import type { ComboResult } from "../types/analysis";

interface ComboLeaderboardProps {
  results: ComboResult[];
  loading?: boolean;
  onSelectCombo: (comboKey: string) => void;
}

function formatPercent(value: number | null): string {
  if (value == null) return "n/a";
  return `${(value * 100).toFixed(1)}%`;
}

export function ComboLeaderboard({ results, loading, onSelectCombo }: ComboLeaderboardProps) {
  if (loading) {
    return (
      <section className="panel combo-leaderboard">
        <p className="muted">Running analysis...</p>
      </section>
    );
  }

  if (results.length === 0) {
    return (
      <section className="panel combo-leaderboard">
        <h2>Results</h2>
        <p className="muted">
          No combos met the minimum sample threshold. Try lowering min samples or wait for more
          snapshot data.
        </p>
      </section>
    );
  }

  return (
    <section className="panel combo-leaderboard">
      <h2>Top Combinations</h2>
      <div className="combo-leaderboard-table-wrap">
        <table className="combo-leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Accuracy</th>
              <th>Coverage</th>
              <th>Correct</th>
              <th>Wrong</th>
              <th>Combo</th>
            </tr>
          </thead>
          <tbody>
            {results.map((result, index) => {
              const accuracyPct = result.accuracy != null ? result.accuracy * 100 : null;
              return (
                <tr
                  key={result.comboKey}
                  className="combo-leaderboard-row"
                  onClick={() => onSelectCombo(result.comboKey)}
                >
                  <td>{index + 1}</td>
                  <td
                    className={
                      accuracyPct != null && accuracyPct >= 50
                        ? "result-accuracy-good"
                        : "result-accuracy-poor"
                    }
                  >
                    {formatPercent(result.accuracy)}
                  </td>
                  <td>{formatPercent(result.coverage)}</td>
                  <td>{result.correct}</td>
                  <td>{result.wrong}</td>
                  <td className="combo-leaderboard-combo">{result.comboKey}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted combo-leaderboard-hint">Click a row to see per-window breakdown.</p>
    </section>
  );
}
