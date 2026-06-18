-- Season 2 baseline: all tables in SQLite dialect.
-- This replaces the Postgres migrations/001-005 for new installs.
-- The pg-to-sqlite.js copy script handles migrating existing prod data.

CREATE TABLE IF NOT EXISTS players (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT UNIQUE NOT NULL,
  color      TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS builds (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  nickname            TEXT NOT NULL,
  cards               TEXT NOT NULL DEFAULT '[]',
  landmarks           TEXT NOT NULL DEFAULT '[]',
  events              TEXT NOT NULL DEFAULT '[]',
  prophecies          TEXT NOT NULL DEFAULT '[]',
  use_platinum_colony INTEGER NOT NULL DEFAULT 0,
  created_at          TEXT DEFAULT CURRENT_TIMESTAMP
);

-- seasons is a first-class concept in Season 2
CREATE TABLE IF NOT EXISTS seasons (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  number            INTEGER UNIQUE NOT NULL,
  name              TEXT NOT NULL,
  started_at        TEXT DEFAULT CURRENT_TIMESTAMP,
  ended_at          TEXT,
  champion_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL
);

-- Seed Season 1 (closed) and Season 2 (active) at baseline time.
-- The pg-to-sqlite copy script sets all existing games to season 1.
INSERT OR IGNORE INTO seasons (id, number, name, started_at, ended_at) VALUES
  (1, 1, 'Season 1', '2024-01-01', '2025-05-01'),
  (2, 2, 'Season 2', CURRENT_TIMESTAMP, NULL);

CREATE TABLE IF NOT EXISTS games (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  build_id   INTEGER REFERENCES builds(id) ON DELETE SET NULL,
  season_id  INTEGER REFERENCES seasons(id) ON DELETE SET NULL DEFAULT 2,
  started_at TEXT,
  ended_at   TEXT,
  duration   INTEGER,
  edit_token TEXT
);

CREATE TABLE IF NOT EXISTS game_players (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id       INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id     INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  final_score   INTEGER DEFAULT 0,
  placement     INTEGER,
  league_points REAL DEFAULT 0,
  UNIQUE(game_id, player_id)
);

CREATE TABLE IF NOT EXISTS score_snapshots (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id   INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  score     INTEGER NOT NULL,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Tournament tables (originally Postgres migration 005)
CREATE TABLE IF NOT EXISTS tournaments (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',
  best_of          INTEGER NOT NULL DEFAULT 1,
  winner_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  created_at       TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at     TEXT
);

CREATE TABLE IF NOT EXISTS tournament_players (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  player_id     INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  seed          INTEGER NOT NULL,
  UNIQUE(tournament_id, player_id)
);

CREATE TABLE IF NOT EXISTS tournament_matches (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id    INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round            INTEGER NOT NULL,
  match_index      INTEGER NOT NULL,
  player1_id       INTEGER REFERENCES players(id) ON DELETE SET NULL,
  player2_id       INTEGER REFERENCES players(id) ON DELETE SET NULL,
  winner_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  game_id          INTEGER REFERENCES games(id) ON DELETE SET NULL,
  next_match_id    INTEGER REFERENCES tournament_matches(id) ON DELETE SET NULL,
  next_slot        INTEGER,
  status           TEXT NOT NULL DEFAULT 'pending',
  UNIQUE(tournament_id, round, match_index)
);

CREATE TABLE IF NOT EXISTS season_snapshots (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  label               TEXT NOT NULL,
  player_id           INTEGER REFERENCES players(id) ON DELETE SET NULL,
  player_name         TEXT,
  total_league_points REAL,
  total_wins          INTEGER,
  total_games         INTEGER,
  tournament_id       INTEGER REFERENCES tournaments(id) ON DELETE SET NULL,
  captured_at         TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Player profiles (Phase 4)
CREATE TABLE IF NOT EXISTS player_profiles (
  player_id      INTEGER PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  bio            TEXT,
  avatar_card    TEXT,
  background_card TEXT,
  accent_color   TEXT,
  theme_json     TEXT,
  updated_at     TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Achievements (Phase 5)
CREATE TABLE IF NOT EXISTS achievements (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  key         TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  description TEXT NOT NULL,
  icon_card   TEXT
);

CREATE TABLE IF NOT EXISTS player_achievements (
  player_id      INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  earned_at      TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(player_id, achievement_id)
);

-- Seed starter achievement catalog
INSERT OR IGNORE INTO achievements (key, name, description) VALUES
  ('first_win',      'First Blood',      'Win your very first game.'),
  ('wins_5',         'Victorious',       'Win 5 games.'),
  ('wins_25',        'Conqueror',        'Win 25 games.'),
  ('games_10',       'Seasoned',         'Play 10 games.'),
  ('games_50',       'Veteran',          'Play 50 games.'),
  ('high_score_60',  'Grand Duchy',      'Score 60 or more points in a single game.'),
  ('high_score_80',  'Province Rush',    'Score 80 or more points in a single game.'),
  ('win_streak_3',   'On a Roll',        'Win 3 games in a row.'),
  ('all_players',    'Everyone''s Rival','Play a game with every registered player.');

-- Admin banner / site settings (Phase 3)
CREATE TABLE IF NOT EXISTS site_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Web push subscriptions (Phase 8)
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  endpoint  TEXT UNIQUE NOT NULL,
  p256dh    TEXT NOT NULL,
  auth      TEXT NOT NULL,
  player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_game_players_player_id     ON game_players(player_id);
CREATE INDEX IF NOT EXISTS idx_game_players_game_id       ON game_players(game_id);
CREATE INDEX IF NOT EXISTS idx_score_snapshots_game_id    ON score_snapshots(game_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_games_build_id             ON games(build_id);
CREATE INDEX IF NOT EXISTS idx_games_season_id            ON games(season_id);
CREATE INDEX IF NOT EXISTS idx_score_snapshots_player_id  ON score_snapshots(player_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tid     ON tournament_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_game_id ON tournament_matches(game_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_next    ON tournament_matches(next_match_id);
CREATE INDEX IF NOT EXISTS idx_tournament_players_tid     ON tournament_players(tournament_id);
CREATE INDEX IF NOT EXISTS idx_player_achievements_pid   ON player_achievements(player_id);
