import type {
  AppConfig,
  ConfidenceTier,
  HigherTfBias,
  HorizonWeights,
  MarketContext,
  PredictionDirection,
  PredictionHorizon,
  PredictionSignal,
  Recommendation,
  Timeframe,
  TimeframeAnalysis,
} from "../types/analysis.js";
import { resolveHorizonWeights } from "../config/defaultWeights.js";

function getAnalysis(analyses: TimeframeAnalysis[], tf: Timeframe): TimeframeAnalysis | undefined {
  return analyses.find((a) => a.timeframe === tf);
}

function scoreOf(analysis: TimeframeAnalysis | undefined, gauge: "summary" | "oscillators" | "movingAverages"): number {
  if (!analysis) return 0;
  return analysis[gauge].score ?? 0;
}

function isBullish(rec: Recommendation): boolean {
  return rec === "BUY" || rec === "STRONG_BUY";
}

function isBearish(rec: Recommendation): boolean {
  return rec === "SELL" || rec === "STRONG_SELL";
}

function gaugeDirection(rec: Recommendation): "bullish" | "bearish" | "neutral" {
  if (isBullish(rec)) return "bullish";
  if (isBearish(rec)) return "bearish";
  return "neutral";
}

export function getAnchorRsi(analysis: TimeframeAnalysis | undefined): number | null {
  const rsi = analysis?.oscillators.indicators.find((i) => i.name.includes("Relative Strength"));
  return rsi?.value ?? null;
}

function resolveWeights(config: AppConfig, horizon: PredictionHorizon): HorizonWeights {
  return resolveHorizonWeights(horizon, config.predictions?.weights?.[horizon]);
}

function computeHigherTfBias(analyses: TimeframeAnalysis[], higherTfs: Timeframe[]): HigherTfBias {
  const scores = higherTfs
    .map((tf) => getAnalysis(analyses, tf)?.summary.score)
    .filter((s): s is number => s != null);

  if (!scores.length) return "NEUTRAL";

  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  if (avg > 0.1) return "BULLISH";
  if (avg < -0.1) return "BEARISH";
  return "NEUTRAL";
}

export function gaugesAgree(analysis: TimeframeAnalysis): boolean {
  const dirs = [
    gaugeDirection(analysis.summary.recommendation),
    gaugeDirection(analysis.oscillators.recommendation),
    gaugeDirection(analysis.movingAverages.recommendation),
  ].filter((d) => d !== "neutral");

  if (dirs.length < 2) return false;
  return dirs.every((d) => d === dirs[0]);
}

function majorityGaugesAgree(analysis: TimeframeAnalysis): boolean {
  const bullish = [
    analysis.summary.recommendation,
    analysis.oscillators.recommendation,
    analysis.movingAverages.recommendation,
  ].filter(isBullish).length;
  const bearish = [
    analysis.summary.recommendation,
    analysis.oscillators.recommendation,
    analysis.movingAverages.recommendation,
  ].filter(isBearish).length;
  return bullish >= 2 || bearish >= 2;
}

export function directionFromScore(score: number, threshold: number): PredictionDirection {
  if (score > threshold) return "HIGHER";
  if (score < -threshold) return "LOWER";
  return "NO_EDGE";
}

function computeConfidence(
  composite: number,
  direction: PredictionDirection,
  anchor: TimeframeAnalysis,
  alignedCount: number,
  hasConflict: boolean,
  config: AppConfig
): { tier: ConfidenceTier; score: number } {
  const abs = Math.abs(composite);
  const highTh = config.predictions.highConfidenceThreshold;
  const medTh = config.predictions.mediumConfidenceThreshold;

  if (direction === "NO_EDGE") {
    return { tier: "LOW", score: Math.round(abs * 50) };
  }

  const allAgree = gaugesAgree(anchor);
  const majorityAgree = majorityGaugesAgree(anchor);

  if (abs >= highTh && allAgree && !hasConflict && alignedCount >= 2) {
    return { tier: "HIGH", score: Math.min(100, Math.round(60 + abs * 40)) };
  }
  if (abs >= medTh && majorityAgree) {
    return { tier: "MEDIUM", score: Math.min(85, Math.round(40 + abs * 50)) };
  }
  return { tier: "LOW", score: Math.min(55, Math.round(20 + abs * 40)) };
}

