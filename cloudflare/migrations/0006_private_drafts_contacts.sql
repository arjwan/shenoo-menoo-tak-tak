CREATE TABLE IF NOT EXISTS user_post_drafts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  id TEXT NOT NULL,
  content TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id,id)
);
CREATE INDEX IF NOT EXISTS idx_user_post_drafts_recent ON user_post_drafts(user_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS user_phone_contacts (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id,phone)
);
CREATE INDEX IF NOT EXISTS idx_user_phone_contacts_user ON user_phone_contacts(user_id);
