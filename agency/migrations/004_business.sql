-- Monetisation (mainstream brand deals only) + unit economics links.
ALTER TABLE collabs ADD COLUMN deal_value REAL;
ALTER TABLE collabs ADD COLUMN deliverables INTEGER;
ALTER TABLE collabs ADD COLUMN due_date TEXT;
ALTER TABLE collabs ADD COLUMN paid INTEGER NOT NULL DEFAULT 0;
ALTER TABLE contents ADD COLUMN deal_id TEXT;
ALTER TABLE finance_entries ADD COLUMN deal_id TEXT;
ALTER TABLE finance_entries ADD COLUMN content_id TEXT;
