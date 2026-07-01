import { useCallback, useEffect, useState } from "react";
import { fetchConfig, fetchPolymarketResults, fetchProfiles, fetchSnapshot, triggerRefresh } from "./api/client";
import { AgreementPanel } from "./components/AgreementPanel";
import { ConfigPanel } from "./components/ConfigPanel";
import { CollapsibleSection } from "./components/CollapsibleSection";
import { ConflictWarnings } from "./components/ConflictWarnings";
import { ConfluenceStrip } from "./components/ConfluenceStrip";
import { HigherTfBias } from "./components/HigherTfBias";
import { IndicatorTable } from "./components/IndicatorTable";
import { KeyIndicators } from "./components/KeyIndicators";
import { LastUpdated } from "./components/LastUpdated";
import { PredictionCards, loadStoredProfile, storeSelectedProfile } from "./components/PredictionCards";
import { PredictionResultFeed } from "./components/PredictionResultFeed";
import { PriceHeader } from "./components/PriceHeader";
import { SummaryGauge } from "./components/SummaryGauge";
import { TimeframeMatrix } from "./components/TimeframeMatrix";
import type { HypothesisProfileId, HypothesisProfileMeta, PredictionHorizon, Snapshot, Timeframe } from "./types";
import type { PolymarketResultsResponse } from "./types/polymarket";
import "./App.css";

const ADVANCED_TFS: Timeframe[] = ["1m", "5m", "15m", "30m", "1h"];

