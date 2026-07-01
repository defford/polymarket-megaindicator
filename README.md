# BTC Mega Indicator Dashboard

A personal dashboard that fetches TradingView's built-in technical analysis summaries for Bitcoin (`BITSTAMP:BTCUSD`) across multiple timeframes and evaluates configurable multi-timeframe agreement rules.

Data is sourced from TradingView's scanner API — the same backend that powers the [BTCUSD technicals page](https://www.tradingview.com/symbols/BTCUSD/technicals/).

## Disclaimer

- **Not investment advice.** This tool is for informational purposes only.
- TradingView's [Terms of Use](https://www.tradingview.com/policies/) prohibit automated data collection. Use this for **personal dashboard use only** with conservative polling. Do not redistribute or commercialize the data.
- Built-in TradingView indicators only — custom Pine Script indicators are not supported.

## Features

- **Polymarket prediction cards** for 5m, 15m, and 1h windows (HIGHER / LOWER / NO EDGE)
- Confidence scoring with risk warnings and higher-TF context
- Short-TF confluence strip (1m through 1h)
- Multi-timeframe matrix and per-timeframe indicator detail (under Advanced TA)
- Configurable agreement rules (`config/default.yaml`)
- Priority refresh for short timeframes before placing a bet
- TTL caching and rate-limited requests to avoid 429 errors

## Polymarket usage

This dashboard is optimized for short-horizon BTC up/down decisions on Polymarket.

### Reading the prediction cards

Each card answers: **will BTC be higher or lower over the next 5m / 15m / 1h window?**

| Signal | Meaning |
|--------|---------|
| **HIGHER** | Technical composite score favors upside |
| **LOWER** | Technical composite score favors downside |
| **NO EDGE** | Score is near neutral — consider skipping the market |

| Confidence | Meaning |
|------------|---------|
| **HIGH** | Strong composite score, gauges agree, leading TFs align, no higher-TF conflict |
| **MEDIUM** | Moderate score with majority gauge agreement |
| **LOW** | Weak or conflicting setup — treat as low conviction |

**Practical rule:** Prefer markets where direction is HIGHER or LOWER with MEDIUM or HIGH confidence. Skip NO EDGE and LOW confidence unless you have other reasons to trade.

### Warnings

- **Higher-TF opposes** — e.g. betting 5m HIGHER while 1h is bearish. Edge is reduced, not automatically wrong.
- **RSI overbought/oversold** — fade risk when betting with the extreme (HIGHER into overbought, LOWER into oversold).
- **Gauges split** — summary and oscillators disagree on the anchor timeframe.

### Higher-TF context

The 4h and 1d panels show backdrop trend. A 5m HIGHER signal against a bearish 4h/1d backdrop is a counter-trend scalp — higher risk.

### Refresh before betting

Click **Refresh** for a fast priority update (1m–1h only, ~8s). Full refresh runs automatically in the background.

### Tuning via Settings

Open **Settings** in the dashboard header to:

- Apply **strategy presets** (Balanced, Scalp 5m, Trend 1h, High Conviction)
- Adjust **signal thresholds** — higher No Edge bar = fewer marginal bets
- Tune **per-horizon weights** — oscillator emphasis vs MA/trend, conflict sensitivity, confluence bonus
- Toggle **confluence alert rules** per horizon
- **Live preview** shows how saved vs draft settings change HIGHER/LOWER/NO EDGE before you save

Presets are optimized for Polymarket horizons: Scalp 5m weights RSI/momentum; Trend 1h weights moving averages; High Conviction raises all thresholds.

Past technical analysis does not guarantee future outcomes. This is decision support, not a betting system.

## Prerequisites

- Node.js 18+
- npm 9+

## Setup

```bash
npm install
npm run dev
```

- Dashboard: http://localhost:5173
- API: http://localhost:3001/api/snapshot

## Production

```bash
npm run build
npm start
```

Serves the built React app from the Express server on port 3001.

## Deployment (Docker on VPS)

Run the dashboard continuously with persistent storage. Data gathering runs 24/7 on the server; you access the dashboard via SSH tunnel (no domain required) or optionally via HTTPS with a domain.

### DigitalOcean + SSH (recommended, no domain)

The app runs on your Droplet and **only listens on localhost**. You reach it by tunneling SSH to your Mac — nothing is exposed on the public internet except SSH (port 22).

#### 1. Create a Droplet

