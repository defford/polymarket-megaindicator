import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ConfigManager } from "../../config/loadConfig.js";
import { HYPOTHESIS_PROFILE_IDS } from "../../config/hypothesisProfiles.js";
import type { DataService } from "../dataService.js";
import { computeAllProfilePredictions } from "../profileEngine.js";
import { sleep } from "../tradingViewClient.js";
import type {
  HypothesisProfileId,
  PolymarketConfig,
  PredictionDirection,
  PredictionHorizon,
} from "../../types/analysis.js";
import type {
  PolymarketMarket,
  PolymarketOutcome,
  PolymarketResultsResponse,
  PolymarketWindowResult,
  PriceSource,
  ProfileWindowSignal,
} from "../../types/polymarket.js";
import { PolymarketClient } from "./polymarketClient.js";
import { PriceTracker } from "./priceTracker.js";
import {
  buildRecentSlugs,
  buildSlug,
  getWindowEndTs,
  getWindowStartTs,
  inferPriceSource,
} from "./slugUtils.js";
import { buildWindowIndicatorSnapshot } from "./buildIndicatorSnapshot.js";
import { IndicatorSnapshotStore } from "./indicatorSnapshotStore.js";
import { WindowHistoryStore } from "./windowHistoryStore.js";

const HORIZONS: PredictionHorizon[] = ["5m", "15m", "1h"];
const DEFAULT_POLYMARKET: PolymarketConfig = {
  enabled: true,
  historyLimit: 50,
  historyPath: "data/polymarket-windows.json",
  syncIntervalSeconds: 30,
  indicatorSnapshotsPath: "data/indicator-snapshots.json",
  indicatorSnapshotLimit: 500,
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "../../../..");

type ProfileDirections = Partial<Record<HypothesisProfileId, PredictionDirection>>;

function resolveHistoryPath(configPath: string): string {
  if (configPath.startsWith("/")) {
    return configPath;
  }
  return join(PROJECT_ROOT, configPath);
}

function computeSignalCorrect(
  outcome: PolymarketOutcome | null,
  signalDirection: PredictionDirection | null
): boolean | null {
  if (!outcome || !signalDirection || signalDirection === "NO_EDGE") {
    return null;
  }
  if (signalDirection === "HIGHER") return outcome === "Up";
  if (signalDirection === "LOWER") return outcome === "Down";
  return null;
}

function buildProfileSignals(
  directions: ProfileDirections,
  outcome: PolymarketOutcome | null,
  resolved: boolean
): Partial<Record<HypothesisProfileId, ProfileWindowSignal>> {
  const profileSignals: Partial<Record<HypothesisProfileId, ProfileWindowSignal>> = {};

  for (const profileId of HYPOTHESIS_PROFILE_IDS) {
    const direction = directions[profileId];
    if (!direction) continue;
    profileSignals[profileId] = {
      direction,
      signalCorrect: resolved ? computeSignalCorrect(outcome, direction) : null,
    };
  }

  return profileSignals;
}


function legacyFromProfileSignals(
  profileSignals: Partial<Record<HypothesisProfileId, ProfileWindowSignal>> | undefined
): { signalDirection: PredictionDirection | null; signalCorrect: boolean | null } {
  const balanced = profileSignals?.balanced;
  return {
    signalDirection: balanced?.direction ?? null,
    signalCorrect: balanced?.signalCorrect ?? null,
  };
}

function toResult(
  market: PolymarketMarket,
  startPrice: number | null,
  stopPrice: number | null,
  priceSource: PriceSource | null,
  profileDirections: ProfileDirections = {}
): PolymarketWindowResult {
  const profileSignals = buildProfileSignals(profileDirections, market.outcome, market.resolved);
  const legacy = legacyFromProfileSignals(profileSignals);

  return {
    horizon: market.horizon,
    slug: market.slug,
    marketId: market.marketId,
    conditionId: market.conditionId,
    title: market.title,
    windowStart: market.windowStart,
    windowEnd: market.windowEnd,
    startPrice,
    stopPrice,
    priceSource,
    outcome: market.outcome,
    resolved: market.resolved,
    resolutionSource: market.resolutionSource,
    polymarketUrl: market.polymarketUrl,
    profileSignals,
    signalDirection: legacy.signalDirection,
    signalCorrect: legacy.signalCorrect,
  };
}

