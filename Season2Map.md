# Dominion Tracker — Season 2 Roadmap

## Status (2026-05-27)

**Phase 0 (Tournament) is DONE and merged to `main`** (commit `fea6e55`, merge `f367779`) — single-elim brackets, byes, match scoring via the existing scoreboard, auto-advancement, tie resolution, Season 1 champion snapshot, and confetti. `git pull main` to get it. Start new work at **Phase 1**.

Two tweaks made after the plan below was written:
- Tournament **creation, match-play, and tie-resolution are open (no auth)** — only DELETE is auth-gated, consistent with the rest of the app.
- **Handicap seeding**: lowest-ranked / newest players get the round-one byes (the create form seeds newest-first; the backend byes the first seeds). Top players play from round one.

Everything from Phase 1 onward is unbuilt. Cut a `season-2` branch off `main` and begin with the Postgres→SQLite migration.

## Context

Dominion Tracker currently runs Season 1 on `main`, which deploys to the Hostinger VPS (Node/Express + Postgres, single Docker container serving API + static vanilla-JS frontend). We want to (1) run a single-elimination **tournament this weekend** on the live system, then (2) launch a **Season 2** that feels visually fresh and adds profiles, achievements, leveling, live spectating, push notifications, and a season-history archive — and as part of that cutover, migrate the database from **Postgres → SQLite** (aligns with the offline-first / minimal-dependency / single-file-backup philosophy).

Two clean, sequential efforts emerged from planning:

- **Phase 0 — Tournament** ships to *current* Postgres prod before the weekend, on a short branch merged to `main`. It crowns a Tournament 1 winner (confetti) and snapshots the Season 1 leaderboard champion.
- **Phases 1–8 — Season 2** live on a long-lived `season-2` branch off `main`. The Postgres→SQLite migration runs once at deploy time during the Season 2 cutover (operator-run script, not an in-app button). Season 2 merges to `main` when launched.

Decisions already made: tournament ships to current prod now; SQLite migration happens at the Season 2 deploy; live games use **SSE + auto-generated edit token**; notifications use **full web push (VAPID)**; confetti is for the tournament winner.

---

## Branching

```
main  ──┬─ branch: tournament   → merge to main (deploys to Postgres prod) ── weekend
        └─ branch: season-2      → long-lived; merge to main at Season 2 launch
```
Cut `season-2` from `main` *after* the tournament branch merges, so it inherits the tournament feature + the recorded Season 1 / Tournament 1 results.

---

# PHASE 0 — Tournament (current Postgres prod, this weekend)

Single-elimination bracket. A match = a normal `games` row, so scoring/snapshots/the existing scoreboard UI are reused unchanged. Winners advance server-side when a game ends.

### Migration `backend/migrations/005_tournaments.sql` (Postgres dialect)
- `tournaments(id, name, status[pending|active|complete], best_of DEFAULT 1, winner_player_id, created_at, completed_at)`
- `tournament_players(id, tournament_id, player_id, seed, UNIQUE(tournament_id,player_id))`
- `tournament_matches(id, tournament_id, round, match_index, player1_id, player2_id, winner_player_id, game_id, next_match_id, next_slot, status[pending|ready|in_progress|complete|bye], UNIQUE(tournament_id,round,match_index))`
- `season_snapshots(id, label, player_id, player_name, total_league_points, total_wins, total_games, tournament_id, captured_at)` — denormalized so it survives leaderboard recalcs.

`next_match_id` + `next_slot` is the advancement spine. Auto-applies on backend restart via existing `migrate.js`.

