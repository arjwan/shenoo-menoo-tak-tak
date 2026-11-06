-- Cloudflare D1 smart-friend personas (per-user, max 10 active slots).
-- Additive migration: no legacy or Cloudflare user data overwritten.
CREATE TABLE IF NOT EXISTS smart_friend_personas (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 slot INTEGER NOT NULL CHECK(slot BETWEEN 1 AND 10),
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 40),
 gender TEXT NOT NULL CHECK(gender IN ('male','female')),
 age INTEGER NOT NULL CHECK(age BETWEEN 18 AND 80),
 personality TEXT NOT NULL,
 conversation_style TEXT NOT NULL,
 interests_json TEXT NOT NULL DEFAULT '[]',
 avatar_key TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(user_id,slot)
);
CREATE INDEX IF NOT EXISTS idx_smart_personas_owner ON smart_friend_personas(user_id);
