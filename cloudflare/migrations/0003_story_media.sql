-- Native Cloudflare stories: 24-hour content with R2 media and per-story display settings.
CREATE TABLE IF NOT EXISTS story_extras (
  story_id TEXT PRIMARY KEY REFERENCES stories(id) ON DELETE CASCADE,
  visibility TEXT NOT NULL DEFAULT 'everyone',
  overlays TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS story_media (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'main',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_story_media_story ON story_media(story_id);
