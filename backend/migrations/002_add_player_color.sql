-- Add color column to players for persistent per-player chart colors

ALTER TABLE players ADD COLUMN IF NOT EXISTS color VARCHAR(7) DEFAULT '#4db8ff';
