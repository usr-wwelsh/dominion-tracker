-- Swiss-pods tournament format (Season 2). Players are grouped into pods of
-- ~3 each round; a pod is just a normal games row, so scoring/snapshots/the
-- live scoreboard are reused unchanged. Standings = SUM(league_points) over
-- the tournament's games. No elimination: most points after N rounds wins.

ALTER TABLE tournaments ADD COLUMN format TEXT NOT NULL DEFAULT 'single_elim';
ALTER TABLE tournaments ADD COLUMN total_rounds INTEGER;
ALTER TABLE tournaments ADD COLUMN current_round INTEGER NOT NULL DEFAULT 0;

-- Links a pod (a games row) to a tournament round. Single-elim tournaments do
-- not use this table; they keep using tournament_matches.
CREATE TABLE IF NOT EXISTS tournament_games (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round         INTEGER NOT NULL,
  pod_index     INTEGER NOT NULL,
  game_id       INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  UNIQUE(tournament_id, round, pod_index)
);

CREATE INDEX IF NOT EXISTS idx_tournament_games_tid ON tournament_games(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_games_game_id ON tournament_games(game_id);
