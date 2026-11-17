-- Additive only: existing groups remain private. No existing messages or memberships change.
CREATE TABLE IF NOT EXISTS shno_call_group_settings (
 group_id TEXT PRIMARY KEY REFERENCES shno_call_groups(id) ON DELETE CASCADE,
 visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','public')),
 kind TEXT NOT NULL DEFAULT 'group' CHECK(kind IN ('group','channel')),
 description TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_call_group_visibility ON shno_call_group_settings(visibility,group_id);
