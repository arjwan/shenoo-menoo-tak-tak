-- Kahwa Azawi room metadata, stored under the existing D1 identity.
-- Move legality remains server-authoritative and must be ported separately.
CREATE TABLE IF NOT EXISTS game_rooms (
 id TEXT PRIMARY KEY,
 room_code TEXT NOT NULL UNIQUE,
 owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
 game_type TEXT NOT NULL CHECK(game_type IN ('domino','tawla','cards','chess')),
 visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN ('public','friends','private')),
 max_players INTEGER NOT NULL CHECK(max_players BETWEEN 2 AND 6),
 team_mode TEXT NOT NULL DEFAULT 'solo' CHECK(team_mode IN ('solo','2v2')),
 status TEXT NOT NULL DEFAULT 'waiting' CHECK(status IN ('waiting','active','finished')),
 is_active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_game_rooms_active_type ON game_rooms(is_active,game_type,updated_at DESC);
CREATE TABLE IF NOT EXISTS game_room_players (
 room_id TEXT NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 seat_index INTEGER NOT NULL,
 joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(room_id,user_id),
 UNIQUE(room_id,seat_index)
);
CREATE INDEX IF NOT EXISTS idx_game_room_players_user ON game_room_players(user_id);
