#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 root@<droplet-ip>"
  echo "Example: $0 root@157.230.0.1"
  exit 1
fi

TARGET="$1"
REMOTE_DIR="btc-mega-indicator"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$ROOT"

echo "==> Building client and server on this machine..."
npm run build

if [[ ! -f server/dist/index.js || ! -f client/dist/index.html ]]; then
  echo "Build output missing. Expected server/dist/index.js and client/dist/index.html"
  exit 1
fi

echo "==> Syncing to ${TARGET}..."
ssh "$TARGET" "mkdir -p ~/${REMOTE_DIR}/data ~/${REMOTE_DIR}/server/dist ~/${REMOTE_DIR}/client/dist"

# Use explicit destinations — rsync merges same-named folders (dist/) if targets are ambiguous.
rsync -avz --delete server/dist/ "${TARGET}:~/${REMOTE_DIR}/server/dist/"
rsync -avz --delete client/dist/ "${TARGET}:~/${REMOTE_DIR}/client/dist/"
rsync -avz --delete config/ "${TARGET}:~/${REMOTE_DIR}/config/"
rsync -avz \
  package.json \
  package-lock.json \
  server/package.json \
  client/package.json \
  Dockerfile.runtime \
  dockerignore.runtime \
  docker-compose.yml \
  docker-compose.ssh.yml \
  docker-compose.prebuilt.yml \
  "${TARGET}:~/${REMOTE_DIR}/"

# Runtime builds must not exclude pre-synced dist/ folders.
ssh "$TARGET" "cp ~/${REMOTE_DIR}/dockerignore.runtime ~/${REMOTE_DIR}/.dockerignore"

echo "==> Building runtime image on Droplet (no Vite/TS compile)..."
ssh "$TARGET" "test -f ~/${REMOTE_DIR}/server/dist/index.js && test -f ~/${REMOTE_DIR}/client/dist/index.html"
ssh "$TARGET" "cd ~/${REMOTE_DIR} && docker compose \
  -f docker-compose.yml \
  -f docker-compose.ssh.yml \
  -f docker-compose.prebuilt.yml \
  up -d app --build"

echo "==> Done. Tunnel from your Mac:"
echo "    ssh -L 8080:127.0.0.1:3001 ${TARGET}"
echo "    open http://localhost:8080"
