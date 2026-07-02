import type { PredictionHorizon, Recommendation, Timeframe } from "./analysis.js";

export type SimpleAction = "BUY" | "SELL" | "NEUTRAL";

export interface GaugeSnapshot {
  recommendation: Recommendation;
  score: number | null;
  buy: number;
  sell: number;
  neutral: number;
}

export interface TimeframeSnapshot {
  fetchedAt: string | null;
  gauges: {
    summary: GaugeSnapshot;
    oscillators: GaugeSnapshot;
    movingAverages: GaugeSnapshot;
  };
  signals: Record<string, SimpleAction>;
  values: Record<string, number | null>;
}

export interface WindowIndicatorSnapshot {
  slug: string;
  horizon: PredictionHorizon;
  windowStart: string;
  windowEnd: string;
  capturedAt: string;
  timeframes: Partial<Record<Timeframe, TimeframeSnapshot>>;
}

export interface IndicatorSnapshotStoreData {
  version: 1;
  updatedAt: string;
  snapshots: WindowIndicatorSnapshot[];
}
