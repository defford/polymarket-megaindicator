import type { PredictionHorizon, Recommendation, Timeframe, TimeframeAnalysis } from "../../types/analysis.js";
import type {
  GaugeSnapshot,
  SimpleAction,
  TimeframeSnapshot,
  WindowIndicatorSnapshot,
} from "../../types/indicatorSnapshots.js";
import { MA_LABELS, OSCILLATOR_LABELS } from "../technicals.js";

const GAUGE_IDS = ["summary", "oscillators", "moving_averages"] as const;

const LABEL_TO_KEY: Record<string, string> = {
  ...invertLabels(OSCILLATOR_LABELS),
  ...invertLabels(MA_LABELS),
};

function invertLabels(labels: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(labels).map(([key, label]) => [label, key]));
}

export function recommendationToAction(recommendation: Recommendation): SimpleAction {
  if (recommendation === "STRONG_BUY" || recommendation === "BUY") return "BUY";
  if (recommendation === "STRONG_SELL" || recommendation === "SELL") return "SELL";
  return "NEUTRAL";
}

function toGaugeSnapshot(
  gauge: { recommendation: Recommendation; score?: number; buy: number; sell: number; neutral: number }
): GaugeSnapshot {
  return {
    recommendation: gauge.recommendation,
    score: gauge.score ?? null,
    buy: gauge.buy,
    sell: gauge.sell,
    neutral: gauge.neutral,
  };
}

function extractTimeframeSnapshot(analysis: TimeframeAnalysis): TimeframeSnapshot {
  const signals: Record<string, SimpleAction> = {};
  const values: Record<string, number | null> = {};

  for (const row of analysis.oscillators.indicators) {
    const key = LABEL_TO_KEY[row.name] ?? row.name;
    signals[key] = row.action as SimpleAction;
    values[key] = row.value;
  }

  for (const row of analysis.movingAverages.indicators) {
    const key = LABEL_TO_KEY[row.name] ?? row.name;
    signals[key] = row.action as SimpleAction;
    values[key] = row.value;
  }

  for (const gaugeId of GAUGE_IDS) {
    const gauge =
      gaugeId === "summary"
        ? analysis.summary
        : gaugeId === "oscillators"
          ? analysis.oscillators
          : analysis.movingAverages;
    signals[gaugeId] = recommendationToAction(gauge.recommendation);
    values[gaugeId] = gauge.score ?? null;
  }

  return {
    fetchedAt: analysis.fetchedAt,
    gauges: {
      summary: toGaugeSnapshot(analysis.summary),
      oscillators: toGaugeSnapshot(analysis.oscillators),
      movingAverages: toGaugeSnapshot(analysis.movingAverages),
    },
    signals,
    values,
  };
}

export function buildWindowIndicatorSnapshot(
  slug: string,
  horizon: PredictionHorizon,
  windowStart: string,
  windowEnd: string,
  analyses: TimeframeAnalysis[]
): WindowIndicatorSnapshot {
  const timeframes: Partial<Record<Timeframe, TimeframeSnapshot>> = {};

  for (const analysis of analyses) {
    timeframes[analysis.timeframe] = extractTimeframeSnapshot(analysis);
  }

  return {
    slug,
    horizon,
    windowStart,
    windowEnd,
    capturedAt: new Date().toISOString(),
    timeframes,
  };
}

export { GAUGE_IDS };
