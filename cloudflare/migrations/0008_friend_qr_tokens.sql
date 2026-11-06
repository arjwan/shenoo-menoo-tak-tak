-- D1 security-scoped single-use, short-lived friend QR invites.
-- Only SHA-256 hashes of random tokens are stored, never the token itself.
CREATE TABLE IF NOT EXISTS friend_qr_tokens (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE,
 expires_at TEXT NOT NULL,
 used_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_friend_qr_tokens_user ON friend_qr_tokens(user_id,expires_at);
CREATE INDEX IF NOT EXISTS idx_friend_qr_tokens_expiry ON friend_qr_tokens(expires_at);
