import { useMemo, useState } from "react";
import type { ComboEvaluateResult, IndicatorCatalog } from "../types/analysis";
import type { PredictionHorizon, Timeframe } from "../types";

interface ComboBuilderProps {
  catalog: IndicatorCatalog | null;
  horizon: PredictionHorizon;
  onTest: (comboKeys: string[]) => void;
  result: ComboEvaluateResult | null;
  loading?: boolean;
  onViewWindows: (comboKey: string) => void;
}

function toSignalKey(timeframe: Timeframe, indicatorId: string): string {
  return `${timeframe}:${indicatorId}`;
}

export function ComboBuilder({
  catalog,
  horizon,
  onTest,
  result,
  loading,
  onViewWindows,
}: ComboBuilderProps) {
  const [selectedTf, setSelectedTf] = useState<Timeframe>(horizon);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  const defaultTimeframes = useMemo(() => {
    if (!catalog) return [horizon];
    const preferred =
      horizon === "5m"
        ? (["1m", "5m", "15m"] as Timeframe[])
        : horizon === "15m"
          ? (["5m", "15m", "30m"] as Timeframe[])
          : (["15m", "30m", "1h"] as Timeframe[]);
    return preferred.filter((tf) => catalog.timeframes.includes(tf));
  }, [catalog, horizon]);

  const activeTf = catalog?.timeframes.includes(selectedTf)
    ? selectedTf
    : defaultTimeframes[0] ?? horizon;

  const toggleIndicator = (indicatorId: string) => {
    const key = toSignalKey(activeTf, indicatorId);
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const removeKey = (key: string) => {
    setSelectedKeys((prev) => prev.filter((k) => k !== key));
  };

  const handleTest = () => {
    if (selectedKeys.length === 0) return;
    onTest(selectedKeys);
  };

  if (!catalog) {
    return (
      <section className="panel combo-builder">
        <p className="muted">Loading indicator catalog...</p>
      </section>
    );
  }

  const accuracyPct =
    result?.summary.accuracy != null ? result.summary.accuracy * 100 : null;

  return (
    <section className="panel combo-builder">
      <h2>Custom Combo Builder</h2>
      <p className="muted">
        Pick indicators and timeframes, then test how a majority vote would have matched Polymarket
        outcomes.
      </p>

      <div className="combo-builder-tf-row">
        <span className="combo-builder-label">Timeframe</span>
        <div className="tf-tabs">
          {defaultTimeframes.map((tf) => (
            <button
              key={tf}
              type="button"
              className={tf === activeTf ? "tf-tab active" : "tf-tab"}
              onClick={() => setSelectedTf(tf)}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      <div className="combo-builder-groups">
        {(
          [
            ["Oscillators", catalog.oscillators],
            ["Moving Averages", catalog.movingAverages],
            ["Gauges", catalog.gauges],
          ] as const
        ).map(([title, entries]) => (
          <div key={title} className="combo-builder-group">
            <h3>{title}</h3>
            <div className="combo-builder-options">
              {entries.map((entry) => {
                const key = toSignalKey(activeTf, entry.id);
                const selected = selectedKeys.includes(key);
                return (
                  <button
                    key={entry.id}
                    type="button"
                    className={selected ? "combo-builder-option selected" : "combo-builder-option"}
                    onClick={() => toggleIndicator(entry.id)}
                  >
                    {entry.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {selectedKeys.length > 0 && (
        <div className="combo-builder-selected">
          {selectedKeys.map((key) => (
            <button
              key={key}
              type="button"
              className="combo-builder-chip"
              onClick={() => removeKey(key)}
              title="Remove"
            >
              {key} ×
            </button>
          ))}
        </div>
      )}

      <div className="combo-builder-actions">
        <button
          type="button"
          className="btn-primary"
          disabled={selectedKeys.length === 0 || loading}
          onClick={handleTest}
        >
          {loading ? "Testing..." : "Test combo"}
        </button>
      </div>

      {result && (
        <div className="combo-builder-result">
          <div
            className={`result-accuracy-value ${accuracyPct != null && accuracyPct >= 50 ? "result-accuracy-good" : "result-accuracy-poor"}`}
          >
            {accuracyPct != null ? `${accuracyPct.toFixed(1)}%` : "n/a"}
          </div>
          <p className="result-accuracy-detail">
            {result.summary.correct} correct of {result.summary.directional} directional ·{" "}
            {result.summary.wrong} wrong · {result.summary.noEdge} no edge
          </p>
          <button
            type="button"
            className="btn-settings"
            onClick={() => onViewWindows(result.summary.comboKey)}
          >
            View window breakdown
          </button>
        </div>
      )}
    </section>
  );
}
