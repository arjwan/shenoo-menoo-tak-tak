-- Existing production smart_friend_personas predates migration 0009.
-- Its CREATE TABLE IF NOT EXISTS did not add avatar_key. Add it in place
-- so R2 avatar uploads can update the existing five+ persona records safely.
ALTER TABLE smart_friend_personas ADD COLUMN avatar_key TEXT;
