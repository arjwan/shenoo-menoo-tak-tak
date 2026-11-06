-- Private reminders for the authenticated Smart Friend dock.
CREATE TABLE IF NOT EXISTS smart_friend_reminders (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 title TEXT NOT NULL,
 due_at TEXT NOT NULL,
 repeat TEXT NOT NULL CHECK(repeat IN ('none','daily','weekly')),
 voice INTEGER NOT NULL DEFAULT 0 CHECK(voice IN (0,1)),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_smart_friend_reminders_due
 ON smart_friend_reminders(user_id, active, due_at);
