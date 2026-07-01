import type { HypothesisProfileId, PredictionHorizon } from "../types";
import type { PolymarketWindowResult } from "../types/polymarket";
import { horizonLabel } from "../predictionUtils";
import {
  buildPolyline,
  buildTimelineSeries,
  formatMatchTooltip,
  getDefaultChartLayout,
  scaleLinear,
} from "../polymarketChartUtils";

interface ResultTimelineChartProps {
  horizon: PredictionHorizon;
  windows: PolymarketWindowResult[];
  profileId: HypothesisProfileId;
  profileName?: string;
}

function formatScore(score: number): string {
  return score >= 0 ? `+${score}` : `${score}`;
}

export function ResultTimelineChart({
  horizon,
  windows,
  profileId,
  profileName,
}: ResultTimelineChartProps) {
  const { points: series, tracked, correct, wrong, noSignal } = buildTimelineSeries(
    windows,
    profileId
  );

  if (series.length < 2) {
    return (
      <div className="timeline-chart">
        <div className="timeline-chart-header">
          <span className="timeline-chart-title">{horizonLabel(horizon)}</span>
        </div>
        <p className="muted timeline-chart-empty">Need at least 2 resolved windows.</p>
      </div>
    );
  }

  const layout = getDefaultChartLayout();
  const { width, height, padding } = layout;
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const times = series.map((p) => p.time);
  const tMin = times[0];
  const tMax = times[times.length - 1];

  const yValues = series.flatMap((p) =>
    p.predictionScore != null ? [p.resultScore, p.predictionScore] : [p.resultScore]
  );
  const yMin = Math.min(0, ...yValues);
  const yMax = Math.max(0, ...yValues);
  const yPad = yMin === yMax ? 1 : 0;

  const xScale = (t: number) =>
    scaleLinear([tMin, tMax], [padding.left, padding.left + plotW], t);
  const yScale = (v: number) =>
    scaleLinear([yMin - yPad, yMax + yPad], [padding.top + plotH, padding.top], v);

  const zeroY = yScale(0);
  const last = series[series.length - 1];
  const lastPrediction = [...series].reverse().find((p) => p.predictionScore != null);

  const resultPoints = series.map((p) => ({ x: xScale(p.time), y: yScale(p.resultScore) }));
  const predictionPoints = series.map((p) => ({
    x: xScale(p.time),
    y: p.predictionScore != null ? yScale(p.predictionScore) : NaN,
  }));

  const xLabels =
    series.length <= 6
      ? series
      : [series[0], series[Math.floor(series.length / 2)], series[series.length - 1]];

  return (
    <div className="timeline-chart">
      <div className="timeline-chart-header">
        <span className="timeline-chart-title">
          {horizonLabel(horizon)} cumulative score
          {profileName ? ` — ${profileName}` : ""}
        </span>
        <span className="timeline-chart-totals">
          Result {formatScore(last.resultScore)}
          {lastPrediction != null && (
            <> · Prediction {formatScore(lastPrediction.predictionScore!)}</>
          )}
        </span>
      </div>

      <svg
        className="timeline-chart-svg"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${horizonLabel(horizon)} cumulative result and prediction scores`}
      >
        <line
          x1={padding.left}
          y1={zeroY}
          x2={padding.left + plotW}
          y2={zeroY}
          className="timeline-zero-line"
        />

        {yMin < 0 && yMax > 0 && (
          <text x={padding.left - 4} y={zeroY + 3} className="timeline-axis-label" textAnchor="end">
            0
          </text>
        )}

        <path d={buildPolyline(resultPoints)} className="timeline-line timeline-line-result" fill="none" />
        {tracked > 0 && (
          <path
            d={buildPolyline(predictionPoints, true)}
            className="timeline-line timeline-line-prediction"
            fill="none"
          />
        )}

        {series.map((point) => {
          const x = xScale(point.time);
          const y = yScale(point.resultScore);
          const hasTrackedSignal =
            point.signalDirection != null &&
            point.signalDirection !== "NO_EDGE" &&
            point.signalCorrect != null;

          if (!hasTrackedSignal) return null;

          const markerClass = point.signalCorrect
            ? "timeline-marker timeline-marker-match"
            : "timeline-marker timeline-marker-miss";

          return (
            <g key={point.time} className={markerClass}>
              <circle cx={x} cy={y} r={5} className="timeline-marker-ring" />
              <text x={x} y={y + 3.5} className="timeline-marker-label" textAnchor="middle">
                {point.signalCorrect ? "✓" : "✗"}
              </text>
              <title>{formatMatchTooltip(point)}</title>
            </g>
          );
        })}

        {xLabels.map((p) => (
          <text
            key={p.time}
            x={xScale(p.time)}
            y={height - 4}
            className="timeline-axis-label"
            textAnchor="middle"
          >
            {p.timeLabel}
          </text>
        ))}
      </svg>

      <div className="timeline-legend">
        <span className="timeline-legend-item">
          <span className="timeline-legend-swatch timeline-line-result" /> Result (Up +1 / Down -1)
        </span>
        {tracked > 0 && (
          <span className="timeline-legend-item">
            <span className="timeline-legend-swatch timeline-line-prediction" /> Prediction score
          </span>
        )}
        <span className="timeline-legend-item">
          <span className="timeline-legend-swatch timeline-marker-match" /> Match ({correct})
        </span>
        <span className="timeline-legend-item">
          <span className="timeline-legend-swatch timeline-marker-miss" /> Miss ({wrong})
        </span>
      </div>

      {tracked === 0 ? (
        <p className="muted timeline-chart-note">
          No signal markers yet for this profile — the server records all 12 hypothesis signals when
          each window opens. Markers appear after the server has been running across new windows.
        </p>
      ) : noSignal > 0 ? (
        <p className="muted timeline-chart-note">
          {tracked} window{tracked === 1 ? "" : "s"} with signal markers ({correct} match
          {correct === 1 ? "" : "es"}, {wrong} miss{wrong === 1 ? "" : "es"}). {noSignal} older
          window{noSignal === 1 ? "" : "s"} have no captured signal.
        </p>
      ) : null}
    </div>
  );
}
