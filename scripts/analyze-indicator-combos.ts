#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  evaluateCombo,
  loadScoredWindows,
  parseSignalKeys,
  parseTimeframeList,
  searchIndicatorCombos,
  type ComboSearchOptions,
} from "../server/src/analysis/comboSearch.js";
import type { PredictionHorizon } from "../server/src/types/analysis.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

interface CliOptions extends ComboSearchOptions {
  windowsPath: string;
  snapshotsPath: string;
  combo?: string;
  json: boolean;
}

function usage(): string {
  return `Usage: npm run analyze:combos -- [options]

Options:
  --horizon <5m|15m|1h|all>   Horizon to analyze (default: all)
  --max-size <n>              Max indicators per combo (default: 2)
  --min-samples <n>           Minimum directional calls to include result (default: 5)
  --top <n>                   Number of top combos to print (default: 25)
  --timeframes <csv>          Timeframes to search, e.g. 5m,15m,1h
  --windows-path <path>       Polymarket windows JSON (default: data/polymarket-windows.json)
  --snapshots-path <path>     Indicator snapshots JSON (default: data/indicator-snapshots.json)
  --combo <csv>               Evaluate one explicit combo, e.g. 5m:RSI,15m:EMA50
  --json                      Print machine-readable JSON output
  --help                      Show this help text
`;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    windowsPath: join(PROJECT_ROOT, "data/polymarket-windows.json"),
    snapshotsPath: join(PROJECT_ROOT, "data/indicator-snapshots.json"),
    horizon: "all",
    maxSize: 2,
    minSamples: 5,
    top: 25,
    json: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];

    switch (arg) {
      case "--horizon":
        options.horizon = next as PredictionHorizon | "all";
        i++;
        break;
      case "--max-size":
        options.maxSize = Number(next);
        i++;
        break;
      case "--min-samples":
        options.minSamples = Number(next);
        i++;
        break;
      case "--top":
        options.top = Number(next);
        i++;
        break;
      case "--timeframes":
        options.timeframes = parseTimeframeList(next);
        i++;
        break;
      case "--windows-path":
        options.windowsPath = next;
        i++;
        break;
      case "--snapshots-path":
        options.snapshotsPath = next;
        i++;
        break;
      case "--combo":
        options.combo = next;
        i++;
        break;
      case "--json":
        options.json = true;
        break;
      case "--help":
      case "-h":
        console.log(usage());
        process.exit(0);
    }
  }

  return options;
}

function formatPercent(value: number | null): string {
  if (value == null) return "n/a";
  return `${(value * 100).toFixed(1)}%`;
}

function printTable(summary: ReturnType<typeof searchIndicatorCombos>): void {
  console.log(`Resolved windows with snapshots: ${summary.resolvedWindows}`);
  console.log(`Candidate signals: ${summary.candidateSignals}`);
  console.log(`Combos evaluated: ${summary.combosEvaluated}`);
  console.log("");

  if (summary.results.length === 0) {
    console.log("No combos met the minimum sample threshold.");
    return;
  }

  console.log(
    [
      "Rank".padEnd(5),
      "Accuracy".padEnd(10),
      "Coverage".padEnd(10),
      "Correct".padEnd(9),
      "Wrong".padEnd(7),
      "Combo",
    ].join("  ")
  );
  console.log("-".repeat(100));

  summary.results.forEach((result, index) => {
    console.log(
      [
        String(index + 1).padEnd(5),
        formatPercent(result.accuracy).padEnd(10),
        formatPercent(result.coverage).padEnd(10),
        String(result.correct).padEnd(9),
        String(result.wrong).padEnd(7),
        result.comboKey,
      ].join("  ")
    );
  });
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));

  if (!existsSync(options.windowsPath)) {
    console.error(`Windows file not found: ${options.windowsPath}`);
    process.exit(1);
  }

  if (!existsSync(options.snapshotsPath)) {
    console.error(`Snapshots file not found: ${options.snapshotsPath}`);
    console.error("Start the server and let it run through a few Polymarket windows first.");
    process.exit(1);
  }

  const windows = loadScoredWindows(
    options.windowsPath,
    options.snapshotsPath,
    options.horizon
  );

  if (windows.length === 0) {
    console.error("No resolved Polymarket windows with matching indicator snapshots yet.");
    process.exit(1);
  }

  if (options.combo) {
    const combo = parseSignalKeys(options.combo);
    const result = evaluateCombo(windows, combo);

    if (options.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    console.log(`Combo: ${result.comboKey}`);
    console.log(`Windows: ${result.windows}`);
    console.log(`Directional: ${result.directional}`);
    console.log(`Correct: ${result.correct}`);
    console.log(`Wrong: ${result.wrong}`);
    console.log(`No edge: ${result.noEdge}`);
    console.log(`Accuracy: ${formatPercent(result.accuracy)}`);
    console.log(`Coverage: ${formatPercent(result.coverage)}`);
    return;
  }

  const summary = searchIndicatorCombos(windows, options);

  if (options.json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  printTable(summary);
}

main();
