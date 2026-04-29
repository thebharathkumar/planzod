-- Migration 0005: full feature set backing the product backlog.
-- Adds tables for password reset, profiles, notification preferences,
-- saved payment methods, support tickets, refunds, attendee reviews,
-- organizer announcements, marketing campaigns, recommendations, and
-- finance / analytics aggregates.

-- ── Account Management ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  phone text,
  bio text,
  city text,
  country text,
  marketing_opt_in boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS user_profiles_set_updated_at ON user_profiles;
CREATE TRIGGER user_profiles_set_updated_at
BEFORE UPDATE ON user_profiles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email_event_reminders boolean NOT NULL DEFAULT true,
  email_order_receipts boolean NOT NULL DEFAULT true,
  email_marketing boolean NOT NULL DEFAULT true,
  email_organizer_updates boolean NOT NULL DEFAULT true,
  push_event_reminders boolean NOT NULL DEFAULT true,
  push_marketing boolean NOT NULL DEFAULT false,
  sms_event_reminders boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS notification_preferences_set_updated_at ON notification_preferences;
CREATE TRIGGER notification_preferences_set_updated_at
BEFORE UPDATE ON notification_preferences
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx ON password_reset_tokens(user_id);

CREATE TABLE IF NOT EXISTS saved_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_payment_method_id text NOT NULL,
  brand text,
  last4 text,
  exp_month integer,
  exp_year integer,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, stripe_payment_method_id)
);
CREATE INDEX IF NOT EXISTS saved_payment_methods_user_id_idx ON saved_payment_methods(user_id);

CREATE TABLE IF NOT EXISTS support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  email text NOT NULL,
  subject text NOT NULL,
  category text NOT NULL DEFAULT 'general' CHECK (category IN ('general','billing','event','technical','feedback')),
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  assignee_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_tickets_user_id_idx ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON support_tickets(status);

DROP TRIGGER IF EXISTS support_tickets_set_updated_at ON support_tickets;
CREATE TRIGGER support_tickets_set_updated_at
BEFORE UPDATE ON support_tickets
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  author_role text NOT NULL CHECK (author_role IN ('user','agent','system')),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_messages_ticket_id_idx ON support_messages(ticket_id);

-- Soft-delete columns on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_reason text;
CREATE INDEX IF NOT EXISTS users_deleted_at_idx ON users(deleted_at);

-- ── Booking / Refund flow ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','denied','refunded','cancelled')),
  organizer_decision_note text,
  decided_by_user_id uuid REFERENCES users(id),
  decided_at timestamptz,
  refund_executed_at timestamptz,
  stripe_refund_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS refund_requests_order_id_idx ON refund_requests(order_id);
CREATE INDEX IF NOT EXISTS refund_requests_user_id_idx ON refund_requests(user_id);
CREATE INDEX IF NOT EXISTS refund_requests_status_idx ON refund_requests(status);

DROP TRIGGER IF EXISTS refund_requests_set_updated_at ON refund_requests;
CREATE TRIGGER refund_requests_set_updated_at
BEFORE UPDATE ON refund_requests
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS event_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title text,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);
CREATE INDEX IF NOT EXISTS event_reviews_event_id_idx ON event_reviews(event_id);

-- Order line-item refund flag (so partial refunds are tracked)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS refund_amount_cents integer NOT NULL DEFAULT 0;

-- ── Organizer Tools ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS event_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  organizer_id uuid NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  subject text NOT NULL,
  body text NOT NULL,
  channel text NOT NULL DEFAULT 'email' CHECK (channel IN ('email','push','sms')),
  recipient_count integer NOT NULL DEFAULT 0,
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS event_announcements_event_id_idx ON event_announcements(event_id);

ALTER TABLE events ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;
ALTER TABLE events ADD COLUMN IF NOT EXISTS featured_until timestamptz;
CREATE INDEX IF NOT EXISTS events_featured_idx ON events(featured) WHERE featured = true;

