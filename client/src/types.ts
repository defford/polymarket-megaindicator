export type Recommendation =
  | "STRONG_BUY"
  | "BUY"
  | "NEUTRAL"
  | "SELL"
  | "STRONG_SELL"
  | "ERROR";

export type Timeframe =
  | "1m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "2h"
  | "4h"
  | "1d"
  | "1W"
  | "1M";

export type PredictionHorizon = "5m" | "15m" | "1h";
export type PredictionDirection = "HIGHER" | "LOWER" | "NO_EDGE";
export type ConfidenceTier = "HIGH" | "MEDIUM" | "LOW";
export type HigherTfBias = "BULLISH" | "BEARISH" | "NEUTRAL";

export interface GaugeSummary {
  recommendation: Recommendation;
  buy: number;
  sell: number;
  neutral: number;
  score?: number;
}

export interface IndicatorRow {
  name: string;
  value: number | null;
  action: Recommendation | "BUY" | "SELL" | "NEUTRAL";
}

export interface GaugeDetail extends GaugeSummary {
  indicators: IndicatorRow[];
}

export interface TimeframeAnalysis {
  timeframe: Timeframe;
  summary: GaugeSummary;
  oscillators: GaugeDetail;
  movingAverages: GaugeDetail;
  price: {
    close: number | null;
    open: number | null;
    high: number | null;
    low: number | null;
    volume: number | null;
    change: number | null;
  };
  fetchedAt: string;
}

export interface PredictionGaugeSnapshot {
  recommendation: Recommendation;
  score: number;
}

export interface PredictionSignal {
  horizon: PredictionHorizon;
  direction: PredictionDirection;
  confidence: ConfidenceTier;
  confidenceScore: number;
  compositeScore: number;
  supportingFactors: string[];
  warnings: string[];
  gauges: {
    summary: PredictionGaugeSnapshot;
    oscillators: PredictionGaugeSnapshot;
    movingAverages: PredictionGaugeSnapshot;
  };
  confluence: { aligned: Timeframe[]; conflicting: Timeframe[] };
  higherTfBias: HigherTfBias;
  anchorTimeframe: Timeframe;
}

export interface MarketContext {
  price: number | null;
  changeByTf: Partial<Record<Timeframe, number | null>>;
}

export interface AgreementResult {
  ruleId: string;
  name: string;
  matched: boolean;
  matchedTimeframes: Timeframe[];
  details: string;
}

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

export interface Snapshot {
  symbol: string;
  exchange: string;
  screener: string;
  timeframes: TimeframeAnalysis[];
  agreementResults: AgreementResult[];
  predictions: PredictionSignal[];
  profilePredictions: Record<HypothesisProfileId, PredictionSignal[]>;
  marketContext: MarketContext;
  lastRefreshAt: string | null;
  stale: boolean;
  refreshing: boolean;
}

export interface HypothesisProfileMeta {
  id: HypothesisProfileId;
  name: string;
  hypothesis: string;
  description: string;
  bestHorizon: PredictionHorizon;
}

export interface ProfilesResponse {
  profiles: HypothesisProfileMeta[];
}

export interface AppConfigView {
  symbol: { screener: string; exchange: string; ticker: string };
  timeframes: Timeframe[];
  refresh: {
    dashboardPollSeconds: number;
    backgroundRefreshSeconds: number;
    priorityTimeframes: Timeframe[];
  };
  predictions: { horizons: PredictionHorizon[] };
  agreementRules: Array<{ id: string; name: string; enabled: boolean; type: string }>;
}

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

export interface ConfigPreviewResult {
  current: PredictionSignal[];
  draft: PredictionSignal[];
  impact: string[];
}

export interface ConfigSettingsResponse {
  settings: ConfigSettings;
  presets: PresetMeta[];
}
