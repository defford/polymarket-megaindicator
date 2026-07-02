#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-3001}"
SERVER_LOG="${ROOT}/.tmp-server-smoke.log"
SERVER_PID=""
STARTED_SERVER="false"

cleanup() {
  if [[ "${STARTED_SERVER}" == "true" ]] && [[ -n "${SERVER_PID}" ]] && kill -0 "${SERVER_PID}" >/dev/null 2>&1; then
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
    wait "${SERVER_PID}" 2>/dev/null || true
  fi
}
trap cleanup EXIT

cd "${ROOT}"
echo "==> Building server for smoke test..."
npm run build -w server >/dev/null

if curl -sS "http://localhost:${PORT}/api/health" >/dev/null 2>&1; then
  echo "==> Reusing existing local server on port ${PORT}..."
else
  echo "==> Starting server on port ${PORT}..."
  PORT="${PORT}" npm run start -w server >"${SERVER_LOG}" 2>&1 &
  SERVER_PID="$!"
  STARTED_SERVER="true"

  echo "==> Waiting for /api/health..."
  for _ in $(seq 1 60); do
    if curl -sS "http://localhost:${PORT}/api/health" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
fi

if ! curl -sS "http://localhost:${PORT}/api/health" >/dev/null 2>&1; then
  echo "Server did not become healthy. Last logs:"
  tail -n 60 "${SERVER_LOG}" || true
  exit 1
fi

echo "==> Validating /api/snapshot payload..."
SNAPSHOT_JSON="$(curl -sS "http://localhost:${PORT}/api/snapshot")"
SNAPSHOT_JSON="${SNAPSHOT_JSON}" node -e '
const payload = JSON.parse(process.env.SNAPSHOT_JSON ?? "{}");
if (!Array.isArray(payload.predictions)) {
  throw new Error("Expected predictions array");
}
if (!payload.marketContext || typeof payload.marketContext.price !== "number") {
  throw new Error("Expected marketContext.price number");
}
'

echo "Smoke test passed: /api/health and /api/snapshot look good."
