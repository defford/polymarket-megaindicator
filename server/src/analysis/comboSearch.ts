import { readFileSync } from "node:fs";
import type { PredictionDirection, PredictionHorizon, Timeframe } from "../types/analysis.js";
import type { IndicatorSnapshotStoreData, SimpleAction, WindowIndicatorSnapshot } from "../types/indicatorSnapshots.js";
import type { PolymarketOutcome, PolymarketStoreData } from "../types/polymarket.js";
import { ALL_INDICATOR_IDS } from "../services/technicals.js";
import { GAUGE_IDS } from "../services/polymarket/buildIndicatorSnapshot.js";

export const DEFAULT_HORIZON_TIMEFRAMES: Record<PredictionHorizon, Timeframe[]> = {
  "5m": ["1m", "5m", "15m"],
  "15m": ["5m", "15m", "30m"],
  "1h": ["15m", "30m", "1h"],
};

export interface SignalRef {
  timeframe: Timeframe;
  indicatorId: string;
  key: string;
}

export interface ScoredWindow {
  slug: string;
  horizon: PredictionHorizon;
  outcome: PolymarketOutcome;
  snapshot: WindowIndicatorSnapshot;
}

export interface ComboResult {
  combo: SignalRef[];
  comboKey: string;
  windows: number;
  directional: number;
  correct: number;
  wrong: number;
  noEdge: number;
  accuracy: number | null;
  coverage: number;
}

export interface ComboSearchOptions {
  horizon?: PredictionHorizon | "all";
  maxSize?: number;
  minSamples?: number;
  top?: number;
  timeframes?: Timeframe[];
}

export interface ComboSearchSummary {
  resolvedWindows: number;
  snapshotsMatched: number;
  candidateSignals: number;
  combosEvaluated: number;
  results: ComboResult[];
}

function parseSignalKey(key: string): SignalRef | null {
  const separator = key.indexOf(":");
  if (separator <= 0) return null;
  return {
    timeframe: key.slice(0, separator) as Timeframe,
    indicatorId: key.slice(separator + 1),
    key,
  };
}

export function toSignalKey(timeframe: Timeframe, indicatorId: string): string {
  return `${timeframe}:${indicatorId}`;
}

export function actionToDirection(action: SimpleAction | undefined): PredictionDirection {
  if (action === "BUY") return "HIGHER";
  if (action === "SELL") return "LOWER";
  return "NO_EDGE";
}

export function majorityVote(actions: SimpleAction[]): PredictionDirection {
  let buy = 0;
  let sell = 0;

  for (const action of actions) {
    if (action === "BUY") buy++;
    else if (action === "SELL") sell++;
  }

  if (buy > sell) return "HIGHER";
  if (sell > buy) return "LOWER";
  return "NO_EDGE";
}

export function outcomeMatches(direction: PredictionDirection, outcome: PolymarketOutcome): boolean | null {
  if (direction === "NO_EDGE") return null;
  if (direction === "HIGHER") return outcome === "Up";
  return outcome === "Down";
}

export function loadScoredWindows(
  windowsPath: string,
  snapshotsPath: string,
  horizon: PredictionHorizon | "all" = "all"
): ScoredWindow[] {
  const windowsData = JSON.parse(readFileSync(windowsPath, "utf8")) as PolymarketStoreData;
  const snapshotsData = JSON.parse(readFileSync(snapshotsPath, "utf8")) as IndicatorSnapshotStoreData;
  const snapshotBySlug = new Map(snapshotsData.snapshots.map((row) => [row.slug, row]));

  const horizons: PredictionHorizon[] = horizon === "all" ? ["5m", "15m", "1h"] : [horizon];
  const scored: ScoredWindow[] = [];

  for (const h of horizons) {
    for (const row of windowsData.windows[h]) {
      if (!row.resolved || !row.outcome) continue;
      const snapshot = snapshotBySlug.get(row.slug);
      if (!snapshot) continue;
      scored.push({
        slug: row.slug,
        horizon: row.horizon,
        outcome: row.outcome,
        snapshot,
      });
    }
  }

  return scored;
}

