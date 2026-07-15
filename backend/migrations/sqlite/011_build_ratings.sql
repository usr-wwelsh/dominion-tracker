-- Star ratings (1-5) for builds. One rating per player per build; re-rating
-- updates the existing row via upsert rather than creating duplicates.
CREATE TABLE IF NOT EXISTS build_ratings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  build_id   INTEGER NOT NULL REFERENCES builds(id)  ON DELETE CASCADE,
  player_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (build_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_build_ratings_build ON build_ratings(build_id);
