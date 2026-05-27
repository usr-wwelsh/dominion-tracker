-- Season 2 prep: single-elimination tournaments
-- A tournament match is backed by a normal games row, so scoring/snapshots/
-- the live scoreboard are reused unchanged. Winners advance via next_match_id.

CREATE TABLE IF NOT EXISTS tournaments (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending | active | complete
    best_of INTEGER NOT NULL DEFAULT 1,
    winner_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tournament_players (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    seed INTEGER NOT NULL,
    UNIQUE(tournament_id, player_id)
);

CREATE TABLE IF NOT EXISTS tournament_matches (
    id SERIAL PRIMARY KEY,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    round INTEGER NOT NULL,             -- 1 = first round, increasing toward the final
    match_index INTEGER NOT NULL,       -- 0-based slot within the round
    player1_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
    player2_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
    winner_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
    game_id INTEGER REFERENCES games(id) ON DELETE SET NULL,
    next_match_id INTEGER REFERENCES tournament_matches(id) ON DELETE SET NULL,
    next_slot INTEGER,                  -- 1 or 2: which player slot of next_match this winner fills
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | ready | in_progress | complete | bye | tie
    UNIQUE(tournament_id, round, match_index)
);

-- Denormalized season champion snapshot, captured at tournament end so it
-- survives future leaderboard recalculations.
CREATE TABLE IF NOT EXISTS season_snapshots (
    id SERIAL PRIMARY KEY,
    label VARCHAR(255) NOT NULL,
    player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
    player_name VARCHAR(255),
    total_league_points NUMERIC(10,2),
    total_wins INTEGER,
    total_games INTEGER,
    tournament_id INTEGER REFERENCES tournaments(id) ON DELETE SET NULL,
    captured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_tid ON tournament_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_game_id ON tournament_matches(game_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_next ON tournament_matches(next_match_id);
CREATE INDEX IF NOT EXISTS idx_tournament_players_tid ON tournament_players(tournament_id);
