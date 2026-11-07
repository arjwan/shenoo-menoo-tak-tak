-- Cloudflare D1 migration for Islamic community and service provider pages.
-- Idempotent; does not overwrite or delete existing records.
CREATE TABLE IF NOT EXISTS islamic_posts (
  id TEXT PRIMARY KEY, author_id TEXT NOT NULL, category TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '', text TEXT NOT NULL DEFAULT '',
  media_key TEXT, media_type TEXT, media_mime TEXT, media_size INTEGER,
  shared_to_general INTEGER NOT NULL DEFAULT 0, general_post_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_islamic_posts_category_time ON islamic_posts(category,created_at DESC);
CREATE TABLE IF NOT EXISTS islamic_likes (
  post_id TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY(post_id,user_id)
);
CREATE TABLE IF NOT EXISTS islamic_comments (
  id TEXT PRIMARY KEY, post_id TEXT NOT NULL, author_id TEXT NOT NULL,
  text TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_islamic_comments_post ON islamic_comments(post_id,created_at);
CREATE TABLE IF NOT EXISTS service_providers_cf (
  id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, kind TEXT NOT NULL,
  name TEXT NOT NULL, category TEXT NOT NULL, phone TEXT NOT NULL,
  whatsapp TEXT NOT NULL DEFAULT '', governorate TEXT NOT NULL,
  area TEXT NOT NULL, address TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '', vehicle_type TEXT NOT NULL DEFAULT '',
  vehicle_model TEXT NOT NULL DEFAULT '', latitude REAL, longitude REAL,
  available INTEGER NOT NULL DEFAULT 1, image_key TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_service_providers_cf_listing ON service_providers_cf(kind,status,created_at DESC);
CREATE TABLE IF NOT EXISTS service_requests_cf (
  id TEXT PRIMARY KEY, provider_id TEXT NOT NULL,
  requester_id TEXT NOT NULL, request_type TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL, phone TEXT NOT NULL,
  pickup_address TEXT NOT NULL DEFAULT '', destination TEXT NOT NULL DEFAULT '',
  latitude REAL, longitude REAL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
