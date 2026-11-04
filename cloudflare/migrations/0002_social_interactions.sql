-- Add core social interactions, no imported data.
CREATE TABLE IF NOT EXISTS post_likes (
 post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(post_id,user_id)
);
CREATE TABLE IF NOT EXISTS post_comments (
 id TEXT PRIMARY KEY,
 post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
 author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 text TEXT NOT NULL CHECK(length(text) BETWEEN 1 AND 2000),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS post_comments_post_created_idx ON post_comments(post_id,created_at DESC);
CREATE INDEX IF NOT EXISTS stories_expiry_idx ON stories(expires_at DESC);
CREATE INDEX IF NOT EXISTS follows_followed_idx ON follows(followed_id);
