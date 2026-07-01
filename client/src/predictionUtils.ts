import type {
  ConfidenceTier,
  PredictionDirection,
  PredictionHorizon,
  Recommendation,
} from "./types";

export function directionColor(direction: PredictionDirection): string {
  switch (direction) {
    case "HIGHER":
      return "#089981";
    case "LOWER":
      return "#f23645";
    default:
      return "#787b86";
  }
}

export function directionLabel(direction: PredictionDirection): string {
  switch (direction) {
    case "HIGHER":
      return "HIGHER";
    case "LOWER":
      return "LOWER";
    default:
      return "NO EDGE";
  }
}

export function confidenceClass(tier: ConfidenceTier): string {
  return `confidence-${tier.toLowerCase()}`;
}

export function horizonLabel(horizon: PredictionHorizon): string {
  return `${horizon} window`;
}

export function isBullishRec(rec: Recommendation): boolean {
  return rec === "BUY" || rec === "STRONG_BUY";
}

export function isBearishRec(rec: Recommendation): boolean {
  return rec === "SELL" || rec === "STRONG_SELL";
}

export function recToDotColor(rec: Recommendation): string {
  if (isBullishRec(rec)) return "#089981";
  if (isBearishRec(rec)) return "#f23645";
  return "#787b86";
}

export function formatPrice(price: number | null): string {
  if (price == null) return "—";
  return price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatChange(change: number | null): string {
  if (change == null) return "—";
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
}

export function changeClass(change: number | null): string {
  if (change == null) return "neutral-text";
  return change >= 0 ? "buy-text" : "sell-text";
}
