-- Private direct-message ownership, deduplication and read state.
CREATE TABLE IF NOT EXISTS conversation_pairs (
  user_low TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_high TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL UNIQUE REFERENCES conversations(id) ON DELETE CASCADE,
  PRIMARY KEY(user_low,user_high)
);
CREATE TABLE IF NOT EXISTS conversation_read_receipts (
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(conversation_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_time ON messages(conversation_id,created_at DESC,id DESC);
