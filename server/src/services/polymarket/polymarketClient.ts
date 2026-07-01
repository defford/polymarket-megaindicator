import type { PredictionHorizon } from "../../types/analysis.js";
import type { PolymarketMarket, PolymarketOutcome } from "../../types/polymarket.js";
import { sleep } from "../tradingViewClient.js";

const GAMMA_BASE = "https://gamma-api.polymarket.com";

interface GammaMarket {
  id: string;
  conditionId: string;
  slug: string;
  question: string;
  endDate: string;
  startDate?: string;
  eventStartTime?: string;
  closed?: boolean;
  umaResolutionStatus?: string;
  outcomes: string;
  outcomePrices: string;
  resolutionSource?: string;
}

interface GammaEvent {
  slug: string;
  title: string;
  endDate: string;
  startDate?: string;
  eventStartTime?: string;
  resolutionSource?: string;
  markets: GammaMarket[];
}

function parseJsonArray<T>(value: string | T[] | undefined): T[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    return JSON.parse(value) as T[];
  } catch {
    return [];
  }
}

function resolveOutcome(outcomes: string[], prices: string[]): PolymarketOutcome | null {
  if (!outcomes.length || outcomes.length !== prices.length) return null;

  let winnerIdx = -1;
  for (let i = 0; i < prices.length; i++) {
    const price = parseFloat(prices[i]);
    if (price >= 0.99) {
      winnerIdx = i;
      break;
    }
  }

  if (winnerIdx < 0) return null;
  const winner = outcomes[winnerIdx];
  if (winner === "Up" || winner === "Down") return winner;
  return null;
}

function normalizeMarket(
  event: GammaEvent,
  market: GammaMarket,
  horizon: PredictionHorizon
): PolymarketMarket {
  const outcomes = parseJsonArray<string>(market.outcomes);
  const outcomePrices = parseJsonArray<string>(market.outcomePrices);
  const resolved =
    Boolean(market.closed) || market.umaResolutionStatus === "resolved" || resolveOutcome(outcomes, outcomePrices) != null;

  const windowStart =
    market.eventStartTime ?? event.eventStartTime ?? market.startDate ?? event.startDate ?? "";
  const windowEnd = market.endDate ?? event.endDate;
  const slug = market.slug ?? event.slug;

  return {
    horizon,
    slug,
    marketId: market.id,
    conditionId: market.conditionId,
    title: market.question ?? event.title,
    windowStart,
    windowEnd,
    resolved,
    outcome: resolved ? resolveOutcome(outcomes, outcomePrices) : null,
    resolutionSource: market.resolutionSource ?? event.resolutionSource ?? "",
    polymarketUrl: `https://polymarket.com/event/${slug}`,
  };
}

export class PolymarketClient {
  async fetchMarketBySlug(slug: string, horizon: PredictionHorizon): Promise<PolymarketMarket | null> {
    const url = `${GAMMA_BASE}/events?slug=${encodeURIComponent(slug)}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "BTCMegaIndicator/1.0" },
    });

    if (!response.ok) {
      throw new Error(`Polymarket API error: HTTP ${response.status}`);
    }

    const events = (await response.json()) as GammaEvent[];
    if (!events.length || !events[0].markets?.length) {
      return null;
    }

    return normalizeMarket(events[0], events[0].markets[0], horizon);
  }

  async fetchMarketsForSlugs(
    entries: Array<{ slug: string; horizon: PredictionHorizon }>,
    delayMs = 200
  ): Promise<PolymarketMarket[]> {
    const results: PolymarketMarket[] = [];

    for (const entry of entries) {
      try {
        const market = await this.fetchMarketBySlug(entry.slug, entry.horizon);
        if (market) {
          results.push(market);
        }
      } catch (err) {
        console.warn(`Failed to fetch Polymarket market ${entry.slug}:`, (err as Error).message);
      }
      await sleep(delayMs);
    }

    return results;
  }
}
