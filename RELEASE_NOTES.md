# Planzo Features & Release Notes

## [v0.2.0] - Full feature set

End-to-end build covering every story in the product backlog (modules 01–06).

### 01 Account Management
- 01.03 Recover password — email-based reset tokens (`/forgot-password` → `/reset-password`)
- 01.04 Manage profile — display name, phone, bio, city, country, marketing opt-in
- 01.05 Manage notification preferences — email / push / SMS toggles per channel
- 01.06 Manage saved payment methods — Stripe customer + payment method storage with default selection
- 01.07 Contact customer support — public inbox + threaded replies + admin assignment
- 01.08 Delete account — soft-delete with email anonymization and refresh-token revocation

### 02 Booking & Transactions
- 02.05 Manage bookings — `/bookings` page with line items, tickets, refund status
- 02.06 Submit refund request (attendee)
- 02.07 Cancel pending refund request
- 02.09 View booking history (`GET /me/bookings`)
- 02.10 Submit ratings & reviews — eligibility-checked event reviews

### 03 Organizer Tools
- 03.04 Unpublish event (`POST /events/:id/unpublish`)
- 03.08 Approve / deny refund (organizer console at `/organizer/refunds`)
- 03.12 Send updates to attendees over email / push / SMS

### 04 Marketing
- 04.01–04.03 Campaign CRUD
- 04.04 Feature event on homepage
- 04.05 Recommendations from interaction history (`GET /recommendations`)
- 04.06–04.08 Multi-channel sends (email / push / SMS / digital)
- 04.09–04.10 Campaign performance tracking + engagement attribution

### 05 Finance
- 05.01 Track ticket sales (totals + 90-day timeseries)
- 05.02 Track revenue per event
- 05.03 Calculate platform commission for arbitrary date ranges
- 05.04 Manage organizer payouts (create + status transitions + Stripe transfer reference)
- 05.05 Track payment settlement status (auto-written from the Stripe webhook)
- 05.06 Execute refund transaction via Stripe
- 05.07 Generate financial report (`/finance/reports/financial`)
- 05.08 Export financial report (CSV)
- 05.09 Reconcile settlements into payouts

### 06 Analytics
- 06.01 Track event performance (views / saves / shares / sold / check-ins / net / rating)
- 06.02 Analyze revenue trends (timeseries + by category)
- 06.03 Track organizer performance
- 06.04 Analyze customer behaviour (cohorts, repeat rate, interaction mix)
- 06.05 Analyze event discovery (sources, top categories, conversion funnel)
- 06.06 Analyze marketing performance (channel mix + top campaigns)
- 06.07 Organizer dashboard
- 06.08 Marketing analytics dashboard
- 06.09 Finance analytics dashboard
- 06.10 Export analytics report (CSV)

### Schema additions (migration 0005)
`user_profiles`, `notification_preferences`, `password_reset_tokens`, `saved_payment_methods`,
`support_tickets`, `support_messages`, `refund_requests`, `event_reviews`, `event_announcements`,
`campaigns`, `campaign_sends`, `user_event_interactions`, `finance_settings`, `ledger_entries`,
`payouts`, `settlements`, `daily_event_metrics`, `daily_platform_metrics`. Existing tables gained
`users.deleted_at`, `orders.refund_amount_cents`, `events.featured / featured_until`.

### Webhook upgrade
Stripe `checkout.session.completed` now writes a `settlement` row, three ledger entries
(sale / commission / processing_fee), records a `purchase` interaction for analytics, and
attributes the most recent campaign send for the user as a conversion.

### Tests
- `commission.test.ts` covers platform commission + processing fee math
- All existing token / QR tests still pass

---

## [v0.1.0] - 2026-03-18
**Build Number: 1**

### Core Features

- **Event Discovery**: A centralized hub for finding local events with interactive maps, search functionality, and advanced filtering options.
- **3D Globe Interaction**: A visually stunning interactive globe that allows users to explore events globally through interactive markers.
- **Authentication System**: Secure user registration and login with profile management and role-based access.
- **Organizer Dashboard**: A powerful suite of tools for event creators to manage listings, track attendees, and analyze performance.
- **Marketing Dashboard**: Dedicated tools for promotion, tracking campaign success, and audience engagement metrics.
- **Analytics & Reporting**: Comprehensive dashboards for visualizing event data, financial reports, and user trends.
- **Ticketing & Checkout**: A streamlined ticketing system with integrated payment processing and order history.
- **Customer Support Portal**: A robust support center featuring FAQs, documentation, and a contact gateway for users and organizers.
- **User Profiles**: Personalized dashboards for managing tickets, event history, and account settings.
- **Financial Management**: Admin and organizer tools for tracking revenue, payouts, and financial health.
