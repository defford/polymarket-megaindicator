import type { PredictionSignal, TimeframeAnalysis } from "../types";
import { formatValue } from "../utils";

interface KeyIndicatorsProps {
  prediction: PredictionSignal | undefined;
  timeframes: TimeframeAnalysis[];
}

const KEY_NAMES = [
  "Relative Strength Index",
  "MACD Level",
  "Momentum",
  "Stochastic",
];

export function KeyIndicators({ prediction, timeframes }: KeyIndicatorsProps) {
  const anchor = prediction?.anchorTimeframe;
  const analysis = timeframes.find((t) => t.timeframe === anchor);

  if (!prediction || !analysis) {
    return (
      <section className="panel key-indicators-panel">
        <h3>Key Indicators</h3>
        <p className="muted">Select a prediction card to view anchor indicators.</p>
      </section>
    );
  }

  const rows = analysis.oscillators.indicators.filter((ind) =>
    KEY_NAMES.some((name) => ind.name.includes(name))
  );

  return (
    <section className="panel key-indicators-panel">
      <h3>Key Indicators ({anchor})</h3>
      <table className="indicator-table compact">
        <thead>
          <tr>
            <th>Indicator</th>
            <th>Value</th>
            <th>Signal</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td>{row.name.replace(/ \(.*\)/, "")}</td>
              <td className="mono">{formatValue(row.value)}</td>
              <td className={`action-${row.action.toLowerCase()}`}>{row.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="factors-list">
        {prediction.supportingFactors.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </section>
  );
}
