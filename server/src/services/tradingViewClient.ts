import type { PivotLevels, Pivots, Timeframe, TimeframeAnalysis } from "../types/analysis.js";
import {
  buildIndicatorRows,
  computeAnalysis,
  MA_LABELS,
  MA_VALUE_KEYS,
  OSCILLATOR_LABELS,
  OSCILLATOR_VALUE_KEYS,
} from "./technicals.js";

const SCAN_URL = "https://scanner.tradingview.com";

export const INDICATOR_KEYS = [
  "Recommend.Other",
  "Recommend.All",
  "Recommend.MA",
  "RSI",
  "RSI[1]",
  "Stoch.K",
  "Stoch.D",
  "Stoch.K[1]",
  "Stoch.D[1]",
  "CCI20",
  "CCI20[1]",
  "ADX",
  "ADX+DI",
  "ADX-DI",
  "ADX+DI[1]",
  "ADX-DI[1]",
  "AO",
  "AO[1]",
  "Mom",
  "Mom[1]",
  "MACD.macd",
  "MACD.signal",
  "Rec.Stoch.RSI",
  "Stoch.RSI.K",
  "Rec.WR",
  "W.R",
  "Rec.BBPower",
  "BBPower",
  "Rec.UO",
  "UO",
  "close",
  "EMA5",
  "SMA5",
  "EMA10",
  "SMA10",
  "EMA20",
  "SMA20",
  "EMA30",
  "SMA30",
  "EMA50",
  "SMA50",
  "EMA100",
  "SMA100",
  "EMA200",
  "SMA200",
  "Rec.Ichimoku",
  "Ichimoku.BLine",
  "Rec.VWMA",
  "VWMA",
  "Rec.HullMA9",
  "HullMA9",
  "Pivot.M.Classic.S3",
  "Pivot.M.Classic.S2",
  "Pivot.M.Classic.S1",
  "Pivot.M.Classic.Middle",
  "Pivot.M.Classic.R1",
  "Pivot.M.Classic.R2",
  "Pivot.M.Classic.R3",
  "Pivot.M.Fibonacci.S3",
  "Pivot.M.Fibonacci.S2",
  "Pivot.M.Fibonacci.S1",
  "Pivot.M.Fibonacci.Middle",
  "Pivot.M.Fibonacci.R1",
  "Pivot.M.Fibonacci.R2",
  "Pivot.M.Fibonacci.R3",
  "Pivot.M.Camarilla.S3",
  "Pivot.M.Camarilla.S2",
  "Pivot.M.Camarilla.S1",
  "Pivot.M.Camarilla.Middle",
  "Pivot.M.Camarilla.R1",
  "Pivot.M.Camarilla.R2",
  "Pivot.M.Camarilla.R3",
  "Pivot.M.Woodie.S3",
  "Pivot.M.Woodie.S2",
  "Pivot.M.Woodie.S1",
  "Pivot.M.Woodie.Middle",
  "Pivot.M.Woodie.R1",
  "Pivot.M.Woodie.R2",
  "Pivot.M.Woodie.R3",
  "Pivot.M.Demark.S1",
  "Pivot.M.Demark.Middle",
  "Pivot.M.Demark.R1",
  "open",
  "P.SAR",
  "BB.lower",
  "BB.upper",
  "AO[2]",
  "volume",
  "change",
  "low",
  "high",
] as const;

const TIMEFRAME_SUFFIX: Record<Timeframe, string> = {
  "1m": "|1",
  "5m": "|5",
  "15m": "|15",
  "30m": "|30",
  "1h": "|60",
  "2h": "|120",
  "4h": "|240",
  "1d": "",
  "1W": "|1W",
  "1M": "|1M",
};

function buildScanPayload(symbol: string, timeframe: Timeframe) {
  const suffix = TIMEFRAME_SUFFIX[timeframe];
  return {
    symbols: { tickers: [symbol.toUpperCase()], query: { types: [] } },
    columns: INDICATOR_KEYS.map((key) => key + suffix),
  };
}

