-- Claude Code session usage imported from local transcripts (~/.claude/projects/**/*.jsonl), deduplicated by message id.
CREATE TABLE cc_usage (
  message_id TEXT PRIMARY KEY, session_id TEXT, project TEXT, model TEXT, at TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0, output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0, cache_write_tokens INTEGER NOT NULL DEFAULT 0, imported_at TEXT NOT NULL
);
CREATE INDEX idx_cc_usage_session ON cc_usage (session_id);
