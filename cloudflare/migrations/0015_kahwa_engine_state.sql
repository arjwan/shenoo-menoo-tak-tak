-- Server-authoritative game state, versioned for cross-worker optimistic concurrency.
CREATE TABLE IF NOT EXISTS game_room_state (
 room_id TEXT PRIMARY KEY REFERENCES game_rooms(id) ON DELETE CASCADE,
 state_json TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 0,
 saved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
