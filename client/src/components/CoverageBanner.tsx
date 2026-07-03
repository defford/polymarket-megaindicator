import type { AnalysisStats } from "../types/analysis";
import type { PredictionHorizon } from "../types";
import { horizonLabel } from "../predictionUtils";

const HORIZONS: PredictionHorizon[] = ["5m", "15m", "1h"];

interface CoverageBannerProps {
  stats: AnalysisStats | null;
  loading?: boolean;
}

export function CoverageBanner({ stats, loading }: CoverageBannerProps) {
  if (loading && !stats) {
    return (
      <section className="panel coverage-banner">
        <p className="muted">Loading data coverage...</p>
      </section>
    );
  }

  if (!stats) return null;

  const coveragePct =
    stats.resolvedTotal > 0 ? (stats.withSnapshot / stats.resolvedTotal) * 100 : 0;

  return (
    <section className="panel coverage-banner">
      <div className="coverage-banner-header">
        <h2>Data Coverage</h2>
        <p className="muted coverage-note">
          Indicator snapshots are captured while the server runs. Coverage grows over time as new
          Polymarket windows open.
        </p>
      </div>

      <div className="coverage-summary">
        <div className="coverage-stat">
          <span className="coverage-stat-value">{stats.withSnapshot}</span>
          <span className="coverage-stat-label">windows with snapshots</span>
        </div>
        <div className="coverage-stat">
          <span className="coverage-stat-value">{stats.resolvedTotal}</span>
          <span className="coverage-stat-label">resolved windows</span>
        </div>
        <div className="coverage-stat">
          <span
            className={`coverage-stat-value ${coveragePct >= 50 ? "result-accuracy-good" : "result-accuracy-poor"}`}
          >
            {coveragePct.toFixed(0)}%
          </span>
          <span className="coverage-stat-label">joinable coverage</span>
        </div>
        <div className="coverage-stat">
          <span className="coverage-stat-value">{stats.withoutSnapshot}</span>
          <span className="coverage-stat-label">missing snapshots</span>
        </div>
      </div>

      <div className="coverage-grid">
        {HORIZONS.map((horizon) => {
          const row = stats.byHorizon[horizon];
          const pct =
            row.resolvedTotal > 0 ? (row.withSnapshot / row.resolvedTotal) * 100 : 0;
          return (
            <div key={horizon} className="coverage-grid-item">
              <span className="coverage-grid-horizon">{horizonLabel(horizon)}</span>
              <span className="coverage-grid-detail">
                {row.withSnapshot} / {row.resolvedTotal} joinable ({pct.toFixed(0)}%)
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
