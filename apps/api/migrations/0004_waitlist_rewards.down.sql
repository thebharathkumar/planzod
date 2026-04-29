ALTER TABLE waitlist_signups
DROP COLUMN IF EXISTS reward_sent_at,
DROP COLUMN IF EXISTS last_notified_tier;

