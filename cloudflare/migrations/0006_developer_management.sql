-- Additive Cloudflare D1 developer management tables. Existing chats/users are untouched.
CREATE TABLE IF NOT EXISTS developer_rooms (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 120),
 room_type TEXT NOT NULL DEFAULT 'group' CHECK(room_type IN ('group','channel','support')),
 privacy TEXT NOT NULL DEFAULT 'public' CHECK(privacy IN ('public','private')),
 owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
 is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
 is_locked INTEGER NOT NULL DEFAULT 0 CHECK(is_locked IN (0,1)),
 is_official INTEGER NOT NULL DEFAULT 0 CHECK(is_official IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS developer_rooms_created_idx ON developer_rooms(created_at);
CREATE TABLE IF NOT EXISTS developer_room_members (
 room_id TEXT NOT NULL REFERENCES developer_rooms(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (room_id,user_id)
);
CREATE TABLE IF NOT EXISTS developer_room_reports (
 id TEXT PRIMARY KEY,
 room_id TEXT NOT NULL REFERENCES developer_rooms(id) ON DELETE CASCADE,
 reporter_id TEXT REFERENCES users(id) ON DELETE SET NULL,
 reason TEXT NOT NULL CHECK(length(reason) BETWEEN 2 AND 2000),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','reviewing','resolved','dismissed')),
 resolution TEXT NOT NULL DEFAULT '',
 reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
 reviewed_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS developer_room_reports_status_idx ON developer_room_reports(status,created_at);
CREATE TABLE IF NOT EXISTS developer_service_providers (
 id TEXT PRIMARY KEY,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 2 AND 120),
 category TEXT NOT NULL DEFAULT 'عام',
 owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 review_note TEXT NOT NULL DEFAULT '',
 reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
 reviewed_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS developer_service_providers_status_idx ON developer_service_providers(status,created_at);
CREATE TABLE IF NOT EXISTS developer_service_requests (
 id TEXT PRIMARY KEY,
 applicant_id TEXT REFERENCES users(id) ON DELETE SET NULL,
 type TEXT NOT NULL DEFAULT 'service' CHECK(type IN ('service','advertisement','provider')),
 title TEXT NOT NULL CHECK(length(title) BETWEEN 2 AND 120),
 details TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 review_note TEXT NOT NULL DEFAULT '',
 reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
 reviewed_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS developer_service_requests_status_idx ON developer_service_requests(status,created_at);
