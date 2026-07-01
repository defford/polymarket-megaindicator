import type { HypothesisProfileId, PredictionDirection, PredictionHorizon } from "./analysis.js";

export type PolymarketOutcome = "Up" | "Down";
export type PriceSource = "chainlink" | "binance";

export interface ProfileWindowSignal {
  direction: PredictionDirection;
  signalCorrect: boolean | null;
}

export interface PolymarketWindowResult {
  horizon: PredictionHorizon;
  slug: string;
  marketId: string;
  conditionId: string;
  title: string;
  windowStart: string;
  windowEnd: string;
  startPrice: number | null;
  stopPrice: number | null;
  priceSource: PriceSource | null;
  outcome: PolymarketOutcome | null;
  resolved: boolean;
  resolutionSource: string;
  polymarketUrl: string;
  profileSignals?: Partial<Record<HypothesisProfileId, ProfileWindowSignal>>;
  /** @deprecated Use profileSignals.balanced — kept for backward compat */
  signalDirection?: PredictionDirection | null;
  /** @deprecated Use profileSignals.balanced — kept for backward compat */
  signalCorrect?: boolean | null;
}

export interface PolymarketMarket {
  horizon: PredictionHorizon;
  slug: string;
  marketId: string;
  conditionId: string;
  title: string;
  windowStart: string;
  windowEnd: string;
  resolved: boolean;
  outcome: PolymarketOutcome | null;
  resolutionSource: string;
  polymarketUrl: string;
}

export interface PolymarketResultsResponse {
  windows: Record<PredictionHorizon, PolymarketWindowResult[]>;
  activeWindows: Partial<Record<PredictionHorizon, PolymarketWindowResult>>;
  updatedAt: string | null;
}

export interface PolymarketStoreData {
  version: 1 | 2;
  updatedAt: string;
  windows: Record<PredictionHorizon, PolymarketWindowResult[]>;
}
