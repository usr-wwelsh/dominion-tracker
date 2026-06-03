-- build_comments was present in Postgres (migration 003) but dropped from the
-- SQLite baseline consolidation; recreate it here.
CREATE TABLE IF NOT EXISTS build_comments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  build_id     INTEGER NOT NULL REFERENCES builds(id)   ON DELETE CASCADE,
  game_id      INTEGER NOT NULL REFERENCES games(id)    ON DELETE CASCADE,
  player_id    INTEGER NOT NULL REFERENCES players(id)  ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  created_at   TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_build_comments_build ON build_comments(build_id);
CREATE INDEX IF NOT EXISTS idx_build_comments_game  ON build_comments(game_id);
