import type { Recommendation } from "../types/analysis.js";

const STRONG_SELL = "STRONG_SELL" as const;
const SELL = "SELL" as const;
const NEUTRAL = "NEUTRAL" as const;
const BUY = "BUY" as const;
const STRONG_BUY = "STRONG_BUY" as const;
const ERROR = "ERROR" as const;

export function recommendFromScore(value: number): Recommendation {
  if (value >= -1 && value < -0.5) return STRONG_SELL;
  if (value >= -0.5 && value < -0.1) return SELL;
  if (value >= -0.1 && value <= 0.1) return NEUTRAL;
  if (value > 0.1 && value <= 0.5) return BUY;
  if (value > 0.5 && value <= 1) return STRONG_BUY;
  return ERROR;
}

function simple(value: number | null): "BUY" | "SELL" | "NEUTRAL" {
  if (value === -1) return SELL;
  if (value === 1) return BUY;
  return NEUTRAL;
}

function ma(maVal: number, close: number): "BUY" | "SELL" | "NEUTRAL" {
  if (maVal < close) return BUY;
  if (maVal > close) return SELL;
  return NEUTRAL;
}

function rsi(rsiVal: number, rsi1: number): "BUY" | "SELL" | "NEUTRAL" {
  if (rsiVal < 30 && rsi1 < rsiVal) return BUY;
  if (rsiVal > 70 && rsi1 > rsiVal) return SELL;
  return NEUTRAL;
}

function stoch(k: number, d: number, k1: number, d1: number): "BUY" | "SELL" | "NEUTRAL" {
  if (k < 20 && d < 20 && k > d && k1 < d1) return BUY;
  if (k > 80 && d > 80 && k < d && k1 > d1) return SELL;
  return NEUTRAL;
}

function cci20(cci: number, cci1: number): "BUY" | "SELL" | "NEUTRAL" {
  if (cci < -100 && cci > cci1) return BUY;
  if (cci > 100 && cci < cci1) return SELL;
  return NEUTRAL;
}

function adx(adxVal: number, pdi: number, ndi: number, pdi1: number, ndi1: number): "BUY" | "SELL" | "NEUTRAL" {
  if (adxVal > 20 && pdi1 < ndi1 && pdi > ndi) return BUY;
  if (adxVal > 20 && pdi1 > ndi1 && pdi < ndi) return SELL;
  return NEUTRAL;
}

function ao(aoVal: number, ao1: number, ao2: number): "BUY" | "SELL" | "NEUTRAL" {
  if ((aoVal > 0 && ao1 < 0) || (aoVal > 0 && ao1 > 0 && aoVal > ao1 && ao2 > ao1)) return BUY;
  if ((aoVal < 0 && ao1 > 0) || (aoVal < 0 && ao1 < 0 && aoVal < ao1 && ao2 < ao1)) return SELL;
  return NEUTRAL;
}

function mom(momVal: number, mom1: number): "BUY" | "SELL" | "NEUTRAL" {
  if (momVal < mom1) return SELL;
  if (momVal > mom1) return BUY;
  return NEUTRAL;
}

function macd(macdVal: number, signal: number): "BUY" | "SELL" | "NEUTRAL" {
  if (macdVal > signal) return BUY;
  if (macdVal < signal) return SELL;
  return NEUTRAL;
}

function notNull(...vals: (number | null | undefined)[]): boolean {
  return vals.every((v) => v != null);
}

export interface ComputedAnalysis {
  summary: {
    recommendation: Recommendation;
    buy: number;
    sell: number;
    neutral: number;
    score: number;
  };
  oscillators: {
    recommendation: Recommendation;
    buy: number;
    sell: number;
    neutral: number;
    score: number;
    compute: Record<string, "BUY" | "SELL" | "NEUTRAL">;
  };
  movingAverages: {
    recommendation: Recommendation;
    buy: number;
    sell: number;
    neutral: number;
    score: number;
    compute: Record<string, "BUY" | "SELL" | "NEUTRAL">;
  };
  raw: Record<string, number | null>;
}

