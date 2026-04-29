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

## Account management

- Profile + notification preferences + saved Stripe payment methods at `/account`
- Forgot password / reset flow at `/forgot-password` (token by email; in dev the token is returned in the response)
- Soft-delete with `POST /api/v1/account/delete` (anonymizes email, revokes refresh tokens)
- Customer support inbox at `/support` (open to anonymous users, threaded replies)

API:
- `GET/PUT /api/v1/account/profile`, `GET/PUT /api/v1/account/notifications`
- `GET/POST/DELETE /api/v1/account/payment-methods`, `POST /api/v1/account/payment-methods/:id/default`
- `POST /api/v1/account/password/forgot`, `POST /api/v1/account/password/reset`
- `POST /api/v1/account/delete`
- Support: `POST /api/v1/support`, `GET /api/v1/support/mine`, `POST /api/v1/support/:id/reply`

## Bookings, refunds, reviews

- Booking history at `/bookings` lists every order with line items and tickets
- Attendees submit refund requests from `/bookings`; they track status at `/refunds`
- Organizers approve / deny at `/organizer/refunds`; admins execute the Stripe refund

API:
- `GET /api/v1/me/bookings` (orders + line items + tickets)
- `POST /api/v1/refunds` (attendee submit), `POST /api/v1/refunds/:id/cancel`
- `GET /api/v1/refunds/organizer?status=`, `POST /api/v1/refunds/:id/decision`
- `POST /api/v1/refunds/:id/execute` (admin runs Stripe refund + ledger entries)
- Event reviews: `POST /api/v1/events/:eventId/reviews`, `GET /api/v1/events/:eventId/reviews`

## Organizer tools

- Edit, publish, and now **unpublish** events (`POST /api/v1/events/:id/unpublish`)
- Send updates to attendees (`/organizer/events/:id/announcements`) over email / push / sms
- Approve / deny refund requests at `/organizer/refunds`

## Marketing

- Campaign manager at `/admin/marketing` (CRUD + launch + pause + complete)
- Channels: email, push, sms, generic digital, homepage feature
- Recommendations endpoint personalizes based on category history + city: `GET /api/v1/recommendations`
- Track engagement: `POST /api/v1/campaigns/track` records opens / clicks / unsubscribes
- Feature events on the homepage (admin-only): `POST /api/v1/campaigns/feature-event`
- Anonymous interaction tracking: `POST /api/v1/interactions`

## Finance

- Settlement + ledger entries written automatically on each Stripe `checkout.session.completed`
- Configurable platform commission + processing fee (`finance_settings`, default 10% + 2.9% + $0.30)
- Admin dashboard at `/admin/finance`: gross / refunds / commission / net, payout management, settlement reconciliation, CSV export
- API: `/finance/sales`, `/finance/revenue`, `/finance/commission`, `/finance/payouts`, `/finance/settlements`, `/finance/reconcile`, `/finance/reports/financial(.csv)`

## Analytics

- Admin dashboard at `/admin/analytics` covering revenue trends, marketing channels, customer behaviour, discovery funnel, and top organizers
- Per-organizer dashboard data: `GET /api/v1/analytics/organizer/dashboard`
- CSV export: `GET /api/v1/analytics/export.csv?kind=events|revenue-trend`

## Workspace layout
- `apps/api`: Express API + DB migrations (now includes finance, analytics, campaigns, refunds, support, account, recommendations)
- `apps/web`: React web app (with new admin & attendee pages)
- `packages/shared`: shared types/constants
- `infra/cdk`: AWS CDK (staging/prod skeleton)

## Tests

- `npm --workspace @planzo/api run test` — unit tests for token signing, ticket QR, and commission math
- `npm --workspace @planzo/api run typecheck` — strict TS typecheck (Bundler resolution)
- `npm --workspace @planzo/web run typecheck` — frontend TS typecheck
