import { formatTime } from "../utils";

interface LastUpdatedProps {
  lastRefreshAt: string | null;
  stale: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  refreshDisabled: boolean;
}

export function LastUpdated({
  lastRefreshAt,
  stale,
  refreshing,
  onRefresh,
  refreshDisabled,
}: LastUpdatedProps) {
  return (
    <div className="last-updated">
      <span>
        Last updated: {formatTime(lastRefreshAt)}
        {stale && <span className="stale-badge"> (stale)</span>}
        {refreshing && <span className="refreshing-badge"> Refreshing…</span>}
      </span>
      <button type="button" onClick={onRefresh} disabled={refreshDisabled || refreshing}>
        Refresh
      </button>
    </div>
  );
}
