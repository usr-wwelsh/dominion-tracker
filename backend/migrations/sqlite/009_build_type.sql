ALTER TABLE builds ADD COLUMN build_type TEXT NOT NULL DEFAULT 'custom'
  CHECK (build_type IN ('suggested', 'custom', 'experimental'));
