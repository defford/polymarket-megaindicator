import type { GaugeSummary } from "../types";
import { recommendationColor, recommendationLabel } from "../utils";

interface SummaryGaugeProps {
  title: string;
  gauge: GaugeSummary;
}

export function SummaryGauge({ title, gauge }: SummaryGaugeProps) {
  const total = gauge.buy + gauge.sell + gauge.neutral || 1;
  const buyPct = (gauge.buy / total) * 100;
  const neutralPct = (gauge.neutral / total) * 100;
  const sellPct = (gauge.sell / total) * 100;
  const color = recommendationColor(gauge.recommendation);

  return (
    <div className="gauge-card">
      <div className="gauge-header">
        <h3>{title}</h3>
        <span className="gauge-rec" style={{ color }}>
          {recommendationLabel(gauge.recommendation)}
        </span>
      </div>
      <div className="gauge-bar">
        <div className="gauge-segment sell" style={{ width: `${sellPct}%` }} />
        <div className="gauge-segment neutral" style={{ width: `${neutralPct}%` }} />
        <div className="gauge-segment buy" style={{ width: `${buyPct}%` }} />
      </div>
      <div className="gauge-counts">
        <span className="sell-text">Sell {gauge.sell}</span>
        <span className="neutral-text">Neutral {gauge.neutral}</span>
        <span className="buy-text">Buy {gauge.buy}</span>
      </div>
    </div>
  );
}