1. Sign up at [digitalocean.com](https://www.digitalocean.com)
2. **Create → Droplets**
3. **Image:** Ubuntu 24.04 LTS (or 22.04)
4. **Size:** Basic — **Regular**, **1 GB RAM / 1 vCPU** ($4/mo) or **2 GB** ($6/mo) for headroom
5. **Region:** closest to you
6. **Authentication:** SSH key — paste your public key:
   ```bash
   pbcopy < ~/.ssh/id_ed25519.pub
   ```
   If you don't have a key yet:
   ```bash
   ssh-keygen -t ed25519 -C "digitalocean"
   pbcopy < ~/.ssh/id_ed25519.pub
   ```
7. **Hostname:** `btc-mega-indicator`
8. Click **Create Droplet**

Note the **public IP** from the Droplet page.

#### 2. Configure the Cloud Firewall

Only SSH needs to be open — no HTTP/HTTPS ports.

1. **Networking → Firewalls → Create Firewall**
2. **Inbound rules:**

| Type | Protocol | Port | Sources |
|------|----------|------|---------|
| SSH | TCP | 22 | All IPv4, All IPv6 (or your home IP only) |

3. **Apply to Droplets:** select `btc-mega-indicator`
4. Click **Create Firewall**

#### 3. SSH in and install Docker

```bash
ssh root@<droplet-public-ip>

curl -fsSL https://get.docker.com | sh
docker --version
```

#### 4. Deploy the app

```bash
git clone <repo-url> btc-mega-indicator
cd btc-mega-indicator
mkdir -p data
docker compose -f docker-compose.yml -f docker-compose.ssh.yml up -d app --build
docker compose logs -f app
```

No `.env` file or domain needed. Caddy is not started — only the app container runs, bound to `127.0.0.1:3001` on the Droplet.

Wait until logs show `Server running on http://localhost:3001` and background refresh activity.

#### 5. Access the dashboard from your Mac

Open a **new terminal on your Mac** (keep it open while using the dashboard):

```bash
ssh -L 8080:127.0.0.1:3001 root@<droplet-public-ip>
```

In your browser:

```
http://localhost:8080
```

The dashboard and API are available as if running locally. Close the SSH session to disconnect.

**Tip:** Add a shell alias on your Mac:

```bash
# Add to ~/.zshrc
alias btc-dashboard='ssh -L 8080:127.0.0.1:3001 root@<droplet-public-ip>'
```

Then run `btc-dashboard` whenever you want to view it.

#### SSH troubleshooting

| Problem | Fix |
|---------|-----|
| Can't SSH in | Confirm SSH key was added at Droplet creation; firewall allows port 22 |
| `Connection refused` on localhost:8080 | Ensure the SSH tunnel terminal is still open; check `docker compose ps` on the Droplet |
| `docker compose build` fails | Use a 2 GB Droplet if the build runs out of memory |
| Empty dashboard on first load | Wait ~30s for initial TradingView fetch; check `docker compose logs app` |

---

### DigitalOcean + domain (optional HTTPS)

If you later add a domain, use the full stack with Caddy for HTTPS and basic auth:

1. Open firewall ports **80** and **443** in addition to SSH
2. Point DNS A record at your Droplet IP
3. Create `.env` from `.env.example` (set `DOMAIN`, `BASIC_AUTH_USER`, `BASIC_AUTH_HASH`)
4. Deploy with:

```bash
docker compose up -d --build
```

Open `https://your-domain` in a browser.

#### Domain troubleshooting

| Problem | Fix |
|---------|-----|
| Caddy certificate errors | DNS must resolve to the Droplet IP; port 80 must be open |
| Site loads but API errors | `docker compose logs app` — initial TradingView fetch can take ~30s |

---

### Alternatives

**Oracle Cloud Always Free** — $0 Ampere A1 VM. Works on ARM64 with the same Docker setup, but requires extra iptables rules and capacity can be hard to get. See [Oracle Cloud docs](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier.htm) if you prefer free over simplicity.

**Other VPS providers** (Hetzner, Linode, Vultr) — same steps as DigitalOcean: Ubuntu + Docker + open ports 22/80/443 + `docker compose up`.

### Persistence

Data survives container restarts and redeploys via bind mounts:

| Host path | Container path | Contents |
|-----------|------------------|----------|
| `./data/` | `/app/data/` | Polymarket window history (`polymarket-windows.json`) |
| `./config/` | `/app/config/` | Dashboard settings (`default.yaml`) |

The app continuously gathers data in the background (TradingView refresh every 60s, Polymarket sync every 30s).

### Updates

```bash
git pull
docker compose up -d --build
```

Volumes are untouched — history and config are preserved.

### Backups

Periodically copy `./data/polymarket-windows.json` and `./config/default.yaml` off the server.

### Verify

```bash
docker compose ps
curl -u user:pass https://your-domain/api/health
curl -u user:pass https://your-domain/api/polymarket/results
```

Restart the app container and confirm history is retained:

```bash
docker compose restart app
```

## Configuration

Edit [`config/default.yaml`](config/default.yaml):

- **symbol** — exchange, ticker, screener
- **timeframes** — which intervals to fetch
- **predictions** — horizons, score thresholds
- **refresh** — poll intervals, cache TTLs, priority timeframes, request delay
- **agreementRules** — rules evaluated on each refresh

### Rule types

**`gauge_majority`** — count timeframes where a gauge (summary / oscillators / moving_averages) matches given directions:

```yaml
- id: summary_bull_majority
  type: gauge_majority
  gauge: summary
  matchDirections: [BUY, STRONG_BUY]
  minMatchingTimeframes: 6
```

**`all_gauges_align`** — all three gauges must agree on the same direction for specified timeframes:

```yaml
- id: triple_align_daily
  type: all_gauges_align
  timeframes: [1d]
  matchDirections: [SELL, STRONG_SELL, BUY, STRONG_BUY]
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/snapshot` | Cached analysis + agreement results |
| POST | `/api/refresh` | Force refresh (`?priorityOnly=true` for short TFs only) |
| GET | `/api/config/settings` | Full editable settings + preset metadata |
| POST | `/api/config/preview` | Preview prediction changes without saving |
| PUT | `/api/config/settings` | Save settings to YAML and apply |
| POST | `/api/config/preset/:id` | Load preset with preview |
| GET | `/api/health` | Health check |

## Verification

1. Start the dev server and open the dashboard.
2. Confirm `/api/snapshot` returns `predictions` (3 entries) and `marketContext.price`.
3. Verify 5m/15m/1h cards show HIGHER, LOWER, or NO EDGE with confidence tiers.
4. Compare anchor timeframe summary against the live [TradingView technicals page](https://www.tradingview.com/symbols/BTCUSD/technicals/).
5. Trigger `POST /api/refresh?priorityOnly=true` and confirm faster refresh (~8s).

## Project Structure

```
config/default.yaml     # Symbol, timeframes, rules
server/                 # Express API + TradingView client
client/                 # React dashboard (Vite)
```
