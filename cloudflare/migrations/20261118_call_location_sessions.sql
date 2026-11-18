-- Lightweight call lifetime metadata; never stores location coordinates.
CREATE TABLE IF NOT EXISTS call_active_sessions (
  call_id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  caller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  ended_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_call_active_sessions_expiry ON call_active_sessions(expires_at);
