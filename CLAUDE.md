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
python3 -m http.server 8000 --directory frontend
```

**Kill orphaned servers** (if ports 3000/8000 are stuck after a crash):
```bash
fuser -k 3000/tcp; fuser -k 8000/tcp
```

**Database setup** (one-time):
The database now uses SQLite. The `dominion.db` file is automatically created and migrated on the first backend start in `backend/data/`.
If you had a previous PostgreSQL setup from Season 1, run the migration script:
```bash
# Ensure pg package is installed (npm install pg --prefix backend) if you haven't run backend/npm install
PG_URL="postgres://user:pass@host:5432/dominion_tracker" \
SQLITE_PATH="backend/data/dominion.db" \
node backend/scripts/pg-to-sqlite.js
# Then remove backend/node_modules/pg if you don't need it.
```

**Re-initialize schema** (destructive — drops all data):
```bash
rm backend/data/dominion.db
# Then restart the backend to recreate the schema automatically.
```

## Architecture

### Backend (`backend/`)
- `server.js` — Express app, middleware, route mounting, error handlers. Also handles initial SQLite migration and achievement backfills.
- `db.js` — `better-sqlite3` connection for SQLite; exports `query(text, params)` for queries and `getClient()` for transactions.
- `routes/` — one file per resource; mutating game routes (`POST /games`, `PUT /games/:id/end`, `POST /games/:id/scores`) use `getClient()` + explicit `BEGIN/COMMIT/ROLLBACK`.
- `scripts/pg-to-sqlite.js` - One-time script for migrating data from a PostgreSQL Season 1 database to SQLite.

### Frontend (`frontend/`)
Vanilla JS with no build step. Each page is self-contained:

| Page | HTML | JS |
|------|------|----|
| About | `index.html` | (no specific JS, uses shared `api.js`, `header.js`, `falling-cards.js`) |
| Leaderboard | `leaderboard.html` | `js/leaderboard.js` |
| Recent Games | `games.html` | `js/games.js` |
| Builds | `builds.html` | `js/builds.js` |
| Players | `players.html` | `js/players.js` |
| Live Scoreboard | `scoreboard.html` | `js/scoreboard.js` |
| Tournaments | `tournament.html` | `js/tournament.js` |
| Live Games | `live.html` | (no specific JS, uses `api.js`, `header.js`, `falling-cards.js` + inline script for SSE) |
| Player Profile | `profile.html` | (no specific JS, uses `api.js`, `cards.js`, `header.js`, `falling-cards.js` + inline script for profile logic) |
| Season History | `history.html` | (no specific JS, uses `api.js`, `header.js`, `falling-cards.js` + inline script for history logic) |

- `js/api.js` — centralized fetch wrapper; exports `playersAPI`, `buildsAPI`, `gamesAPI`, `statsAPI`, `authAPI`, `seasonsAPI`, `profilesAPI`, `achievementsAPI`, `cardsAPI`, `bannerAPI`, `pushAPI`. All pages load this first via `<script>`.
- `css/main.css` — all CSS variables, stone-tile background, theme. Page-specific CSS files extend it.
- `sw.js` - Service worker for PWA functionality, including web push notifications.

### Key Data Flow
1. **Starting a game**: `POST /api/games` creates the game + `game_players` rows (initial `final_score = 3`, initial snapshot inserted). A unique `edit_token` is generated for live editing. `PUT /api/games/:id/start` timestamps it.
2. **Score updates**: `POST /api/games/:id/scores` accepts an `edit_token` if one exists for the game. Live score updates are broadcast via Server-Sent Events (SSE). Frontend debounces 500ms before sending.
3. **Ending a game**: `PUT /api/games/:id/end` calculates placements by score DESC, assigns league points. It also triggers achievement evaluation (`evaluateAchievements`), tournament advancement (`maybeAdvanceTournament` if the game is part of a tournament), and web push notifications for leaderboard changes (`notifyRankChanges`).
4. **Leaderboard**: Now primarily ranks players by `avg_league_points` (average LP per game) for the active season.

### League Points (ties)
Tied players share the average of the points slots they occupy. Implemented in `calculateAverageLeaguePoints()` in `routes/games.js`.

### Theme
CSS variables live in `main.css`. Key palette has been refreshed for Season 2:
- `--color-blue` / `--color-blue-hover` — richer, jewel-toned blue.
- `--color-accent` / `--color-accent-hover` — warmer bronze/gold, used for headings and borders.
- `--color-crimson` - New accent for highlights and notifications.
- The `body` background is a slightly darker stone tile pattern with a noise grain overlay. Custom fonts (`Cinzel`) are used for display text.

### Score Charts
Canvas-based (no chart library). `drawScoreChart()` in `games.js` still draws from `score_snapshots`. Live score charts are also rendered in `live.html` using SSE.

## Environment
Backend reads `.env` (or `backend/.env` for local dev):
```
SQLITE_PATH=/data/dominion.db           # Path to the SQLite DB file
PORT=3000                               # Port for the Express API
AUTH_USER=admin                         # Global login for protected actions
AUTH_PASS=changeme                      # Password for AUTH_USER
VAPID_PUBLIC=                           # Public VAPID key for web push notifications (generate with npx web-push generate-vapid-keys)
VAPID_PRIVATE=                          # Private VAPID key
VAPID_SUBJECT=mailto:admin@example.com  # Contact email for VAPID keys
```
`pg` is now an optional dependency, only required if migrating from a Postgres Season 1 database.
