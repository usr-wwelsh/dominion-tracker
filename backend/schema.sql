-- Dominion Game Tracker Database Schema

-- Drop existing tables if they exist (for development)
DROP TABLE IF EXISTS score_snapshots CASCADE;
DROP TABLE IF EXISTS game_players CASCADE;
DROP TABLE IF EXISTS games CASCADE;
DROP TABLE IF EXISTS builds CASCADE;
DROP TABLE IF EXISTS players CASCADE;

-- Players table
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    color VARCHAR(7) DEFAULT '#4db8ff',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Builds table (card combinations used in games)
CREATE TABLE builds (
    id SERIAL PRIMARY KEY,
    nickname VARCHAR(255) NOT NULL,
    cards TEXT[] NOT NULL,
    landmarks TEXT[],
    events TEXT[],
    prophecies TEXT[],
    use_platinum_colony BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Games table
CREATE TABLE games (
    id SERIAL PRIMARY KEY,
    build_id INTEGER REFERENCES builds(id) ON DELETE SET NULL,
    started_at TIMESTAMP,
    ended_at TIMESTAMP,
    duration INTEGER -- duration in seconds
);

-- Game players table (tracks player participation and results)
CREATE TABLE game_players (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    final_score INTEGER DEFAULT 0,
    placement INTEGER, -- 1st, 2nd, 3rd, etc.
    league_points INTEGER DEFAULT 0, -- 5 for 1st, 3 for 2nd, 1 for 3rd, 0 for others
    UNIQUE(game_id, player_id)
);

-- Score snapshots table (tracks score changes over time during a game)
CREATE TABLE score_snapshots (
    id SERIAL PRIMARY KEY,
    game_id INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    score INTEGER NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for query optimization
CREATE INDEX idx_game_players_player_id ON game_players(player_id);
CREATE INDEX idx_game_players_game_id ON game_players(game_id);
CREATE INDEX idx_score_snapshots_game_id_timestamp ON score_snapshots(game_id, timestamp);
CREATE INDEX idx_games_build_id ON games(build_id);
CREATE INDEX idx_score_snapshots_player_id ON score_snapshots(player_id);

-- Comments for documentation
COMMENT ON TABLE players IS 'Stores player information';
COMMENT ON TABLE builds IS 'Stores card build configurations for games';
COMMENT ON TABLE games IS 'Stores game session information';
COMMENT ON TABLE game_players IS 'Junction table linking players to games with their results';
COMMENT ON TABLE score_snapshots IS 'Stores historical score updates during games for visualization';

COMMENT ON COLUMN game_players.league_points IS 'Points awarded based on placement: 1st=5, 2nd=3, 3rd=1, 4th+=0';
COMMENT ON COLUMN games.duration IS 'Game duration in seconds, calculated from started_at to ended_at';