const OSCILLATOR_LABELS: Record<string, string> = {
  RSI: "Relative Strength Index (14)",
  "STOCH.K": "Stochastic %K (14, 3, 3)",
  CCI: "Commodity Channel Index (20)",
  ADX: "Average Directional Index (14)",
  AO: "Awesome Oscillator",
  Mom: "Momentum (10)",
  MACD: "MACD Level (12, 26)",
  "Stoch.RSI": "Stochastic RSI Fast (3, 3, 14, 14)",
  "W%R": "Williams Percent Range (14)",
  BBP: "Bull Bear Power",
  UO: "Ultimate Oscillator (7, 14, 28)",
};

const MA_LABELS: Record<string, string> = {
  EMA10: "Exponential Moving Average (10)",
  SMA10: "Simple Moving Average (10)",
  EMA20: "Exponential Moving Average (20)",
  SMA20: "Simple Moving Average (20)",
  EMA30: "Exponential Moving Average (30)",
  SMA30: "Simple Moving Average (30)",
  EMA50: "Exponential Moving Average (50)",
  SMA50: "Simple Moving Average (50)",
  EMA100: "Exponential Moving Average (100)",
  SMA100: "Simple Moving Average (100)",
  EMA200: "Exponential Moving Average (200)",
  SMA200: "Simple Moving Average (200)",
  Ichimoku: "Ichimoku Base Line (9, 26, 52, 26)",
  VWMA: "Volume Weighted Moving Average (20)",
  HullMA: "Hull Moving Average (9)",
};

export function computeAnalysis(indicators: Record<string, number | null>): ComputedAnalysis | null {
  const v = (key: string) => indicators[key] ?? null;

  if (v("Recommend.Other") == null || v("Recommend.All") == null || v("Recommend.MA") == null) {
    return null;
  }

  const recommendOsc = recommendFromScore(v("Recommend.Other")!);
  const recommendSummary = recommendFromScore(v("Recommend.All")!);
  const recommendMa = recommendFromScore(v("Recommend.MA")!);

  const oscCounter = { BUY: 0, SELL: 0, NEUTRAL: 0 };
  const maCounter = { BUY: 0, SELL: 0, NEUTRAL: 0 };
  const computedOsc: Record<string, "BUY" | "SELL" | "NEUTRAL"> = {};
  const computedMa: Record<string, "BUY" | "SELL" | "NEUTRAL"> = {};

  if (notNull(v("RSI"), v("RSI[1]"))) {
    computedOsc.RSI = rsi(v("RSI")!, v("RSI[1]")!);
    oscCounter[computedOsc.RSI]++;
  }
  if (notNull(v("Stoch.K"), v("Stoch.D"), v("Stoch.K[1]"), v("Stoch.D[1]"))) {
    computedOsc["STOCH.K"] = stoch(v("Stoch.K")!, v("Stoch.D")!, v("Stoch.K[1]")!, v("Stoch.D[1]")!);
    oscCounter[computedOsc["STOCH.K"]]++;
  }
  if (notNull(v("CCI20"), v("CCI20[1]"))) {
    computedOsc.CCI = cci20(v("CCI20")!, v("CCI20[1]")!);
    oscCounter[computedOsc.CCI]++;
  }
  if (notNull(v("ADX"), v("ADX+DI"), v("ADX-DI"), v("ADX+DI[1]"), v("ADX-DI[1]"))) {
    computedOsc.ADX = adx(v("ADX")!, v("ADX+DI")!, v("ADX-DI")!, v("ADX+DI[1]")!, v("ADX-DI[1]")!);
    oscCounter[computedOsc.ADX]++;
  }
  if (notNull(v("AO"), v("AO[1]"), v("AO[2]"))) {
    computedOsc.AO = ao(v("AO")!, v("AO[1]")!, v("AO[2]")!);
    oscCounter[computedOsc.AO]++;
  }
  if (notNull(v("Mom"), v("Mom[1]"))) {
    computedOsc.Mom = mom(v("Mom")!, v("Mom[1]")!);
    oscCounter[computedOsc.Mom]++;
  }
  if (notNull(v("MACD.macd"), v("MACD.signal"))) {
    computedOsc.MACD = macd(v("MACD.macd")!, v("MACD.signal")!);
    oscCounter[computedOsc.MACD]++;
  }
  if (v("Rec.Stoch.RSI") != null) {
    computedOsc["Stoch.RSI"] = simple(v("Rec.Stoch.RSI"));
    oscCounter[computedOsc["Stoch.RSI"]]++;
  }
  if (v("Rec.WR") != null) {
    computedOsc["W%R"] = simple(v("Rec.WR"));
    oscCounter[computedOsc["W%R"]]++;
  }
  if (v("Rec.BBPower") != null) {
    computedOsc.BBP = simple(v("Rec.BBPower"));
    oscCounter[computedOsc.BBP]++;
  }
  if (v("Rec.UO") != null) {
    computedOsc.UO = simple(v("Rec.UO"));
    oscCounter[computedOsc.UO]++;
  }

  const close = v("close");
  const maKeys = ["EMA10", "SMA10", "EMA20", "SMA20", "EMA30", "SMA30", "EMA50", "SMA50", "EMA100", "SMA100", "EMA200", "SMA200"];

  if (close != null) {
    for (const key of maKeys) {
      const maVal = v(key);
      if (maVal != null) {
        computedMa[key] = ma(maVal, close);
        maCounter[computedMa[key]]++;
      }
    }
  }

  if (v("Rec.Ichimoku") != null) {
    computedMa.Ichimoku = simple(v("Rec.Ichimoku"));
    maCounter[computedMa.Ichimoku]++;
  }
  if (v("Rec.VWMA") != null) {
    computedMa.VWMA = simple(v("Rec.VWMA"));
    maCounter[computedMa.VWMA]++;
  }
  if (v("Rec.HullMA9") != null) {
    computedMa.HullMA = simple(v("Rec.HullMA9"));
    maCounter[computedMa.HullMA]++;
  }

  return {
    summary: {
      recommendation: recommendSummary,
      buy: oscCounter.BUY + maCounter.BUY,
      sell: oscCounter.SELL + maCounter.SELL,
      neutral: oscCounter.NEUTRAL + maCounter.NEUTRAL,
      score: v("Recommend.All")!,
    },
    oscillators: {
      recommendation: recommendOsc,
      buy: oscCounter.BUY,
      sell: oscCounter.SELL,
      neutral: oscCounter.NEUTRAL,
      score: v("Recommend.Other")!,
      compute: computedOsc,
    },
    movingAverages: {
      recommendation: recommendMa,
      buy: maCounter.BUY,
      sell: maCounter.SELL,
      neutral: maCounter.NEUTRAL,
      score: v("Recommend.MA")!,
      compute: computedMa,
    },
    raw: indicators,
  };
}

