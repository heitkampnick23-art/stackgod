-- Per-user Apple + Google publisher credentials. Builders bring their own
-- developer accounts (Apple Guideline 4.2.6). Secret material is AES-GCM
-- encrypted with the Worker's ENCRYPTION_KEY before storage.

CREATE TABLE IF NOT EXISTS developer_credentials (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- Apple
  apple_team_id TEXT,
  apple_bundle_prefix TEXT,             -- e.g. "com.acme"  → ships as com.acme.{slug}
  apple_asc_issuer_id TEXT,
  apple_asc_key_id TEXT,
  apple_asc_p8_enc TEXT,                -- base64(iv || ciphertext)

  -- Google
  google_play_service_account_enc TEXT, -- base64(iv || ciphertext) of the JSON
  google_package_prefix TEXT,           -- e.g. "com.acme" → com.acme.{slug}

  apple_connected_at INTEGER,
  google_connected_at INTEGER,
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
