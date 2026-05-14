-- Mobile build jobs. Lifecycle: queued → dispatched → running → succeeded|failed.
-- Status updates come from GitHub Actions via /builds/:id/status (HMAC-auth).

CREATE TABLE IF NOT EXISTS builds (
  id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,                    -- ios | android
  bundle_id TEXT,                        -- com.acme.{slug}
  status TEXT NOT NULL DEFAULT 'queued', -- queued|dispatched|running|succeeded|failed
  gh_run_id TEXT,                        -- github actions run id
  gh_run_url TEXT,
  error TEXT,
  artifact_url TEXT,                     -- TestFlight build number / Play track URL
  queued_at INTEGER NOT NULL DEFAULT (unixepoch()),
  dispatched_at INTEGER,
  finished_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_builds_app ON builds(app_id, queued_at DESC);
CREATE INDEX IF NOT EXISTS idx_builds_user ON builds(user_id, queued_at DESC);
