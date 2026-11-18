CREATE TABLE IF NOT EXISTS call_push_devices (
 installation_id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 session_hash TEXT NOT NULL,
 token TEXT NOT NULL,
 updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS call_push_devices_user ON call_push_devices(user_id);
