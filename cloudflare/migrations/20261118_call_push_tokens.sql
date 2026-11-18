-- Registered devices belong to an authenticated Shno Mano Call session.
CREATE TABLE IF NOT EXISTS call_push_tokens (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'android' CHECK(platform IN ('android')),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_call_push_tokens_user ON call_push_tokens(user_id);
