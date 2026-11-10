-- Private group conversations and ephemeral mesh call signaling on D1.
-- Group membership is mandatory for any message or signaling operation.
CREATE TABLE IF NOT EXISTS shno_call_groups (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS shno_call_group_members (
 group_id TEXT NOT NULL REFERENCES shno_call_groups(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(group_id,user_id)
);
CREATE INDEX IF NOT EXISTS idx_shno_group_user ON shno_call_group_members(user_id,group_id);
CREATE TABLE IF NOT EXISTS shno_call_group_messages (
 id TEXT PRIMARY KEY, group_id TEXT NOT NULL REFERENCES shno_call_groups(id) ON DELETE CASCADE,
 sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 text TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_shno_group_messages ON shno_call_group_messages(group_id,created_at,id);
CREATE TABLE IF NOT EXISTS shno_call_group_signals (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 group_id TEXT NOT NULL REFERENCES shno_call_groups(id) ON DELETE CASCADE,
 call_id TEXT NOT NULL,
 sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 event TEXT NOT NULL CHECK(event IN ('invite','join','leave','end','offer','answer','ice','media')),
 payload TEXT NOT NULL DEFAULT '{}',
 created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 expires_at INTEGER NOT NULL DEFAULT (unixepoch()+180)
);
CREATE INDEX IF NOT EXISTS idx_shno_group_signal_recipient ON shno_call_group_signals(recipient_id,id);
