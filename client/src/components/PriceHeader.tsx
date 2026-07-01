import type { MarketContext, PredictionHorizon } from "../types";
import { changeClass, formatChange, formatPrice } from "../predictionUtils";

interface PriceHeaderProps {
  symbol: string;
  exchange: string;
  marketContext: MarketContext | undefined;
}

const CHANGE_TFS: PredictionHorizon[] = ["5m", "15m", "1h"];

export function PriceHeader({ symbol, exchange, marketContext }: PriceHeaderProps) {
  return (
    <div className="price-header">
      <div className="price-main">
        <span className="price-label">{exchange}:{symbol}</span>
        <span className="price-value">${formatPrice(marketContext?.price ?? null)}</span>
      </div>
      <div className="price-changes">
        {CHANGE_TFS.map((tf) => {
          const change = marketContext?.changeByTf?.[tf] ?? null;
          return (
            <div key={tf} className="price-change-item">
              <span className="price-change-tf">{tf}</span>
              <span className={changeClass(change)}>{formatChange(change)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
