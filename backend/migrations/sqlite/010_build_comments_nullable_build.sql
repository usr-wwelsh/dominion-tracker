-- build_comments.build_id becomes optional: comments can now be attached to a
-- game directly (live spectator comments, post-game comments on non-build
-- games) without requiring a build. game_id/player_id stay required.
-- SQLite can't ALTER a column to drop NOT NULL, so rebuild the table.

CREATE TABLE build_comments_new (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  build_id     INTEGER REFERENCES builds(id)   ON DELETE CASCADE,
  game_id      INTEGER NOT NULL REFERENCES games(id)    ON DELETE CASCADE,
  player_id    INTEGER NOT NULL REFERENCES players(id)  ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  created_at   TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO build_comments_new (id, build_id, game_id, player_id, comment_text, created_at)
  SELECT id, build_id, game_id, player_id, comment_text, created_at FROM build_comments;

DROP TABLE build_comments;
ALTER TABLE build_comments_new RENAME TO build_comments;

CREATE INDEX IF NOT EXISTS idx_build_comments_build ON build_comments(build_id);
CREATE INDEX IF NOT EXISTS idx_build_comments_game  ON build_comments(game_id);
