import type { HypothesisProfileId, PredictionHorizon } from "../types";
import type { PolymarketWindowResult } from "../types/polymarket";
import { getProfileSignal } from "../types/polymarket";
import { horizonLabel } from "../predictionUtils";
import { CollapsibleSection } from "./CollapsibleSection";
import { ResultTimelineChart } from "./ResultTimelineChart";

interface PredictionResultFeedProps {
  selectedHorizon: PredictionHorizon;
  selectedProfile: HypothesisProfileId;
  profileName?: string;
  allWindows: Record<PredictionHorizon, PolymarketWindowResult[]>;
  activeWindows: Partial<Record<PredictionHorizon, PolymarketWindowResult>>;
}

function formatPrice(value: number | null): string {
  if (value == null) return "—";
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatChange(start: number | null, stop: number | null): string {
  if (start == null || stop == null) return "—";
  const delta = stop - start;
  const pct = (delta / start) * 100;
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(2)} (${sign}${pct.toFixed(3)}%)`;
}

function formatWindowTime(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return "Unknown window";
  }

  const fmt = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
  return `${fmt.format(startDate)} – ${fmt.format(endDate)}`;
}

function outcomeClass(outcome: PolymarketWindowResult["outcome"]): string {
  if (outcome === "Up") return "outcome-up";
  if (outcome === "Down") return "outcome-down";
  return "outcome-pending";
}

export function PredictionResultFeed({
  selectedHorizon,
  selectedProfile,
  profileName,
  allWindows,
  activeWindows,
}: PredictionResultFeedProps) {
  const windows = allWindows[selectedHorizon] ?? [];
  const activeWindow = activeWindows[selectedHorizon];
  const rows = activeWindow ? [activeWindow, ...windows.filter((w) => w.slug !== activeWindow.slug)] : windows;

  return (
    <section className="panel result-feed-panel">
      <h2>Polymarket Results</h2>
      <p className="panel-hint">
        Cumulative score charts: Up/Higher = +1, Down/Lower = -1. Prediction accuracy reflects the
        selected hypothesis profile&apos;s signal captured at window open (not NO_EDGE). Older windows
        may only have data for profiles captured after this feature was enabled. Prices from
        Polymarket RTDS (Chainlink for 5m/15m, Binance for 1h).
      </p>

      <ResultTimelineChart
        horizon={selectedHorizon}
        windows={windows}
        profileId={selectedProfile}
        profileName={profileName}
      />

      <CollapsibleSection title={`Window history — ${horizonLabel(selectedHorizon)}`} nested>
        {rows.length === 0 ? (
          <p className="muted">No window history yet. Results populate after the first sync.</p>
        ) : (
          <div className="result-feed-table-wrap">
            <table className="result-feed-table">
              <thead>
                <tr>
                  <th>Window</th>
                  <th>Start</th>
                  <th>Stop</th>
                  <th>Change</th>
                  <th>Signal</th>
                  <th>Outcome</th>
                  <th>Market</th>
                </tr>
              </thead>
              <tbody>
              {rows.map((row) => {
                const inProgress = activeWindow?.slug === row.slug;
                const awaitingOutcome =
                  !inProgress && !row.resolved && new Date(row.windowEnd).getTime() <= Date.now();
                const { direction, signalCorrect } = getProfileSignal(row, selectedProfile);
                  return (
                    <tr key={row.slug} className={inProgress ? "row-active" : undefined}>
                      <td>
                        <div className="result-window-title">{row.title}</div>
                        <div className="result-window-time">{formatWindowTime(row.windowStart, row.windowEnd)}</div>
                        {inProgress && <span className="result-status-badge">In progress</span>}
                      </td>
                      <td>{formatPrice(row.startPrice)}</td>
                      <td>{formatPrice(row.stopPrice)}</td>
                      <td>{formatChange(row.startPrice, row.stopPrice)}</td>
                      <td>
                        {direction ?? "—"}
                        {signalCorrect != null && (
                          <span className={signalCorrect ? "signal-correct" : "signal-wrong"}>
                            {signalCorrect ? " ✓" : " ✗"}
                          </span>
                        )}
                      </td>
                    <td>
                      <span className={`outcome-badge ${outcomeClass(row.outcome)}`}>
                        {row.outcome ??
                          (inProgress ? "Pending" : awaitingOutcome ? "Resolving…" : "—")}
                      </span>
                    </td>
                      <td>
                        <a href={row.polymarketUrl} target="_blank" rel="noreferrer">
                          View
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CollapsibleSection>
    </section>
  );
}
