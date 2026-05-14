-- Public-tips ledger for the First 100 Founders Fund.
-- Every Stripe-completed checkout in the 'tip' mode lands here.

CREATE TABLE IF NOT EXISTS tips (
  id TEXT PRIMARY KEY,
  stripe_session_id TEXT UNIQUE NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  supporter_name TEXT,                -- nullable; show "Anonymous"
  supporter_email TEXT,
  message TEXT,
  anonymous INTEGER NOT NULL DEFAULT 0,
  ts INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_tips_ts ON tips(ts DESC);

-- Public ledger of grants we've made (Apple/Google fees we've paid for builders).
CREATE TABLE IF NOT EXISTS grants (
  id TEXT PRIMARY KEY,
  recipient_handle TEXT NOT NULL,    -- e.g. "@maria_ph"
  app_url TEXT,
  kind TEXT NOT NULL,                -- 'apple_99' | 'google_25' | 'other'
  amount_cents INTEGER NOT NULL,
  note TEXT,
  ts INTEGER NOT NULL DEFAULT (unixepoch())
);
