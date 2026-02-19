-- Initial schema

CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS builds (
    id SERIAL PRIMARY KEY,
    nickname VARCHAR(255) NOT NULL,
    cards TEXT[] NOT NULL,
    landmarks TEXT[],
    events TEXT[],
    prophecies TEXT[],
    use_platinum_colony BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS games (
    id SERIAL PRIMARY KEY,
    build_id INTEGER REFERENCES builds(id) ON DELETE SET NULL,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    duration INTEGER
);

CREATE TABLE IF NOT EXISTS game_players (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    final_score INTEGER DEFAULT 0,
    placement INTEGER,
    league_points INTEGER DEFAULT 0,
    UNIQUE(game_id, player_id)
);

CREATE TABLE IF NOT EXISTS score_snapshots (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_game_players_player_id ON game_players(player_id);
CREATE INDEX IF NOT EXISTS idx_game_players_game_id ON game_players(game_id);
CREATE INDEX IF NOT EXISTS idx_score_snapshots_game_id_timestamp ON score_snapshots(game_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_games_build_id ON games(build_id);
CREATE INDEX IF NOT EXISTS idx_score_snapshots_player_id ON score_snapshots(player_id);
