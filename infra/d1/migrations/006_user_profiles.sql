-- Public builder profiles at /u/{handle}.
-- handle is unique, lowercase, [a-z0-9-] 3-32 chars. Auto-generated from email
-- on first profile-page visit if not already set.

ALTER TABLE users ADD COLUMN handle TEXT;
ALTER TABLE users ADD COLUMN bio TEXT;
ALTER TABLE users ADD COLUMN twitter TEXT;
ALTER TABLE users ADD COLUMN website TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle ON users(handle) WHERE handle IS NOT NULL;