function profileDirectionsFromSignals(
  profileSignals: Partial<Record<HypothesisProfileId, ProfileWindowSignal>> | undefined
): ProfileDirections {
  if (!profileSignals) return {};
  const directions: ProfileDirections = {};
  for (const profileId of HYPOTHESIS_PROFILE_IDS) {
    const signal = profileSignals[profileId];
    if (signal?.direction) directions[profileId] = signal.direction;
  }
  return directions;
}

function legacyDirectionToProfiles(
  signalDirection: PredictionDirection | null | undefined
): ProfileDirections {
  if (!signalDirection) return {};
  return { balanced: signalDirection };
}

export class WindowHistoryService {
  private client = new PolymarketClient();
  private priceTracker = new PriceTracker();
  private store: WindowHistoryStore;
  private snapshotStore: IndicatorSnapshotStore;
  private config: PolymarketConfig;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private activeWindows: Partial<Record<PredictionHorizon, PolymarketWindowResult>> = {};
  private capturedProfileSignals = new Map<string, ProfileDirections>();
  private capturedSnapshotSlugs = new Set<string>();
  private started = false;

  constructor(
    private configManager: ConfigManager,
    private dataService: DataService
  ) {
    this.config = this.getPolymarketConfig();
    this.store = new WindowHistoryStore(
      resolveHistoryPath(this.config.historyPath),
      this.config.historyLimit
    );
    this.snapshotStore = new IndicatorSnapshotStore(
      resolveHistoryPath(this.config.indicatorSnapshotsPath),
      this.config.indicatorSnapshotLimit
    );
    this.capturedSnapshotSlugs = this.snapshotStore.getSlugs();
  }

  private getPolymarketConfig(): PolymarketConfig {
    return { ...DEFAULT_POLYMARKET, ...this.configManager.getConfig().polymarket };
  }

  async start(): Promise<void> {
    if (!this.config.enabled || this.started) return;
    this.started = true;

    this.priceTracker.start();
    await this.waitForPrices(5000);
    await this.backfill();
    await this.syncActiveWindows();

    this.syncTimer = setInterval(() => {
      this.syncActiveWindows().catch((err) => {
        console.warn("Polymarket sync failed:", (err as Error).message);
      });
    }, this.config.syncIntervalSeconds * 1000);
  }

  stop(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    this.priceTracker.stop();
    this.started = false;
  }

  getResults(horizon?: PredictionHorizon): PolymarketResultsResponse {
    const windows = this.store.getWindows(horizon);
    const activeWindows = { ...this.activeWindows };

    if (horizon) {
      const filteredActive: Partial<Record<PredictionHorizon, PolymarketWindowResult>> = {};
      if (activeWindows[horizon]) {
        filteredActive[horizon] = activeWindows[horizon];
      }
      return {
        windows,
        activeWindows: filteredActive,
        updatedAt: this.store.getUpdatedAt(),
      };
    }

    return {
      windows,
      activeWindows,
      updatedAt: this.store.getUpdatedAt(),
    };
  }

  private maybeCaptureIndicatorSnapshot(
    slug: string,
    horizon: PredictionHorizon,
    windowStart: string,
    windowEnd: string
  ): void {
    if (this.capturedSnapshotSlugs.has(slug) || this.snapshotStore.has(slug)) {
      this.capturedSnapshotSlugs.add(slug);
      return;
    }

    const analyses = this.dataService.getCachedAnalyses();
    if (analyses.length === 0) return;

    const snapshot = buildWindowIndicatorSnapshot(
      slug,
      horizon,
      windowStart,
      windowEnd,
      analyses
    );
    this.snapshotStore.upsert(snapshot);
    this.capturedSnapshotSlugs.add(slug);
  }

  private captureAllProfileDirections(horizon: PredictionHorizon): ProfileDirections {
    const analyses = this.dataService.getCachedAnalyses();
    const baseConfig = this.configManager.getConfig();
    const allPredictions = computeAllProfilePredictions(analyses, baseConfig);
    const directions: ProfileDirections = {};

    for (const profileId of HYPOTHESIS_PROFILE_IDS) {
      const prediction = allPredictions[profileId]?.find((p) => p.horizon === horizon);
      if (prediction?.direction) {
        directions[profileId] = prediction.direction;
      }
    }

    return directions;
  }

