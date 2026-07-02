export type Recommendation =
  | "STRONG_BUY"
  | "BUY"
  | "NEUTRAL"
  | "SELL"
  | "STRONG_SELL"
  | "ERROR";

export type GaugeType = "summary" | "oscillators" | "moving_averages";

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

export interface PivotLevels {
  s3: number | null;
  s2: number | null;
  s1: number | null;
  middle: number | null;
  r1: number | null;
  r2: number | null;
  r3: number | null;
}

export interface Pivots {
  classic: PivotLevels;
  fibonacci: PivotLevels;
  camarilla: PivotLevels;
  woodie: PivotLevels;
  demark: { s1: number | null; middle: number | null; r1: number | null };
}

export interface TimeframeAnalysis {
  timeframe: Timeframe;
  summary: GaugeSummary;
  oscillators: GaugeDetail;
  movingAverages: GaugeDetail;
  pivots: Pivots;
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

export interface GaugeMajorityRule {
  id: string;
  name: string;
  enabled: boolean;
  type: "gauge_majority";
  gauge: GaugeType;
  matchDirections: Recommendation[];
  minMatchingTimeframes: number;
  requireSpecificTimeframes?: Timeframe[];
}

export interface AllGaugesAlignRule {
  id: string;
  name: string;
  enabled: boolean;
  type: "all_gauges_align";
  timeframes: Timeframe[];
  matchDirections: Recommendation[];
}

export type AgreementRule = GaugeMajorityRule | AllGaugesAlignRule;

export interface PolymarketConfig {
  enabled: boolean;
  historyLimit: number;
  historyPath: string;
  syncIntervalSeconds: number;
  indicatorSnapshotsPath: string;
  indicatorSnapshotLimit: number;
}

export interface AppConfig {
  symbol: {
    screener: string;
    exchange: string;
    ticker: string;
  };
  timeframes: Timeframe[];
  refresh: {
    dashboardPollSeconds: number;
    backgroundRefreshSeconds: number;
    requestDelayMs: number;
    manualRefreshCooldownSeconds: number;
    priorityTimeframes: Timeframe[];
    cacheTtlSeconds: Record<Timeframe, number>;
  };
  predictions: PredictionsConfig;
  agreementRules: AgreementRule[];
  polymarket?: PolymarketConfig;
}

export interface AgreementResult {
  ruleId: string;
  name: string;
  matched: boolean;
  matchedTimeframes: Timeframe[];
  details: string;
}

export type PredictionHorizon = "5m" | "15m" | "1h";
export type PredictionDirection = "HIGHER" | "LOWER" | "NO_EDGE";
export type ConfidenceTier = "HIGH" | "MEDIUM" | "LOW";
export type HigherTfBias = "BULLISH" | "BEARISH" | "NEUTRAL";

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

export interface HorizonWeights {
  anchor: Timeframe;
  leading: Timeframe[];
  higherTf: Timeframe[];
  anchorSummaryWeight: number;
  oscWeight: number;
  maWeight: number;
  leadingWeight: number;
  conflictPenalty: number;
  confluenceBonus: number;
}

export interface PredictionsConfig {
  horizons: PredictionHorizon[];
  noEdgeThreshold: number;
  highConfidenceThreshold: number;
  mediumConfidenceThreshold: number;
  weights: Partial<Record<PredictionHorizon, Partial<HorizonWeights>>>;
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

