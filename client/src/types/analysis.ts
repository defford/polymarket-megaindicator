import type { PredictionDirection, PredictionHorizon, Timeframe } from "../types";

export interface SignalRef {
  timeframe: Timeframe;
  indicatorId: string;
  key: string;
}

export interface ComboResult {
  combo: SignalRef[];
  comboKey: string;
  windows: number;
  directional: number;
  correct: number;
  wrong: number;
  noEdge: number;
  accuracy: number | null;
  coverage: number;
}

export interface ComboSearchSummary {
  resolvedWindows: number;
  snapshotsMatched: number;
  candidateSignals: number;
  combosEvaluated: number;
  results: ComboResult[];
}

export type ComboWindowOutcome = "correct" | "wrong" | "no_edge";

export interface ComboWindowSignal {
  key: string;
  action: "BUY" | "SELL" | "NEUTRAL" | null;
}

export interface ComboWindowResult {
  slug: string;
  horizon: PredictionHorizon;
  windowStart: string;
  outcome: "Up" | "Down";
  direction: PredictionDirection;
  result: ComboWindowOutcome;
  signals: ComboWindowSignal[];
}

export interface ComboEvaluateResult {
  summary: ComboResult;
  windows: ComboWindowResult[];
}

export interface HorizonAnalysisStats {
  resolvedTotal: number;
  withSnapshot: number;
  withoutSnapshot: number;
}

export interface AnalysisStats {
  resolvedTotal: number;
  withSnapshot: number;
  withoutSnapshot: number;
  byHorizon: Record<PredictionHorizon, HorizonAnalysisStats>;
}

export interface IndicatorCatalogEntry {
  id: string;
  label: string;
  category: "oscillator" | "moving_average" | "gauge";
}

export interface IndicatorCatalog {
  timeframes: Timeframe[];
  oscillators: IndicatorCatalogEntry[];
  movingAverages: IndicatorCatalogEntry[];
  gauges: IndicatorCatalogEntry[];
}

export interface ComboWindowsResponse {
  combo: SignalRef[];
  windows: ComboWindowResult[];
}

export interface ComboSearchParams {
  horizon?: PredictionHorizon | "all";
  maxSize?: number;
  minSamples?: number;
  top?: number;
  timeframes?: Timeframe[];
}