  private resolveProfileDirections(
    slug: string,
    horizon: PredictionHorizon,
    existing: Partial<Record<HypothesisProfileId, ProfileWindowSignal>> | undefined,
    legacySignal: PredictionDirection | null | undefined,
    allowLiveCapture: boolean
  ): ProfileDirections {
    const fromExisting = profileDirectionsFromSignals(existing);
    if (Object.keys(fromExisting).length > 0) {
      this.capturedProfileSignals.set(slug, fromExisting);
      return fromExisting;
    }

    const cached = this.capturedProfileSignals.get(slug);
    if (cached && Object.keys(cached).length > 0) return cached;

    const fromLegacy = legacyDirectionToProfiles(legacySignal);
    if (Object.keys(fromLegacy).length > 0) {
      this.capturedProfileSignals.set(slug, fromLegacy);
      return fromLegacy;
    }

    if (allowLiveCapture) {
      const directions = this.captureAllProfileDirections(horizon);
      if (Object.keys(directions).length > 0) {
        this.capturedProfileSignals.set(slug, directions);
        return directions;
      }
    }

    return {};
  }

  private async waitForPrices(timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const chainlink = this.priceTracker.getPriceAt("chainlink", Date.now());
      const binance = this.priceTracker.getPriceAt("binance", Date.now());
      if (chainlink != null || binance != null) return;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  private async backfill(): Promise<void> {
    for (const horizon of HORIZONS) {
      const slugs = buildRecentSlugs(horizon, this.config.historyLimit);
      const entries = slugs.map((slug) => ({ slug, horizon }));
      const markets = await this.client.fetchMarketsForSlugs(entries, 150);

      for (const market of markets) {
        const existing = this.store
          .getWindows(horizon)[horizon]
          .find((row) => row.slug === market.slug);
        const profileDirections = this.resolveProfileDirections(
          market.slug,
          horizon,
          existing?.profileSignals,
          existing?.signalDirection,
          false
        );
        this.store.upsert(this.buildResultFromMarket(market, false, profileDirections));
      }
    }
  }

  private async syncActiveWindows(): Promise<void> {
    const now = Date.now();

    for (const horizon of HORIZONS) {
      const stored = this.store.getWindows(horizon)[horizon];
      const unresolvedPast = stored.filter(
        (row) => !row.resolved && new Date(row.windowEnd).getTime() <= now
      );

      const currentStartTs = getWindowStartTs(horizon, now);
      const currentSlug = buildSlug(horizon, currentStartTs);

      const currentMarket = await this.client.fetchMarketBySlug(currentSlug, horizon);
      if (currentMarket) {
        const existingActive = this.activeWindows[horizon];
        const profileDirections = this.resolveProfileDirections(
          currentSlug,
          horizon,
          existingActive?.slug === currentSlug ? existingActive.profileSignals : undefined,
          existingActive?.slug === currentSlug ? existingActive.signalDirection : null,
          true
        );
        const activeResult = this.buildResultFromMarket(
          currentMarket,
          true,
          profileDirections
        );
        this.activeWindows[horizon] = activeResult;
        this.store.upsert(activeResult);
        this.maybeCaptureIndicatorSnapshot(
          currentSlug,
          horizon,
          currentMarket.windowStart,
          currentMarket.windowEnd
        );
      }

      for (const row of unresolvedPast) {
        const market = await this.client.fetchMarketBySlug(row.slug, horizon);
        if (market) {
          const activeRow = this.activeWindows[horizon];
          const existingSignals =
            row.profileSignals ??
            (activeRow?.slug === row.slug ? activeRow.profileSignals : undefined);
          const profileDirections = this.resolveProfileDirections(
            row.slug,
            horizon,
            existingSignals,
            row.signalDirection ?? activeRow?.signalDirection,
            false
          );
          this.store.upsert(this.buildResultFromMarket(market, false, profileDirections));
        }
        await sleep(150);
      }
    }
  }

  private buildResultFromMarket(
    market: PolymarketMarket,
    isActive = false,
    profileDirections: ProfileDirections = {}
  ): PolymarketWindowResult {
    const priceSource = inferPriceSource(market.resolutionSource);
    const startMs = market.windowStart
      ? new Date(market.windowStart).getTime()
      : getWindowStartTs(market.horizon) * 1000;
    const endMs = market.windowEnd
      ? new Date(market.windowEnd).getTime()
      : getWindowEndTs(market.horizon, Math.floor(startMs / 1000)) * 1000;

    const startPrice = this.priceTracker.getPriceAt(priceSource, startMs);
    const stopPrice = isActive && !market.resolved
      ? null
      : this.priceTracker.getPriceAt(priceSource, endMs);

    return toResult(
      market,
      startPrice,
      stopPrice,
      startPrice != null || stopPrice != null ? priceSource : null,
      profileDirections
    );
  }
}
