<p align="center"><img src="banner.svg" alt="Dominion Tracker" width="100%"></p>

Self-hosted league tracker for Dominion game nights. Vanilla JS frontend, Express backend, single-file SQLite database — no build step, no cloud.

## Features

- Live scoreboard with score-progression charts, plus spectator mode over SSE
- Leaderboard, seasons with archived history, and single-elimination or Swiss-pod tournaments
- Kingdom builds with per-build stats and comments
- Player profiles with card-art avatars, achievements, levels, and head-to-head stats
- Installable PWA with web-push notifications

## Run it

**Docker:**

```bash
cp .env.example .env   # set AUTH_USER / AUTH_PASS
docker compose up -d   # http://localhost:3002
```

**Local:**

```bash
cd backend && npm install && npm start   # http://localhost:3000
```

The database is created and migrated automatically on first start. Back it up by copying one file. Coming from the Season 1 Postgres setup? `backend/scripts/pg-to-sqlite.js` does the one-time migration.

## League points

`LP = 100 × (n − p) / (n − 1)` — first place gets 100, last gets 0, everyone else evenly spaced. Ties split the average of their slots. Season standings rank by average LP per game.

## License

[MIT](LICENSE) © usr-wwelsh
