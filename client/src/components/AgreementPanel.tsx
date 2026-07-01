import type { AgreementResult } from "../types";

interface AgreementPanelProps {
  results: AgreementResult[];
}

export function AgreementPanel({ results }: AgreementPanelProps) {
  if (!results.length) {
    return (
      <section className="panel">
        <h2>Agreement Rules</h2>
        <p className="muted">No enabled rules configured.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Agreement Rules</h2>
      <ul className="agreement-list">
        {results.map((rule) => (
          <li key={rule.ruleId} className={rule.matched ? "agreement-match" : "agreement-no-match"}>
            <div className="agreement-row">
              <span className="agreement-status">{rule.matched ? "✓" : "○"}</span>
              <div>
                <strong>{rule.name}</strong>
                <p className="agreement-details">{rule.details}</p>
                {rule.matchedTimeframes.length > 0 && (
                  <p className="agreement-tfs">Timeframes: {rule.matchedTimeframes.join(", ")}</p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
