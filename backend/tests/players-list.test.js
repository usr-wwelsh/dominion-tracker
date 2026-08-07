const { startServer, resetData, createPlayers, playGame } = require('./helpers/server');
const test = require('node:test');
const assert = require('node:assert/strict');

let server, client;

test.before(async () => {
  server = await startServer();
  client = server.client;
});
test.after(async () => { await server.close(); });
test.beforeEach(() => { resetData(); });

test('the player list reports how many games each player has played', async () => {
  // Dave is created but never seated, so he anchors the zero case.
  const [alice, bob, cara] = await createPlayers(client, ['Alice', 'Bob', 'Cara', 'Dave']);

  await playGame(client, {
    playerIds: [alice.id, bob.id],
    scores: { [alice.id]: 40, [bob.id]: 10 },
  });
  await playGame(client, {
    playerIds: [alice.id, cara.id],
    scores: { [alice.id]: 30, [cara.id]: 20 },
  });

  const res = await client.get('/api/players');
  assert.equal(res.status, 200);

  const counts = Object.fromEntries(res.body.map(p => [p.name, p.total_games]));
  assert.deepEqual(counts, { Alice: 2, Bob: 1, Cara: 1, Dave: 0 });
});

test('a player who has never played reports zero games, not null', async () => {
  await createPlayers(client, ['Solo']);

  const res = await client.get('/api/players');
  assert.equal(res.body[0].total_games, 0);
});
