const {
  startServer, resetData, basicAuth, createPlayers, createBuild, playGame,
} = require('./helpers/server');
const test = require('node:test');
const assert = require('node:assert/strict');

let server, client, db;

const USER = 'admin';
const PASS = 'hunter2';
const GOOD = basicAuth(USER, PASS);

test.before(async () => {
  server = await startServer();
  client = server.client;
  db = server.db;
});
test.after(async () => { await server.close(); });

test.beforeEach(() => {
  resetData();
  // requireAuth reads the env on every request, so each test states the world
  // it wants rather than inheriting one.
  process.env.AUTH_USER = USER;
  process.env.AUTH_PASS = PASS;
});
test.afterEach(() => {
  delete process.env.AUTH_USER;
  delete process.env.AUTH_PASS;
});

// A finished game and a build, both deletable — the fixtures the destructive
// routes operate on.
async function seedDeletables() {
  const players = await createPlayers(client, ['Alice', 'Bob']);
  const build = await createBuild(client);
  const game = await playGame(client, {
    playerIds: players.map(p => p.id),
    scores: { [players[0].id]: 30, [players[1].id]: 20 },
    buildId: build.id,
  });
  return { game, build };
}

test('destructive routes reject a request with no credentials', async () => {
  const { game, build } = await seedDeletables();

  const noAuth = [
    await client.del(`/api/games/${game.id}`),
    await client.del(`/api/builds/${build.id}`),
    await client.get('/api/admin/export-db'),
  ];
  for (const res of noAuth) assert.equal(res.status, 401);

  assert.ok(db.prepare('SELECT id FROM games WHERE id = ?').get(game.id), 'game survived');
  assert.ok(db.prepare('SELECT id FROM builds WHERE id = ?').get(build.id), 'build survived');
});

test('destructive routes reject wrong and malformed credentials', async () => {
  const { game } = await seedDeletables();

  const wrongPass = await client.del(`/api/games/${game.id}`, undefined, {
    headers: basicAuth(USER, 'wrong'),
  });
  assert.equal(wrongPass.status, 401);

  const wrongUser = await client.del(`/api/games/${game.id}`, undefined, {
    headers: basicAuth('someone', PASS),
  });
  assert.equal(wrongUser.status, 401);

  const notBasic = await client.del(`/api/games/${game.id}`, undefined, {
    headers: { Authorization: `Bearer ${PASS}` },
  });
  assert.equal(notBasic.status, 401);

  assert.ok(db.prepare('SELECT id FROM games WHERE id = ?').get(game.id), 'game survived');
});

test('destructive routes accept correct credentials', async () => {
  const { game, build } = await seedDeletables();

  const deletedGame = await client.del(`/api/games/${game.id}`, undefined, { headers: GOOD });
  assert.equal(deletedGame.status, 200);
  assert.equal(db.prepare('SELECT id FROM games WHERE id = ?').get(game.id), undefined);
  assert.equal(
    db.prepare('SELECT COUNT(*) AS c FROM game_players WHERE game_id = ?').get(game.id).c,
    0,
    'the game rows should go with it'
  );

  const deletedBuild = await client.del(`/api/builds/${build.id}`, undefined, { headers: GOOD });
  assert.equal(deletedBuild.status, 200);
  assert.equal(db.prepare('SELECT id FROM builds WHERE id = ?').get(build.id), undefined);
});

test('the admin export streams a database file when authenticated', async () => {
  await seedDeletables();

  const res = await client.get('/api/admin/export-db', { headers: GOOD });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition') || '', /dominion-backup-\d{4}-\d{2}-\d{2}\.db/);
  assert.ok(String(res.body).startsWith('SQLite format 3'), 'the download should be a SQLite file');
});

test('a missing target still gets past auth and 404s', async () => {
  // Proves the 401s above come from the credentials, not from the route
  // rejecting the request for some other reason.
  const missingGame = await client.del('/api/games/999999', undefined, { headers: GOOD });
  assert.equal(missingGame.status, 404);

  const missingBuild = await client.del('/api/builds/999999', undefined, { headers: GOOD });
  assert.equal(missingBuild.status, 404);
});

test('with no credentials configured the routes pass straight through', async () => {
  delete process.env.AUTH_USER;
  delete process.env.AUTH_PASS;

  const { game, build } = await seedDeletables();

  const deletedGame = await client.del(`/api/games/${game.id}`);
  assert.equal(deletedGame.status, 200);

  const deletedBuild = await client.del(`/api/builds/${build.id}`);
  assert.equal(deletedBuild.status, 200);

  const exported = await client.get('/api/admin/export-db');
  assert.equal(exported.status, 200);
});

test('a half-configured pair is treated as unconfigured', async () => {
  // requireAuth needs both halves; one alone cannot authenticate anyone, so it
  // must not lock the routes out either.
  delete process.env.AUTH_PASS;

  const { game } = await seedDeletables();
  const res = await client.del(`/api/games/${game.id}`);
  assert.equal(res.status, 200);
});

test('the auth check endpoint reports whether credentials are valid', async () => {
  const anonymous = await client.get('/api/auth/check');
  assert.equal(anonymous.status, 401);

  const authenticated = await client.get('/api/auth/check', { headers: GOOD });
  assert.equal(authenticated.status, 200);
  assert.deepEqual(authenticated.body, { ok: true });
});
