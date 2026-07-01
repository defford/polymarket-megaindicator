import type { AppConfig, PredictionHorizon } from "../types/analysis.js";
import { DEFAULT_HORIZON_WEIGHTS } from "./defaultWeights.js";

export type StrategyPresetId = "balanced" | "scalp_5m" | "trend_1h" | "high_conviction";

export interface HorizonTuning {
  oscillatorEmphasis: number;
  conflictSensitivity: number;
  confluenceBonus: number;
}

export interface ConfigSettings {
  preset: StrategyPresetId;
  predictions: {
    noEdgeThreshold: number;
    highConfidenceThreshold: number;
    mediumConfidenceThreshold: number;
    horizonTuning: Record<PredictionHorizon, HorizonTuning>;
  };
  agreementRules: Record<string, boolean>;
  refresh: {
    dashboardPollSeconds: number;
  };
}

export interface PresetMeta {
  id: StrategyPresetId;
  name: string;
  description: string;
  bestFor: string;
}

export const PRESET_META: PresetMeta[] = [
  {
    id: "balanced",
    name: "Balanced",
    description: "Default mix of oscillators and moving averages across all horizons.",
    bestFor: "General 5m / 15m / 1h Polymarket use",
  },
  {
    id: "scalp_5m",
    name: "Scalp 5m",
    description: "Prioritizes fast oscillators on 5m, stricter entry bar, higher conflict penalties.",
    bestFor: "Quick 5-minute markets where momentum and RSI matter most",
  },
  {
    id: "trend_1h",
    name: "Trend 1h",
    description: "Weights moving averages on 1h, softer short-TF noise filtering.",
    bestFor: "1-hour markets where trend direction dominates",
  },
  {
    id: "high_conviction",
    name: "High Conviction",
    description: "Raises thresholds so only strong, aligned setups surface as actionable.",
    bestFor: "Fewer bets, higher selectivity — skip marginal setups",
  },
];

const PRESET_SETTINGS: Record<StrategyPresetId, Omit<ConfigSettings, "agreementRules">> = {
  balanced: {
    preset: "balanced",
    predictions: {
      noEdgeThreshold: 0.1,
      highConfidenceThreshold: 0.35,
      mediumConfidenceThreshold: 0.15,
      horizonTuning: {
        "5m": { oscillatorEmphasis: 75, conflictSensitivity: 50, confluenceBonus: 0.08 },
        "15m": { oscillatorEmphasis: 58, conflictSensitivity: 45, confluenceBonus: 0.08 },
        "1h": { oscillatorEmphasis: 42, conflictSensitivity: 40, confluenceBonus: 0.08 },
      },
    },
    refresh: { dashboardPollSeconds: 15 },
  },
  scalp_5m: {
    preset: "scalp_5m",
    predictions: {
      noEdgeThreshold: 0.12,
      highConfidenceThreshold: 0.4,
      mediumConfidenceThreshold: 0.2,
      horizonTuning: {
        "5m": { oscillatorEmphasis: 90, conflictSensitivity: 70, confluenceBonus: 0.1 },
        "15m": { oscillatorEmphasis: 65, conflictSensitivity: 55, confluenceBonus: 0.08 },
        "1h": { oscillatorEmphasis: 40, conflictSensitivity: 45, confluenceBonus: 0.06 },
      },
    },
    refresh: { dashboardPollSeconds: 10 },
  },
  trend_1h: {
    preset: "trend_1h",
    predictions: {
      noEdgeThreshold: 0.08,
      highConfidenceThreshold: 0.32,
      mediumConfidenceThreshold: 0.14,
      horizonTuning: {
        "5m": { oscillatorEmphasis: 60, conflictSensitivity: 40, confluenceBonus: 0.06 },
        "15m": { oscillatorEmphasis: 50, conflictSensitivity: 38, confluenceBonus: 0.08 },
        "1h": { oscillatorEmphasis: 25, conflictSensitivity: 35, confluenceBonus: 0.1 },
      },
    },
    refresh: { dashboardPollSeconds: 20 },
  },
  high_conviction: {
    preset: "high_conviction",
    predictions: {
      noEdgeThreshold: 0.15,
      highConfidenceThreshold: 0.45,
      mediumConfidenceThreshold: 0.25,
      horizonTuning: {
        "5m": { oscillatorEmphasis: 70, conflictSensitivity: 80, confluenceBonus: 0.1 },
        "15m": { oscillatorEmphasis: 58, conflictSensitivity: 75, confluenceBonus: 0.1 },
        "1h": { oscillatorEmphasis: 45, conflictSensitivity: 70, confluenceBonus: 0.1 },
      },
    },
    refresh: { dashboardPollSeconds: 15 },
  },
};

function emphasisToWeights(emphasis: number): { oscWeight: number; maWeight: number } {
  const t = Math.max(0, Math.min(100, emphasis)) / 100;
  const oscWeight = 0.1 + t * 0.45;
  const maWeight = 0.1 + (1 - t) * 0.35;
  return { oscWeight, maWeight };
}

function sensitivityToPenalty(sensitivity: number, horizon: PredictionHorizon): number {
  const base = DEFAULT_HORIZON_WEIGHTS[horizon].conflictPenalty;
  const t = Math.max(0, Math.min(100, sensitivity)) / 100;
  return Math.round((base * (0.6 + t * 0.8)) * 1000) / 1000;
}

