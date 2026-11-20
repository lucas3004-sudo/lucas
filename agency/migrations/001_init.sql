-- AI Agency OS - initial schema. Timestamps: ISO-8601 UTC text. JSON stored as TEXT.
-- provenance values: measured | estimated | forecast | manual | template | n/a

CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);

CREATE TABLE agency_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  status TEXT NOT NULL DEFAULT 'stopped',           -- running | paused | stopped
  current_run_id TEXT,
  updated_at TEXT NOT NULL
);
INSERT INTO agency_state (id, status, updated_at) VALUES (1, 'stopped', '1970-01-01T00:00:00+00:00');

CREATE TABLE agents (id TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'active', updated_at TEXT NOT NULL);

CREATE TABLE runs (
  id TEXT PRIMARY KEY, status TEXT NOT NULL, trigger TEXT NOT NULL, params TEXT,
  started_at TEXT NOT NULL, finished_at TEXT, summary TEXT
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY, type TEXT NOT NULL, agent TEXT NOT NULL, run_id TEXT, content_id TEXT,
  payload TEXT NOT NULL DEFAULT '{}', result TEXT,
  status TEXT NOT NULL DEFAULT 'queued',             -- queued | running | waiting | done | failed | dead | cancelled
  priority INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 3,
  run_after TEXT NOT NULL, lease_until TEXT, worker_id TEXT, last_error TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, finished_at TEXT
);
CREATE INDEX idx_jobs_ready ON jobs (status, run_after, priority);
CREATE INDEX idx_jobs_run ON jobs (run_id);

CREATE TABLE schedules (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, job_type TEXT NOT NULL, agent TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}', spec TEXT NOT NULL,           -- every:<seconds> | daily:HH:MM (local tz)
  next_run_at TEXT NOT NULL, last_run_at TEXT, enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE contents (
  id TEXT PRIMARY KEY, run_id TEXT, title TEXT NOT NULL,
  stage TEXT NOT NULL,          -- research|strategy|concept|script|prompt|generation|editing|qc|approval|publication|analysis
  status TEXT NOT NULL,         -- in_progress|waiting_assets|needs_revision|awaiting_approval|approved|scheduled|ready_to_publish|published|rejected|failed
  platform TEXT NOT NULL, format TEXT NOT NULL, pillar TEXT,
  concept TEXT, hook TEXT, script TEXT, prompts TEXT, caption TEXT, hashtags TEXT, qc TEXT, meta TEXT,
  scheduled_at TEXT, published_at TEXT, published_url TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX idx_contents_status ON contents (status);

CREATE TABLE content_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, content_id TEXT NOT NULL, at TEXT NOT NULL,
  actor TEXT NOT NULL, action TEXT NOT NULL, details TEXT
);
CREATE INDEX idx_history_content ON content_history (content_id);

CREATE TABLE assets (
  id TEXT PRIMARY KEY, content_id TEXT, character_id TEXT,
  kind TEXT NOT NULL,           -- image | video | audio | reference | drop | final | export
  path TEXT NOT NULL, mime TEXT, size INTEGER,
  source TEXT NOT NULL,         -- upload | elevenlabs | alexya | ffmpeg | placeholder
  approved INTEGER NOT NULL DEFAULT 0, meta TEXT, created_at TEXT NOT NULL
);
CREATE INDEX idx_assets_content ON assets (content_id);

CREATE TABLE characters (id TEXT PRIMARY KEY, data TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL);

CREATE TABLE research_items (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL,           -- plan|trend|competitor_note|hook|format|opportunity|strategy|insight
  platform TEXT, title TEXT NOT NULL, body TEXT, url TEXT,
  source TEXT NOT NULL, provenance TEXT NOT NULL, run_id TEXT, created_at TEXT NOT NULL
);

CREATE TABLE competitors (
  id TEXT PRIMARY KEY, platform TEXT NOT NULL, handle TEXT NOT NULL, niche TEXT, notes TEXT,
  followers INTEGER, avg_views INTEGER, provenance TEXT NOT NULL DEFAULT 'manual', updated_at TEXT NOT NULL
);

CREATE TABLE experiments (
  id TEXT PRIMARY KEY, hypothesis TEXT NOT NULL, variable TEXT NOT NULL, variant_a TEXT, variant_b TEXT,
  metric TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'proposed', result TEXT, run_id TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT, content_id TEXT, platform TEXT NOT NULL, date TEXT NOT NULL,
  views INTEGER, likes INTEGER, comments INTEGER, shares INTEGER, saves INTEGER, followers_delta INTEGER,
  provenance TEXT NOT NULL DEFAULT 'manual', created_at TEXT NOT NULL
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY, platform TEXT NOT NULL, author TEXT, text TEXT NOT NULL, content_id TEXT,
  received_at TEXT NOT NULL, category TEXT, sentiment TEXT, sentiment_score REAL, priority TEXT,
  status TEXT NOT NULL DEFAULT 'new',                -- new | drafted | needs_human | replied | ignored
  suggested_reply TEXT, escalation_reason TEXT, final_reply TEXT,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE finance_entries (
  id TEXT PRIMARY KEY, date TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('revenue', 'expense')),
  category TEXT NOT NULL, amount REAL NOT NULL, currency TEXT NOT NULL DEFAULT 'EUR', source TEXT,
  provenance TEXT NOT NULL DEFAULT 'manual', note TEXT, created_at TEXT NOT NULL
);

CREATE TABLE llm_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, agent TEXT NOT NULL, job_id TEXT, task TEXT,
  provider TEXT NOT NULL, model TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0, cache_write_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL NOT NULL DEFAULT 0,
  token_provenance TEXT NOT NULL, cost_provenance TEXT NOT NULL,
  latency_ms INTEGER, status TEXT NOT NULL, error TEXT
);
CREATE INDEX idx_llm_at ON llm_calls (at);

CREATE TABLE api_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, service TEXT NOT NULL, operation TEXT NOT NULL,
  units REAL, unit TEXT, cost_usd REAL, provenance TEXT NOT NULL, job_id TEXT, details TEXT
);

CREATE TABLE activity_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, level TEXT NOT NULL, actor TEXT NOT NULL,
  action TEXT NOT NULL, entity TEXT, details TEXT
);
CREATE INDEX idx_log_at ON activity_log (at);

CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, level TEXT NOT NULL, title TEXT NOT NULL,
  body TEXT, link TEXT, read INTEGER NOT NULL DEFAULT 0, delivered TEXT
);

CREATE TABLE integration_checks (name TEXT PRIMARY KEY, status TEXT NOT NULL, checked_at TEXT NOT NULL, details TEXT);
