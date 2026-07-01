import type { PredictionSignal, Timeframe, TimeframeAnalysis } from "../types";
import { recToDotColor } from "../predictionUtils";

interface ConfluenceStripProps {
  timeframes: TimeframeAnalysis[];
  selectedPrediction: PredictionSignal | undefined;
}

const STRIP_TFS: Timeframe[] = ["1m", "5m", "15m", "30m", "1h"];

export function ConfluenceStrip({ timeframes, selectedPrediction }: ConfluenceStripProps) {
  const byTf = new Map(timeframes.map((t) => [t.timeframe, t]));
  const anchor = selectedPrediction?.anchorTimeframe;

  return (
    <section className="panel confluence-panel">
      <h3>Short-TF Confluence</h3>
      <div className="confluence-strip">
        {STRIP_TFS.map((tf) => {
          const analysis = byTf.get(tf);
          const rec = analysis?.summary.recommendation ?? "NEUTRAL";
          const isAnchor = tf === anchor;
          const isAligned = selectedPrediction?.confluence.aligned.includes(tf);
          const isConflicting = selectedPrediction?.confluence.conflicting.includes(tf);

          return (
            <div
              key={tf}
              className={`confluence-pill ${isAnchor ? "anchor" : ""} ${isAligned ? "aligned" : ""} ${isConflicting ? "conflicting" : ""}`}
            >
              <span className="confluence-dot" style={{ backgroundColor: recToDotColor(rec) }} />
              <span className="confluence-tf">{tf}</span>
            </div>
          );
        })}
      </div>
      {selectedPrediction && (
        <p className="confluence-hint">
          Anchor: <strong>{selectedPrediction.anchorTimeframe}</strong> —{" "}
          {selectedPrediction.confluence.aligned.length} aligned,{" "}
          {selectedPrediction.confluence.conflicting.length} conflicting
        </p>
      )}
    </section>
  );
}
