import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, stringify } from "yaml";
import type { AppConfig, Timeframe } from "../types/analysis.js";
import { appConfigToSettings, mergeSettingsIntoConfig, type ConfigSettings } from "./configSettings.js";

const DEFAULT_PREDICTIONS = {
  horizons: ["5m", "15m", "1h"] as const,
  noEdgeThreshold: 0.1,
  highConfidenceThreshold: 0.35,
  mediumConfidenceThreshold: 0.15,
  weights: {},
};

const DEFAULT_PRIORITY: Timeframe[] = ["1m", "5m", "15m", "30m", "1h"];

const __dirname = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_CONFIG_PATH = join(__dirname, "../../../config/default.yaml");

const DEFAULT_POLYMARKET = {
  enabled: true,
  historyLimit: 50,
  historyPath: "data/polymarket-windows.json",
  syncIntervalSeconds: 30,
  indicatorSnapshotsPath: "data/indicator-snapshots.json",
  indicatorSnapshotLimit: 500,
};

export function normalizeConfig(config: AppConfig): AppConfig {
  config.predictions = { ...DEFAULT_PREDICTIONS, ...config.predictions };
  config.polymarket = { ...DEFAULT_POLYMARKET, ...config.polymarket };
  if (!config.refresh.priorityTimeframes?.length) {
    config.refresh.priorityTimeframes = DEFAULT_PRIORITY;
  }
  return config;
}

export function loadConfig(configPath = DEFAULT_CONFIG_PATH): AppConfig {
  const raw = readFileSync(configPath, "utf8");
  const config = normalizeConfig(parse(raw) as AppConfig);

  if (!config.symbol?.screener || !config.symbol?.exchange || !config.symbol?.ticker) {
    throw new Error("Invalid config: symbol section is required");
  }

  if (!config.timeframes?.length) {
    throw new Error("Invalid config: at least one timeframe is required");
  }

  return config;
}

export function getCacheTtl(config: AppConfig, timeframe: Timeframe): number {
  return config.refresh.cacheTtlSeconds?.[timeframe] ?? 300;
}

export class ConfigManager {
  constructor(
    private configPath: string,
    private config: AppConfig
  ) {}

  static create(configPath = DEFAULT_CONFIG_PATH): ConfigManager {
    return new ConfigManager(configPath, loadConfig(configPath));
  }

  getConfig(): AppConfig {
    return this.config;
  }

  getSettings(): ConfigSettings {
    return appConfigToSettings(this.config);
  }

  applySettings(settings: ConfigSettings): AppConfig {
    this.config = mergeSettingsIntoConfig(this.config, settings);
    return this.config;
  }

  updateConfig(updater: (current: AppConfig) => AppConfig): AppConfig {
    this.config = normalizeConfig(updater(this.config));
    return this.config;
  }

  save(): void {
    const doc = {
      symbol: this.config.symbol,
      timeframes: this.config.timeframes,
      predictions: this.config.predictions,
      refresh: this.config.refresh,
      agreementRules: this.config.agreementRules,
      polymarket: this.config.polymarket,
    };
    writeFileSync(this.configPath, stringify(doc, { lineWidth: 0 }));
  }

  reload(): AppConfig {
    this.config = loadConfig(this.configPath);
    return this.config;
  }
}
