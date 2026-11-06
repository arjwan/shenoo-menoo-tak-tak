-- Native Cloudflare D1 consultation provider applications. Existing legacy records
-- require separately verified migration; never auto-approve imported applications.
CREATE TABLE IF NOT EXISTS consultation_providers (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 category TEXT NOT NULL CHECK(category IN ('medical','legal','educational','psychological')),
 title TEXT NOT NULL,
 specialty TEXT NOT NULL,
 bio TEXT NOT NULL,
 service_type TEXT NOT NULL CHECK(service_type IN ('free','paid')),
 fee INTEGER NOT NULL DEFAULT 0 CHECK(fee >= 0),
 currency TEXT NOT NULL DEFAULT 'IQD',
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','suspended')),
 rejection_reason TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(user_id,category)
);
CREATE INDEX IF NOT EXISTS idx_consultation_providers_approved
 ON consultation_providers(status,category,created_at);
