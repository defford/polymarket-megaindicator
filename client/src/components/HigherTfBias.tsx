import type { HigherTfBias, TimeframeAnalysis } from "../types";
import { recommendationColor, recommendationLabel } from "../utils";

interface HigherTfBiasProps {
  timeframes: TimeframeAnalysis[];
}

const BIAS_TFS = ["4h", "1d"] as const;

function biasLabel(bias: HigherTfBias): string {
  switch (bias) {
    case "BULLISH":
      return "Bullish tailwind";
    case "BEARISH":
      return "Bearish headwind";
    default:
      return "Neutral backdrop";
  }
}

function biasClass(bias: HigherTfBias): string {
  switch (bias) {
    case "BULLISH":
      return "bias-bull";
    case "BEARISH":
      return "bias-bear";
    default:
      return "bias-neutral";
  }
}

export function HigherTfBias({ timeframes }: HigherTfBiasProps) {
  const byTf = new Map(timeframes.map((t) => [t.timeframe, t]));

  const scores = BIAS_TFS.map((tf) => byTf.get(tf)?.summary.score ?? 0);
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const bias: HigherTfBias = avg > 0.1 ? "BULLISH" : avg < -0.1 ? "BEARISH" : "NEUTRAL";

  return (
    <section className="panel bias-panel">
      <h3>Higher-TF Context</h3>
      <div className={`bias-summary ${biasClass(bias)}`}>{biasLabel(bias)}</div>
      <div className="bias-tfs">
        {BIAS_TFS.map((tf) => {
          const analysis = byTf.get(tf);
          if (!analysis) return null;
          const rec = analysis.summary.recommendation;
          return (
            <div key={tf} className="bias-tf-row">
              <span>{tf}</span>
              <span style={{ color: recommendationColor(rec) }}>{recommendationLabel(rec)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
