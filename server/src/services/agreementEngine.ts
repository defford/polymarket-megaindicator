import type {
  AgreementResult,
  AgreementRule,
  AppConfig,
  GaugeType,
  Recommendation,
  Snapshot,
  Timeframe,
  TimeframeAnalysis,
} from "../types/analysis.js";
import { buildMarketContext, computePredictions } from "./predictionEngine.js";
import { computeAllProfilePredictions } from "./profileEngine.js";

function getGauge(
  analysis: TimeframeAnalysis,
  gauge: GaugeType
): { recommendation: Recommendation } {
  switch (gauge) {
    case "summary":
      return analysis.summary;
    case "oscillators":
      return analysis.oscillators;
    case "moving_averages":
      return analysis.movingAverages;
  }
}

function isDirectionMatch(recommendation: Recommendation, directions: Recommendation[]): boolean {
  return directions.includes(recommendation);
}

function evaluateGaugeMajority(
  rule: Extract<AgreementRule, { type: "gauge_majority" }>,
  analyses: TimeframeAnalysis[],
  enabledTimeframes: Timeframe[]
): AgreementResult {
  const pool = rule.requireSpecificTimeframes?.length
    ? analyses.filter((a) => rule.requireSpecificTimeframes!.includes(a.timeframe))
    : analyses.filter((a) => enabledTimeframes.includes(a.timeframe));

  const matchedTimeframes = pool
    .filter((a) => isDirectionMatch(getGauge(a, rule.gauge).recommendation, rule.matchDirections))
    .map((a) => a.timeframe);

  const matched = matchedTimeframes.length >= rule.minMatchingTimeframes;

  return {
    ruleId: rule.id,
    name: rule.name,
    matched,
    matchedTimeframes,
    details: matched
      ? `${matchedTimeframes.length}/${enabledTimeframes.length} timeframes match ${rule.matchDirections.join("/")} on ${rule.gauge}`
      : `Only ${matchedTimeframes.length}/${rule.minMatchingTimeframes} required timeframes match on ${rule.gauge}`,
  };
}

function evaluateAllGaugesAlign(
  rule: Extract<AgreementRule, { type: "all_gauges_align" }>,
  analyses: TimeframeAnalysis[]
): AgreementResult {
  const matchedTimeframes: Timeframe[] = [];

  for (const tf of rule.timeframes) {
    const analysis = analyses.find((a) => a.timeframe === tf);
    if (!analysis) continue;

    const recs = [
      analysis.summary.recommendation,
      analysis.oscillators.recommendation,
      analysis.movingAverages.recommendation,
    ];

    const allSame = recs.every((r) => r === recs[0]);
    const directionOk = isDirectionMatch(recs[0], rule.matchDirections);

    if (allSame && directionOk) {
      matchedTimeframes.push(tf);
    }
  }

  const matched = matchedTimeframes.length === rule.timeframes.length;

  return {
    ruleId: rule.id,
    name: rule.name,
    matched,
    matchedTimeframes,
    details: matched
      ? `All gauges align (${matchedTimeframes[0] ? analyses.find((a) => a.timeframe === matchedTimeframes[0])?.summary.recommendation : ""}) on ${rule.timeframes.join(", ")}`
      : `Gauges do not all align on ${rule.timeframes.join(", ")}`,
  };
}

export function evaluateAgreementRules(
  config: AppConfig,
  analyses: TimeframeAnalysis[]
): AgreementResult[] {
  return config.agreementRules
    .filter((rule) => rule.enabled)
    .map((rule) => {
      if (rule.type === "gauge_majority") {
        return evaluateGaugeMajority(rule, analyses, config.timeframes);
      }
      return evaluateAllGaugesAlign(rule, analyses);
    });
}

export function buildSnapshot(
  config: AppConfig,
  analyses: TimeframeAnalysis[],
  meta: { lastRefreshAt: string | null; stale: boolean; refreshing: boolean }
): Snapshot {
  return {
    symbol: config.symbol.ticker,
    exchange: config.symbol.exchange,
    screener: config.symbol.screener,
    timeframes: analyses,
    agreementResults: evaluateAgreementRules(config, analyses),
    predictions: computePredictions(analyses, config),
    profilePredictions: computeAllProfilePredictions(analyses, config),
    marketContext: buildMarketContext(analyses),
    lastRefreshAt: meta.lastRefreshAt,
    stale: meta.stale,
    refreshing: meta.refreshing,
  };
}
