-- Accounts, series, collaborations, targets + richer metrics (growth engine).
CREATE TABLE accounts (
  id TEXT PRIMARY KEY, platform TEXT NOT NULL, handle TEXT NOT NULL, display_name TEXT, bio TEXT, url TEXT,
  status TEXT NOT NULL DEFAULT 'active',            -- active | paused | restricted
  daily_quota INTEGER NOT NULL DEFAULT 1, followers INTEGER, notes TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE (platform, handle)
);
CREATE TABLE account_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, account_id TEXT NOT NULL, at TEXT NOT NULL,
  kind TEXT NOT NULL,                                -- followers | warning | restriction | milestone | note
  value REAL, details TEXT, provenance TEXT NOT NULL DEFAULT 'manual'
);
CREATE INDEX idx_account_events ON account_events (account_id, at);
CREATE TABLE series (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, pillar TEXT, format TEXT, platform TEXT, premise TEXT,
  episodes INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE collabs (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL,          -- creator | brand | media | engage
  name TEXT NOT NULL, platform TEXT, handle TEXT, audience_size INTEGER,
  stage TEXT NOT NULL DEFAULT 'prospect',            -- prospect | contacted | discussion | agreed | done | declined
  fit_score INTEGER, notes TEXT, draft_message TEXT, next_action_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE targets (
  id TEXT PRIMARY KEY, account_id TEXT, metric TEXT NOT NULL,   -- followers | views_week | er | posts_week
  target REAL NOT NULL, deadline TEXT NOT NULL, created_at TEXT NOT NULL
);
ALTER TABLE contents ADD COLUMN account_id TEXT;
ALTER TABLE contents ADD COLUMN parent_id TEXT;
ALTER TABLE contents ADD COLUMN series_id TEXT;
ALTER TABLE contents ADD COLUMN episode INTEGER;
ALTER TABLE metrics ADD COLUMN avg_watch_s REAL;
ALTER TABLE metrics ADD COLUMN completion_rate REAL;
CREATE TABLE alerts_seen (key TEXT PRIMARY KEY, at TEXT NOT NULL);
