/**
 * Postgres → SQLite migration (one-time Season 2 cutover).
 *
 * Two entry points:
 *   1. CLI:  `node backend/scripts/pg-to-sqlite.js`
 *            Builds a fresh SQLite file (backs up any existing one, applies the
 *            baseline schema) then copies all data from Postgres.
 *   2. maybeAutoImport(sqlite):  called by server.js on startup. If the SQLite db
 *            is empty AND a Postgres connection is configured + reachable, it runs
 *            the copy once and marks it done in site_settings. Otherwise no-ops.
 *
 * `pg` is an OPTIONAL dependency — only needed for this cutover. It is lazy-required
 * so normal Season 2 operation (SQLite-only) never loads it.
 *
 * CLI usage:
 *   PG_URL="postgres://user:pass@host:5432/dominion_tracker" \
 *   SQLITE_PATH="/data/dominion.db" \
 *   node backend/scripts/pg-to-sqlite.js
 */

const fs = require('fs');
const path = require('path');

const BASELINE_PATH = path.join(__dirname, '..', 'migrations', 'sqlite', '001_baseline.sql');

// Build a Postgres connection string from env. Supports an explicit PG_URL /
// DATABASE_URL, or the discrete DB_* vars the app already uses.
function pgUrlFromEnv() {
  if (process.env.PG_URL) return process.env.PG_URL;
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const { DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD } = process.env;
  if (DB_HOST && DB_NAME && DB_USER) {
    const auth = DB_PASSWORD
      ? `${DB_USER}:${encodeURIComponent(DB_PASSWORD)}`
      : DB_USER;
    return `postgres://${auth}@${DB_HOST}:${DB_PORT || 5432}/${DB_NAME}`;
  }
  return null;
}

