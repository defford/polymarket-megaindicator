import type { ComboWindowResult } from "../types/analysis";
import { directionLabel } from "../predictionUtils";

interface ComboDrilldownProps {
  comboKey: string;
  windows: ComboWindowResult[];
  loading?: boolean;
  onClose: () => void;
}

function formatWindowTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resultSymbol(result: ComboWindowResult["result"]): string {
  if (result === "correct") return "✓";
  if (result === "wrong") return "✗";
  return "—";
}

export function ComboDrilldown({ comboKey, windows, loading, onClose }: ComboDrilldownProps) {
  return (
    <div className="combo-drilldown-backdrop" onClick={onClose} role="presentation">
      <div
        className="combo-drilldown panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="combo-drilldown-title"
      >
        <div className="combo-drilldown-header">
          <div>
            <h2 id="combo-drilldown-title">Window Breakdown</h2>
            <p className="muted combo-drilldown-combo">{comboKey}</p>
          </div>
          <button type="button" className="btn-settings" onClick={onClose}>
            Close
          </button>
        </div>

        {loading ? (
          <p className="muted">Loading window details...</p>
        ) : windows.length === 0 ? (
          <p className="muted">No window data available.</p>
        ) : (
          <div className="combo-drilldown-table-wrap">
            <table className="combo-drilldown-table">
              <thead>
                <tr>
                  <th>Window</th>
                  <th>Horizon</th>
                  <th>Outcome</th>
                  <th>Vote</th>
                  <th>Result</th>
                  <th>Signals</th>
                </tr>
              </thead>
              <tbody>
                {windows.map((row) => (
                  <tr key={row.slug}>
                    <td>{formatWindowTime(row.windowStart)}</td>
                    <td>{row.horizon}</td>
                    <td>{row.outcome}</td>
                    <td>{directionLabel(row.direction)}</td>
                    <td
                      className={
                        row.result === "correct"
                          ? "result-accuracy-good"
                          : row.result === "wrong"
                            ? "result-accuracy-poor"
                            : "muted"
                      }
                    >
                      {resultSymbol(row.result)}
                    </td>
                    <td className="combo-drilldown-signals">
                      {row.signals
                        .map((signal) => `${signal.key}: ${signal.action ?? "—"}`)
                        .join(" · ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
