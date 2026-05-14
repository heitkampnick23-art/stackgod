-- Stackgod D1 schema (production)

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  apple_sub TEXT UNIQUE,
  google_sub TEXT UNIQUE,
  name TEXT,
  avatar_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free',           -- free | hobby | pro | studio
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_connect_account_id TEXT,              -- builders selling SaaS
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS apps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,                          -- {slug}.stakgod.app
  name TEXT NOT NULL,
  description TEXT,
  pages_project TEXT,                          -- CF Pages project name
  custom_domain TEXT,
  ios_bundle_id TEXT,
  android_package TEXT,
  status TEXT NOT NULL DEFAULT 'draft',        -- draft | live | archived
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_apps_slug ON apps(slug);
CREATE INDEX IF NOT EXISTS idx_apps_user ON apps(user_id);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                          -- user | assistant | system
  content TEXT NOT NULL,
  model TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Hard credit ledger. Every AI call appends a row; middleware sums today's rows.
CREATE TABLE IF NOT EXISTS usage_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                          -- ai_message | deploy | mobile_build | domain_buy
  model TEXT,
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  ts INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_usage_user_ts ON usage_events(user_id, ts);

-- Domains the user purchased through Stackgod (CF Registrar).
CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_id TEXT REFERENCES apps(id) ON DELETE SET NULL,
  domain TEXT UNIQUE NOT NULL,
  registrar TEXT NOT NULL DEFAULT 'cloudflare',
  cost_usd REAL NOT NULL,                      -- wholesale CF cost
  fee_usd REAL NOT NULL DEFAULT 1.00,          -- our markup
  expires_at INTEGER,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Stripe Connect: payouts received by builders selling subs/products.
CREATE TABLE IF NOT EXISTS builder_payouts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_gross_cents INTEGER NOT NULL,
  application_fee_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  stripe_payment_intent TEXT UNIQUE,
  ts INTEGER NOT NULL DEFAULT (unixepoch())
);
