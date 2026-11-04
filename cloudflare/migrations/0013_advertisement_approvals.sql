-- Advertisement moderation stored in Cloudflare D1.
-- Each ad is a real post with a separate approval record; ordinary posts are unchanged.
CREATE TABLE IF NOT EXISTS ad_records (
  post_id TEXT PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 120),
  category TEXT NOT NULL DEFAULT 'عام',
  contact TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  review_note TEXT NOT NULL DEFAULT '',
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ad_records_status ON ad_records(status,created_at DESC);