// Copy all Season 1 data from Postgres into an already-open, schema-ready
// better-sqlite3 database. Atomic (single transaction); verifies row counts.
// Returns a summary object of per-table counts.
async function copyFromPostgres(sqlite, pgUrl) {
  const { Client } = require('pg'); // lazy: optional dependency
  const pg = new Client({ connectionString: pgUrl, connectionTimeoutMillis: 10000 });
  await pg.connect();

  const summary = {};
  sqlite.pragma('foreign_keys = OFF');
  sqlite.exec('BEGIN');
  try {
    // --- players ---
    const { rows: players } = await pg.query('SELECT * FROM players ORDER BY id');
    const insPlayer = sqlite.prepare(
      'INSERT OR REPLACE INTO players (id, name, color, created_at) VALUES (?, ?, ?, ?)'
    );
    for (const r of players) {
      insPlayer.run(r.id, r.name, r.color || null, r.created_at?.toISOString() || null);
    }
    summary.players = players.length;

    // --- builds ---
    const { rows: builds } = await pg.query('SELECT * FROM builds ORDER BY id');
    const insBuild = sqlite.prepare(
      `INSERT OR REPLACE INTO builds
         (id, nickname, cards, landmarks, events, prophecies, use_platinum_colony, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const r of builds) {
      insBuild.run(
        r.id, r.nickname,
        JSON.stringify(r.cards || []),
        JSON.stringify(r.landmarks || []),
        JSON.stringify(r.events || []),
        JSON.stringify(r.prophecies || []),
        r.use_platinum_colony ? 1 : 0,
        r.created_at?.toISOString() || null
      );
    }
    summary.builds = builds.length;

    // --- games (all historical games belong to season 1) ---
    const { rows: games } = await pg.query('SELECT * FROM games ORDER BY id');
    const insGame = sqlite.prepare(
      `INSERT OR REPLACE INTO games
         (id, build_id, season_id, started_at, ended_at, duration, edit_token)
       VALUES (?, ?, 1, ?, ?, ?, NULL)`
    );
    for (const r of games) {
      insGame.run(
        r.id, r.build_id || null,
        r.started_at?.toISOString() || null,
        r.ended_at?.toISOString() || null,
        r.duration || null
      );
    }
    summary.games = games.length;

    // --- game_players ---
    const { rows: gps } = await pg.query('SELECT * FROM game_players ORDER BY id');
    const insGp = sqlite.prepare(
      `INSERT OR REPLACE INTO game_players
         (id, game_id, player_id, final_score, placement, league_points)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const r of gps) {
      insGp.run(r.id, r.game_id, r.player_id, r.final_score, r.placement, r.league_points);
    }
    summary.game_players = gps.length;

    // --- score_snapshots ---
    const { rows: snaps } = await pg.query('SELECT * FROM score_snapshots ORDER BY id');
    const insSnap = sqlite.prepare(
      'INSERT OR REPLACE INTO score_snapshots (id, game_id, player_id, score, timestamp) VALUES (?, ?, ?, ?, ?)'
    );
    for (const r of snaps) {
      insSnap.run(r.id, r.game_id, r.player_id, r.score, r.timestamp?.toISOString() || null);
    }
    summary.score_snapshots = snaps.length;

    // --- build_comments (Postgres-only table; may not exist) ---
    try {
      const { rows: bcs } = await pg.query('SELECT * FROM build_comments ORDER BY id');
      const insBc = sqlite.prepare(
        `INSERT OR REPLACE INTO build_comments
           (id, build_id, game_id, player_id, comment_text, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      for (const r of bcs) {
        insBc.run(r.id, r.build_id, r.game_id, r.player_id, r.comment_text, r.created_at?.toISOString() || null);
      }
      summary.build_comments = bcs.length;
    } catch { summary.build_comments = 'skipped (no table)'; }

    // --- tournaments (Postgres migration 005; may not exist on older dbs) ---
    try {
      const { rows: ts } = await pg.query('SELECT * FROM tournaments ORDER BY id');
      const insT = sqlite.prepare(
        `INSERT OR REPLACE INTO tournaments
           (id, name, status, best_of, winner_player_id, created_at, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      );
      for (const r of ts) {
        insT.run(r.id, r.name, r.status, r.best_of, r.winner_player_id || null,
          r.created_at?.toISOString() || null, r.completed_at?.toISOString() || null);
      }
      summary.tournaments = ts.length;

      const { rows: tps } = await pg.query('SELECT * FROM tournament_players ORDER BY id');
      const insTp = sqlite.prepare(
        'INSERT OR REPLACE INTO tournament_players (id, tournament_id, player_id, seed) VALUES (?, ?, ?, ?)'
      );
      for (const r of tps) insTp.run(r.id, r.tournament_id, r.player_id, r.seed);
      summary.tournament_players = tps.length;

      const { rows: tms } = await pg.query('SELECT * FROM tournament_matches ORDER BY id');
      const insTm = sqlite.prepare(
        `INSERT OR REPLACE INTO tournament_matches
           (id, tournament_id, round, match_index, player1_id, player2_id,
            winner_player_id, game_id, next_match_id, next_slot, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const r of tms) {
        insTm.run(r.id, r.tournament_id, r.round, r.match_index,
          r.player1_id || null, r.player2_id || null, r.winner_player_id || null,
          r.game_id || null, r.next_match_id || null, r.next_slot || null, r.status);
      }
      summary.tournament_matches = tms.length;

      const { rows: sss } = await pg.query('SELECT * FROM season_snapshots ORDER BY id');
      const insSs = sqlite.prepare(
        `INSERT OR REPLACE INTO season_snapshots
           (id, label, player_id, player_name, total_league_points, total_wins, total_games, tournament_id, captured_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const r of sss) {
        insSs.run(r.id, r.label, r.player_id || null, r.player_name,
          r.total_league_points, r.total_wins, r.total_games,
          r.tournament_id || null, r.captured_at?.toISOString() || null);
      }
      summary.season_snapshots = sss.length;
    } catch (e) { summary.tournaments = `skipped (${e.message})`; }

    sqlite.exec('COMMIT');
  } catch (e) {
    sqlite.exec('ROLLBACK');
    await pg.end().catch(() => {});
    throw e;
  }

  // Fix auto-increment high-water marks so new rows don't collide with copied ids.
  for (const tbl of ['players', 'builds', 'games', 'game_players', 'score_snapshots',
                     'tournaments', 'tournament_players', 'tournament_matches', 'season_snapshots']) {
    try {
      const maxId = sqlite.prepare(`SELECT MAX(id) AS m FROM ${tbl}`).get().m;
      if (maxId) {
        sqlite.prepare('INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES (?, ?)').run(tbl, maxId);
      }
    } catch {}
  }

  sqlite.pragma('foreign_keys = ON');
  const issues = sqlite.pragma('foreign_key_check');
  if (issues.length > 0) {
    await pg.end().catch(() => {});
    throw new Error(`foreign_key_check failed: ${JSON.stringify(issues)}`);
  }

  // Verify row counts match the source.
  for (const tbl of ['players', 'builds', 'games', 'game_players', 'score_snapshots']) {
    const pgCount = (await pg.query(`SELECT COUNT(*) AS c FROM ${tbl}`)).rows[0].c;
    const sqCount = sqlite.prepare(`SELECT COUNT(*) AS c FROM ${tbl}`).get().c;
    if (String(pgCount) !== String(sqCount)) {
      await pg.end().catch(() => {});
      throw new Error(`row count mismatch for ${tbl}: pg=${pgCount} sqlite=${sqCount}`);
    }
  }

  await pg.end();
  return summary;
}

// Startup hook: auto-import from Postgres exactly once, only when it makes sense.
// No-ops (and never throws on a missing/unreachable Postgres) so normal boots are
// unaffected. Re-tries on a future boot only if Postgres was unreachable.
async function maybeAutoImport(sqlite) {
  const flag = sqlite.prepare("SELECT value FROM site_settings WHERE key = 'pg_import_done'").get();
  if (flag && flag.value === 'true') return;

  const markDone = () => sqlite.prepare(
    `INSERT INTO site_settings (key, value) VALUES ('pg_import_done', 'true')
     ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = CURRENT_TIMESTAMP`
  ).run();

  // Already has data — nothing to import; mark done so we never probe Postgres again.
  const gameCount = sqlite.prepare('SELECT COUNT(*) AS c FROM games').get().c;
  if (gameCount > 0) { markDone(); return; }

  const pgUrl = pgUrlFromEnv();
  if (!pgUrl) return; // no Postgres configured → fresh Season 2 install, normal operation

  try {
    require.resolve('pg');
  } catch {
    console.warn('[pg-import] Postgres is configured but the `pg` package is not installed — skipping auto-import.');
    return;
  }

  console.log('[pg-import] Empty database + Postgres configured — attempting one-time import...');
  try {
    const summary = await copyFromPostgres(sqlite, pgUrl);
    markDone();
    console.log('[pg-import] Import complete:', JSON.stringify(summary));
  } catch (e) {
    if (/ECONNREFUSED|ENOTFOUND|EAI_AGAIN|timeout|terminating connection/i.test(e.message)) {
      console.warn(`[pg-import] Postgres not reachable (${e.message}). Skipping; will retry on next boot.`);
      return;
    }
    throw e; // real failure (e.g. count mismatch) — surface it
  }
}

// --- CLI entry point ---
async function runCli() {
  require('dotenv').config({ quiet: true });
  const Database = require('better-sqlite3');

  const pgUrl = pgUrlFromEnv();
  const sqlitePath = process.env.SQLITE_PATH || path.join(__dirname, '..', 'data', 'dominion.db');

  if (!pgUrl) {
    console.error('Error: set PG_URL/DATABASE_URL (or DB_HOST/DB_NAME/DB_USER) to your Postgres connection.');
    process.exit(1);
  }

  console.log(`Source: ${pgUrl.replace(/:([^:@/]+)@/, ':***@')}`);
  console.log(`Target: ${sqlitePath}`);

  if (fs.existsSync(sqlitePath)) {
    const bak = `${sqlitePath}.bak.${Date.now()}`;
    fs.renameSync(sqlitePath, bak);
    console.log(`Existing SQLite file backed up to ${bak}`);
  }

  const sqlite = new Database(sqlitePath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.exec(fs.readFileSync(BASELINE_PATH, 'utf8'));

  const summary = await copyFromPostgres(sqlite, pgUrl);
  for (const [tbl, n] of Object.entries(summary)) console.log(`  ${tbl}: ${n}`);
  sqlite.close();

  console.log('\nMigration complete. Verify with the app, then switch compose to SQLite.');
}

module.exports = { copyFromPostgres, maybeAutoImport, pgUrlFromEnv };

if (require.main === module) {
  runCli().catch(err => { console.error(err); process.exit(1); });
}
