import type { AppConfig, Snapshot, Timeframe, TimeframeAnalysis } from "../types/analysis.js";
import type { ConfigManager } from "../config/loadConfig.js";
import { getCacheTtl } from "../config/loadConfig.js";
import { buildSnapshot } from "./agreementEngine.js";
import { RateLimitError, sleep, TradingViewClient } from "./tradingViewClient.js";

export class DataService {
  private client: TradingViewClient;
  private cache = new Map<Timeframe, TimeframeAnalysis>();
  private lastRefreshAt: string | null = null;
  private lastFullRefreshAt = 0;
  private lastManualRefreshAt = 0;
  private refreshing = false;
  private stale = false;
  private refreshPromise: Promise<void> | null = null;

  constructor(private configManager: ConfigManager) {
    const config = configManager.getConfig();
    this.client = new TradingViewClient(
      config.symbol.screener,
      config.symbol.exchange,
      config.symbol.ticker
    );
  }

  private get config(): AppConfig {
    return this.configManager.getConfig();
  }

  getCachedAnalyses(): TimeframeAnalysis[] {
    return this.config.timeframes
      .map((tf) => this.cache.get(tf))
      .filter((a): a is TimeframeAnalysis => a != null);
  }

  getSnapshot(configOverride?: AppConfig): Snapshot {
    const cfg = configOverride ?? this.config;
    return buildSnapshot(cfg, this.getCachedAnalyses(), {
      lastRefreshAt: this.lastRefreshAt,
      stale: this.stale,
      refreshing: this.refreshing,
    });
  }

  private getFetchOrder(priorityOnly: boolean): Timeframe[] {
    const priority = this.config.refresh.priorityTimeframes ?? [];
    if (priorityOnly) {
      return priority.filter((tf) => this.config.timeframes.includes(tf));
    }
    const rest = this.config.timeframes.filter((tf) => !priority.includes(tf));
    return [...priority.filter((tf) => this.config.timeframes.includes(tf)), ...rest];
  }

  isCacheExpired(timeframe: Timeframe): boolean {
    const cached = this.cache.get(timeframe);
    if (!cached) return true;
    const ttl = getCacheTtl(this.config, timeframe) * 1000;
    return Date.now() - new Date(cached.fetchedAt).getTime() > ttl;
  }

  needsRefresh(priorityOnly = false): boolean {
    const order = this.getFetchOrder(priorityOnly);
    return order.some((tf) => this.isCacheExpired(tf));
  }

  canManualRefresh(): boolean {
    const cooldown = this.config.refresh.manualRefreshCooldownSeconds * 1000;
    return Date.now() - this.lastManualRefreshAt >= cooldown;
  }

  shouldUsePriorityRefresh(): boolean {
    const twoMinutes = 2 * 60 * 1000;
    return Date.now() - this.lastFullRefreshAt < twoMinutes;
  }

  async refresh(force = false, priorityOnly = false): Promise<Snapshot> {
    if (this.refreshing && this.refreshPromise) {
      await this.refreshPromise;
      return this.getSnapshot();
    }

    const effectivePriorityOnly = priorityOnly || (force && this.shouldUsePriorityRefresh());

    if (!force && !this.needsRefresh(effectivePriorityOnly)) {
      return this.getSnapshot();
    }

    if (force && !this.canManualRefresh()) {
      const err = new Error("Manual refresh cooldown active") as Error & { statusCode: number };
      err.statusCode = 429;
      throw err;
    }

    this.refreshPromise = this.doRefresh(force, effectivePriorityOnly);
    await this.refreshPromise;
    this.refreshPromise = null;
    return this.getSnapshot();
  }

  private async doRefresh(force: boolean, priorityOnly: boolean): Promise<void> {
    this.refreshing = true;
    if (force) {
      this.lastManualRefreshAt = Date.now();
    }

    let hadRateLimit = false;
    const fetchOrder = this.getFetchOrder(priorityOnly);

    try {
      for (const timeframe of fetchOrder) {
        if (!force && !this.isCacheExpired(timeframe)) {
          continue;
        }

        let attempts = 0;
        while (attempts < 3) {
          try {
            const result = await this.client.fetchTimeframe(timeframe);
            if (result) {
              this.cache.set(timeframe, result);
            }
            break;
          } catch (err) {
            if (err instanceof RateLimitError) {
              hadRateLimit = true;
              attempts++;
              await sleep(2000 * attempts);
              continue;
            }
            throw err;
          }
        }

        await sleep(this.config.refresh.requestDelayMs);
      }

      this.lastRefreshAt = new Date().toISOString();
      if (!priorityOnly) {
        this.lastFullRefreshAt = Date.now();
      }
      this.stale = hadRateLimit;
    } catch {
      this.stale = true;
      throw new Error("Failed to refresh data from TradingView");
    } finally {
      this.refreshing = false;
    }
  }

  startBackgroundRefresh(): void {
    const intervalMs = this.config.refresh.backgroundRefreshSeconds * 1000;
    setInterval(() => {
      if (!this.refreshing && this.needsRefresh(false)) {
        this.refresh().catch(() => {
          this.stale = true;
        });
      }
    }, intervalMs);
  }
}
