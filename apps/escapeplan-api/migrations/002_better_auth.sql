ALTER TABLE operators ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0;
UPDATE operators SET email = COALESCE(email, username || '@escapeplan.local');
CREATE UNIQUE INDEX IF NOT EXISTS idx_operators_email ON operators(email);
UPDATE operators SET email_verified = 1 WHERE email_verified IS NULL;
