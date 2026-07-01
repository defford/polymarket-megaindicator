import type { HorizonWeights, PredictionHorizon } from "../types/analysis.js";

export const DEFAULT_HORIZON_WEIGHTS: Record<PredictionHorizon, HorizonWeights> = {
  "5m": {
    anchor: "5m",
    leading: ["1m", "15m"],
    higherTf: ["30m", "1h"],
    anchorSummaryWeight: 0.35,
    oscWeight: 0.45,
    maWeight: 0.15,
    leadingWeight: 0.2,
    conflictPenalty: 0.15,
    confluenceBonus: 0.08,
  },
  "15m": {
    anchor: "15m",
    leading: ["5m", "30m"],
    higherTf: ["1h", "4h"],
    anchorSummaryWeight: 0.35,
    oscWeight: 0.35,
    maWeight: 0.25,
    leadingWeight: 0.2,
    conflictPenalty: 0.12,
    confluenceBonus: 0.08,
  },
  "1h": {
    anchor: "1h",
    leading: ["15m", "30m"],
    higherTf: ["4h", "1d"],
    anchorSummaryWeight: 0.35,
    oscWeight: 0.25,
    maWeight: 0.35,
    leadingWeight: 0.2,
    conflictPenalty: 0.1,
    confluenceBonus: 0.08,
  },
};

export function resolveHorizonWeights(
  horizon: PredictionHorizon,
  overrides?: Partial<HorizonWeights>
): HorizonWeights {
  return { ...DEFAULT_HORIZON_WEIGHTS[horizon], ...overrides };
}
