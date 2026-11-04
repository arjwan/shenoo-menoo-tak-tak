CREATE TABLE IF NOT EXISTS friend_requests (
 id TEXT PRIMARY KEY,
 sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','rejected','canceled')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 responded_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_pending_pair ON friend_requests(sender_id,receiver_id) WHERE status='pending';
CREATE INDEX IF NOT EXISTS idx_friend_received ON friend_requests(receiver_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_friend_sent ON friend_requests(sender_id,status,created_at DESC);