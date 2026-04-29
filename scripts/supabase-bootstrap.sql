-- Planzo full bootstrap — paste into Supabase SQL Editor and click "Run".
-- Idempotent: safe to re-run. Creates schema + seeds 12 events + 3 demo accounts.
-- Demo logins (password = "password123"):
--   demo@planzo.app       (organizer)
--   attendee@planzo.app   (attendee)
--   admin@planzo.app      (admin)

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'attendee' CHECK (role IN ('attendee', 'organizer', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx ON refresh_tokens(user_id);

CREATE TABLE IF NOT EXISTS organizers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  payout_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  place_id text UNIQUE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  geo geography(Point, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  venue_id uuid NOT NULL REFERENCES venues(id),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'other',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled')),
  hero_image_url text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  geo geography(Point, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS events_geo_gist_idx ON events USING GIST (geo);
CREATE INDEX IF NOT EXISTS events_status_starts_at_idx ON events(status, starts_at);

CREATE TABLE IF NOT EXISTS ticket_tiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name text NOT NULL,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  currency text NOT NULL DEFAULT 'usd',
  total_qty integer NOT NULL CHECK (total_qty >= 0),
  remaining_qty integer NOT NULL CHECK (remaining_qty >= 0),
  sales_start timestamptz NOT NULL DEFAULT now(),
  sales_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ticket_tiers_event_id_idx ON ticket_tiers(event_id);

CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id),
  user_id uuid NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'refunded')),
  stripe_session_id text UNIQUE,
  amount_total_cents integer NOT NULL CHECK (amount_total_cents >= 0),
  currency text NOT NULL DEFAULT 'usd',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS orders_user_id_idx ON orders(user_id);
CREATE INDEX IF NOT EXISTS orders_event_id_idx ON orders(event_id);

CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  ticket_tier_id uuid NOT NULL REFERENCES ticket_tiers(id),
  qty integer NOT NULL CHECK (qty > 0),
  unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);

CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id),
  user_id uuid NOT NULL REFERENCES users(id),
  status text NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'voided')),
  qr_secret_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tickets_user_id_idx ON tickets(user_id);
CREATE INDEX IF NOT EXISTS tickets_event_id_idx ON tickets(event_id);