export default function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [polymarketResults, setPolymarketResults] = useState<PolymarketResultsResponse | null>(null);
  const [timeframes, setTimeframes] = useState<Timeframe[]>([]);
  const [selectedHorizon, setSelectedHorizon] = useState<PredictionHorizon>("5m");
  const [selectedTf, setSelectedTf] = useState<Timeframe>("5m");
  const [pollSeconds, setPollSeconds] = useState(15);
  const [error, setError] = useState<string | null>(null);
  const [refreshCooldown, setRefreshCooldown] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<HypothesisProfileId>(loadStoredProfile);
  const [profileMeta, setProfileMeta] = useState<HypothesisProfileMeta[]>([]);

  const loadSnapshot = useCallback(async () => {
    try {
      const data = await fetchSnapshot();
      setSnapshot(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  const loadPolymarketResults = useCallback(async () => {
    try {
      const data = await fetchPolymarketResults();
      setPolymarketResults(data);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    fetchProfiles()
      .then((data) => setProfileMeta(data.profiles))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchConfig()
      .then((cfg) => {
        setTimeframes(cfg.timeframes);
        setPollSeconds(cfg.refresh.dashboardPollSeconds);
        const defaultHorizon = cfg.predictions?.horizons?.[0] ?? "5m";
        setSelectedHorizon(defaultHorizon);
        setSelectedTf(defaultHorizon);
      })
      .catch((err) => setError((err as Error).message));
  }, []);

  useEffect(() => {
    loadSnapshot();
    const id = setInterval(loadSnapshot, pollSeconds * 1000);
    return () => clearInterval(id);
  }, [loadSnapshot, pollSeconds]);

  useEffect(() => {
    loadPolymarketResults();
    const id = setInterval(loadPolymarketResults, pollSeconds * 1000);
    return () => clearInterval(id);
  }, [loadPolymarketResults, pollSeconds]);

  const handleRefresh = async (priorityOnly = true) => {
    setRefreshCooldown(true);
    try {
      const data = await triggerRefresh(priorityOnly);
      setSnapshot(data);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTimeout(() => setRefreshCooldown(false), 5000);
    }
  };

  const profilePredictions = snapshot?.profilePredictions?.[selectedProfile]
    ?? snapshot?.profilePredictions?.balanced
    ?? snapshot?.predictions
    ?? [];
  const selectedPrediction = profilePredictions.find((p) => p.horizon === selectedHorizon);
  const selected = snapshot?.timeframes.find((t) => t.timeframe === selectedTf);
  const matchedRules = snapshot?.agreementResults.filter((r) => r.matched) ?? [];
  const strongPredictions = profilePredictions.filter(
    (p) => p.direction !== "NO_EDGE" && p.confidence !== "LOW"
  ) ?? [];
  const activeProfileName = profileMeta.find((p) => p.id === selectedProfile)?.name;

  const handleProfileSelect = (profileId: HypothesisProfileId) => {
    setSelectedProfile(profileId);
    storeSelectedProfile(profileId);
  };

  const handleHorizonSelect = (horizon: PredictionHorizon) => {
    setSelectedHorizon(horizon);
    setSelectedTf(horizon);
  };

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>BTC Mega Indicator</h1>
          <p className="subtitle">Polymarket Decision Dashboard — BITSTAMP:BTCUSD</p>
        </div>
        <div className="header-actions">
          <button type="button" className="btn-settings" onClick={() => setConfigOpen(true)}>
            Settings
          </button>
          <LastUpdated
            lastRefreshAt={snapshot?.lastRefreshAt ?? null}
            stale={snapshot?.stale ?? false}
            refreshing={snapshot?.refreshing ?? false}
            onRefresh={() => handleRefresh(true)}
            refreshDisabled={refreshCooldown}
          />
        </div>
      </header>

      <ConfigPanel
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        onApplied={(data) => {
          setSnapshot(data);
          fetchConfig()
            .then((cfg) => setPollSeconds(cfg.refresh.dashboardPollSeconds))
            .catch(() => {});
        }}
        currentPredictions={snapshot?.predictions ?? []}
      />

      <PriceHeader
        symbol={snapshot?.symbol ?? "BTCUSD"}
        exchange={snapshot?.exchange ?? "BITSTAMP"}
        marketContext={snapshot?.marketContext}
      />

      {error && <div className="error-banner">{error}</div>}

      {strongPredictions.length > 0 && (
        <div className="alert-banner">
          Actionable signals:{" "}
          {strongPredictions.map((p) => `${p.horizon} ${p.direction} (${p.confidence})`).join(" · ")}
        </div>
      )}

      <PredictionCards
        profilePredictions={snapshot?.profilePredictions}
        fallbackPredictions={snapshot?.predictions ?? []}
        profiles={profileMeta}
        selectedProfile={selectedProfile}
        selectedHorizon={selectedHorizon}
        onSelectHorizon={handleHorizonSelect}
        onSelectProfile={handleProfileSelect}
      />

      <PredictionResultFeed
        selectedHorizon={selectedHorizon}
        selectedProfile={selectedProfile}
        profileName={activeProfileName}
        allWindows={
          polymarketResults?.windows ?? { "5m": [], "15m": [], "1h": [] }
        }
        activeWindows={polymarketResults?.activeWindows ?? {}}
      />

      <div className="context-row">
        <ConfluenceStrip
          timeframes={snapshot?.timeframes ?? []}
          selectedPrediction={selectedPrediction}
        />
        <ConflictWarnings predictions={profilePredictions} />
      </div>

      <div className="context-row">
        <HigherTfBias timeframes={snapshot?.timeframes ?? []} />
        <KeyIndicators prediction={selectedPrediction} timeframes={snapshot?.timeframes ?? []} />
      </div>

      <CollapsibleSection title="Advanced TA">
        {matchedRules.length > 0 && (
          <div className="alert-banner subtle">
            Confluence rules matched: {matchedRules.map((r) => r.name).join(", ")}
          </div>
        )}

        <section className="panel nested-panel">
          <h2>Multi-Timeframe Matrix</h2>
          <TimeframeMatrix
            timeframes={snapshot?.timeframes ?? []}
            orderedTimeframes={timeframes}
          />
        </section>

        <AgreementPanel results={snapshot?.agreementResults ?? []} />

        <section className="panel nested-panel">
          <h2>Timeframe Detail</h2>
          <div className="tf-tabs">
            {ADVANCED_TFS.map((tf) => (
              <button
                key={tf}
                type="button"
                className={tf === selectedTf ? "tf-tab active" : "tf-tab"}
                onClick={() => setSelectedTf(tf)}
              >
                {tf}
              </button>
            ))}
          </div>

          {selected ? (
            <>
              <div className="gauge-grid">
                <SummaryGauge title="Summary" gauge={selected.summary} />
                <SummaryGauge title="Oscillators" gauge={selected.oscillators} />
                <SummaryGauge title="Moving Averages" gauge={selected.movingAverages} />
              </div>
              <div className="indicator-grid">
                <IndicatorTable title="Oscillators" rows={selected.oscillators.indicators} />
                <IndicatorTable title="Moving Averages" rows={selected.movingAverages.indicators} />
              </div>
            </>
          ) : (
            <p className="muted">No data for {selectedTf} yet.</p>
          )}
        </section>
      </CollapsibleSection>

      <footer className="footer">
        Data sourced from TradingView scanner API. For personal Polymarket decision support only. Not investment advice.
      </footer>
    </div>
  );
}
