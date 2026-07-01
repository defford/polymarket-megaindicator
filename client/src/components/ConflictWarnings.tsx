import type { PredictionSignal } from "../types";

interface ConflictWarningsProps {
  predictions: PredictionSignal[];
}

export function ConflictWarnings({ predictions }: ConflictWarningsProps) {
  const allWarnings = predictions.flatMap((p) =>
    p.warnings.map((w) => ({ horizon: p.horizon, text: w }))
  );

  if (!allWarnings.length) {
    return (
      <section className="panel warnings-panel warnings-clear">
        <h3>Risk Warnings</h3>
        <p className="muted">No active conflicts or fade risks detected.</p>
      </section>
    );
  }

  return (
    <section className="panel warnings-panel">
      <h3>Risk Warnings</h3>
      <ul className="warnings-list">
        {allWarnings.map((w, i) => (
          <li key={`${w.horizon}-${i}`}>
            <span className="warning-horizon">{w.horizon}</span>
            {w.text}
          </li>
        ))}
      </ul>
    </section>
  );
}
