// Integration-test harness: the real express app, on an ephemeral port, over a
// real SQLite database built by the real migrations.
//
// Require this BEFORE anything that pulls in ../db — db.js opens its database
// at require time from SQLITE_PATH, so the path has to be set first.
//
// node --test gives every test file its own process, so one database per file
// is enough isolation. resetData() clears it between tests within a file.
process.env.NODE_ENV = 'test';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { once } = require('node:events');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dominion-test-'));
process.env.SQLITE_PATH = path.join(tmpDir, 'dominion.db');

const { db } = require('../../db');
const { migrate } = require('../../migrate');

// migrate() narrates every file it applies. Useful on boot, pure noise here.
const realLog = console.log;
console.log = () => {};
try {
  migrate();
} finally {
  console.log = realLog;
}

const app = require('../../app');

// dotenv has already loaded .env by this point, and a developer's local .env
// sets AUTH_USER/AUTH_PASS — which would 401 every destructive route and make
// results depend on an untracked file. Tests that care about auth set them.
delete process.env.AUTH_USER;
delete process.env.AUTH_PASS;

// Everything the app writes to, children before parents. achievements and
// seasons are seeded by the migrations and stay put.
const DATA_TABLES = [
  'score_snapshots',
  'build_comments',
  'build_ratings',
  'player_achievements',
  'player_profiles',
  'push_subscriptions',
  'season_snapshots',
  'tournament_games',
  'tournament_matches',
  'tournament_players',
  'tournaments',
  'game_players',
  'games',
  'builds',
  'players',
];

function resetData() {
  db.pragma('foreign_keys = OFF');
  try {
    for (const table of DATA_TABLES) db.prepare(`DELETE FROM ${table}`).run();
    // Restart the id counters so ids are predictable per test, but leave the
    // seeded tables alone or their foreign keys would collide with new rows.
    db.prepare(
      `DELETE FROM sqlite_sequence WHERE name NOT IN ('achievements', 'seasons')`
    ).run();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

function makeClient(baseUrl) {
  const call = async (method, url, body, opts = {}) => {
    const res = await fetch(baseUrl + url, {
      method,
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let parsed = null;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    return { status: res.status, body: parsed, headers: res.headers };
  };

  return {
    get:   (url, opts)       => call('GET', url, undefined, opts),
    post:  (url, body, opts) => call('POST', url, body, opts),
    put:   (url, body, opts) => call('PUT', url, body, opts),
    patch: (url, body, opts) => call('PATCH', url, body, opts),
    del:   (url, body, opts) => call('DELETE', url, body, opts),
  };
}

function basicAuth(user, pass) {
  return { Authorization: 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64') };
}

async function startServer() {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  return {
    app,
    db,
    baseUrl,
    client: makeClient(baseUrl),
    close: async () => {
      // fetch keeps its sockets alive, so a plain close() never resolves.
      server.closeAllConnections();
      server.close();
      await once(server, 'close');
    },
  };
}

// --- fixtures ---------------------------------------------------------------

async function createPlayer(client, name) {
  const res = await client.post('/api/players', { name });
  if (res.status !== 201) throw new Error(`createPlayer(${name}) -> ${res.status}`);
  return res.body;
}

async function createPlayers(client, names) {
  const players = [];
  for (const name of names) players.push(await createPlayer(client, name));
  return players;
}

async function createBuild(client, fields = {}) {
  const res = await client.post('/api/builds', {
    nickname: 'Test Build',
    cards: ['Village', 'Smithy'],
    ...fields,
  });
  if (res.status !== 201) throw new Error(`createBuild -> ${res.status}`);
  return res.body;
}

// Run a game end to end: create, start, score every player, end. `scores` maps
// player id -> final score.
async function playGame(client, { playerIds, scores, buildId = null }) {
  const created = await client.post('/api/games', { build_id: buildId, player_ids: playerIds });
  if (created.status !== 201) throw new Error(`playGame create -> ${created.status}`);
  const gameId = created.body.id;

  await client.put(`/api/games/${gameId}/start`);
  for (const playerId of playerIds) {
    await client.post(`/api/games/${gameId}/scores`, {
      player_id: playerId,
      score: scores[playerId],
      edit_token: created.body.edit_token,
    });
  }

  const ended = await client.put(`/api/games/${gameId}/end`);
  if (ended.status !== 200) throw new Error(`playGame end -> ${ended.status}`);
  return ended.body;
}

module.exports = {
  startServer,
  resetData,
  basicAuth,
  createPlayer,
  createPlayers,
  createBuild,
  playGame,
  db,
};