export function buildIndicatorRows(
  compute: Record<string, "BUY" | "SELL" | "NEUTRAL">,
  labels: Record<string, string>,
  raw: Record<string, number | null>,
  valueKeys: Record<string, string | string[]>
) {
  return Object.entries(compute).map(([key, action]) => {
    const valueKey = valueKeys[key];
    let value: number | null = null;
    if (Array.isArray(valueKey)) {
      value = valueKey.map((k) => raw[k]).find((v) => v != null) ?? null;
    } else if (valueKey) {
      value = raw[valueKey] ?? null;
    }
    return { name: labels[key] ?? key, value, action };
  });
}

export const OSCILLATOR_VALUE_KEYS: Record<string, string | string[]> = {
  RSI: "RSI",
  "STOCH.K": "Stoch.K",
  CCI: "CCI20",
  ADX: "ADX",
  AO: "AO",
  Mom: "Mom",
  MACD: "MACD.macd",
  "Stoch.RSI": "Stoch.RSI.K",
  "W%R": "W.R",
  BBP: "BBPower",
  UO: "UO",
};

export const MA_VALUE_KEYS: Record<string, string> = {
  EMA10: "EMA10",
  SMA10: "SMA10",
  EMA20: "EMA20",
  SMA20: "SMA20",
  EMA30: "EMA30",
  SMA30: "SMA30",
  EMA50: "EMA50",
  SMA50: "SMA50",
  EMA100: "EMA100",
  SMA100: "SMA100",
  EMA200: "EMA200",
  SMA200: "SMA200",
  Ichimoku: "Ichimoku.BLine",
  VWMA: "VWMA",
  HullMA: "HullMA9",
};

export { OSCILLATOR_LABELS, MA_LABELS };

export const OSCILLATOR_INDICATOR_IDS = Object.keys(OSCILLATOR_LABELS);
export const MA_INDICATOR_IDS = Object.keys(MA_LABELS);
export const ALL_INDICATOR_IDS = [...OSCILLATOR_INDICATOR_IDS, ...MA_INDICATOR_IDS];
