import type { Recommendation } from "./types";

export function recommendationColor(rec: Recommendation): string {
  switch (rec) {
    case "STRONG_BUY":
      return "#089981";
    case "BUY":
      return "#26a69a";
    case "NEUTRAL":
      return "#787b86";
    case "SELL":
      return "#f23645";
    case "STRONG_SELL":
      return "#b22833";
    default:
      return "#787b86";
  }
}

export function recommendationLabel(rec: Recommendation): string {
  return rec.replace("_", " ");
}

export function formatValue(value: number | null): string {
  if (value == null) return "—";
  if (Math.abs(value) >= 1000) return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return value.toFixed(2);
}

export function formatTime(iso: string | null): string {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
}