-- ── Marketing ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid REFERENCES organizers(id) ON DELETE SET NULL,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  channel text NOT NULL CHECK (channel IN ('email','push','sms','digital','homepage_feature')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','paused','completed','cancelled')),
  audience_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  scheduled_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  budget_cents integer,
  created_by_user_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campaigns_status_idx ON campaigns(status);
CREATE INDEX IF NOT EXISTS campaigns_event_id_idx ON campaigns(event_id);
CREATE INDEX IF NOT EXISTS campaigns_organizer_id_idx ON campaigns(organizer_id);

DROP TRIGGER IF EXISTS campaigns_set_updated_at ON campaigns;
CREATE TRIGGER campaigns_set_updated_at
BEFORE UPDATE ON campaigns
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS campaign_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','delivered','opened','clicked','converted','failed','unsubscribed')),
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  converted_at timestamptz,
  attributed_order_id uuid REFERENCES orders(id),
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS campaign_sends_campaign_id_idx ON campaign_sends(campaign_id);
CREATE INDEX IF NOT EXISTS campaign_sends_user_id_idx ON campaign_sends(user_id);
CREATE INDEX IF NOT EXISTS campaign_sends_status_idx ON campaign_sends(status);

CREATE TABLE IF NOT EXISTS user_event_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  interaction_type text NOT NULL CHECK (interaction_type IN ('view','click','save','share','purchase','search_impression')),
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS uei_user_id_idx ON user_event_interactions(user_id);
CREATE INDEX IF NOT EXISTS uei_event_id_idx ON user_event_interactions(event_id);
CREATE INDEX IF NOT EXISTS uei_type_idx ON user_event_interactions(interaction_type);

-- ── Finance ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS finance_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  platform_commission_bps integer NOT NULL DEFAULT 1000,  -- 10.00%
  payment_processing_bps integer NOT NULL DEFAULT 290,    -- 2.90%
  payment_processing_flat_cents integer NOT NULL DEFAULT 30,
  payout_schedule text NOT NULL DEFAULT 'weekly' CHECK (payout_schedule IN ('daily','weekly','monthly','manual')),
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO finance_settings(id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  organizer_id uuid REFERENCES organizers(id) ON DELETE SET NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('sale','refund','commission','processing_fee','payout','adjustment')),
  amount_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  description text,
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ledger_entries_order_id_idx ON ledger_entries(order_id);
CREATE INDEX IF NOT EXISTS ledger_entries_organizer_id_idx ON ledger_entries(organizer_id);
CREATE INDEX IF NOT EXISTS ledger_entries_type_idx ON ledger_entries(entry_type);
CREATE INDEX IF NOT EXISTS ledger_entries_created_at_idx ON ledger_entries(created_at);

CREATE TABLE IF NOT EXISTS payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'usd',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','paid','failed','cancelled')),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  scheduled_at timestamptz,
  paid_at timestamptz,
  stripe_transfer_id text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payouts_organizer_id_idx ON payouts(organizer_id);
CREATE INDEX IF NOT EXISTS payouts_status_idx ON payouts(status);

DROP TRIGGER IF EXISTS payouts_set_updated_at ON payouts;
CREATE TRIGGER payouts_set_updated_at
BEFORE UPDATE ON payouts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  organizer_id uuid NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  gross_cents integer NOT NULL,
  commission_cents integer NOT NULL,
  processing_fee_cents integer NOT NULL,
  refund_cents integer NOT NULL DEFAULT 0,
  net_organizer_cents integer NOT NULL,
  status text NOT NULL DEFAULT 'unsettled' CHECK (status IN ('unsettled','reconciled','paid')),
  payout_id uuid REFERENCES payouts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reconciled_at timestamptz
);
CREATE INDEX IF NOT EXISTS settlements_organizer_id_idx ON settlements(organizer_id);
CREATE INDEX IF NOT EXISTS settlements_status_idx ON settlements(status);

-- ── Analytics aggregates (materialized rollups, written by worker / cron) ──

CREATE TABLE IF NOT EXISTS daily_event_metrics (
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  day date NOT NULL,
  views integer NOT NULL DEFAULT 0,
  saves integer NOT NULL DEFAULT 0,
  shares integer NOT NULL DEFAULT 0,
  tickets_sold integer NOT NULL DEFAULT 0,
  gross_cents integer NOT NULL DEFAULT 0,
  PRIMARY KEY (event_id, day)
);

CREATE TABLE IF NOT EXISTS daily_platform_metrics (
  day date PRIMARY KEY,
  new_users integer NOT NULL DEFAULT 0,
  active_users integer NOT NULL DEFAULT 0,
  events_published integer NOT NULL DEFAULT 0,
  tickets_sold integer NOT NULL DEFAULT 0,
  gross_cents integer NOT NULL DEFAULT 0,
  refund_cents integer NOT NULL DEFAULT 0
);
