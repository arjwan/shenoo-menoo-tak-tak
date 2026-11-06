-- Developer entitlement is separate from the public users.role field.
-- Grant insertion and revocation are admin-only D1 operations, never public HTTP APIs.
CREATE TABLE IF NOT EXISTS developer_grants (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  grant_source TEXT NOT NULL DEFAULT 'cloudflare-account-owner',
  granted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS developer_grants_active ON developer_grants(revoked_at);
