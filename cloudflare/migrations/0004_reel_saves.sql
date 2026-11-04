CREATE TABLE IF NOT EXISTS reel_saves (post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (post_id,user_id));
CREATE INDEX IF NOT EXISTS idx_reel_saves_user ON reel_saves(user_id,created_at);
