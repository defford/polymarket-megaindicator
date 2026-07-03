import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_HORIZON_TIMEFRAMES,
  evaluateCombo,
  fetchAnalysisStats,
  fetchComboWindows,
  fetchIndicatorCatalog,
  searchCombos,
} from "../api/client";
import { ComboBuilder } from "../components/ComboBuilder";
import { ComboDrilldown } from "../components/ComboDrilldown";
import { ComboLeaderboard } from "../components/ComboLeaderboard";
import { CoverageBanner } from "../components/CoverageBanner";
import type {
  AnalysisStats,
  ComboEvaluateResult,
  ComboResult,
  ComboSearchSummary,
  ComboWindowResult,
  IndicatorCatalog,
} from "../types/analysis";
import type { PredictionHorizon, Timeframe } from "../types";

const HORIZONS: PredictionHorizon[] = ["5m", "15m", "1h"];

export default function AnalysisPage() {
  const [stats, setStats] = useState<AnalysisStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [catalog, setCatalog] = useState<IndicatorCatalog | null>(null);
  const [horizon, setHorizon] = useState<PredictionHorizon>("5m");
  const [maxSize, setMaxSize] = useState(2);
  const [minSamples, setMinSamples] = useState(5);
  const [top, setTop] = useState(25);
  const [timeframes, setTimeframes] = useState<Timeframe[]>(DEFAULT_HORIZON_TIMEFRAMES["5m"]);
  const [searchSummary, setSearchSummary] = useState<ComboSearchSummary | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [builderResult, setBuilderResult] = useState<ComboEvaluateResult | null>(null);
  const [builderLoading, setBuilderLoading] = useState(false);
  const [drilldownCombo, setDrilldownCombo] = useState<string | null>(null);
  const [drilldownWindows, setDrilldownWindows] = useState<ComboWindowResult[]>([]);
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const data = await fetchAnalysisStats();
      setStats(data);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    const id = setInterval(loadStats, 60_000);
    return () => clearInterval(id);
  }, [loadStats]);

  useEffect(() => {
    fetchIndicatorCatalog()
      .then(setCatalog)
      .catch(() => setCatalog(null));
  }, []);

  useEffect(() => {
    setTimeframes(DEFAULT_HORIZON_TIMEFRAMES[horizon]);
    setSearchSummary(null);
    setBuilderResult(null);
  }, [horizon]);

  const scoredWindows = stats?.byHorizon[horizon]?.withSnapshot ?? 0;
  const canRun = scoredWindows >= minSamples;

  const handleHorizonChange = (next: PredictionHorizon) => {
    setHorizon(next);
  };

  const toggleTimeframe = (tf: Timeframe) => {
    setTimeframes((prev) =>
      prev.includes(tf) ? prev.filter((t) => t !== tf) : [...prev, tf]
    );
  };

  const handleRunAnalysis = async () => {
    setSearchLoading(true);
    setSearchError(null);
    try {
      const summary = await searchCombos({
        horizon,
        maxSize,
        minSamples,
        top,
        timeframes: timeframes.length > 0 ? timeframes : DEFAULT_HORIZON_TIMEFRAMES[horizon],
      });
      setSearchSummary(summary);
    } catch (err) {
      setSearchError((err as Error).message);
      setSearchSummary(null);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleTestCombo = async (comboKeys: string[]) => {
    setBuilderLoading(true);
    try {
      const result = await evaluateCombo({ comboKeys, horizon });
      setBuilderResult(result);
    } catch (err) {
      setSearchError((err as Error).message);
    } finally {
      setBuilderLoading(false);
    }
  };

  const openDrilldown = async (comboKey: string) => {
    setDrilldownCombo(comboKey);
    setDrilldownLoading(true);
    setDrilldownWindows([]);
    try {
      const data = await fetchComboWindows(comboKey, horizon);
      setDrilldownWindows(data.windows);
    } catch {
      setDrilldownWindows([]);
    } finally {
      setDrilldownLoading(false);
    }
  };

  const closeDrilldown = () => {
    setDrilldownCombo(null);
    setDrilldownWindows([]);
  };

  const results: ComboResult[] = searchSummary?.results ?? [];

  return (
    <div className="analysis-page">
      <CoverageBanner stats={stats} loading={statsLoading} />

      <section className="panel analysis-controls">
        <h2>Search Controls</h2>

        <div className="analysis-horizon-tabs tf-tabs">
          {HORIZONS.map((h) => (
            <button
              key={h}
              type="button"
              className={h === horizon ? "tf-tab active" : "tf-tab"}
              onClick={() => handleHorizonChange(h)}
            >
              {h}
            </button>
          ))}
        </div>

        <div className="analysis-control-grid">
          <label className="analysis-control">
            <span>Max combo size</span>
            <select value={maxSize} onChange={(e) => setMaxSize(Number(e.target.value))}>
              <option value={1}>1 (singles)</option>
              <option value={2}>2 (pairs)</option>
              <option value={3}>3 (triples)</option>
            </select>
          </label>

          <label className="analysis-control">
            <span>Min samples</span>
            <input
              type="number"
              min={1}
              max={1000}
              value={minSamples}
              onChange={(e) => setMinSamples(Number(e.target.value))}
            />
          </label>

          <label className="analysis-control">
            <span>Top results</span>
            <input
              type="number"
              min={1}
              max={50}
              value={top}
              onChange={(e) => setTop(Number(e.target.value))}
            />
          </label>
        </div>

        {catalog && (
          <div className="analysis-timeframes">
            <span className="analysis-control-label">Timeframes</span>
            <div className="tf-tabs">
              {DEFAULT_HORIZON_TIMEFRAMES[horizon].map((tf) => (
                <button
                  key={tf}
                  type="button"
                  className={timeframes.includes(tf) ? "tf-tab active" : "tf-tab"}
                  onClick={() => toggleTimeframe(tf)}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="analysis-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={!canRun || searchLoading}
            onClick={handleRunAnalysis}
          >
            {searchLoading ? "Running..." : "Run analysis"}
          </button>
          {!canRun && (
            <p className="muted analysis-run-hint">
              Need at least {minSamples} resolved windows with snapshots for {horizon} (currently{" "}
              {scoredWindows}).
            </p>
          )}
        </div>

        {searchError && <div className="error-banner">{searchError}</div>}

        {searchSummary && !searchLoading && (
          <p className="muted analysis-meta">
            Evaluated {searchSummary.combosEvaluated.toLocaleString()} combos from{" "}
            {searchSummary.candidateSignals} candidate signals across{" "}
            {searchSummary.resolvedWindows} windows.
          </p>
        )}
      </section>

      <ComboLeaderboard
        results={results}
        loading={searchLoading}
        onSelectCombo={openDrilldown}
      />

      <ComboBuilder
        catalog={catalog}
        horizon={horizon}
        onTest={handleTestCombo}
        result={builderResult}
        loading={builderLoading}
        onViewWindows={openDrilldown}
      />

      {drilldownCombo && (
        <ComboDrilldown
          comboKey={drilldownCombo}
          windows={drilldownWindows}
          loading={drilldownLoading}
          onClose={closeDrilldown}
        />
      )}
    </div>
  );
}
