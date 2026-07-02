import type { HypothesisProfileId, PredictionHorizon } from "../types";
import type { PolymarketWindowResult } from "../types/polymarket";
import { horizonLabel } from "../predictionUtils";
import { buildTimelineSeries } from "../polymarketChartUtils";

interface ResultAccuracyCardProps {
  horizon: PredictionHorizon;
  windows: PolymarketWindowResult[];
  profileId: HypothesisProfileId;
  profileName?: string;
}

export function ResultAccuracyCard({
  horizon,
  windows,
  profileId,
  profileName,
}: ResultAccuracyCardProps) {
  const { tracked, correct, wrong, noEdge, noSignal } = buildTimelineSeries(windows, profileId);
  const accuracyPct = tracked > 0 ? (correct / tracked) * 100 : null;

  return (
    <div className="result-accuracy-card">
      <div className="result-accuracy-header">
        <span className="result-accuracy-title">
          {horizonLabel(horizon)}
          {profileName ? ` — ${profileName}` : ""}
        </span>
      </div>

      {tracked === 0 ? (
        <p className="muted result-accuracy-empty">
          {noEdge > 0 || noSignal > 0
            ? "No HIGHER/LOWER predictions to score yet."
            : "No resolved windows yet."}
        </p>
      ) : (
        <>
          <div
            className={`result-accuracy-value ${accuracyPct! >= 50 ? "result-accuracy-good" : "result-accuracy-poor"}`}
          >
            {accuracyPct!.toFixed(1)}%
          </div>
          <p className="result-accuracy-detail">
            {correct} correct of {tracked} prediction{tracked === 1 ? "" : "s"}
            {wrong > 0 && <span className="muted"> · {wrong} miss{wrong === 1 ? "" : "es"}</span>}
          </p>
        </>
      )}

      {tracked === 0 && noEdge === 0 && noSignal === 0 ? null : (
        <p className="muted result-accuracy-note">
          Only HIGHER/LOWER signals count toward accuracy. Skipped: {noEdge} no edge, {noSignal} no
          signal.
        </p>
      )}
    </div>
  );
}