### Backend
- **Refactor `routes/games.js`**: extract the create-game body (game + two `game_players` at 3 VP + initial snapshots) into exported `createGameTx(client, {build_id, player_ids})`; call it from both `POST /games` and the tournament play endpoint.
- **Advancement hook in `PUT /games/:id/end`**: after the existing placement/LP commit, call new `maybeAdvanceTournament(gameId)`:
  1. `SELECT * FROM tournament_matches WHERE game_id=$1` — none → return (zero behavior change for normal games).
  2. No-op if match already `complete` (idempotency guard against re-end).
  3. Winner = placement-1 player. **On an exact VP tie**, do not auto-pick — return a flag so the bracket UI prompts the operator to choose (Dominion breaks ties by fewer turns, which we don't track).
  4. Set winner + `status=complete`; write winner into `next_match`'s `player{next_slot}_id`; flip that match to `ready` if both slots filled.
  5. If no `next_match_id` (the final): set tournament `complete` + `winner_player_id` + `completed_at`, and insert the Season 1 `season_snapshots` row (reuse the leaderboard CTE `LIMIT 1`).
- **New `routes/tournaments.js`** (register in `server.js` next to existing mounts):
  - `GET /tournaments` — list.
  - `POST /tournaments` (`requireAuth`) — `{name, player_ids (seed order), best_of?}`; builds bracket in one `getClient()` transaction. Bracket gen: pad to next power of 2, standard seed order, byes auto-resolve and propagate; set `next_match_id` in a second UPDATE pass.
  - `GET /tournaments/:id` — nested rounds→matches enriched with player names/colors + backing-game status.
  - `POST /tournaments/:id/matches/:matchId/play` — validates `ready` + `game_id IS NULL`, calls `createGameTx`, sets `game_id` + `status=in_progress`, returns `{game_id}`.
  - `POST /tournaments/:id/snapshot-season` (`requireAuth`) — manual Season 1 snapshot (also fired automatically on final).
  - `DELETE /tournaments/:id` (`requireAuth`).

### Frontend
- **`tournamentsAPI`** in `js/api.js` (mirror `gamesAPI` shape).
- **`tournament.html` + `js/tournament.js`** — three views via `?id=`: create (reuse `scoreboard.js`'s roster-button pattern to pick attendees; pre-sort by `statsAPI.getLeaderboard()` rank for seeding), bracket (DOM columns + CSS connectors, "Play Match" buttons on `ready` matches, poll every ~3s for cross-device progression), completion (champion banner + confetti).
- **`js/scoreboard.js` resume mode** (~30 lines, guarded by `?game=`): `resumeExistingGame(id, tournamentId, matchId)` loads via `gamesAPI.getById`, populates `currentGame`/`selectedPlayers` from `final_score`, hides setup, shows game section, starts timer/chart, binds the existing debounced +/- handler. Normal path unchanged. On End, if `?tournament=` present, swap end buttons to "Back to Bracket".
- **`js/confetti.js`** — vanilla full-screen canvas, ~150 gravity particles, self-cleaning; same inject/animate/cleanup shape as `falling-cards.js`. Zero deps.
- Add a **Tournament** nav link to all page headers (nav HTML is hand-duplicated per page — mechanical edit).

### Phase 0 files
`backend/migrations/005_tournaments.sql` (new), `backend/routes/games.js` (refactor + hook), `backend/routes/tournaments.js` (new), `backend/server.js` (mount), `frontend/js/api.js`, `frontend/js/scoreboard.js`, `frontend/tournament.html` + `frontend/js/tournament.js` + `frontend/css/tournament.css` + `frontend/js/confetti.js` (new), nav links in all `*.html`.

---

# PHASE 1 — Season 2 foundation: Postgres → SQLite

Driver: **`better-sqlite3`** (synchronous, single mature native dep, bundles SQLite 3.45 → `RETURNING` + window functions guaranteed). Drop `pg` from runtime deps (keep temporarily for the copy script).

### Rewrite `backend/db.js` to preserve route call signatures
Keep `query(text, params)` → `{rows, rowCount}` and `getClient()` → `{query, release}`, so routes barely change.
- Translate `$1,$2` → `?` (params already positional).
- Route `SELECT`/`WITH`/`RETURNING` through `stmt.all()`; others through `stmt.run()` (expose `changes` as `rowCount`, plus `lastInsertRowid`).
- `getClient().query` maps literal `BEGIN`/`COMMIT`/`ROLLBACK` strings to SQLite statements, everything else to the same exec path — so games/builds/players transaction routes work verbatim. `release()` is a no-op.
- Pragmas at open: `journal_mode = WAL`, **`foreign_keys = ON`** (mandatory — without it all `ON DELETE CASCADE/SET NULL` silently no-op). DB path from `SQLITE_PATH` env.

### Fix `backend/migrate.js`
- `prepare()` runs one statement only — multi-statement `.sql` files must use **`db.exec(sql)`** (the single most important compatibility fix). Wrap each file in a transaction via `db.exec`.
- `schema_migrations` → `INTEGER PRIMARY KEY AUTOINCREMENT`; point `migrationsDir` at `migrations/sqlite/`.

### Season 2 baseline schema `backend/migrations/sqlite/001_baseline.sql`
Single consolidated file with the final shape of *all* tables (incl. Phase-0 tournament tables + Season 2 additions below). Dialect: `SERIAL`→`INTEGER PRIMARY KEY AUTOINCREMENT`, `VARCHAR(n)`→`TEXT`, `NOW()`→`CURRENT_TIMESTAMP`, `BOOLEAN ... DEFAULT FALSE`→`DEFAULT 0`, `NUMERIC`→`REAL`, **`TEXT[]`→`TEXT` (JSON)**. Postgres `migrations/*.sql` stay in repo for history but are no longer executed. Future Season 2 migrations are `002_...` etc.

### Query ports
- **`routes/builds.js`** (only route touching arrays): `JSON.stringify` cards/landmarks/events/prophecies on write; add `hydrateBuild(row)` that `JSON.parse`s them on every read (incl. `RETURNING *` rows). Keeps API response shape identical → frontend unchanged. Note `use_platinum_colony` now reads `0/1`.
- **`routes/stats.js`**: `json_agg`→`json_group_array` (order via the existing ordered CTE; no inline ORDER BY in the agg), drop `::numeric`/`::json` casts, `ROUND(...)` for precision, `CAST(... AS REAL)` on integer-division ratios, keep `NULLS LAST` (supported on 3.45). `JSON.parse(row.recent_form)` in route.
- **`routes/games.js`** JSON-agg queries (game list/detail `players` arrays): minimal port — `json_object`/`json_group_array` + `JSON.parse` in the route (less churn, identical response shape). Window functions + `RETURNING` need no changes.

### One-time copy script `backend/scripts/pg-to-sqlite.js`
Standalone, operator-run once at cutover (both `pg` + `better-sqlite3` present). Connect to live Postgres read-only → open fresh SQLite, run baseline schema → `PRAGMA foreign_keys=OFF`, copy in FK order (`players → builds → games → game_players → score_snapshots → build_comments → tournaments → tournament_players → tournament_matches → season_snapshots`) preserving original ids, JSON-stringify build arrays, coerce booleans to 0/1 → fix `sqlite_sequence` high-water marks → `PRAGMA foreign_keys=ON` + `PRAGMA foreign_key_check` + assert per-table row counts match. Whole load in one transaction. Writes a fresh file each run.

### Docker / compose
- Drop the `db` (postgres) service + `depends_on`/healthcheck; remove `DB_*` env, add `SQLITE_PATH=/data/dominion.db`.
- Add named volume `sqlite_data:/data`. **Keep `postgres_data` declared** until migration is verified — *do not `docker volume rm` it until `foreign_key_check` passes and counts match.*
- `backend/Dockerfile`: switch base to `node:20-bookworm-slim` (glibc → `better-sqlite3` prebuilt binary, no toolchain). Ensure `/data` exists/owned.
- Update `.env.example`.

### Phase 1 files
`backend/db.js`, `backend/migrate.js` (rewrite); `backend/migrations/sqlite/001_baseline.sql`, `backend/scripts/pg-to-sqlite.js` (new); `backend/routes/{builds,stats,games}.js` (query ports); `backend/package.json`; `docker-compose.yml`, `backend/Dockerfile`, `.env.example`.

---

# PHASE 2 — Seasons & history archive

Make "season" a first-class concept so Season 1 is preserved and Season 2 starts clean.
- Baseline adds `seasons(id, number, name, started_at, ended_at, champion_player_id)` and `games.season_id` (default → Season 1). Copy script sets all existing games to Season 1; insert Season 1 (closed, champion from `season_snapshots`) + Season 2 (active).
- `routes/stats.js` leaderboard filters to the **active** season (`WHERE g.season_id = <active>`).
- **`seasons` route**: `GET /seasons`, `GET /seasons/:id/standings` (final archived standings), `GET /seasons/:id/champion`.
- **`history.html` + `js/history.js`**: past seasons' champions, final standings, and the Tournament 1 bracket (from `tournament_matches`). Surface Season 1 + Tournament 1 winners prominently.

---

# PHASE 3 — Homepage as About page + admin banner

- Move the leaderboard off `index.html` to `leaderboard.html` (+ nav). `index.html` becomes an About page: what the league is, current season, champion highlights, links, and the admin banner at top.
- **Banner**: `site_settings(key TEXT PRIMARY KEY, value TEXT, updated_at)` (or a `banners` row). `GET /api/banner` (public), `PUT /api/banner` (`requireAuth`). Frontend renders if set; admins edit via a small form gated by the existing Basic-auth credential-prompt pattern (reuse `showDeleteModal` style).

---

# PHASE 4 — Player profile pages (open edit, itch.io-style)

No auth — anyone can customize, with guardrails (preset palettes; avatar/background restricted to the 167 card images in `frontend/dominion-cards-used-small/`).
- Baseline adds `player_profiles(player_id PK FK, bio TEXT, avatar_card TEXT, background_card TEXT, accent_color TEXT, theme_json TEXT, updated_at)`.
- `GET /api/players/:id/profile`, `PUT /api/players/:id/profile` (validate avatar/background against the known card-filename list; validate color against presets).
- **`profile.html` + `js/profile.js`**: header with avatar (card closeup) + customizable background/accent; reuses existing `/players/:id/stats` and `/players/:id/h2h`; shows level/XP (Phase 6) and achievements (Phase 5). Link player names across leaderboard/games/bracket to `profile.html?id=`.

---

# PHASE 5 — Achievements & milestones

Build the framework; seed a starter catalog (specific milestones/art TBD by owner). Icons = card art.
- Baseline adds `achievements(id, key, name, description, icon_card)` and `player_achievements(player_id, achievement_id, earned_at, UNIQUE(player_id,achievement_id))`.
- **Evaluation hook**: on game end (after placement/LP), run `evaluateAchievements(playerIds)` against criteria (e.g. first win, N wins, high score, win streak, played-with-build) and insert newly earned rows. Keep criteria as small pure functions in `routes/achievements.js`.
- `GET /api/players/:id/achievements`; display grid on profile (earned vs locked silhouettes).

---

# PHASE 6 — Player leveling (XP from playtime)

- **Derived, not stored** (avoids sync drift): XP = sum of `games.duration` for the player's completed games × a generous multiplier; level via a fast early curve (e.g. `level = floor(sqrt(totalXp / K))` tuned so early levels come quickly). Compute in a stats query / small helper.
- `GET /api/players/:id/level` (or fold into `/stats`): `{ total_xp, level, xp_into_level, xp_for_next }`.
- Display level badge + progress bar on profile and optionally next to leaderboard names. (Confirm `games.duration` is populated on end; if not, derive from `ended_at - started_at`.)

---

# PHASE 7 — Live games page (SSE + auto edit token)

- Baseline adds `games.edit_token TEXT`. On game create, generate a short random token; the starter shares it.
- **SSE**: `GET /api/games/:id/stream` keeps a per-game set of `res` objects; `POST /games/:id/scores` broadcasts `{player_id, score}` to subscribers via `res.write` (no new dependency). Clean up on `req.on('close')`.
- **Edit gating**: `POST /games/:id/scores` accepts an `edit_token`; valid token → allowed to edit, otherwise read-only. Viewers without the token watch live; entering the token unlocks the +/- controls.
- **`live.html` + `js/live.js`**: list in-progress games (`started_at` set, `ended_at` null); open one to a live read-only view (reuse the canvas live chart from `scoreboard.js`, refactored into a shared render function) that subscribes via `EventSource`. Token entry unlocks editing.

---

# PHASE 8 — PWA web push + visual redesign

### Web push (full, VAPID)
- Add `web-push` dep; env `VAPID_PUBLIC`, `VAPID_PRIVATE`, `VAPID_SUBJECT`. Baseline adds `push_subscriptions(id, endpoint, p256dh, auth, player_id?, created_at)`.
- `routes/push.js`: `GET /api/push/key` (public VAPID key), `POST /api/push/subscribe`.
- **Frontend**: request Notification permission, `PushManager.subscribe` with VAPID key, POST subscription. iOS only works when installed to home screen on 16.4+ — surface that in UI copy.
- **`sw.js`**: add `push` + `notificationclick` handlers; bump cache version.
- **Triggers**: on game end / leaderboard recompute, detect rank changes (new #1, big jumps) and push (`"X jumped to first on the leaderboard"`); optionally notify on live-game start.

### Visual redesign + animations
- Refresh the medieval theme by swapping/extending the CSS variables in `frontend/css/main.css` (palette, depth, accents) so Season 2 feels new without a rewrite. Add tasteful micro-animations: page/section fade-ins, score-bump pulses, leaderboard rank-change transitions, hover states; reuse `confetti.js` for milestone moments. Use the `frontend-design` skill for the redesign pass to keep it polished and distinctive. Tighten the mobile/PWA layout (the hamburger nav + 768px breakpoint already exist) for a more native feel.

---

## Implementation order

1. **Phase 0** on `tournament` branch → test → merge to `main` → deploy → run tournament weekend.
2. Cut `season-2` from `main`. **Phase 1** (SQLite) first — it underpins everything; verify locally and via a Postgres-dump copy run.
3. Phases 2–8 are largely independent and additive on top of the SQLite foundation; suggested order 2 → 3 → 4 → 5 → 6 → 7 → 8 (history/banner are quick wins; profiles unlock the surface that achievements/levels render into; live games and push are the heaviest).
4. At launch: deploy `season-2`, run `pg-to-sqlite.js` once against prod Postgres, verify counts + `foreign_key_check`, switch compose to SQLite, confirm, then (only later) remove `postgres_data`.

## Open implementation choices (defaults chosen; flag if you disagree)
- JSON-agg ports: **minimal SQL port** (`json_object`/`json_group_array` + `JSON.parse`), not a flat-join refactor.
- 2-player exact-VP tie in a match: **operator picks the winner** in the bracket UI (no silent auto-pick).
- Leveling: **derived from playtime**, not stored.

---

## Verification

**Phase 0 (tournament, Postgres):**
- Backend restart applies `005`; create a 6-player tournament → confirm byes seed against top seeds, bracket renders.
- Play matches via the resumed scoreboard; confirm winners auto-advance, `tournament_matches` linkage updates, and the final flips tournament to `complete`, fires confetti, and writes a `season_snapshots` row.
- Confirm non-tournament games behave exactly as before (advancement hook is a no-op).
- Force a tied final → confirm operator winner-pick prompt.

**Phase 1 (SQLite):**
- Fresh `dominion.db` from baseline; smoke-test every route: leaderboard (window functions + recent_form), games CRUD + score snapshots + chart data, builds CRUD round-tripping arrays as JSON, tournament flow.
- Run `pg-to-sqlite.js` against a prod Postgres dump; assert per-table row counts equal and `PRAGMA foreign_key_check` returns empty.
- Verify cascades work (delete a game → its `game_players`/`score_snapshots` removed) confirming `foreign_keys=ON`.
- Build/run the bookworm-slim container; confirm `better-sqlite3` loads and the SQLite volume persists across restart.

**Phases 2–8:** per feature — season filter shows only active-season games + history page shows archived Season 1/Tournament 1; banner edit requires auth and renders publicly; profile edits persist and reject non-preset/non-card inputs; achievements award on the game-end hook; level/XP math matches expected curve; live page streams score updates over SSE to a second browser and the token gates editing; push subscription registers and a simulated rank change delivers a notification (test on Android/desktop; document iOS install requirement).