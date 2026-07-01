import type { PredictionHorizon } from "../../types/analysis.js";

const HORIZON_SECONDS: Record<PredictionHorizon, number> = {
  "5m": 300,
  "15m": 900,
  "1h": 3600,
};

const ET_TIMEZONE = "America/New_York";

export function getHorizonSeconds(horizon: PredictionHorizon): number {
  return HORIZON_SECONDS[horizon];
}

export function getWindowStartTs(horizon: PredictionHorizon, nowMs = Date.now()): number {
  const seconds = getHorizonSeconds(horizon);
  const nowSec = Math.floor(nowMs / 1000);
  return Math.floor(nowSec / seconds) * seconds;
}

export function getWindowEndTs(horizon: PredictionHorizon, windowStartTs: number): number {
  return windowStartTs + getHorizonSeconds(horizon);
}

function buildHourlySlug(windowStartTs: number): string {
  const date = new Date(windowStartTs * 1000);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ET_TIMEZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    hour12: true,
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const month = get("month").toLowerCase();
  const day = get("day");
  const year = get("year");
  const hour = get("hour");
  const dayPeriod = get("dayPeriod").toLowerCase();

  return `bitcoin-up-or-down-${month}-${day}-${year}-${hour}${dayPeriod}-et`;
}

export function buildSlug(horizon: PredictionHorizon, windowStartTs: number): string {
  if (horizon === "1h") {
    return buildHourlySlug(windowStartTs);
  }
  return `btc-updown-${horizon}-${windowStartTs}`;
}

export function buildRecentWindowStarts(
  horizon: PredictionHorizon,
  count = 50,
  nowMs = Date.now()
): number[] {
  const currentStart = getWindowStartTs(horizon, nowMs);
  const step = getHorizonSeconds(horizon);
  const starts: number[] = [];

  for (let i = 0; i < count; i++) {
    starts.push(currentStart - i * step);
  }

  return starts;
}

export function buildRecentSlugs(
  horizon: PredictionHorizon,
  count = 50,
  nowMs = Date.now()
): string[] {
  return buildRecentWindowStarts(horizon, count, nowMs).map((ts) => buildSlug(horizon, ts));
}

export function inferPriceSource(resolutionSource: string): "chainlink" | "binance" {
  const lower = resolutionSource.toLowerCase();
  if (lower.includes("binance")) {
    return "binance";
  }
  return "chainlink";
}
