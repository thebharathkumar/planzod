# Planzo — Full Walkthrough

Planzo is a **location-aware event discovery and ticketing platform** built as a React + Vite MVP. It lets attendees find events, buy tickets, and track bookings, while giving organizers, admins, finance, and marketing teams their own dedicated dashboards.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + Vite 6 |
| Routing | React Router v7 |
| Styling | Tailwind CSS v4 + custom CSS design tokens |
| Map | Leaflet + react-leaflet (OpenStreetMap, no API key) |
| Charts | Recharts |
| Icons | Lucide React |
| UI Primitives | Radix UI, shadcn/ui |
| State | React Context (Auth + Cart) |
| Data | In-memory mock data (TypeScript interfaces) |
| Build/Deploy | Vite → Docker (nginx) → Jenkins CI/CD |

---

## Data Model

All data lives in [`mock-data.ts`](file:///Users/bharathkumarr/Downloads/Event%20Discovery%20Dashboard/src/app/mock-data.ts). There are 6 core TypeScript interfaces:

```
User          → id, name, email, role, avatar, verified
Event         → id, title, category, date, time, venue, address, city,
                lat, lng, organizer, image, tags, tiers[], rating,
                reviewCount, featured, status
TicketTier    → id, name, price, remaining, total, description
Booking       → eventId, userId, tierName, quantity, total, status, qrCode
RevenueRecord → eventTitle, gross, commission, payout, status
Campaign      → name, type, event, sent, opened, clicked, revenue, status
```

**Roles:** `attendee` | `organizer` | `admin` | `finance` | `marketing`

**Mock users (demo login accounts):**

| Name | Email | Role |
|---|---|---|
| Alex Rivera | alex@planzo.io | Attendee |
| Sam Chen | sam@planzo.io | Organizer |
| Jordan Blake | jordan@planzo.io | Admin |
| Taylor Kim | taylor@planzo.io | Finance |
| Morgan Lee | morgan@planzo.io | Marketing |

---

## State Management

[`store.tsx`](file:///Users/bharathkumarr/Downloads/Event%20Discovery%20Dashboard/src/app/store.tsx) exposes two React Contexts wrapped in `<AppProvider>`:

### Auth Context (`useAuth`)
- `currentUser` — the logged-in `User` object (defaults to Alex Rivera on load)
- `login(email, password, role?)` — finds a matching user in `MOCK_USERS`, sets state
- `logout()` — clears `currentUser`
- `isAuthenticated` — boolean derived from `currentUser`

### Cart Context (`useCart`)
- `items` — `CartItem[]` (eventId, tier, price, quantity)
- `addItem()` — upserts by `tierId`
- `removeItem(tierId)` — removes specific tier
- `clearCart()` — empties cart
- `total` — computed sum of `price x quantity` across all items

---

## Routing

All routes are defined in [`App.tsx`](file:///Users/bharathkumarr/Downloads/Event%20Discovery%20Dashboard/src/app/App.tsx):

| Path | Page | Who uses it |
|---|---|---|
| `/` | EventDiscovery | Everyone |
| `/events/:id` | EventDetail | Everyone |
| `/checkout` | Checkout | Attendees |
| `/my-tickets` | MyTickets | Attendees |
| `/organizer` | OrganizerDashboard | Organizers |
| `/analytics` | AnalyticsDashboard | Admins |
| `/admin` | AdminFinanceDashboard | Finance |
| `/marketing` | MarketingDashboard | Marketing |
| `/login` | AuthLogin | Everyone |
| `/register` | AuthRegister | Everyone |

Any unknown path redirects to `/`.

---

## Pages

### `/` — Event Discovery

The main landing page. Features:
- **Hero section** — peach-to-lavender gradient, giant search bar, "Use My Location" CTA
- **Featured Events** — 3-column card strip (only `event.featured === true` events)
- **Category filter tabs** — All / Music / Tech / Food / Art / Wellness (client-side filters `MOCK_EVENTS`)
- **Sort dropdown** — Featured First / Date / Price
- **Event grid** — All matching events as cards with image, title, date, city, price from lowest tier

![Homepage — poppy hero gradient, event cards and filter tabs](/Users/bharathkumarr/.gemini/antigravity/brain/78cbbccc-3356-4661-9bfc-dd9f1ed64dac/homepage_poppy_theme_1771896109883.png)

---

### `/events/:id` — Event Detail

Clicking any event card navigates here using the event `id` from the URL param. Features:
- **Hero image + metadata** — full-width photo, title, date, time, venue, rating, status badge
- **About section** — description, organizer, venue, address, city in a 2x2 grid
- **Live Leaflet/OpenStreetMap map** — reads `event.lat` / `event.lng` and places an interactive pin. No API key required. Clicking "Open maps" opens the full OpenStreetMap site to the exact location
- **Tags** — hash-tagged keywords (e.g. #EDM #Festival) below the map
- **Sticky ticket selector** — right-side panel with all `event.tiers[]`, per-tier +/– quantity controls, running total, orange gradient "Add to Cart" button, Save and Share actions

![Event Detail — map with Miami marker, ticket sidebar](/Users/bharathkumarr/.gemini/antigravity/brain/78cbbccc-3356-4661-9bfc-dd9f1ed64dac/event_detail_e1_map_1771896101804.png)

**How the map works:**
1. `react-leaflet` renders a `<MapContainer center={[event.lat, event.lng]}>`
2. `<TileLayer>` streams street tiles from OpenStreetMap's CDN
3. `<Marker icon={defaultIcon}>` places a pin — uses a custom `L.Icon` with CDN-hosted images to bypass the Vite build icon-path bug
4. `<Popup>` shows venue name, address, and a "View on map" link

---

### `/checkout` — Checkout

- Shows all items currently in the cart (from `CartContext`)
- Per-item quantity editing and remove buttons
- Order summary with subtotal
- "Place Order" CTA — clears the cart and shows a confirmation (mock, no backend)

---

### `/my-tickets` — My Tickets

- Lists `MOCK_BOOKINGS` filtered to `currentUser.id`
- Each booking card shows: event name, date, venue, tier, quantity, total paid, status badge (`confirmed` / `pending`), and a **QR code placeholder** string
- Cancel / Download actions (UI only)

---

### `/organizer` — Organizer Dashboard

Sam Chen's view (role: `organizer`). Features:
- Revenue summary cards — total gross, platform fee deducted, net payout
- Event list for the organizer's events with per-event ticket sales progress
- Tier-level breakdown table — name, total capacity, remaining, sold, revenue generated
- Quick action buttons — Create Event, Export CSV

---

### `/analytics` — Analytics Dashboard

Admin/global view. Features:
- **KPI cards** — Total Revenue, Tickets Sold, Attendees, New Users (sourced from `MOCK_ANALYTICS`)
- **Revenue + Tickets line chart** (Recharts `<LineChart>`) — 7-month trend Sep through Mar
- **Category donut chart** (Recharts `<PieChart>`) — Music 35%, Tech 25%, Food 18%, Art 12%, Wellness 10%
- **Top events table** — ranked by gross revenue

---

### `/admin` — Finance Dashboard

Finance team view (role: `finance`). Features:
- Revenue records table from `MOCK_REVENUE` — event, organizer, gross, 10% platform commission, organizer payout, status
- Status badges — paid / processing / pending
- Platform total earnings summary card at the top

---

### `/marketing` — Marketing Dashboard

Marketing team view (role: `marketing`). Features:
- Campaign performance table from `MOCK_CAMPAIGNS` — name, type (email/push/featured), emails sent, open rate %, click rate %, revenue attributed
- Status filter tabs — active / draft / completed
- Summary stat cards — total reach, total campaign revenue, average open rate

---

### `/login` — Login

- Email + password form
- **One-click demo role buttons** — instantly logs in as Attendee, Organizer, Admin, Finance, or Marketing
- Calls `useAuth().login()` → sets `currentUser` in React Context → Navbar immediately reflects the new user name, role badge, and relevant nav links

![Login — cream background, orange sign-in button, demo accounts](/Users/bharathkumarr/.gemini/antigravity/brain/78cbbccc-3356-4661-9bfc-dd9f1ed64dac/login_page_poppy_theme_1771896110222.png)

---

### `/register` — Register

- Fields: full name, email, password, confirm password, role selector dropdown
- Client-side form validation — no backend connection in this MVP build

---

## Design System — Poppy Theme

All tokens are CSS variables in [`theme.css`](file:///Users/bharathkumarr/Downloads/Event%20Discovery%20Dashboard/src/styles/theme.css):

| Token | Value | Usage |
|---|---|---|
| `--color-bg-base` | `#fff8f4` | Page background (warm cream) |
| `--color-bg-card` | `#ffffff` | Card/panel surfaces |
| Primary CTA | `#f97316` orange | Buttons, active states |
| Primary gradient | `#f97316 to #ef4444` | CTA buttons, badges |
| Secondary accent | `#8b5cf6` violet | Share, secondary actions |
| `--color-text-primary` | `#1a0a00` | Dark warm-brown headings |
| `--color-text-muted` | `#78716c` | Labels, subtext |

**Typography:** [Outfit](https://fonts.google.com/specimen/Outfit) (Google Fonts) for headings; system sans-serif for body.

---

## Navbar

[`navbar.tsx`](file:///Users/bharathkumarr/Downloads/Event%20Discovery%20Dashboard/src/app/components/navbar.tsx) — always visible, fixed at the top:
- **Logo** — lightning bolt icon + "Planzo" in orange gradient text
- **Nav links** — Discover (always); My Tickets (attendee); or role dashboard link (organizer/admin/finance/marketing)
- **Right side** — avatar initials circle, user name, role badge, cart icon with live item count, logout button  
- Reads `currentUser` from `useAuth()` and `items.length` from `useCart()` — both update reactively on any change

---

## Deployment

| File | Purpose |
|---|---|
| [Dockerfile](file:///Users/bharathkumarr/Downloads/Event%20Discovery%20Dashboard/Dockerfile) | Multi-stage: Node 20 builds Vite bundle, nginx:alpine serves `/dist` |
| [nginx.conf](file:///Users/bharathkumarr/Downloads/Event%20Discovery%20Dashboard/nginx.conf) | Gzip compression, cache headers, HTML5 history fallback (all routes serve `index.html`) |
| [Jenkinsfile](file:///Users/bharathkumarr/Downloads/Event%20Discovery%20Dashboard/Jenkinsfile) | CI/CD pipeline: Checkout → Install → Lint → TypeCheck → Unit Tests → Build → Docker Build → Deploy Staging/Production |
| [.env.example](file:///Users/bharathkumarr/Downloads/Event%20Discovery%20Dashboard/.env.example) | All environment variables for frontend, backend, DB, Stripe, and email |

**Local dev:**
```bash
npm install
npm run dev   # starts Vite at http://localhost:5173
```
