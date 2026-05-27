/**
 * One-time operator-run migration script: Postgres → SQLite.
 * Run ONCE at Season 2 cutover. Requires both pg and better-sqlite3 installed.
 *
 * Usage:
 *   PG_URL="postgres://user:pass@host:5432/dominion_tracker" \
 *   SQLITE_PATH="/data/dominion.db" \
 *   node backend/scripts/pg-to-sqlite.js
 */

require('dotenv').config();
const { Client } = require('pg');
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const PG_URL  = process.env.PG_URL  || process.env.DATABASE_URL;
const SQLITE_PATH = process.env.SQLITE_PATH || path.join(__dirname, '..', 'data', 'dominion.db');

if (!PG_URL) {
  console.error('Error: set PG_URL or DATABASE_URL env var to your Postgres connection string.');
  process.exit(1);
}

const baselineSql = fs.readFileSync(
  path.join(__dirname, '..', 'migrations', 'sqlite', '001_baseline.sql'),
  'utf8'
);

async function run() {
  console.log(`Source: ${PG_URL.replace(/:([^:@]+)@/, ':***@')}`);
  console.log(`Target: ${SQLITE_PATH}`);

  if (fs.existsSync(SQLITE_PATH)) {
    const bak = `${SQLITE_PATH}.bak.${Date.now()}`;
    fs.renameSync(SQLITE_PATH, bak);
    console.log(`Existing SQLite file backed up to ${bak}`);
  }

  const sqlite = new Database(SQLITE_PATH);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = OFF');

  // Apply baseline schema
  sqlite.exec(baselineSql);

  const pg = new Client({ connectionString: PG_URL });
  await pg.connect();

  const copy = sqlite.transaction(async () => {
    // --- players ---
    const { rows: players } = await pg.query('SELECT * FROM players ORDER BY id');
    const insPlayer = sqlite.prepare(
      'INSERT OR REPLACE INTO players (id, name, color, created_at) VALUES (?, ?, ?, ?)'
    );
    for (const r of players) {
      insPlayer.run(r.id, r.name, r.color || null, r.created_at?.toISOString() || null);
    }
    console.log(`  players: ${players.length}`);

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
    console.log(`  builds: ${builds.length}`);

    // --- games (all go to season_id=1) ---
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
    console.log(`  games: ${games.length}`);

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
    console.log(`  game_players: ${gps.length}`);

    // --- score_snapshots ---
    const { rows: snaps } = await pg.query('SELECT * FROM score_snapshots ORDER BY id');
    const insSnap = sqlite.prepare(
      'INSERT OR REPLACE INTO score_snapshots (id, game_id, player_id, score, timestamp) VALUES (?, ?, ?, ?, ?)'
    );
    for (const r of snaps) {
      insSnap.run(r.id, r.game_id, r.player_id, r.score, r.timestamp?.toISOString() || null);
    }
    console.log(`  score_snapshots: ${snaps.length}`);

    // --- build_comments (if exists) ---
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
      console.log(`  build_comments: ${bcs.length}`);
    } catch { console.log('  build_comments: table not present, skipping'); }

    // --- tournaments ---
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
      console.log(`  tournaments: ${ts.length}`);

      const { rows: tps } = await pg.query('SELECT * FROM tournament_players ORDER BY id');
      const insTp = sqlite.prepare(
        'INSERT OR REPLACE INTO tournament_players (id, tournament_id, player_id, seed) VALUES (?, ?, ?, ?)'
      );
      for (const r of tps) insTp.run(r.id, r.tournament_id, r.player_id, r.seed);
      console.log(`  tournament_players: ${tps.length}`);

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
      console.log(`  tournament_matches: ${tms.length}`);

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
      console.log(`  season_snapshots: ${sss.length}`);
    } catch (e) { console.log(`  tournaments: skipped (${e.message})`); }
  });

  // Wrap the whole thing in a single SQLite transaction
  // (the above closure captures pg which is async, so we run sequentially)
  sqlite.pragma('foreign_keys = OFF');
  await copy();

  // Fix auto-increment high-water marks
  for (const tbl of ['players','builds','games','game_players','score_snapshots',
                      'tournaments','tournament_players','tournament_matches','season_snapshots']) {
    try {
      const maxId = sqlite.prepare(`SELECT MAX(id) AS m FROM ${tbl}`).get().m;
      if (maxId) {
        sqlite.prepare(`INSERT OR REPLACE INTO sqlite_sequence (name, seq) VALUES (?, ?)`).run(tbl, maxId);
      }
    } catch {}
  }

  sqlite.pragma('foreign_keys = ON');
  const issues = sqlite.pragma('foreign_key_check');
  if (issues.length > 0) {
    console.error('foreign_key_check FAILED:', issues);
    process.exit(1);
  }

  // Verify row counts match
  let ok = true;
  for (const [pg_tbl, sq_tbl] of [['players','players'],['builds','builds'],['games','games'],
      ['game_players','game_players'],['score_snapshots','score_snapshots']]) {
    const pg_count = (await pg.query(`SELECT COUNT(*) AS c FROM ${pg_tbl}`)).rows[0].c;
    const sq_count = sqlite.prepare(`SELECT COUNT(*) AS c FROM ${sq_tbl}`).get().c;
    const match = String(pg_count) === String(sq_count);
    console.log(`  ${sq_tbl}: pg=${pg_count} sqlite=${sq_count} ${match ? '✓' : '✗ MISMATCH'}`);
    if (!match) ok = false;
  }

  await pg.end();
  sqlite.close();

  if (!ok) {
    console.error('\nRow count mismatch — do NOT switch to SQLite yet. Investigate above.');
    process.exit(1);
  }
  console.log('\nMigration complete. Verify with the app, then switch compose to SQLite.');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
