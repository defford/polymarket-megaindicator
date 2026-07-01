import type { HypothesisProfileId, PredictionDirection } from "./types";
import type { PolymarketOutcome, PolymarketWindowResult } from "./types/polymarket";
import { getProfileSignal } from "./types/polymarket";

export interface TimelinePoint {
  time: number;
  timeLabel: string;
  resultScore: number;
  predictionScore: number | null;
  outcome: PolymarketOutcome;
  signalDirection: PredictionDirection | null;
  signalCorrect: boolean | null;
}

export interface TimelineStats {
  points: TimelinePoint[];
  tracked: number;
  correct: number;
  wrong: number;
  noSignal: number;
}

export function buildTimelineSeries(
  windows: PolymarketWindowResult[],
  profileId: HypothesisProfileId = "balanced"
): TimelineStats {
  const resolved = windows
    .filter((w) => w.resolved && w.outcome != null)
    .sort((a, b) => new Date(a.windowEnd).getTime() - new Date(b.windowEnd).getTime());

  const timeFmt = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
  let resultScore = 0;
  let predictionScore = 0;
  let hasPrediction = false;
  let correct = 0;
  let wrong = 0;
  let noSignal = 0;

  const points = resolved.map((window) => {
    resultScore += window.outcome === "Up" ? 1 : -1;

    const { direction, signalCorrect } = getProfileSignal(window, profileId);
    const hasDirectionalSignal = direction != null && direction !== "NO_EDGE";

    let pointPrediction: number | null = null;
    if (hasDirectionalSignal && signalCorrect != null) {
      predictionScore += signalCorrect ? 1 : -1;
      hasPrediction = true;
      pointPrediction = predictionScore;
      if (signalCorrect) correct++;
      else wrong++;
    } else {
      noSignal++;
      if (hasPrediction) {
        pointPrediction = predictionScore;
      }
    }

    return {
      time: new Date(window.windowEnd).getTime(),
      timeLabel: timeFmt.format(new Date(window.windowEnd)),
      resultScore,
      predictionScore: pointPrediction,
      outcome: window.outcome!,
      signalDirection: direction,
      signalCorrect,
    };
  });

  return {
    points,
    tracked: correct + wrong,
    correct,
    wrong,
    noSignal,
  };
}

export function formatMatchTooltip(point: TimelinePoint): string {
  if (!point.signalDirection || point.signalDirection === "NO_EDGE") {
    return `${point.outcome} — no signal captured`;
  }
  if (point.signalCorrect == null) {
    return `Signal ${point.signalDirection} — pending`;
  }
  const expected = point.signalDirection === "HIGHER" ? "Up" : "Down";
  return `Signal ${point.signalDirection} → ${point.outcome} (expected ${expected}) — ${
    point.signalCorrect ? "match" : "miss"
  }`;
}

export interface ChartLayout {
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
}

export function getDefaultChartLayout(): ChartLayout {
  return {
    width: 560,
    height: 180,
    padding: { top: 16, right: 16, bottom: 28, left: 36 },
  };
}

export function scaleLinear(
  domain: [number, number],
  range: [number, number],
  value: number
): number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  if (d1 === d0) return (r0 + r1) / 2;
  return r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);
}

export function buildPolyline(
  points: Array<{ x: number; y: number }>,
  nullBreak = false
): string {
  const segments: string[] = [];
  let current: string[] = [];

  for (const point of points) {
    if (nullBreak && !Number.isFinite(point.y)) {
      if (current.length) {
        segments.push(current.join(" "));
        current = [];
      }
      continue;
    }
    current.push(`${point.x},${point.y}`);
  }

  if (current.length) {
    segments.push(current.join(" "));
  }

  return segments.map((s) => `M ${s.replace(/ /g, " L ")}`).join(" ");
}
