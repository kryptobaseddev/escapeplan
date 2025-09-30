ALTER TABLE operators ADD COLUMN archived_at TEXT;
ALTER TABLE operators ADD COLUMN archived_by TEXT;
ALTER TABLE operators ADD COLUMN archived_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_operators_archived_at ON operators(archived_at);
