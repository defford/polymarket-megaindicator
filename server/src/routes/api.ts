import { Router } from "express";
import type { ConfigManager } from "../config/loadConfig.js";
import { PRESET_META, getPresetSettings, mergeSettingsIntoConfig, type ConfigSettings } from "../config/configSettings.js";
import { getHypothesisProfileMeta } from "../services/profileEngine.js";
import type { DataService } from "../services/dataService.js";
import type { WindowHistoryService } from "../services/polymarket/windowHistoryService.js";
import { parseSignalKeys, parseTimeframeList } from "../analysis/comboSearch.js";
import type { PredictionHorizon } from "../types/analysis.js";

export function createApiRouter(
  configManager: ConfigManager,
  dataService: DataService,
  windowHistoryService: WindowHistoryService
): Router {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  router.get("/profiles", (_req, res) => {
    res.json({ profiles: getHypothesisProfileMeta() });
  });

  router.get("/config", (_req, res) => {
    const config = configManager.getConfig();
    res.json({
      symbol: config.symbol,
      timeframes: config.timeframes,
      refresh: {
        dashboardPollSeconds: config.refresh.dashboardPollSeconds,
        backgroundRefreshSeconds: config.refresh.backgroundRefreshSeconds,
        priorityTimeframes: config.refresh.priorityTimeframes,
      },
      predictions: {
        horizons: config.predictions.horizons,
      },
      agreementRules: config.agreementRules.map((r) => ({
        id: r.id,
        name: r.name,
        enabled: r.enabled,
        type: r.type,
      })),
    });
  });

  router.get("/config/settings", (_req, res) => {
    res.json({
      settings: configManager.getSettings(),
      presets: PRESET_META,
    });
  });

  router.post("/config/preview", (req, res) => {
    const settings = req.body as ConfigSettings;
    if (!settings?.predictions) {
      res.status(400).json({ error: "Invalid settings payload" });
      return;
    }

    const currentConfig = configManager.getConfig();
    const draftConfig = mergeSettingsIntoConfig(currentConfig, settings);
    const currentSnapshot = dataService.getSnapshot(currentConfig);
    const draftSnapshot = dataService.getSnapshot(draftConfig);

    res.json({
      current: currentSnapshot.predictions,
      draft: draftSnapshot.predictions,
      impact: summarizeImpact(currentSnapshot.predictions, draftSnapshot.predictions),
    });
  });

  router.put("/config/settings", (req, res) => {
    const settings = req.body as ConfigSettings;
    if (!settings?.predictions) {
      res.status(400).json({ error: "Invalid settings payload" });
      return;
    }

    try {
      configManager.applySettings(settings);
      configManager.save();
      const snapshot = dataService.getSnapshot();
      res.json({
        settings: configManager.getSettings(),
        snapshot,
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  router.post("/config/preset/:presetId", (req, res) => {
    const presetId = req.params.presetId as ConfigSettings["preset"];
    const current = configManager.getSettings();
    const settings = getPresetSettings(presetId, current.agreementRules);
    const draftConfig = mergeSettingsIntoConfig(configManager.getConfig(), settings);
    const currentPredictions = dataService.getSnapshot().predictions;
    const draftPredictions = dataService.getSnapshot(draftConfig).predictions;

    res.json({
      settings,
      preview: {
        current: currentPredictions,
        draft: draftPredictions,
        impact: summarizeImpact(currentPredictions, draftPredictions),
      },
    });
  });

  router.get("/snapshot", (_req, res) => {
    res.json(dataService.getSnapshot());
  });

  router.get("/polymarket/results", (req, res) => {
    const horizon = req.query.horizon as PredictionHorizon | undefined;
    if (horizon && !["5m", "15m", "1h"].includes(horizon)) {
      res.status(400).json({ error: "Invalid horizon. Use 5m, 15m, or 1h." });
      return;
    }
    res.json(windowHistoryService.getResults(horizon));
  });

  router.post("/refresh", async (req, res) => {
    const priorityOnly = req.query.priorityOnly === "true";
    try {
      const snapshot = await dataService.refresh(true, priorityOnly);
      res.json(snapshot);
    } catch (err) {
      const error = err as Error & { statusCode?: number };
      if (error.statusCode === 429) {
        res.status(429).json({ error: error.message });
        return;
      }
      res.status(500).json({ error: error.message ?? "Refresh failed" });
    }
  });

  router.get("/analysis/stats", (req, res) => {
    const horizon = parseHorizonQuery(req.query.horizon);
    if (horizon === "invalid") {
      res.status(400).json({ error: "Invalid horizon. Use 5m, 15m, 1h, or all." });
      return;
    }
    res.json(windowHistoryService.getAnalysisStats(horizon));
  });

  router.get("/analysis/indicators", (_req, res) => {
    res.json(windowHistoryService.getIndicatorCatalog());
  });

  router.get("/analysis/combos", (req, res) => {
    const horizon = parseHorizonQuery(req.query.horizon);
    if (horizon === "invalid") {
      res.status(400).json({ error: "Invalid horizon. Use 5m, 15m, 1h, or all." });
      return;
    }

    const maxSize = clampInt(req.query.maxSize, 2, 1, 3);
    const minSamples = clampInt(req.query.minSamples, 5, 1, 1000);
    const top = clampInt(req.query.top, 25, 1, 50);
    const timeframes = parseTimeframeList(
      typeof req.query.timeframes === "string" ? req.query.timeframes : undefined
    );

    const summary = windowHistoryService.searchCombos({
      horizon: horizon ?? "all",
      maxSize,
      minSamples,
      top,
      timeframes,
    });

    if (summary.resolvedWindows === 0) {
      res.status(503).json({
        error: "No resolved windows with indicator snapshots yet. Let the server run through more Polymarket windows.",
        ...summary,
      });
      return;
    }

    res.json(summary);
  });

  router.post("/analysis/combos/evaluate", (req, res) => {
    const body = req.body as {
      comboKeys?: string[];
      horizon?: PredictionHorizon | "all";
    };

    if (!Array.isArray(body.comboKeys) || body.comboKeys.length === 0) {
      res.status(400).json({ error: "comboKeys array is required" });
      return;
    }

    const horizon = body.horizon ?? "all";
    if (horizon !== "all" && !["5m", "15m", "1h"].includes(horizon)) {
      res.status(400).json({ error: "Invalid horizon. Use 5m, 15m, 1h, or all." });
      return;
    }

    try {
      const result = windowHistoryService.evaluateComboByKeys(body.comboKeys, horizon);
      if (result.summary.windows === 0) {
        res.status(503).json({
          error: "No resolved windows with indicator snapshots yet.",
          ...result,
        });
        return;
      }
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  router.get("/analysis/combos/windows", (req, res) => {
    const comboParam = req.query.combo;
    if (typeof comboParam !== "string" || !comboParam.trim()) {
      res.status(400).json({ error: "combo query param is required (comma-separated signal keys)" });
      return;
    }

    const horizon = parseHorizonQuery(req.query.horizon);
    if (horizon === "invalid") {
      res.status(400).json({ error: "Invalid horizon. Use 5m, 15m, 1h, or all." });
      return;
    }

    const combo = parseSignalKeys(comboParam);
    if (combo.length === 0) {
      res.status(400).json({ error: "No valid signal keys in combo param" });
      return;
    }

    try {
      const windows = windowHistoryService.getComboWindowBreakdown(
        combo.map((ref) => ref.key),
        horizon ?? "all"
      );
      if (windows.length === 0) {
        res.status(503).json({
          error: "No resolved windows with indicator snapshots yet.",
          windows: [],
        });
        return;
      }
      res.json({ combo, windows });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  return router;
}

function summarizeImpact(
  current: { horizon: string; direction: string; confidence: string }[],
  draft: { horizon: string; direction: string; confidence: string }[]
) {
  const lines: string[] = [];
  let actionableBefore = 0;
  let actionableAfter = 0;

  for (const d of draft) {
    const c = current.find((x) => x.horizon === d.horizon);
    const wasActionable = c && c.direction !== "NO_EDGE" && c.confidence !== "LOW";
    const isActionable = d.direction !== "NO_EDGE" && d.confidence !== "LOW";
    if (wasActionable) actionableBefore++;
    if (isActionable) actionableAfter++;

    if (c && (c.direction !== d.direction || c.confidence !== d.confidence)) {
      lines.push(
        `${d.horizon}: ${c.direction}/${c.confidence} → ${d.direction}/${d.confidence}`
      );
    }
  }

  if (actionableAfter > actionableBefore) {
    lines.unshift(`+${actionableAfter - actionableBefore} more actionable signal(s)`);
  } else if (actionableAfter < actionableBefore) {
    lines.unshift(`${actionableBefore - actionableAfter} fewer actionable signal(s) — stricter`);
  } else if (!lines.length) {
    lines.push("No signal changes with current market data");
  }

  return lines;
}

function parseHorizonQuery(
  value: unknown
): PredictionHorizon | "all" | undefined | "invalid" {
  if (value == null || value === "") return undefined;
  if (value === "all") return "all";
  if (typeof value === "string" && ["5m", "15m", "1h"].includes(value)) {
    return value as PredictionHorizon;
  }
  return "invalid";
}

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
