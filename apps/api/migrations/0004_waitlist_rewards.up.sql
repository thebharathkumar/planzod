ALTER TABLE waitlist_signups
ADD COLUMN IF NOT EXISTS reward_sent_at timestamptz,
ADD COLUMN IF NOT EXISTS last_notified_tier text;

