-- One-time owner-verified developer password setup. No password or raw invite tokens in D1.
CREATE TABLE IF NOT EXISTS developer_setup_tokens (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 token_hash TEXT NOT NULL UNIQUE,
 expires_at TEXT NOT NULL,
 consumed_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
