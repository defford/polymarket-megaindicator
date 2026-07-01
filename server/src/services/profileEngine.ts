import {
  getHypothesisProfile,
  HYPOTHESIS_PROFILES,
  type HypothesisProfile,
  type HypothesisProfileId,
} from "../config/hypothesisProfiles.js";
import { mergeSettingsIntoConfig } from "../config/configSettings.js";
import type {
  AppConfig,
  PredictionDirection,
  PredictionHorizon,
  PredictionSignal,
  TimeframeAnalysis,
} from "../types/analysis.js";
import {
  computePredictions,
  directionFromScore,
  getAnchorRsi,
} from "./predictionEngine.js";

export type ProfilePredictionsMap = Record<HypothesisProfileId, PredictionSignal[]>;

function allGaugesDirectional(analysis: TimeframeAnalysis): boolean {
  const recs = [
    analysis.summary.recommendation,
    analysis.oscillators.recommendation,
    analysis.movingAverages.recommendation,
  ];
  const bullish = recs.every((r) => r === "BUY" || r === "STRONG_BUY");
  const bearish = recs.every((r) => r === "SELL" || r === "STRONG_SELL");
  return bullish || bearish;
}

function applyStrategyPostProcessors(
  predictions: PredictionSignal[],
  profile: HypothesisProfile,
  analyses: TimeframeAnalysis[],
  config: AppConfig
): PredictionSignal[] {
  const strategy = profile.strategy ?? "standard";
  if (strategy === "standard") return predictions;

  const threshold = config.predictions.noEdgeThreshold;

  return predictions.map((prediction) => {
    if (strategy === "gauge_consensus") {
      const anchor = analyses.find((a) => a.timeframe === prediction.anchorTimeframe);
      if (!anchor || !allGaugesDirectional(anchor)) {
        return {
          ...prediction,
          direction: "NO_EDGE" as PredictionDirection,
          confidence: "LOW",
          warnings: [...prediction.warnings, "Gauge consensus filter: anchor gauges not aligned"],
        };
      }
      return prediction;
    }

    if (strategy === "higher_tf_gate") {
      const { direction, higherTfBias } = prediction;
      const blocked =
        (direction === "HIGHER" && higherTfBias === "BEARISH") ||
        (direction === "LOWER" && higherTfBias === "BULLISH");
      if (blocked) {
        return {
          ...prediction,
          direction: "NO_EDGE" as PredictionDirection,
          confidence: "LOW",
          warnings: [...prediction.warnings, "Higher TF gate: HTF bias opposes signal"],
        };
      }
      return prediction;
    }

    if (strategy === "mean_reversion") {
      const anchor = analyses.find((a) => a.timeframe === prediction.anchorTimeframe);
      const rsi = getAnchorRsi(anchor);
      if (rsi == null) return prediction;

      let composite = prediction.compositeScore;
      if (rsi > 70) composite -= 0.12;
      else if (rsi < 30) composite += 0.12;

      const direction = directionFromScore(composite, threshold);
      return {
        ...prediction,
        direction,
        compositeScore: Math.round(composite * 1000) / 1000,
        warnings:
          rsi > 70 || rsi < 30
            ? [...prediction.warnings, `Mean reversion: RSI ${rsi.toFixed(1)} fade applied`]
            : prediction.warnings,
      };
    }

    return prediction;
  });
}

export function getProfileConfig(baseConfig: AppConfig, profile: HypothesisProfile): AppConfig {
  const settings = { ...profile.settings, agreementRules: {} };
  let config = mergeSettingsIntoConfig(baseConfig, settings);

  if (profile.weightOverrides) {
    const weights = { ...config.predictions.weights };
    for (const [horizon, overrides] of Object.entries(profile.weightOverrides) as [
      PredictionHorizon,
      NonNullable<HypothesisProfile["weightOverrides"]>[PredictionHorizon],
    ][]) {
      if (!overrides) continue;
      weights[horizon] = { ...weights[horizon], ...overrides };
    }
    config = {
      ...config,
      predictions: { ...config.predictions, weights },
    };
  }

  return config;
}

export function computeProfilePredictions(
  analyses: TimeframeAnalysis[],
  baseConfig: AppConfig,
  profileId: HypothesisProfileId
): PredictionSignal[] {
  const profile = getHypothesisProfile(profileId);
  const config = getProfileConfig(baseConfig, profile);
  const predictions = computePredictions(analyses, config);
  return applyStrategyPostProcessors(predictions, profile, analyses, config);
}

export function computeAllProfilePredictions(
  analyses: TimeframeAnalysis[],
  baseConfig: AppConfig
): ProfilePredictionsMap {
  const result = {} as ProfilePredictionsMap;
  for (const profile of HYPOTHESIS_PROFILES) {
    result[profile.id] = computeProfilePredictions(analyses, baseConfig, profile.id);
  }
  return result;
}

export function getProfileDirectionForHorizon(
  profilePredictions: ProfilePredictionsMap,
  profileId: HypothesisProfileId,
  horizon: PredictionHorizon
): PredictionDirection | null {
  const prediction = profilePredictions[profileId]?.find((p) => p.horizon === horizon);
  return prediction?.direction ?? null;
}

export { getHypothesisProfileMeta } from "../config/hypothesisProfiles.js";
