import type { HorizonWeights, PredictionHorizon } from "../types/analysis.js";
import type { ConfigSettings } from "./configSettings.js";

export type HypothesisProfileId =
  | "balanced"
  | "oscillator_momentum"
  | "trend_rider"
  | "higher_tf_gate"
  | "leading_echo"
  | "confluence_stack"
  | "scalp_snap"
  | "swing_hourly"
  | "high_conviction"
  | "conflict_sensitive"
  | "gauge_consensus"
  | "mean_reversion";

export type ProfileStrategy =
  | "standard"
  | "mean_reversion"
  | "gauge_consensus"
  | "higher_tf_gate";

export interface HypothesisProfile {
  id: HypothesisProfileId;
  name: string;
  hypothesis: string;
  description: string;
  bestHorizon: PredictionHorizon;
  settings: Omit<ConfigSettings, "agreementRules">;
  strategy?: ProfileStrategy;
  weightOverrides?: Partial<Record<PredictionHorizon, Partial<HorizonWeights>>>;
}

const BASE_REFRESH = { dashboardPollSeconds: 15 };

export const HYPOTHESIS_PROFILES: HypothesisProfile[] = [
  {
    id: "balanced",
    name: "Balanced",
    hypothesis: "Mixed TA works on short horizons",
    description: "Default mix of oscillators and moving averages across all horizons.",
    bestHorizon: "15m",
    settings: {
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
      refresh: BASE_REFRESH,
    },
  },
  {
    id: "oscillator_momentum",
    name: "Oscillator Momentum",
    hypothesis: "Momentum oscillators lead price on 5m/15m",
    description: "Heavy oscillator weight with moderate entry threshold.",
    bestHorizon: "5m",
    settings: {
      preset: "balanced",
      predictions: {
        noEdgeThreshold: 0.09,
        highConfidenceThreshold: 0.34,
        mediumConfidenceThreshold: 0.14,
        horizonTuning: {
          "5m": { oscillatorEmphasis: 95, conflictSensitivity: 45, confluenceBonus: 0.06 },
          "15m": { oscillatorEmphasis: 88, conflictSensitivity: 42, confluenceBonus: 0.07 },
          "1h": { oscillatorEmphasis: 70, conflictSensitivity: 38, confluenceBonus: 0.06 },
        },
      },
      refresh: BASE_REFRESH,
    },
  },
  {
    id: "trend_rider",
    name: "Trend Rider",
    hypothesis: "MA alignment predicts continuation",
    description: "Low oscillator emphasis, high moving-average weight on anchor TF.",
    bestHorizon: "1h",
    settings: {
      preset: "balanced",
      predictions: {
        noEdgeThreshold: 0.08,
        highConfidenceThreshold: 0.32,
        mediumConfidenceThreshold: 0.14,
        horizonTuning: {
          "5m": { oscillatorEmphasis: 35, conflictSensitivity: 40, confluenceBonus: 0.07 },
          "15m": { oscillatorEmphasis: 28, conflictSensitivity: 38, confluenceBonus: 0.08 },
          "1h": { oscillatorEmphasis: 15, conflictSensitivity: 35, confluenceBonus: 0.09 },
        },
      },
      refresh: BASE_REFRESH,
    },
  },
  {
    id: "higher_tf_gate",
    name: "Higher TF Gate",
    hypothesis: "Only trade when higher TF agrees",
    description: "Strong conflict penalty plus post-filter when HTF bias opposes direction.",
    bestHorizon: "15m",
    strategy: "higher_tf_gate",
    settings: {
      preset: "balanced",
      predictions: {
        noEdgeThreshold: 0.1,
        highConfidenceThreshold: 0.36,
        mediumConfidenceThreshold: 0.16,
        horizonTuning: {
          "5m": { oscillatorEmphasis: 60, conflictSensitivity: 85, confluenceBonus: 0.06 },
          "15m": { oscillatorEmphasis: 55, conflictSensitivity: 82, confluenceBonus: 0.07 },
          "1h": { oscillatorEmphasis: 45, conflictSensitivity: 78, confluenceBonus: 0.08 },
        },
      },
      refresh: BASE_REFRESH,
    },
  },
  {
    id: "leading_echo",
    name: "Leading Echo",
    hypothesis: "Leading TFs front-run the anchor",
    description: "Boosts leading timeframe weight and lowers anchor summary contribution.",
    bestHorizon: "5m",
    weightOverrides: {
      "5m": { anchorSummaryWeight: 0.22, leadingWeight: 0.38 },
      "15m": { anchorSummaryWeight: 0.24, leadingWeight: 0.35 },
      "1h": { anchorSummaryWeight: 0.26, leadingWeight: 0.32 },
    },
    settings: {
      preset: "balanced",
      predictions: {
        noEdgeThreshold: 0.09,
        highConfidenceThreshold: 0.33,
        mediumConfidenceThreshold: 0.14,
        horizonTuning: {
          "5m": { oscillatorEmphasis: 65, conflictSensitivity: 42, confluenceBonus: 0.1 },
          "15m": { oscillatorEmphasis: 58, conflictSensitivity: 40, confluenceBonus: 0.1 },
          "1h": { oscillatorEmphasis: 50, conflictSensitivity: 38, confluenceBonus: 0.09 },
        },
      },
      refresh: BASE_REFRESH,
    },
  },
  {
    id: "confluence_stack",
    name: "Confluence Stack",
    hypothesis: "Multi-TF agreement is edge",
    description: "High confluence bonus rewards aligned leading timeframes.",
    bestHorizon: "15m",
    settings: {
      preset: "balanced",
      predictions: {
        noEdgeThreshold: 0.09,
        highConfidenceThreshold: 0.34,
        mediumConfidenceThreshold: 0.15,
        horizonTuning: {
          "5m": { oscillatorEmphasis: 62, conflictSensitivity: 48, confluenceBonus: 0.14 },
          "15m": { oscillatorEmphasis: 58, conflictSensitivity: 45, confluenceBonus: 0.15 },
          "1h": { oscillatorEmphasis: 50, conflictSensitivity: 42, confluenceBonus: 0.14 },
        },
      },
      refresh: BASE_REFRESH,
    },
  },
  {
    id: "scalp_snap",
    name: "Scalp Snap",
    hypothesis: "Fast 5m snap-back moves",
    description: "Scalp-style tuning with tight thresholds on fast oscillators.",
    bestHorizon: "5m",
    settings: {
      preset: "scalp_5m",
      predictions: {
        noEdgeThreshold: 0.12,
        highConfidenceThreshold: 0.4,
        mediumConfidenceThreshold: 0.2,
        horizonTuning: {
          "5m": { oscillatorEmphasis: 92, conflictSensitivity: 68, confluenceBonus: 0.1 },
          "15m": { oscillatorEmphasis: 68, conflictSensitivity: 55, confluenceBonus: 0.08 },
          "1h": { oscillatorEmphasis: 42, conflictSensitivity: 45, confluenceBonus: 0.06 },
        },
      },
      refresh: { dashboardPollSeconds: 10 },
    },
  },
  {
    id: "swing_hourly",
    name: "Swing Hourly",
    hypothesis: "1h trend dominates noise",
    description: "Trend-1h style tuning with softer short-TF oscillator weight.",
    bestHorizon: "1h",
    settings: {
      preset: "trend_1h",
      predictions: {
        noEdgeThreshold: 0.08,
        highConfidenceThreshold: 0.32,
        mediumConfidenceThreshold: 0.14,
        horizonTuning: {
          "5m": { oscillatorEmphasis: 58, conflictSensitivity: 38, confluenceBonus: 0.06 },
          "15m": { oscillatorEmphasis: 48, conflictSensitivity: 36, confluenceBonus: 0.08 },
          "1h": { oscillatorEmphasis: 22, conflictSensitivity: 32, confluenceBonus: 0.11 },
        },
      },
      refresh: { dashboardPollSeconds: 20 },
    },
  },
  {
    id: "high_conviction",
    name: "High Conviction",
    hypothesis: "Skip marginal setups",
    description: "Raises thresholds so only strong, aligned setups surface.",
    bestHorizon: "15m",
    settings: {
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
      refresh: BASE_REFRESH,
    },
  },
  {
    id: "conflict_sensitive",
    name: "Conflict Sensitive",
    hypothesis: "HTF disagreement means no trade",
    description: "Extreme conflict penalty suppresses counter-trend signals.",
    bestHorizon: "15m",
    settings: {
      preset: "balanced",
      predictions: {
        noEdgeThreshold: 0.11,
        highConfidenceThreshold: 0.38,
        mediumConfidenceThreshold: 0.18,
        horizonTuning: {
          "5m": { oscillatorEmphasis: 58, conflictSensitivity: 100, confluenceBonus: 0.06 },
          "15m": { oscillatorEmphasis: 55, conflictSensitivity: 100, confluenceBonus: 0.07 },
          "1h": { oscillatorEmphasis: 50, conflictSensitivity: 95, confluenceBonus: 0.08 },
        },
      },
      refresh: BASE_REFRESH,
    },
  },
  {
    id: "gauge_consensus",
    name: "Gauge Consensus",
    hypothesis: "All 3 gauges must agree",
    description: "Forces NO_EDGE when summary, oscillators, and MAs disagree on anchor TF.",
    bestHorizon: "15m",
    strategy: "gauge_consensus",
    settings: {
      preset: "balanced",
      predictions: {
        noEdgeThreshold: 0.08,
        highConfidenceThreshold: 0.33,
        mediumConfidenceThreshold: 0.14,
        horizonTuning: {
          "5m": { oscillatorEmphasis: 55, conflictSensitivity: 45, confluenceBonus: 0.08 },
          "15m": { oscillatorEmphasis: 55, conflictSensitivity: 45, confluenceBonus: 0.08 },
          "1h": { oscillatorEmphasis: 55, conflictSensitivity: 40, confluenceBonus: 0.08 },
        },
      },
      refresh: BASE_REFRESH,
    },
  },
  {
    id: "mean_reversion",
    name: "Mean Reversion",
    hypothesis: "Fade RSI extremes",
    description: "Nudges composite against overbought/oversold RSI on anchor timeframe.",
    bestHorizon: "5m",
    strategy: "mean_reversion",
    settings: {
      preset: "balanced",
      predictions: {
        noEdgeThreshold: 0.09,
        highConfidenceThreshold: 0.33,
        mediumConfidenceThreshold: 0.14,
        horizonTuning: {
          "5m": { oscillatorEmphasis: 80, conflictSensitivity: 40, confluenceBonus: 0.05 },
          "15m": { oscillatorEmphasis: 72, conflictSensitivity: 38, confluenceBonus: 0.06 },
          "1h": { oscillatorEmphasis: 60, conflictSensitivity: 35, confluenceBonus: 0.06 },
        },
      },
      refresh: BASE_REFRESH,
    },
  },
];

export const HYPOTHESIS_PROFILE_IDS = HYPOTHESIS_PROFILES.map((p) => p.id);

export function getHypothesisProfile(id: HypothesisProfileId): HypothesisProfile {
  const profile = HYPOTHESIS_PROFILES.find((p) => p.id === id);
  if (!profile) throw new Error(`Unknown hypothesis profile: ${id}`);
  return profile;
}

export function getHypothesisProfileMeta() {
  return HYPOTHESIS_PROFILES.map(({ id, name, hypothesis, description, bestHorizon }) => ({
    id,
    name,
    hypothesis,
    description,
    bestHorizon,
  }));
}
