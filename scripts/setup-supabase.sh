#!/bin/bash
# One-shot Supabase setup: install deps, build the shared package, run the
# 5 SQL migrations, and seed 12 demo events + 3 test accounts.
#
# Usage:
#   export DATABASE_URL='postgresql://postgres:YOUR_PW@db.<ref>.supabase.co:5432/postgres'
#   ./scripts/setup-supabase.sh
#
# The script never prints your password.

set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  cat <<'EOF'
❌ DATABASE_URL is not set.

Set it first (replace YOUR_PW with the password you chose when creating
the Supabase project):

  export DATABASE_URL='postgresql://postgres:YOUR_PW@db.<your-ref>.supabase.co:5432/postgres'

Then re-run this script.
EOF
  exit 1
fi

# Mask the password before printing the URL.
SAFE_URL=$(echo "$DATABASE_URL" | sed -E 's#(postgres(ql)?://[^:]+:)[^@]+(@)#\1***\3#')
echo "→ Target: $SAFE_URL"
echo

# These secrets aren't used by migrations or seeding, but env.ts validates
# them at import time. Provide harmless dev placeholders so the user only
# has to set DATABASE_URL to bootstrap.
export JWT_ACCESS_SECRET="${JWT_ACCESS_SECRET:-bootstrap_dev_access_secret_change_in_prod}"
export JWT_REFRESH_SECRET="${JWT_REFRESH_SECRET:-bootstrap_dev_refresh_secret_change_in_prod}"
export TICKET_QR_SECRET="${TICKET_QR_SECRET:-bootstrap_dev_ticket_qr_secret_change_in_prod}"

cd "$(dirname "$0")/.."

echo "📦 Installing workspace dependencies…"
npm install --no-audit --no-fund

echo
echo "🔨 Building @planzo/shared…"
npm --workspace @planzo/shared run build

echo
echo "🗄️  Running migrations (0001 → 0005)…"
npm run migrate:up

echo
echo "🌱 Seeding 12 demo events + 3 demo accounts…"
npm run seed

cat <<'EOF'

✅ Supabase is ready.

Demo accounts (password for all: password123):
  • demo@planzo.app       — organizer
  • attendee@planzo.app   — attendee
  • admin@planzo.app      — admin

Next steps:
  1. Run the API locally:    npm run dev:api
  2. Run the web app:        npm run dev:web
  3. Or deploy the API:      see README.md → "Deploy on Render"
EOF
