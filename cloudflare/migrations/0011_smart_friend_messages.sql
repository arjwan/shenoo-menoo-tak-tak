-- Authenticated, owner-scoped smart friend conversations. Additive.
CREATE TABLE IF NOT EXISTS smart_friend_messages (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 persona_id TEXT NOT NULL REFERENCES smart_friend_personas(id) ON DELETE CASCADE,
 role TEXT NOT NULL CHECK(role IN ('user','assistant')),
 text TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_smart_friend_messages_chat
 ON smart_friend_messages(user_id, persona_id, created_at, id);