function collectCandidateSignals(
  windows: ScoredWindow[],
  timeframes: Timeframe[]
): SignalRef[] {
  const seen = new Set<string>();
  const refs: SignalRef[] = [];
  const indicatorIds = [...ALL_INDICATOR_IDS, ...GAUGE_IDS];

  for (const window of windows) {
    for (const timeframe of timeframes) {
      const tfSnapshot = window.snapshot.timeframes[timeframe];
      if (!tfSnapshot) continue;

      for (const indicatorId of indicatorIds) {
        if (tfSnapshot.signals[indicatorId] == null) continue;
        const key = toSignalKey(timeframe, indicatorId);
        if (seen.has(key)) continue;
        seen.add(key);
        refs.push({ timeframe, indicatorId, key });
      }
    }
  }

  return refs.sort((a, b) => a.key.localeCompare(b.key));
}

function getSignalAction(snapshot: WindowIndicatorSnapshot, ref: SignalRef): SimpleAction | undefined {
  return snapshot.timeframes[ref.timeframe]?.signals[ref.indicatorId];
}

export function evaluateCombo(windows: ScoredWindow[], combo: SignalRef[]): ComboResult {
  let correct = 0;
  let wrong = 0;
  let noEdge = 0;

  for (const window of windows) {
    const actions = combo
      .map((ref) => getSignalAction(window.snapshot, ref))
      .filter((action): action is SimpleAction => action != null);

    if (actions.length === 0) {
      noEdge++;
      continue;
    }

    const direction = majorityVote(actions);
    const match = outcomeMatches(direction, window.outcome);
    if (match == null) {
      noEdge++;
    } else if (match) {
      correct++;
    } else {
      wrong++;
    }
  }

  const directional = correct + wrong;
  const comboKey = combo.map((ref) => ref.key).join(" + ");

  return {
    combo,
    comboKey,
    windows: windows.length,
    directional,
    correct,
    wrong,
    noEdge,
    accuracy: directional > 0 ? correct / directional : null,
    coverage: windows.length > 0 ? directional / windows.length : 0,
  };
}

function* combinations<T>(items: T[], size: number): Generator<T[]> {
  if (size <= 0 || size > items.length) return;

  function* pick(start: number, chosen: T[]): Generator<T[]> {
    if (chosen.length === size) {
      yield chosen.slice();
      return;
    }

    for (let i = start; i <= items.length - (size - chosen.length); i++) {
      yield* pick(i + 1, [...chosen, items[i]]);
    }
  }

  yield* pick(0, []);
}

function compareResults(a: ComboResult, b: ComboResult): number {
  const accuracyA = a.accuracy ?? -1;
  const accuracyB = b.accuracy ?? -1;
  if (accuracyB !== accuracyA) return accuracyB - accuracyA;
  if (b.directional !== a.directional) return b.directional - a.directional;
  return a.combo.length - b.combo.length;
}

export function searchIndicatorCombos(
  windows: ScoredWindow[],
  options: ComboSearchOptions = {}
): ComboSearchSummary {
  const maxSize = options.maxSize ?? 2;
  const minSamples = options.minSamples ?? 5;
  const top = options.top ?? 25;
  const horizon = options.horizon ?? "all";
  const filteredWindows =
    horizon === "all" ? windows : windows.filter((row) => row.horizon === horizon);

  const timeframes =
    options.timeframes ??
  (horizon === "all"
    ? (["1m", "5m", "15m", "30m", "1h"] as Timeframe[])
    : DEFAULT_HORIZON_TIMEFRAMES[horizon]);

  const candidates = collectCandidateSignals(filteredWindows, timeframes);
  const results: ComboResult[] = [];
  let combosEvaluated = 0;

  for (let size = 1; size <= maxSize; size++) {
    for (const combo of combinations(candidates, size)) {
      combosEvaluated++;
      const result = evaluateCombo(filteredWindows, combo);
      if (result.directional >= minSamples) {
        results.push(result);
      }
    }
  }

  results.sort(compareResults);

  return {
    resolvedWindows: filteredWindows.length,
    snapshotsMatched: filteredWindows.length,
    candidateSignals: candidates.length,
    combosEvaluated,
    results: results.slice(0, top),
  };
}

export function parseTimeframeList(value: string | undefined): Timeframe[] | undefined {
  if (!value) return undefined;
  return value.split(",").map((part) => part.trim()) as Timeframe[];
}

export function parseSignalKeys(value: string | undefined): SignalRef[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => parseSignalKey(part.trim()))
    .filter((ref): ref is SignalRef => ref != null);
}
