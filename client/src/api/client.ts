import type {
  ConfigPreviewResult,
  ConfigSettings,
  ConfigSettingsResponse,
  PredictionHorizon,
  ProfilesResponse,
  Snapshot,
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
