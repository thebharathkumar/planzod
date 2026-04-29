DROP TRIGGER IF EXISTS events_set_geo ON events;
DROP TRIGGER IF EXISTS venues_set_geo ON venues;
DROP TRIGGER IF EXISTS orders_set_updated_at ON orders;
DROP TRIGGER IF EXISTS ticket_tiers_set_updated_at ON ticket_tiers;
DROP TRIGGER IF EXISTS events_set_updated_at ON events;
DROP TRIGGER IF EXISTS venues_set_updated_at ON venues;

DROP FUNCTION IF EXISTS set_geo_from_lat_lng();
DROP FUNCTION IF EXISTS set_updated_at();

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS stripe_events;
DROP TABLE IF EXISTS checkins;
DROP TABLE IF EXISTS tickets;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS ticket_tiers;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS venues;
DROP TABLE IF EXISTS organizers;
DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS users;

