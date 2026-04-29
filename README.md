# Planzo

Planzo is a location-aware event discovery and ticketing MVP (React + Node + Postgres/PostGIS + Stripe), designed for an end-to-end capstone demo.

## Local dev (Week 1 foundation)

### Prereqs
- Node.js >= 20
- Docker

**Note:** If you have PostgreSQL installed locally on port 5432, the Docker DB uses port **5433** to avoid conflicts. The default `.env` is configured for this.

### 1) Start Postgres + PostGIS
```bash
docker compose up -d db
```

### 2) Configure API env
```bash
cp apps/api/.env.example apps/api/.env
```

### 2b) Configure Web env (optional)
```bash
cp apps/web/.env.example apps/web/.env
```

### 3) Build shared package & run migrations
```bash
npm install
npm --workspace @planzo/shared run build
npm run migrate:up
```

### 3b) (Optional) Seed demo data
```bash
npm --workspace apps/api run seed
```

### 4) Start API + Web (two terminals)
```bash
npm run dev:api
```

```bash
npm run dev:web
```

## Stripe (test mode) quick notes
- `POST /api/v1/checkout/create-session` redirects to Stripe Checkout.
- Tickets are issued on `checkout.session.completed` via `POST /api/v1/webhooks/stripe` (raw body + signature).
- For local webhook testing, use the Stripe CLI and set `STRIPE_WEBHOOK_SECRET` in `apps/api/.env`.

## Demo flow (end-to-end)
1. Register + login
2. Create organizer profile
3. Create event draft → add a ticket tier → publish
4. Search from Home → open event → buy ticket (Stripe test)
5. View “My Tickets” (QR)
6. Open “Scanner” on organizer device → scan QR → check-in

## Built-in AI (no API key)
- Organizer AI Studio: generate descriptions, tags, agendas, and tier ideas.
- Attendee AI Concierge: prompt box on Home for curated suggestions (demo).
- AI endpoints:
  - `POST /api/v1/ai/event-copy`
  - `POST /api/v1/ai/event-name`
  - `POST /api/v1/ai/event-title-rewrite`
  - `POST /api/v1/ai/ticket-tiers`

## Public organizer profiles
- Public page: `/organizers/:id`
- API: `GET /api/v1/organizer/public/:organizerId`
 - Reviews: `POST /api/v1/organizer/public/:organizerId/reviews`

## Startup polish
- Niche positioning: workshops & classes.
- Pricing page: `/pricing`
- Verified organizer badge + ratings on public profile.
- Starting‑soon filter (next 6 hours) on search.

## Share cards
- Organizer share preview: `GET /api/v1/share/organizer/:id`
- Organizer OG image: `GET /api/v1/share/organizers/:id.svg`
- Event share preview: `GET /api/v1/share/event/:id`
- Event OG image: `GET /api/v1/share/events/:id.svg`

## Email previews
- `POST /api/v1/emails/preview` with `{ type: "order" | "organizer" }`
- `POST /api/v1/emails/send` with `{ to, type }` (SES required)
 - UI previews: `/emails`

## Waitlist + referrals
- `POST /api/v1/waitlist` with `{ email, referralCode? }`
- `GET /api/v1/waitlist/leaderboard`
 - `GET /api/v1/waitlist/status?email=`
 - `POST /api/v1/waitlist/rewards/send`
- Public page: `/waitlist`

## Workspace layout
- `apps/api`: Express API + DB migrations
- `apps/web`: React web app
- `packages/shared`: shared types/constants
- `infra/cdk`: AWS CDK (staging/prod skeleton)
