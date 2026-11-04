-- Real D1 authentication abuse controls: keys are HMAC-derived, never raw IP addresses.
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  scope TEXT NOT NULL,
  identifier_hash TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(scope,identifier_hash,window_start)
);
CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_window ON auth_rate_limits(window_start);
