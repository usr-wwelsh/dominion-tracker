# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Application

**Backend** (from `backend/`):
```bash
npm start          # production
npm run dev        # watch mode (node --watch, no nodemon needed)
```

**Frontend**: serve `frontend/` with any static file server:
```bash
python3 -m http.server 8000
```

**Kill orphaned servers** (if ports 3000/8000 are stuck after a crash):
```bash
fuser -k 3000/tcp; fuser -k 8000/tcp
```

**Database setup** (one-time):
```bash
createdb -U postgres dominion_tracker
psql -U postgres -d dominion_tracker -f backend/schema.sql
```

**Re-initialize schema** (destructive — drops all tables):
```bash
psql -U postgres -d dominion_tracker -f backend/schema.sql
```

## Architecture

### Backend (`backend/`)
- `server.js` — Express app, middleware, route mounting, error handlers
- `db.js` — pg connection pool; exports `query(text, params)` for simple queries and `getClient()` for transactions
- `routes/` — one file per resource; mutating game routes (`POST /games`, `PUT /games/:id/end`, `POST /games/:id/scores`) use `getClient()` + explicit `BEGIN/COMMIT/ROLLBACK`

### Frontend (`frontend/`)
Vanilla JS with no build step. Each page is self-contained:

| Page | HTML | JS |
|------|------|----|
| Leaderboard | `index.html` | `js/leaderboard.js` |
| Recent Games | `games.html` | `js/games.js` |
| Builds | `builds.html` | `js/builds.js` |
| Live Scoreboard | `scoreboard.html` | `js/scoreboard.js` |

- `js/api.js` — centralized fetch wrapper; exports `playersAPI`, `buildsAPI`, `gamesAPI`, `statsAPI`. All pages load this first via `<script>`.
- `css/main.css` — all CSS variables, stone-tile background, theme. Page-specific CSS files extend it.

### Key Data Flow
1. **Starting a game**: `POST /api/games` creates the game + `game_players` rows (initial `final_score = 3`, initial snapshot inserted) → `PUT /api/games/:id/start` timestamps it.
2. **Score updates**: `POST /api/games/:id/scores` updates `game_players.final_score` AND inserts a `score_snapshots` row. Frontend debounces 500ms before sending.
3. **Ending a game**: `PUT /api/games/:id/end` calculates placements by score DESC, assigns league points (1st=5, 2nd=3, 3rd=1, 4th+=0), averages points for ties.
4. **Leaderboard**: single aggregation query in `routes/stats.js` — no caching layer.

### League Points (ties)
Tied players share the average of the points slots they occupy. Implemented in `calculateAverageLeaguePoints()` in `routes/games.js`.

### Theme
CSS variables live in `main.css`. Key palette:
- `--color-blue` / `--color-blue-hover` — medieval steel blue, used for interactive elements
- `--color-accent` / `--color-accent-hover` — bronze/gold, used for headings and borders
- Stone tile background is an inline SVG data URL on `body` with offset brick rows

### Score Charts
Canvas-based (no chart library). `drawScoreChart()` in `games.js` draws from `score_snapshots`. Chart is rendered after a 50ms delay post-expand to ensure the container has a measured width before setting `canvas.width = canvas.offsetWidth`.

## Environment
Backend reads `backend/.env`:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=dominion_tracker
DB_USER=postgres
DB_PASSWORD=
PORT=3000
```