export function settingsToAppConfigPatch(settings: ConfigSettings): Pick<AppConfig, "predictions" | "refresh" | "agreementRules"> {
  const horizons: PredictionHorizon[] = ["5m", "15m", "1h"];
  const weights: AppConfig["predictions"]["weights"] = {};

  for (const h of horizons) {
    const tuning = settings.predictions.horizonTuning[h];
    const { oscWeight, maWeight } = emphasisToWeights(tuning.oscillatorEmphasis);
    const defaults = DEFAULT_HORIZON_WEIGHTS[h];
    weights[h] = {
      ...defaults,
      oscWeight,
      maWeight,
      conflictPenalty: sensitivityToPenalty(tuning.conflictSensitivity, h),
      confluenceBonus: tuning.confluenceBonus,
    };
  }

  return {
    predictions: {
      horizons,
      noEdgeThreshold: settings.predictions.noEdgeThreshold,
      highConfidenceThreshold: settings.predictions.highConfidenceThreshold,
      mediumConfidenceThreshold: settings.predictions.mediumConfidenceThreshold,
      weights,
    },
    refresh: {
      dashboardPollSeconds: settings.refresh.dashboardPollSeconds,
    } as AppConfig["refresh"],
    agreementRules: [] as AppConfig["agreementRules"],
  };
}

export function appConfigToSettings(config: AppConfig): ConfigSettings {
  const preset = detectPreset(config);
  const horizons: PredictionHorizon[] = ["5m", "15m", "1h"];
  const horizonTuning = {} as Record<PredictionHorizon, HorizonTuning>;

  for (const h of horizons) {
    const w = { ...DEFAULT_HORIZON_WEIGHTS[h], ...config.predictions.weights[h] };
    const emphasis = Math.round(((w.oscWeight - 0.1) / 0.45) * 100);
    const basePenalty = DEFAULT_HORIZON_WEIGHTS[h].conflictPenalty;
    const sensitivity = Math.round(((w.conflictPenalty / basePenalty - 0.6) / 0.8) * 100);
    horizonTuning[h] = {
      oscillatorEmphasis: Math.max(0, Math.min(100, emphasis)),
      conflictSensitivity: Math.max(0, Math.min(100, sensitivity)),
      confluenceBonus: w.confluenceBonus,
    };
  }

  const agreementRules: Record<string, boolean> = {};
  for (const rule of config.agreementRules) {
    agreementRules[rule.id] = rule.enabled;
  }

  return {
    preset,
    predictions: {
      noEdgeThreshold: config.predictions.noEdgeThreshold,
      highConfidenceThreshold: config.predictions.highConfidenceThreshold,
      mediumConfidenceThreshold: config.predictions.mediumConfidenceThreshold,
      horizonTuning,
    },
    agreementRules,
    refresh: {
      dashboardPollSeconds: config.refresh.dashboardPollSeconds,
    },
  };
}

function detectPreset(config: AppConfig): StrategyPresetId {
  const current = {
    noEdge: config.predictions.noEdgeThreshold,
    high: config.predictions.highConfidenceThreshold,
    medium: config.predictions.mediumConfidenceThreshold,
  };

  for (const id of ["scalp_5m", "trend_1h", "high_conviction", "balanced"] as StrategyPresetId[]) {
    const p = PRESET_SETTINGS[id].predictions;
    if (
      Math.abs(current.noEdge - p.noEdgeThreshold) < 0.005 &&
      Math.abs(current.high - p.highConfidenceThreshold) < 0.005 &&
      Math.abs(current.medium - p.mediumConfidenceThreshold) < 0.005
    ) {
      return id;
    }
  }
  return "balanced";
}

export function getPresetSettings(id: StrategyPresetId, currentRules: Record<string, boolean>): ConfigSettings {
  const base = PRESET_SETTINGS[id];
  const agreementRules: Record<string, boolean> = {};

  for (const ruleId of Object.keys(currentRules)) {
    agreementRules[ruleId] = false;
  }

  const enable = (ids: string[]) => {
    for (const rid of ids) {
      if (rid in agreementRules) agreementRules[rid] = true;
    }
  };

  if (id === "scalp_5m") enable(["5m_confluence_bull", "5m_confluence_bear"]);
  else if (id === "trend_1h") enable(["1h_confluence_bull", "1h_confluence_bear"]);
  else if (id === "high_conviction") {
    enable([
      "5m_confluence_bull", "5m_confluence_bear",
      "15m_confluence_bull", "15m_confluence_bear",
      "1h_confluence_bull", "1h_confluence_bear",
    ]);
  } else {
    enable([
      "5m_confluence_bull", "5m_confluence_bear",
      "15m_confluence_bull", "15m_confluence_bear",
    ]);
  }

  return {
    ...base,
    agreementRules,
  };
}

export function mergeSettingsIntoConfig(config: AppConfig, settings: ConfigSettings): AppConfig {
  const patch = settingsToAppConfigPatch(settings);
  const agreementRules = config.agreementRules.map((rule) => ({
    ...rule,
    enabled: settings.agreementRules[rule.id] ?? rule.enabled,
  }));

  return {
    ...config,
    predictions: patch.predictions,
    refresh: {
      ...config.refresh,
      dashboardPollSeconds: settings.refresh.dashboardPollSeconds,
    },
    agreementRules,
  };
}
