-- Public discovery: apps can opt-in to appear in /discover.

ALTER TABLE apps ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;
ALTER TABLE apps ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE apps ADD COLUMN tagline TEXT;

CREATE INDEX IF NOT EXISTS idx_apps_public ON apps(is_public, updated_at DESC);
