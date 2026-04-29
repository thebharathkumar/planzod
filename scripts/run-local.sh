#!/usr/bin/env bash
# Planzo – run local dev setup
# Prereqs: Node.js >= 20, Docker (must be running)

set -e
cd "$(dirname "$0")/.."

echo "=== Planzo local setup ==="

# 1. Start Postgres + PostGIS
echo "→ Starting Postgres + PostGIS..."
docker compose up -d db

# Wait for DB to be ready
echo "→ Waiting for database..."
until docker compose exec -T db pg_isready -U postgres -d planzo 2>/dev/null; do
  sleep 1
done

# 2. Build shared package (required for API)
echo "→ Building shared package..."
npm --workspace @planzo/shared run build

# 3. Run migrations
echo "→ Running migrations..."
npm run migrate:up

# 4. Optional: seed demo data
read -p "Seed demo data? (y/N) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  npm --workspace apps/api run seed
fi

echo ""
echo "=== Setup complete ==="
echo "Start the app in two terminals:"
echo "  Terminal 1: npm run dev:api"
echo "  Terminal 2: npm run dev:web"
echo ""
echo "  API:  http://localhost:4000"
echo "  Web:  http://localhost:5173"
echo ""
