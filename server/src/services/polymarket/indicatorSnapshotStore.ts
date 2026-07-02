import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { PredictionHorizon } from "../../types/analysis.js";
import type { IndicatorSnapshotStoreData, WindowIndicatorSnapshot } from "../../types/indicatorSnapshots.js";

function emptyStore(): IndicatorSnapshotStoreData {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    snapshots: [],
  };
}

export class IndicatorSnapshotStore {
  private data: IndicatorSnapshotStoreData;

  constructor(
    private filePath: string,
    private limit: number
  ) {
    this.data = this.load();
  }

  getUpdatedAt(): string | null {
    return this.data.updatedAt ?? null;
  }

  getAll(): WindowIndicatorSnapshot[] {
    return [...this.data.snapshots];
  }

  getBySlug(slug: string): WindowIndicatorSnapshot | undefined {
    return this.data.snapshots.find((row) => row.slug === slug);
  }

  has(slug: string): boolean {
    return this.data.snapshots.some((row) => row.slug === slug);
  }

  getSlugs(): Set<string> {
    return new Set(this.data.snapshots.map((row) => row.slug));
  }

  upsert(snapshot: WindowIndicatorSnapshot): void {
    const idx = this.data.snapshots.findIndex((row) => row.slug === snapshot.slug);
    if (idx >= 0) {
      return;
    }

    this.data.snapshots.unshift(snapshot);
    this.data.snapshots.sort(
      (a, b) => new Date(b.windowStart).getTime() - new Date(a.windowStart).getTime()
    );

    if (this.data.snapshots.length > this.limit) {
      this.data.snapshots = this.data.snapshots.slice(0, this.limit);
    }

    this.data.updatedAt = new Date().toISOString();
    this.save();
  }

  countByHorizon(): Record<PredictionHorizon, number> {
    const counts: Record<PredictionHorizon, number> = { "5m": 0, "15m": 0, "1h": 0 };
    for (const row of this.data.snapshots) {
      counts[row.horizon]++;
    }
    return counts;
  }

  private load(): IndicatorSnapshotStoreData {
    if (!existsSync(this.filePath)) {
      return emptyStore();
    }

    try {
      const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as IndicatorSnapshotStoreData;
      if (parsed.version !== 1 || !Array.isArray(parsed.snapshots)) {
        return emptyStore();
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
