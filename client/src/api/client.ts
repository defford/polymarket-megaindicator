import type {
  AnalysisStats,
  ComboEvaluateResult,
  ComboSearchParams,
  ComboSearchSummary,
  ComboWindowsResponse,
  IndicatorCatalog,
} from "../types/analysis";
import type {
  ConfigPreviewResult,
  ConfigSettings,
  ConfigSettingsResponse,
  PredictionHorizon,
  ProfilesResponse,
  Snapshot,
  Timeframe,
} from "../types";
import type { PolymarketResultsResponse } from "../types/polymarket";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchSnapshot(): Promise<Snapshot> {
  return request<Snapshot>("/api/snapshot");
}

export function fetchConfig() {
  return request<import("../types").AppConfigView>("/api/config");
}

export function fetchConfigSettings(): Promise<ConfigSettingsResponse> {
  return request<ConfigSettingsResponse>("/api/config/settings");
}

export function previewConfigSettings(settings: ConfigSettings): Promise<ConfigPreviewResult> {
  return request<ConfigPreviewResult>("/api/config/preview", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
}

export function saveConfigSettings(settings: ConfigSettings): Promise<{ settings: ConfigSettings; snapshot: Snapshot }> {
  return request("/api/config/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
}

export function loadPreset(presetId: ConfigSettings["preset"]) {
  return request<{
    settings: ConfigSettings;
    preview: ConfigPreviewResult;
  }>(`/api/config/preset/${presetId}`, { method: "POST" });
}

export function triggerRefresh(priorityOnly = false): Promise<Snapshot> {
  const qs = priorityOnly ? "?priorityOnly=true" : "";
  return request<Snapshot>(`/api/refresh${qs}`, { method: "POST" });
}

export function fetchPolymarketResults(horizon?: PredictionHorizon): Promise<PolymarketResultsResponse> {
  const qs = horizon ? `?horizon=${encodeURIComponent(horizon)}` : "";
  return request<PolymarketResultsResponse>(`/api/polymarket/results${qs}`);
}

export function fetchProfiles(): Promise<ProfilesResponse> {
  return request<ProfilesResponse>("/api/profiles");
}

export function fetchAnalysisStats(horizon?: PredictionHorizon | "all"): Promise<AnalysisStats> {
  const qs = horizon ? `?horizon=${encodeURIComponent(horizon)}` : "";
  return request<AnalysisStats>(`/api/analysis/stats${qs}`);
}

export function fetchIndicatorCatalog(): Promise<IndicatorCatalog> {
  return request<IndicatorCatalog>("/api/analysis/indicators");
}

export function searchCombos(params: ComboSearchParams = {}): Promise<ComboSearchSummary> {
  const search = new URLSearchParams();
  if (params.horizon) search.set("horizon", params.horizon);
  if (params.maxSize != null) search.set("maxSize", String(params.maxSize));
  if (params.minSamples != null) search.set("minSamples", String(params.minSamples));
  if (params.top != null) search.set("top", String(params.top));
  if (params.timeframes?.length) search.set("timeframes", params.timeframes.join(","));
  const qs = search.toString();
  return request<ComboSearchSummary>(`/api/analysis/combos${qs ? `?${qs}` : ""}`);
}

export function evaluateCombo(body: {
  comboKeys: string[];
  horizon?: PredictionHorizon | "all";
}): Promise<ComboEvaluateResult> {
  return request<ComboEvaluateResult>("/api/analysis/combos/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function fetchComboWindows(
  combo: string,
  horizon?: PredictionHorizon | "all"
): Promise<ComboWindowsResponse> {
  const search = new URLSearchParams({ combo });
  if (horizon) search.set("horizon", horizon);
  return request<ComboWindowsResponse>(`/api/analysis/combos/windows?${search.toString()}`);
}

export const DEFAULT_HORIZON_TIMEFRAMES: Record<PredictionHorizon, Timeframe[]> = {
  "5m": ["1m", "5m", "15m"],
  "15m": ["5m", "15m", "30m"],
  "1h": ["15m", "30m", "1h"],
};
