import type { Timeframe, TimeframeAnalysis } from "../types";
import { recommendationColor, recommendationLabel } from "../utils";

interface TimeframeMatrixProps {
  timeframes: TimeframeAnalysis[];
  orderedTimeframes: Timeframe[];
}

type GaugeKey = "summary" | "oscillators" | "movingAverages";

const COLUMNS: { key: GaugeKey; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "oscillators", label: "Oscillators" },
  { key: "movingAverages", label: "Moving Averages" },
];

export function TimeframeMatrix({ timeframes, orderedTimeframes }: TimeframeMatrixProps) {
  const byTf = new Map(timeframes.map((t) => [t.timeframe, t]));

  return (
    <div className="matrix-wrapper">
      <table className="matrix-table">
        <thead>
          <tr>
            <th>Timeframe</th>
            {COLUMNS.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orderedTimeframes.map((tf) => {
            const row = byTf.get(tf);
            return (
              <tr key={tf}>
                <td className="tf-cell">{tf}</td>
                {COLUMNS.map((col) => {
                  const gauge = row?.[col.key];
                  if (!gauge) {
                    return (
                      <td key={col.key} className="matrix-cell empty">
                        —
                      </td>
                    );
                  }
                  return (
                    <td
                      key={col.key}
                      className="matrix-cell"
                      style={{
                        backgroundColor: `${recommendationColor(gauge.recommendation)}22`,
                        color: recommendationColor(gauge.recommendation),
                      }}
                    >
                      {recommendationLabel(gauge.recommendation)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
