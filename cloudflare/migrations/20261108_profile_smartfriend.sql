-- New isolated storage for persona portraits and conversations.
CREATE TABLE IF NOT EXISTS smart_friend_avatars_cf (
 friend_id TEXT PRIMARY KEY, user_id TEXT NOT NULL, r2_key TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS smart_friend_messages_cf (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL, friend_id TEXT NOT NULL,
 role TEXT NOT NULL, text TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_smart_friend_messages_cf ON smart_friend_messages_cf(user_id,friend_id,created_at);