function parsePivotLevels(raw: Record<string, number | null>, prefix: string): PivotLevels {
  return {
    s3: raw[`${prefix}.S3`] ?? null,
    s2: raw[`${prefix}.S2`] ?? null,
    s1: raw[`${prefix}.S1`] ?? null,
    middle: raw[`${prefix}.Middle`] ?? null,
    r1: raw[`${prefix}.R1`] ?? null,
    r2: raw[`${prefix}.R2`] ?? null,
    r3: raw[`${prefix}.R3`] ?? null,
  };
}

function parsePivots(raw: Record<string, number | null>): Pivots {
  return {
    classic: parsePivotLevels(raw, "Pivot.M.Classic"),
    fibonacci: parsePivotLevels(raw, "Pivot.M.Fibonacci"),
    camarilla: parsePivotLevels(raw, "Pivot.M.Camarilla"),
    woodie: parsePivotLevels(raw, "Pivot.M.Woodie"),
    demark: {
      s1: raw["Pivot.M.Demark.S1"] ?? null,
      middle: raw["Pivot.M.Demark.Middle"] ?? null,
      r1: raw["Pivot.M.Demark.R1"] ?? null,
    },
  };
}

export class TradingViewClient {
  constructor(
    private screener: string,
    private exchange: string,
    private ticker: string
  ) {}

  get symbol(): string {
    return `${this.exchange}:${this.ticker}`;
  }

  async fetchTimeframe(timeframe: Timeframe): Promise<TimeframeAnalysis | null> {
    const payload = buildScanPayload(this.symbol, timeframe);
    const url = `${SCAN_URL}/${this.screener.toLowerCase()}/scan`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "BTCMegaIndicator/1.0",
      },
      body: JSON.stringify(payload),
    });

    if (response.status === 429) {
      throw new RateLimitError("TradingView rate limit exceeded");
    }

    if (!response.ok) {
      throw new Error(`TradingView API error: HTTP ${response.status}`);
    }

    const body = (await response.json()) as { data: Array<{ s: string; d: (number | null)[] }> };
    if (!body.data?.length) {
      return null;
    }

    const indicators: Record<string, number | null> = {};
    const row = body.data[0].d;
    for (let i = 0; i < INDICATOR_KEYS.length; i++) {
      indicators[INDICATOR_KEYS[i]] = row[i] ?? null;
    }

    const computed = computeAnalysis(indicators);
    if (!computed) {
      return null;
    }

    return {
      timeframe,
      summary: {
        recommendation: computed.summary.recommendation,
        buy: computed.summary.buy,
        sell: computed.summary.sell,
        neutral: computed.summary.neutral,
        score: computed.summary.score,
      },
      oscillators: {
        recommendation: computed.oscillators.recommendation,
        buy: computed.oscillators.buy,
        sell: computed.oscillators.sell,
        neutral: computed.oscillators.neutral,
        score: computed.oscillators.score,
        indicators: buildIndicatorRows(
          computed.oscillators.compute,
          OSCILLATOR_LABELS,
          computed.raw,
          OSCILLATOR_VALUE_KEYS
        ),
      },
      movingAverages: {
        recommendation: computed.movingAverages.recommendation,
        buy: computed.movingAverages.buy,
        sell: computed.movingAverages.sell,
        neutral: computed.movingAverages.neutral,
        score: computed.movingAverages.score,
        indicators: buildIndicatorRows(
          computed.movingAverages.compute,
          MA_LABELS,
          computed.raw,
          MA_VALUE_KEYS
        ),
      },
      pivots: parsePivots(computed.raw),
      price: {
        close: computed.raw.close,
        open: computed.raw.open,
        high: computed.raw.high,
        low: computed.raw.low,
        volume: computed.raw.volume,
        change: computed.raw.change,
      },
      fetchedAt: new Date().toISOString(),
    };
  }
}

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
