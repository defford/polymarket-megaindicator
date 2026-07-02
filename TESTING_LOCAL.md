# Local Testing Workflow

Use this workflow for day-to-day development so you do not need to push to GitHub or redeploy your Droplet for every change.

## 1) Fast local loop (default)

Install once:

```bash
npm install
```

Run frontend + backend together:

```bash
npm run dev
```

Open:

- Frontend: `http://localhost:5173`
- Backend API (proxied through Vite): frontend requests `/api/*` and Vite forwards to `http://localhost:3001`

Use this for most changes (UI, server logic, config behavior, API responses).

## 2) One-command backend smoke test

Run a lightweight API verification:

```bash
npm run smoke:server
```

What it does:

- Builds the server
- Starts it locally on port 3001
- Verifies `/api/health`
- Verifies `/api/snapshot` includes `predictions` and `marketContext.price`

If you want a full local validation before pushing:

```bash
npm run check:local
```

## 3) Local Docker parity check (only when needed)

Use Docker locally only for container/runtime changes (Dockerfile, compose, env wiring):

```bash
docker compose up -d --build app
docker compose logs -f app
```

Then validate:

```bash
curl http://localhost:3001/api/health
```

## 4) When to use GitHub and Droplet

- Push to GitHub when the local checks pass and you want review/backup.
- Deploy to Droplet after merge or when you intentionally want staging/production verification.

You should not need Droplet deploys to confirm normal feature edits.