CREATE TABLE IF NOT EXISTS checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL UNIQUE REFERENCES tickets(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  checked_in_by_user_id uuid NOT NULL REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS checkins_event_id_idx ON checkins(event_id);

CREATE TABLE IF NOT EXISTS stripe_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL UNIQUE,
  processed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid REFERENCES users(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  metadata_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_actor_user_id_idx ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs(entity_type, entity_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_geo_from_lat_lng()
RETURNS trigger AS $$
BEGIN
  NEW.geo = ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS venues_set_updated_at ON venues;
CREATE TRIGGER venues_set_updated_at
BEFORE UPDATE ON venues
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS events_set_updated_at ON events;
CREATE TRIGGER events_set_updated_at
BEFORE UPDATE ON events
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS ticket_tiers_set_updated_at ON ticket_tiers;
CREATE TRIGGER ticket_tiers_set_updated_at
BEFORE UPDATE ON ticket_tiers
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS orders_set_updated_at ON orders;
CREATE TRIGGER orders_set_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS venues_set_geo ON venues;
CREATE TRIGGER venues_set_geo
BEFORE INSERT OR UPDATE OF lat, lng ON venues
FOR EACH ROW
EXECUTE FUNCTION set_geo_from_lat_lng();

DROP TRIGGER IF EXISTS events_set_geo ON events;
CREATE TRIGGER events_set_geo
BEFORE INSERT OR UPDATE OF lat, lng ON events
FOR EACH ROW
EXECUTE FUNCTION set_geo_from_lat_lng();

CREATE TABLE IF NOT EXISTS organizer_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES organizers(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_id)
);
CREATE INDEX IF NOT EXISTS organizer_reviews_organizer_id_idx ON organizer_reviews(organizer_id);
CREATE INDEX IF NOT EXISTS organizer_reviews_event_id_idx ON organizer_reviews(event_id);

CREATE TABLE IF NOT EXISTS waitlist_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email citext NOT NULL UNIQUE,
  referral_code text NOT NULL UNIQUE,
  referred_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS waitlist_referred_by_idx ON waitlist_signups(referred_by);

ALTER TABLE waitlist_signups
ADD COLUMN IF NOT EXISTS reward_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS last_notified_tier text;

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

-- ─── Seed: demo accounts ────────────────────────────────────────────────
-- Password for all three is "password123" (bcrypt-hashed below).

INSERT INTO users (email, password_hash, role) VALUES
  ('demo@planzo.app',     '$2b$10$d4QXITA6jJoRlafUF.cRa.npoEqPq4w577e3J6cEveJrJsyIwLeBa', 'organizer'),
  ('attendee@planzo.app', '$2b$10$KO3tW8EGWxWgjWG/lwPx.ub4C2gmcIPJ1XrK2O2SsJZzG3rx2hDCC', 'attendee'),
  ('admin@planzo.app',    '$2b$10$GpG7UaaML/CIHWxSF68M8.81Ov6m8rJTMNNJMVvJmlgwlKT.URyf.', 'admin')
ON CONFLICT (email) DO NOTHING;

INSERT INTO organizers (user_id, display_name)
SELECT id, 'Planzo Demo Organizer'
FROM users WHERE email = 'demo@planzo.app'
ON CONFLICT (user_id) DO NOTHING;

-- ─── Seed: 12 demo events with venues + tiers ──────────────────────────

DO $seed$
DECLARE
  org_id uuid;
  v_id uuid;
  e_id uuid;
BEGIN
  SELECT id INTO org_id FROM organizers LIMIT 1;
  IF org_id IS NULL THEN RAISE NOTICE 'Skipping seed — no organizer'; RETURN; END IF;

  -- Skip if events already seeded.
  IF EXISTS (SELECT 1 FROM events WHERE title = 'Neon Nights Electronic Festival') THEN
    RAISE NOTICE 'Events already seeded, skipping';
    RETURN;
  END IF;

  -- 1. Neon Nights (Miami)
  INSERT INTO venues(name, address, lat, lng) VALUES ('Skyline Arena', '123 Harbor Blvd, Miami, FL', 25.7617, -80.1918) RETURNING id INTO v_id;
  INSERT INTO events(organizer_id, venue_id, title, description, category, starts_at, ends_at, status, hero_image_url, lat, lng, featured)
    VALUES (org_id, v_id, 'Neon Nights Electronic Festival',
      'World-class DJs across 3 stages with immersive light installations, art galleries, and a gourmet food village.',
      'concert', now() + interval '7 days' + interval '20 hours', now() + interval '8 days' + interval '2 hours',
      'published', 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200&auto=format&fit=crop', 25.7617, -80.1918, true)
    RETURNING id INTO e_id;
  INSERT INTO ticket_tiers(event_id, name, price_cents, total_qty, remaining_qty) VALUES
    (e_id, 'General', 4900, 500, 500),
    (e_id, 'VIP',     14900, 100, 100);

  -- 2. Startup Founders Summit (SF)
  INSERT INTO venues(name, address, lat, lng) VALUES ('Innovation Hub', '456 Tech Park Dr, San Francisco, CA', 37.7749, -122.4194) RETURNING id INTO v_id;
  INSERT INTO events(organizer_id, venue_id, title, description, category, starts_at, ends_at, status, hero_image_url, lat, lng, featured)
    VALUES (org_id, v_id, 'Startup Founders Summit 2026',
      '500+ founders, VCs, and innovators. Keynotes, pitch competitions, and hands-on workshops.',
      'meetup', now() + interval '14 days' + interval '9 hours', now() + interval '14 days' + interval '18 hours',
      'published', 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&auto=format&fit=crop', 37.7749, -122.4194, true)
    RETURNING id INTO e_id;
  INSERT INTO ticket_tiers(event_id, name, price_cents, total_qty, remaining_qty) VALUES
    (e_id, 'Standard',     29900, 300, 300),
    (e_id, 'Founder Pass', 59900, 50,  50);

  -- 3. Culinary World Tour (NYC)
  INSERT INTO venues(name, address, lat, lng) VALUES ('Central Park Meadow', 'Central Park West, New York, NY', 40.7828, -73.9654) RETURNING id INTO v_id;
  INSERT INTO events(organizer_id, venue_id, title, description, category, starts_at, ends_at, status, hero_image_url, lat, lng, featured)
    VALUES (org_id, v_id, 'Culinary World Tour: Street Food Edition',
      '40+ cuisines in one outdoor festival. Live cooking demos, celebrity chefs, artisan markets.',
      'food', now() + interval '21 days' + interval '11 hours', now() + interval '21 days' + interval '22 hours',
      'published', 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=1200&auto=format&fit=crop', 40.7828, -73.9654, false)
    RETURNING id INTO e_id;
  INSERT INTO ticket_tiers(event_id, name, price_cents, total_qty, remaining_qty) VALUES
    (e_id, 'Day Pass',     3500,  800, 800),
    (e_id, 'Chef''s Table', 12000, 30,  30);

  -- 4. Impressionist Art (Boston)
  INSERT INTO venues(name, address, lat, lng) VALUES ('Metropolitan Gallery', '789 Museum Mile, Boston, MA', 42.3601, -71.0589) RETURNING id INTO v_id;
  INSERT INTO events(organizer_id, venue_id, title, description, category, starts_at, ends_at, status, hero_image_url, lat, lng, featured)
    VALUES (org_id, v_id, 'Impressionist Art Exhibition: Light & Shadow',
      '200 masterworks from the Impressionist era with interactive AI guide and evening tours.',
      'arts', now() + interval '10 days' + interval '10 hours', now() + interval '10 days' + interval '19 hours',
      'published', 'https://images.unsplash.com/photo-1602726859144-2bb8c9de3c5c?w=1200&auto=format&fit=crop', 42.3601, -71.0589, false)
    RETURNING id INTO e_id;
  INSERT INTO ticket_tiers(event_id, name, price_cents, total_qty, remaining_qty) VALUES
    (e_id, 'Adult',   2500, 500, 500),
    (e_id, 'Premium', 6500, 80,  80);

  -- 5. Yoga Retreat (Asheville)
  INSERT INTO venues(name, address, lat, lng) VALUES ('Blue Ridge Mountain Retreat', 'Appalachian Trail Rd, Asheville, NC', 35.5951, -82.5515) RETURNING id INTO v_id;
  INSERT INTO events(organizer_id, venue_id, title, description, category, starts_at, ends_at, status, hero_image_url, lat, lng, featured)
    VALUES (org_id, v_id, 'Sunrise Yoga & Wellness Retreat',
      '3-day immersive retreat with sunrise yoga, meditation, sound healing, and farm-to-table meals.',
      'sports', now() + interval '28 days' + interval '7 hours', now() + interval '30 days' + interval '19 hours',
      'published', 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=1200&auto=format&fit=crop', 35.5951, -82.5515, true)
    RETURNING id INTO e_id;
  INSERT INTO ticket_tiers(event_id, name, price_cents, total_qty, remaining_qty) VALUES
    (e_id, 'Day Visitor',  7500,  100, 100),
    (e_id, 'Full Retreat', 45000, 40,  40);

  -- 6. Jazz Under the Stars (NOLA)
  INSERT INTO venues(name, address, lat, lng) VALUES ('Riverside Amphitheater', '300 River Walk Blvd, New Orleans, LA', 29.9511, -90.0715) RETURNING id INTO v_id;
  INSERT INTO events(organizer_id, venue_id, title, description, category, starts_at, ends_at, status, hero_image_url, lat, lng, featured)
    VALUES (org_id, v_id, 'Jazz Under the Stars',
      'Outdoor jazz with Grammy-nominated artists, craft cocktails, and picnic-style seating.',
      'concert', now() + interval '5 days' + interval '19 hours', now() + interval '5 days' + interval '23 hours',
      'published', 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=1200&auto=format&fit=crop', 29.9511, -90.0715, false)
    RETURNING id INTO e_id;
  INSERT INTO ticket_tiers(event_id, name, price_cents, total_qty, remaining_qty) VALUES
    (e_id, 'Lawn',     5500,  300, 300),
    (e_id, 'Reserved', 11000, 80,  80);

  -- 7. Indie Game Workshop (Austin)
  INSERT INTO venues(name, address, lat, lng) VALUES ('Maker Space HQ', '222 Creator Ave, Austin, TX', 30.2672, -97.7431) RETURNING id INTO v_id;
  INSERT INTO events(organizer_id, venue_id, title, description, category, starts_at, ends_at, status, hero_image_url, lat, lng, featured)
    VALUES (org_id, v_id, 'Indie Game Dev Workshop',
      '2-day Unity workshop where you build a complete indie game from scratch. Take home your project.',
      'workshop', now() + interval '12 days' + interval '10 hours', now() + interval '13 days' + interval '17 hours',
      'published', 'https://images.unsplash.com/photo-1547036967-23d11aacaee0?w=1200&auto=format&fit=crop', 30.2672, -97.7431, false)
    RETURNING id INTO e_id;
  INSERT INTO ticket_tiers(event_id, name, price_cents, total_qty, remaining_qty) VALUES
    (e_id, 'Workshop', 19900, 40, 40);

  -- 8. Fashion Showcase (LA)
  INSERT INTO venues(name, address, lat, lng) VALUES ('Design District Gallery', '88 Fashion Row, Los Angeles, CA', 34.0522, -118.2437) RETURNING id INTO v_id;
  INSERT INTO events(organizer_id, venue_id, title, description, category, starts_at, ends_at, status, hero_image_url, lat, lng, featured)
    VALUES (org_id, v_id, 'Emerging Designers Fashion Showcase',
      '20 emerging designers present debut collections on the runway. VIP reception included.',
      'arts', now() + interval '18 days' + interval '18 hours', now() + interval '18 days' + interval '23 hours',
      'published', 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&auto=format&fit=crop', 34.0522, -118.2437, true)
    RETURNING id INTO e_id;
  INSERT INTO ticket_tiers(event_id, name, price_cents, total_qty, remaining_qty) VALUES
    (e_id, 'Runway',       8900,  200, 200),
    (e_id, 'Designer VIP', 25000, 20,  20);

  -- 9. Free Coding Bootcamp (Seattle)
  INSERT INTO venues(name, address, lat, lng) VALUES ('Public Library Tech Hub', '1000 4th Ave, Seattle, WA', 47.6062, -122.3321) RETURNING id INTO v_id;
  INSERT INTO events(organizer_id, venue_id, title, description, category, starts_at, ends_at, status, hero_image_url, lat, lng, featured)
    VALUES (org_id, v_id, 'Community Coding Bootcamp — Free',
      'Free intro to web development. Bring a laptop, leave with your first deployed website.',
      'class', now() + interval '3 days' + interval '14 hours', now() + interval '3 days' + interval '18 hours',
      'published', 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1200&auto=format&fit=crop', 47.6062, -122.3321, false)
    RETURNING id INTO e_id;
  INSERT INTO ticket_tiers(event_id, name, price_cents, total_qty, remaining_qty) VALUES
    (e_id, 'Free Seat', 0, 30, 30);

  -- 10. Farmers Market (Denver)
  INSERT INTO venues(name, address, lat, lng) VALUES ('Downtown Plaza', 'Civic Center Park, Denver, CO', 39.7392, -104.9903) RETURNING id INTO v_id;
  INSERT INTO events(organizer_id, venue_id, title, description, category, starts_at, ends_at, status, hero_image_url, lat, lng, featured)
    VALUES (org_id, v_id, 'Saturday Farmers Market & Live Music',
      'Local growers, artisan goods, and live folk music. Free to browse, pay-what-you-can for music tips.',
      'community', now() + interval '2 days' + interval '9 hours', now() + interval '2 days' + interval '13 hours',
      'published', 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=1200&auto=format&fit=crop', 39.7392, -104.9903, false)
    RETURNING id INTO e_id;
  INSERT INTO ticket_tiers(event_id, name, price_cents, total_qty, remaining_qty) VALUES
    (e_id, 'Free Entry', 0, 999, 999);

  -- 11. Photography Walk (Chicago)
  INSERT INTO venues(name, address, lat, lng) VALUES ('Millennium Park', '201 E Randolph St, Chicago, IL', 41.8781, -87.6298) RETURNING id INTO v_id;
  INSERT INTO events(organizer_id, venue_id, title, description, category, starts_at, ends_at, status, hero_image_url, lat, lng, featured)
    VALUES (org_id, v_id, 'Photography Walk: Golden Hour',
      'Pro photographer leads a 2-hour walking tour through the city''s most photogenic spots.',
      'workshop', now() + interval '6 days' + interval '17 hours', now() + interval '6 days' + interval '19 hours',
      'published', 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?w=1200&auto=format&fit=crop', 41.8781, -87.6298, false)
    RETURNING id INTO e_id;
  INSERT INTO ticket_tiers(event_id, name, price_cents, total_qty, remaining_qty) VALUES
    (e_id, 'Walk + Critique', 4500, 18, 18);

  -- 12. Trail Run (Portland)
  INSERT INTO venues(name, address, lat, lng) VALUES ('Forest Park Trailhead', 'NW Thurman St, Portland, OR', 45.5152, -122.6784) RETURNING id INTO v_id;
  INSERT INTO events(organizer_id, venue_id, title, description, category, starts_at, ends_at, status, hero_image_url, lat, lng, featured)
    VALUES (org_id, v_id, 'Sunday Trail Run & Coffee',
      '5km easy trail run for all paces, followed by free coffee and pastries. Bring a friend.',
      'sports', now() + interval '4 days' + interval '8 hours', now() + interval '4 days' + interval '10 hours',
      'published', 'https://images.unsplash.com/photo-1502904550040-7534597429ae?w=1200&auto=format&fit=crop', 45.5152, -122.6784, false)
    RETURNING id INTO e_id;
  INSERT INTO ticket_tiers(event_id, name, price_cents, total_qty, remaining_qty) VALUES
    (e_id, 'Drop-in', 0, 999, 999);

  RAISE NOTICE 'Seeded 12 events across 12 cities ✓';
END $seed$;

SELECT 'Setup complete. Demo logins (pw=password123):' AS message
UNION ALL SELECT '  demo@planzo.app (organizer)'
UNION ALL SELECT '  attendee@planzo.app (attendee)'
UNION ALL SELECT '  admin@planzo.app (admin)'
UNION ALL SELECT format('Events: %s', (SELECT COUNT(*) FROM events))
UNION ALL SELECT format('Users:  %s', (SELECT COUNT(*) FROM users));
