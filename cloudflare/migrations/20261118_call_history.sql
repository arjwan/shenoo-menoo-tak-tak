-- Durable call outcomes and per-recipient missed-call read status.
-- Does not store audio, video, or location data.
CREATE TABLE IF NOT EXISTS call_history(
 call_id TEXT PRIMARY KEY,
 conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
 caller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 type TEXT NOT NULL CHECK(type IN ('audio','video')),
 state TEXT NOT NULL DEFAULT 'ringing' CHECK(state IN ('ringing','missed','answered','declined')),
 started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 answered_at TEXT,
 ended_at TEXT,
 recipient_read_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_call_history_caller ON call_history(caller_id,started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_history_recipient ON call_history(recipient_id,started_at DESC);
CREATE INDEX IF NOT EXISTS idx_call_history_unread ON call_history(recipient_id,state,recipient_read_at);