function buildPrediction(
  horizon: PredictionHorizon,
  analyses: TimeframeAnalysis[],
  config: AppConfig
): PredictionSignal | null {
  const weights = resolveWeights(config, horizon);
  const anchor = getAnalysis(analyses, weights.anchor);
  if (!anchor) return null;

  const anchorSummary = scoreOf(anchor, "summary");
  const anchorOsc = scoreOf(anchor, "oscillators");
  const anchorMa = scoreOf(anchor, "movingAverages");

  const leadingScores = weights.leading
    .map((tf) => scoreOf(getAnalysis(analyses, tf), "summary"))
    .filter((s) => s !== 0 || weights.leading.length > 0);
  const leadingAvg =
    leadingScores.length > 0 ? leadingScores.reduce((a, b) => a + b, 0) / leadingScores.length : 0;

  let composite =
    weights.anchorSummaryWeight * anchorSummary +
    weights.oscWeight * anchorOsc +
    weights.maWeight * anchorMa +
    weights.leadingWeight * leadingAvg;

  const anchorDir = gaugeDirection(anchor.summary.recommendation);
  const aligned: Timeframe[] = [];
  const conflicting: Timeframe[] = [];

  for (const tf of [weights.anchor, ...weights.leading]) {
    const a = getAnalysis(analyses, tf);
    if (!a) continue;
    const dir = gaugeDirection(a.summary.recommendation);
    if (dir === "neutral" || anchorDir === "neutral") continue;
    if (dir === anchorDir) aligned.push(tf);
    else conflicting.push(tf);
  }

  let alignedLeading = 0;
  for (const tf of weights.leading) {
    const a = getAnalysis(analyses, tf);
    if (!a || anchorDir === "neutral") continue;
    if (gaugeDirection(a.summary.recommendation) === anchorDir) alignedLeading++;
  }

  if (alignedLeading >= 2) {
    composite += weights.confluenceBonus * (anchorDir === "bullish" ? 1 : -1);
  }

  const higherTfBias = computeHigherTfBias(analyses, weights.higherTf);
  let hasHigherTfConflict = false;
  const direction = directionFromScore(composite, config.predictions.noEdgeThreshold);

  for (const tf of weights.higherTf) {
    const a = getAnalysis(analyses, tf);
    if (!a) continue;
    const hDir = gaugeDirection(a.summary.recommendation);
    if (direction === "HIGHER" && hDir === "bearish") {
      composite -= weights.conflictPenalty;
      hasHigherTfConflict = true;
      conflicting.push(tf);
    } else if (direction === "LOWER" && hDir === "bullish") {
      composite += weights.conflictPenalty;
      hasHigherTfConflict = true;
      conflicting.push(tf);
    }
  }

  const finalDirection = directionFromScore(composite, config.predictions.noEdgeThreshold);
  const { tier, score: confidenceScore } = computeConfidence(
    composite,
    finalDirection,
    anchor,
    alignedLeading,
    hasHigherTfConflict,
    config
  );

  const supportingFactors: string[] = [];
  const warnings: string[] = [];

  supportingFactors.push(
    `${weights.anchor} summary: ${anchor.summary.recommendation.replace("_", " ")} (${anchorSummary.toFixed(2)})`
  );
  if (alignedLeading >= 2) {
    supportingFactors.push(`${alignedLeading} leading timeframes align with ${weights.anchor}`);
  }
  if (gaugesAgree(anchor)) {
    supportingFactors.push(`All gauges agree on ${weights.anchor}`);
  }

  if (hasHigherTfConflict) {
    warnings.push(`Higher timeframe opposes ${horizon} signal (${weights.higherTf.join(", ")})`);
  }
  if (!gaugesAgree(anchor) && !majorityGaugesAgree(anchor)) {
    warnings.push(`${weights.anchor} gauges are split — mixed signals`);
  }

  const rsi = getAnchorRsi(anchor);
  if (rsi != null && finalDirection === "HIGHER" && rsi > 70) {
    warnings.push(`RSI ${rsi.toFixed(1)} overbought on ${weights.anchor} — fade risk`);
  }
  if (rsi != null && finalDirection === "LOWER" && rsi < 30) {
    warnings.push(`RSI ${rsi.toFixed(1)} oversold on ${weights.anchor} — bounce risk`);
  }

  if (gaugeDirection(anchor.summary.recommendation) !== gaugeDirection(anchor.oscillators.recommendation)) {
    warnings.push(`Summary vs oscillators disagree on ${weights.anchor}`);
  }

  return {
    horizon,
    direction: finalDirection,
    confidence: tier,
    confidenceScore,
    compositeScore: Math.round(composite * 1000) / 1000,
    supportingFactors,
    warnings,
    gauges: {
      summary: { recommendation: anchor.summary.recommendation, score: anchorSummary },
      oscillators: { recommendation: anchor.oscillators.recommendation, score: anchorOsc },
      movingAverages: { recommendation: anchor.movingAverages.recommendation, score: anchorMa },
    },
    confluence: { aligned, conflicting: [...new Set(conflicting)] },
    higherTfBias,
    anchorTimeframe: weights.anchor,
  };
}

export function buildMarketContext(analyses: TimeframeAnalysis[]): MarketContext {
  const priceTf = getAnalysis(analyses, "5m") ?? getAnalysis(analyses, "1m") ?? analyses[0];
  const changeByTf: Partial<Record<Timeframe, number | null>> = {};

  for (const a of analyses) {
    changeByTf[a.timeframe] = a.price.change;
  }

  return {
    price: priceTf?.price.close ?? null,
    changeByTf,
  };
}

export function computePredictions(analyses: TimeframeAnalysis[], config: AppConfig): PredictionSignal[] {
  const horizons = config.predictions?.horizons ?? ["5m", "15m", "1h"];
  return horizons
    .map((h) => buildPrediction(h, analyses, config))
    .filter((p): p is PredictionSignal => p != null);
}
