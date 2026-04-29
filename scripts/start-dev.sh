#!/usr/bin/env bash
# Start Planzo API + Web for local development
# Prereqs: Docker running (for DB), npm install done

set -e
cd "$(dirname "$0")/.."

echo "=== Planzo dev servers ==="

# Ensure DB is up
if ! docker ps --format '{{.Names}}' | grep -q planzo-db; then
  echo "→ Starting database..."
  docker compose up -d db
  sleep 5
fi

# Ensure shared package is built
if [ ! -f packages/shared/dist/index.js ]; then
  echo "→ Building shared package..."
  npm --workspace @planzo/shared run build
fi

echo ""
echo "→ Starting API on http://localhost:4000"
echo "→ Starting Web on http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both."
echo ""

# Run both in parallel
npm run dev:api &
API_PID=$!
npm run dev:web &
WEB_PID=$!

trap "kill $API_PID $WEB_PID 2>/dev/null; exit" INT TERM
wait
