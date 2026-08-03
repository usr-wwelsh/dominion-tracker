const { startServer, resetData, createPlayers, createBuild } = require('./helpers/server');
const test = require('node:test');
const assert = require('node:assert/strict');

let server, client, db;

test.before(async () => {
  server = await startServer();
  client = server.client;
  db = server.db;
});
test.after(async () => { await server.close(); });
test.beforeEach(() => { resetData(); });

// Scores are keyed by player id, so the caller controls the finishing order.
async function runGame(playerIds, scores, buildId = null) {
  const created = await client.post('/api/games', { build_id: buildId, player_ids: playerIds });
  assert.equal(created.status, 201);
  const gameId = created.body.id;

  const started = await client.put(`/api/games/${gameId}/start`);
  assert.equal(started.status, 200);
  assert.ok(started.body.started_at, 'start must stamp started_at');

  for (const playerId of playerIds) {
    const scored = await client.post(`/api/games/${gameId}/scores`, {
      player_id: playerId,
      score: scores[playerId],
      edit_token: created.body.edit_token,
    });
    assert.equal(scored.status, 200);
  }

  const ended = await client.put(`/api/games/${gameId}/end`);
  assert.equal(ended.status, 200);
  return { gameId, created: created.body, ended: ended.body };
}

// Reduce an ended game's players to [name, placement, league_points] triples so
// assertions read like the scoreboard.
function board(endedBody, players) {
  const byId = new Map(players.map(p => [p.id, p.name]));
  return endedBody.players.map(p => [byId.get(p.player_id), p.placement, p.league_points]);
}

test('a clean four-player finish assigns placements and the full 0-100 spread', async () => {
  const players = await createPlayers(client, ['Alice', 'Bob', 'Cara', 'Dan']);
  const [a, b, c, d] = players;

  const { gameId, ended } = await runGame(
    players.map(p => p.id),
    { [a.id]: 45, [b.id]: 38, [c.id]: 30, [d.id]: 12 }
  );

  assert.deepEqual(board(ended, players), [
    ['Alice', 1, 100],
    ['Bob',   2, 66.67],
    ['Cara',  3, 33.33],
    ['Dan',   4, 0],
  ]);

  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(gameId);
  assert.ok(game.ended_at, 'end must stamp ended_at');
  assert.ok(Number.isInteger(game.duration) && game.duration >= 0, 'end must record a duration');
});

test('a two-way tie for first splits the top two slots', async () => {
  const players = await createPlayers(client, ['Alice', 'Bob', 'Cara', 'Dan']);
  const [a, b, c, d] = players;

  const { ended } = await runGame(
    players.map(p => p.id),
    { [a.id]: 40, [b.id]: 40, [c.id]: 30, [d.id]: 20 }
  );

  // Alice and Bob share slots 1 and 2, so both take (100 + 66.67) / 2. Cara
  // still lands on placement 3 — a tie consumes the slots it spans.
  assert.deepEqual(board(ended, players), [
    ['Alice', 1, 83.33],
    ['Bob',   1, 83.33],
    ['Cara',  3, 33.33],
    ['Dan',   4, 0],
  ]);
});

test('an all-tied game gives every player placement 1 and the midpoint', async () => {
  const players = await createPlayers(client, ['Alice', 'Bob', 'Cara', 'Dan']);
  const scores = Object.fromEntries(players.map(p => [p.id, 25]));

  const { ended } = await runGame(players.map(p => p.id), scores);

  for (const row of ended.players) {
    assert.equal(row.placement, 1);
    assert.equal(row.league_points, 50);
  }
});

test('players start on 3 points — the three starting Estates', async () => {
  const players = await createPlayers(client, ['Alice', 'Bob']);
  const build = await createBuild(client, { nickname: 'Estates' });

  const created = await client.post('/api/games', {
    build_id: build.id,
    player_ids: players.map(p => p.id),
  });
  assert.equal(created.status, 201);

  const rows = db.prepare('SELECT final_score FROM game_players WHERE game_id = ?').all(created.body.id);
  assert.deepEqual(rows.map(r => r.final_score), [3, 3]);
});

test('a shelters build starts everyone on 0 — Shelters are worth no VP', async () => {
  const players = await createPlayers(client, ['Alice', 'Bob']);
  const build = await createBuild(client, { nickname: 'Dark Ages', use_shelters: true });

  const created = await client.post('/api/games', {
    build_id: build.id,
    player_ids: players.map(p => p.id),
  });
  assert.equal(created.status, 201);

  const rows = db.prepare('SELECT final_score FROM game_players WHERE game_id = ?').all(created.body.id);
  assert.deepEqual(rows.map(r => r.final_score), [0, 0]);

  // The opening snapshot has to agree, or the score chart starts from a lie.
  const snaps = db.prepare('SELECT score FROM score_snapshots WHERE game_id = ?').all(created.body.id);
  assert.deepEqual(snaps.map(s => s.score), [0, 0]);
});

test('the same player listed twice is seated once', async () => {
  // A double-tap on the player picker used to reach the INSERT twice and blow
  // up on the game_players UNIQUE constraint, failing the whole create with an
  // unexplained 500. The duplicate is the caller's slip, not a real conflict.
  const players = await createPlayers(client, ['Alice', 'Bob']);
  const [a, b] = players;

  const created = await client.post('/api/games', { player_ids: [a.id, b.id, a.id] });
  assert.equal(created.status, 201);

  const seated = db
    .prepare('SELECT player_id FROM game_players WHERE game_id = ? ORDER BY player_id')
    .all(created.body.id)
    .map(r => r.player_id);
  assert.deepEqual(seated, [a.id, b.id]);

  const snaps = db
    .prepare('SELECT player_id FROM score_snapshots WHERE game_id = ? ORDER BY player_id')
    .all(created.body.id)
    .map(r => r.player_id);
  assert.deepEqual(snaps, [a.id, b.id]);
});

test('scoring rejects a wrong edit token and a player who is not in the game', async () => {
  const players = await createPlayers(client, ['Alice', 'Bob']);
  const outsider = (await createPlayers(client, ['Eve']))[0];
  const [a, b] = players;

  const created = await client.post('/api/games', { player_ids: [a.id, b.id] });
  const gameId = created.body.id;

  const wrongToken = await client.post(`/api/games/${gameId}/scores`, {
    player_id: a.id, score: 10, edit_token: 'not-the-token',
  });
  assert.equal(wrongToken.status, 403);

  const notSeated = await client.post(`/api/games/${gameId}/scores`, {
    player_id: outsider.id, score: 10, edit_token: created.body.edit_token,
  });
  assert.equal(notSeated.status, 404);
});

test('an empty player list is rejected before a game row is written', async () => {
  const res = await client.post('/api/games', { player_ids: [] });
  assert.equal(res.status, 400);
  assert.equal(db.prepare('SELECT COUNT(*) AS c FROM games').get().c, 0);
});
