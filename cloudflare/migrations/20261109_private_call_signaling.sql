-- Private ephemeral signaling for one-to-one WebRTC calls.
-- Each event is visible only to its intended authenticated recipient.
CREATE TABLE IF NOT EXISTS private_call_signals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  call_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('call:invite','call:accept','call:reject','call:end','webrtc:offer','webrtc:answer','webrtc:ice')),
  payload TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  expires_at INTEGER NOT NULL DEFAULT (unixepoch()+120)
);
CREATE INDEX IF NOT EXISTS idx_private_call_signals_recipient ON private_call_signals(recipient_id,id);
CREATE INDEX IF NOT EXISTS idx_private_call_signals_expiry ON private_call_signals(expires_at);
CREATE INDEX IF NOT EXISTS idx_private_call_signals_sender_window ON private_call_signals(sender_id,created_at);
