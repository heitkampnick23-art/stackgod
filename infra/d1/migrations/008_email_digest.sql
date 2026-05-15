-- Weekly builder digest. Tracks per-user idempotency (one email per ISO week)
-- and a soft unsubscribe so we never re-spam someone who opted out.

ALTER TABLE users ADD COLUMN digest_unsubscribed_at INTEGER;

CREATE TABLE IF NOT EXISTS email_digests_sent (
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_key TEXT NOT NULL,                 -- e.g. "2026-W20"
  sent_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  views    INTEGER NOT NULL DEFAULT 0,
  forks    INTEGER NOT NULL DEFAULT 0,
  revenue_cents INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, week_key)
);
CREATE INDEX IF NOT EXISTS idx_digests_sent_at ON email_digests_sent(sent_at DESC);
