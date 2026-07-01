import WebSocket from "ws";
import type { PriceSource } from "../../types/polymarket.js";

const RTDS_URL = "wss://ws-live-data.polymarket.com";
const PING_INTERVAL_MS = 5000;
const RECONNECT_DELAY_MS = 3000;
const BUFFER_RETENTION_MS = 2 * 60 * 60 * 1000;

interface PriceTick {
  timestampMs: number;
  value: number;
}

export class PriceTracker {
  private ws: WebSocket | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private buffers: Record<PriceSource, PriceTick[]> = {
    chainlink: [],
    binance: [],
  };

  start(): void {
    if (this.running) return;
    this.running = true;
    this.connect();
  }

  stop(): void {
    this.running = false;
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  getPriceAt(source: PriceSource, targetMs: number): number | null {
    const ticks = this.buffers[source];
    if (!ticks.length) return null;

    for (const tick of ticks) {
      if (tick.timestampMs >= targetMs) {
        return tick.value;
      }
    }

    const last = ticks[ticks.length - 1];
    return last?.value ?? null;
  }

  private connect(): void {
    if (!this.running) return;

    this.ws = new WebSocket(RTDS_URL);

    this.ws.on("open", () => {
      this.subscribe();
      this.pingTimer = setInterval(() => {
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.ws.send("PING");
        }
      }, PING_INTERVAL_MS);
    });

    this.ws.on("message", (data) => {
      const raw = data.toString();
      if (raw === "PONG") return;

      try {
        this.handleMessage(JSON.parse(raw));
      } catch {
        // ignore non-JSON frames
      }
    });

    this.ws.on("close", () => this.scheduleReconnect());
    this.ws.on("error", () => this.scheduleReconnect());
  }

  private scheduleReconnect(): void {
    if (!this.running || this.reconnectTimer) return;

    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }

    this.ws = null;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, RECONNECT_DELAY_MS);
  }

  private subscribe(): void {
    if (this.ws?.readyState !== WebSocket.OPEN) return;

    this.ws.send(
      JSON.stringify({
        action: "subscribe",
        subscriptions: [
          {
            topic: "crypto_prices_chainlink",
            type: "*",
            filters: JSON.stringify({ symbol: "btc/usd" }),
          },
          {
            topic: "crypto_prices",
            type: "*",
            filters: "btcusdt",
          },
        ],
      })
    );
  }

  private handleMessage(message: Record<string, unknown>): void {
    const topic = message.topic as string | undefined;
    const payload = message.payload as Record<string, unknown> | undefined;

    if (topic === "crypto_prices_chainlink") {
      this.ingestHistoricalOrUpdate("chainlink", message, (item) => ({
        timestampMs: Number(item.timestamp ?? item.t ?? 0),
        value: Number(item.value ?? item.p ?? 0),
      }));
      if (payload?.symbol === "btc/usd" || payload?.symbol === "BTC/USD") {
        this.addTick("chainlink", {
          timestampMs: Number(payload.timestamp),
          value: Number(payload.value),
        });
      }
      return;
    }

    if (topic === "crypto_prices") {
      this.ingestHistoricalOrUpdate("binance", message, (item) => ({
        timestampMs: Number(item.timestamp ?? item.t ?? 0),
        value: Number(item.value ?? item.p ?? 0),
      }));
      if (payload) {
        const symbol = String(payload.symbol ?? "").toLowerCase();
        if (symbol === "btcusdt") {
          this.addTick("binance", {
            timestampMs: Number(payload.timestamp),
            value: Number(payload.value),
          });
        }
      }
    }
  }

  private ingestHistoricalOrUpdate(
    source: PriceSource,
    message: Record<string, unknown>,
    mapItem: (item: Record<string, unknown>) => PriceTick
  ): void {
    const payload = message.payload as Record<string, unknown> | undefined;
    const data = payload?.data;
    if (!Array.isArray(data)) return;

    for (const item of data) {
      if (item && typeof item === "object") {
        const tick = mapItem(item as Record<string, unknown>);
        if (tick.timestampMs > 0 && tick.value > 0) {
          this.addTick(source, tick);
        }
      }
    }
  }

  private addTick(source: PriceSource, tick: PriceTick): void {
    if (!Number.isFinite(tick.timestampMs) || !Number.isFinite(tick.value)) return;

    const buffer = this.buffers[source];
    const last = buffer[buffer.length - 1];
    if (last && last.timestampMs === tick.timestampMs && last.value === tick.value) {
      return;
    }

    buffer.push(tick);
    buffer.sort((a, b) => a.timestampMs - b.timestampMs);
    this.trimBuffer(source);
  }

  private trimBuffer(source: PriceSource): void {
    const cutoff = Date.now() - BUFFER_RETENTION_MS;
    const buffer = this.buffers[source];
    while (buffer.length > 0 && buffer[0].timestampMs < cutoff) {
      buffer.shift();
    }
  }
}
