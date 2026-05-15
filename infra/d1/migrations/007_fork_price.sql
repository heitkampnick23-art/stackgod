-- Marketplace: builders can sell forks of their public apps.
-- fork_price_cents = 0 means free fork (default behavior, what we have today).
-- Stripe Connect routes the payment to the builder; we take 20% application_fee.

ALTER TABLE apps ADD COLUMN fork_price_cents INTEGER NOT NULL DEFAULT 0;

-- Tracks completed paid forks for the receipts ledger + dispute resolution.
CREATE TABLE IF NOT EXISTS fork_purchases (
  id TEXT PRIMARY KEY,
  source_app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  source_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buyer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  forked_app_id TEXT REFERENCES apps(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL,
  application_fee_cents INTEGER NOT NULL,
  stripe_session_id TEXT UNIQUE,
  ts INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_fork_purchases_buyer ON fork_purchases(buyer_user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_fork_purchases_source ON fork_purchases(source_user_id, ts DESC);
