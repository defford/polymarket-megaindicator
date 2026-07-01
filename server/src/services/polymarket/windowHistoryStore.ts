import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { PredictionHorizon } from "../../types/analysis.js";
import type { PolymarketStoreData, PolymarketWindowResult } from "../../types/polymarket.js";

const HORIZONS: PredictionHorizon[] = ["5m", "15m", "1h"];

function emptyStore(): PolymarketStoreData {
  return {
    version: 2,
    updatedAt: new Date().toISOString(),
    windows: { "5m": [], "15m": [], "1h": [] },
  };
}

function mergeProfileSignals(
  existing: PolymarketWindowResult["profileSignals"],
  incoming: PolymarketWindowResult["profileSignals"]
): PolymarketWindowResult["profileSignals"] {
  if (!existing && !incoming) return undefined;
  return { ...existing, ...incoming };
}

export class WindowHistoryStore {
  private data: PolymarketStoreData;

  constructor(
    private filePath: string,
    private limit: number
  ) {
    this.data = this.load();
  }

  getUpdatedAt(): string | null {
    return this.data.updatedAt ?? null;
  }

  getWindows(horizon?: PredictionHorizon): Record<PredictionHorizon, PolymarketWindowResult[]> {
    if (horizon) {
      return {
        "5m": horizon === "5m" ? [...this.data.windows["5m"]] : [],
        "15m": horizon === "15m" ? [...this.data.windows["15m"]] : [],
        "1h": horizon === "1h" ? [...this.data.windows["1h"]] : [],
      };
    }
    return {
      "5m": [...this.data.windows["5m"]],
      "15m": [...this.data.windows["15m"]],
      "1h": [...this.data.windows["1h"]],
    };
  }

  upsert(result: PolymarketWindowResult): void {
    const list = this.data.windows[result.horizon];
    const idx = list.findIndex((row) => row.slug === result.slug);
    const existing = idx >= 0 ? list[idx] : null;
    const profileSignals = mergeProfileSignals(existing?.profileSignals, result.profileSignals);
    const balanced = profileSignals?.balanced;

    const merged: PolymarketWindowResult = existing
      ? {
          ...result,
          startPrice: result.startPrice ?? existing.startPrice,
          stopPrice: result.stopPrice ?? existing.stopPrice,
          priceSource: result.priceSource ?? existing.priceSource,
          profileSignals,
          signalDirection: balanced?.direction ?? result.signalDirection ?? existing.signalDirection,
          signalCorrect: balanced?.signalCorrect ?? result.signalCorrect ?? existing.signalCorrect,
          resolved: result.resolved || existing.resolved,
          outcome: result.outcome ?? existing.outcome,
        }
      : { ...result, profileSignals };

    if (idx >= 0) {
      list[idx] = merged;
    } else {
      list.unshift(merged);
    }

    list.sort((a, b) => new Date(b.windowStart).getTime() - new Date(a.windowStart).getTime());

    if (list.length > this.limit) {
      this.data.windows[result.horizon] = list.slice(0, this.limit);
    }

    this.data.version = 2;
    this.data.updatedAt = new Date().toISOString();
    this.save();
  }

  private load(): PolymarketStoreData {
    if (!existsSync(this.filePath)) {
      return emptyStore();
    }

    try {
      const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as PolymarketStoreData;
      if ((parsed.version !== 1 && parsed.version !== 2) || !parsed.windows) {
        return emptyStore();
      }

      for (const horizon of HORIZONS) {
        if (!Array.isArray(parsed.windows[horizon])) {
          parsed.windows[horizon] = [];
        }
      }

      return parsed;
    } catch {
      return emptyStore();
    }
  }

  private save(): void {
    const dir = dirname(this.filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
  }
}
