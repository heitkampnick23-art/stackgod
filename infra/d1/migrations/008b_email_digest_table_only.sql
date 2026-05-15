-- Idempotent re-run of 008. Skips ALTER TABLE users (column already added)
-- and only creates the digest tracking table + index.

CREATE TABLE IF NOT EXISTS email_digests_sent (
  user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_key TEXT NOT NULL,
  sent_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  views    INTEGER NOT NULL DEFAULT 0,
  forks    INTEGER NOT NULL DEFAULT 0,
  revenue_cents INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, week_key)
);
CREATE INDEX IF NOT EXISTS idx_digests_sent_at ON email_digests_sent(sent_at DESC);
