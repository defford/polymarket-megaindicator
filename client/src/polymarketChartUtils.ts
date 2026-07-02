import type { HypothesisProfileId } from "./types";
import type { PolymarketWindowResult } from "./types/polymarket";
import { getProfileSignal } from "./types/polymarket";

export interface TimelineStats {
  tracked: number;
  correct: number;
  wrong: number;
  noEdge: number;
  noSignal: number;
}

export function buildTimelineSeries(
  windows: PolymarketWindowResult[],
  profileId: HypothesisProfileId = "balanced"
): TimelineStats {
  const resolved = windows
    .filter((w) => w.resolved && w.outcome != null)
    .sort((a, b) => new Date(a.windowEnd).getTime() - new Date(b.windowEnd).getTime());

  let correct = 0;
  let wrong = 0;
  let noEdge = 0;
  let noSignal = 0;

  for (const window of resolved) {
    const { direction, signalCorrect } = getProfileSignal(window, profileId);
    const hasDirectionalSignal = direction != null && direction !== "NO_EDGE";

    if (hasDirectionalSignal && signalCorrect != null) {
      if (signalCorrect) correct++;
      else wrong++;
    } else if (direction === "NO_EDGE") {
      noEdge++;
    } else {
      noSignal++;
    }
  }

  return {
    tracked: correct + wrong,
    correct,
    wrong,
    noEdge,
    noSignal,
  };
}
