import type { HypothesisProfileId, PredictionDirection, PredictionHorizon } from "../types";

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
  signalDirection?: PredictionDirection | null;
  signalCorrect?: boolean | null;
}

export interface PolymarketResultsResponse {
  windows: Record<PredictionHorizon, PolymarketWindowResult[]>;
  activeWindows: Partial<Record<PredictionHorizon, PolymarketWindowResult>>;
  updatedAt: string | null;
}

export interface ResolvedProfileSignal {
  direction: PredictionDirection | null;
  signalCorrect: boolean | null;
}

export function getProfileSignal(
  window: PolymarketWindowResult,
  profileId: HypothesisProfileId
): ResolvedProfileSignal {
  const profileSignal = window.profileSignals?.[profileId];
  if (profileSignal) {
    return {
      direction: profileSignal.direction,
      signalCorrect: profileSignal.signalCorrect,
    };
  }

  if (profileId === "balanced" && window.signalDirection != null) {
    return {
      direction: window.signalDirection,
      signalCorrect: window.signalCorrect ?? null,
    };
  }

  return { direction: null, signalCorrect: null };
}
