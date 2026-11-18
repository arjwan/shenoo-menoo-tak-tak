-- Each uploaded private attachment belongs to an existing D1 message. R2 media is never public.
CREATE TABLE IF NOT EXISTS private_message_attachments(
 message_id TEXT PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
 conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
 owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 r2_key TEXT NOT NULL UNIQUE,
 mime_type TEXT NOT NULL,
 file_name TEXT NOT NULL,
 file_size INTEGER NOT NULL CHECK(file_size > 0 AND file_size <= 10485760),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_private_message_media_conversation ON private_message_attachments(conversation_id);
