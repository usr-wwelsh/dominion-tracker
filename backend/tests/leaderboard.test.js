const { startServer, resetData, createPlayers, playGame } = require('./helpers/server');
const test = require('node:test');
const assert = require('node:assert/strict');
const { MIN_GAMES_FOR_RANKING } = require('../config');

let server, client, db;

test.before(async () => {
  server = await startServer();
  client = server.client;
  db = server.db;
});
test.after(async () => { await server.close(); });
test.beforeEach(() => { resetData(); });

async function leaderboard() {
  const res = await client.get('/api/leaderboard');
  assert.equal(res.status, 200);
  return res.body;
}

function rowFor(rows, player) {
  const row = rows.find(r => r.id === player.id);
  assert.ok(row, `${player.name} should be on the leaderboard`);
  return row;
}

// One head-to-head game, `winner` takes it.
function head2head(winner, loser) {
  return playGame(client, {
    playerIds: [winner.id, loser.id],
    scores: { [winner.id]: 40, [loser.id]: 10 },
  });
}

test('players below the games threshold are listed but not qualified', async () => {
  const [alice, bob, cara] = await createPlayers(client, ['Alice', 'Bob', 'Cara']);

  // Bob wins everything he plays but only plays three games; Alice grinds out
  // the full quota and loses most of hers.
  for (let i = 0; i < 3; i++) await head2head(bob, alice);
  for (let i = 0; i < MIN_GAMES_FOR_RANKING - 3; i++) await head2head(alice, cara);

  const rows = await leaderboard();
  const aliceRow = rowFor(rows, alice);
  const bobRow = rowFor(rows, bob);

  assert.equal(aliceRow.total_games, MIN_GAMES_FOR_RANKING);
  assert.equal(aliceRow.qualified, 1);
  assert.equal(bobRow.total_games, 3);
  assert.equal(bobRow.qualified, 0);
  assert.equal(aliceRow.min_games_for_ranking, MIN_GAMES_FOR_RANKING);

  // Bob's average is perfect and Alice's is not, yet provisional players sort
  // below every qualified one.
  assert.ok(bobRow.avg_league_points > aliceRow.avg_league_points);
  assert.ok(
    rows.indexOf(aliceRow) < rows.indexOf(bobRow),
    'qualified players come first regardless of average'
  );
});

test('the last qualifying game flips a player from provisional to ranked', async () => {
  const [alice, bob] = await createPlayers(client, ['Alice', 'Bob']);

  for (let i = 0; i < MIN_GAMES_FOR_RANKING - 1; i++) await head2head(alice, bob);
  assert.equal(rowFor(await leaderboard(), alice).qualified, 0);

  await head2head(alice, bob);
  const row = rowFor(await leaderboard(), alice);
  assert.equal(row.qualified, 1);
  assert.equal(row.total_games, MIN_GAMES_FOR_RANKING);
});

test('qualified players are ordered by average league points, then wins', async () => {
  const [alice, bob, cara] = await createPlayers(client, ['Alice', 'Bob', 'Cara']);
  const quota = MIN_GAMES_FOR_RANKING;

  // Alice beats Bob every time; Cara beats Bob every time; Alice plays Cara
  // once and wins, so Alice ends ahead of Cara ends ahead of Bob.
  for (let i = 0; i < quota; i++) await head2head(alice, bob);
  for (let i = 0; i < quota - 1; i++) await head2head(cara, bob);
  await head2head(alice, cara);

  const rows = await leaderboard();
  const ranked = rows.filter(r => r.qualified === 1).map(r => r.name);
  assert.deepEqual(ranked, ['Alice', 'Cara', 'Bob']);

  const aliceRow = rowFor(rows, alice);
  assert.equal(aliceRow.total_games, quota + 1);
  assert.equal(aliceRow.total_wins, quota + 1);
  assert.equal(aliceRow.avg_league_points, 100);
  assert.equal(aliceRow.win_rate, 100);

  const bobRow = rowFor(rows, bob);
  assert.equal(bobRow.total_wins, 0);
  assert.equal(bobRow.avg_league_points, 0);
});

test('recent form lists the last five placements, newest first', async () => {
  const [alice, bob] = await createPlayers(client, ['Alice', 'Bob']);

  for (let i = 0; i < 6; i++) await head2head(alice, bob);
  await head2head(bob, alice);

  const row = rowFor(await leaderboard(), alice);
  assert.ok(Array.isArray(row.recent_form), 'recent_form should arrive parsed, not as JSON text');
  assert.equal(row.recent_form.length, 5, 'capped at five games');
  assert.equal(row.recent_form[0], 2, 'the most recent game was a loss');
});

test('a player with no finished games is left off entirely', async () => {
  const [alice, bob, ghost] = await createPlayers(client, ['Alice', 'Bob', 'Ghost']);
  await head2head(alice, bob);

  const rows = await leaderboard();
  assert.ok(!rows.some(r => r.id === ghost.id), 'never played, never listed');
  assert.equal(rows.length, 2);
});

test('games from a closed season do not count towards the active one', async () => {
  const [alice, bob] = await createPlayers(client, ['Alice', 'Bob']);

  for (let i = 0; i < MIN_GAMES_FOR_RANKING; i++) await head2head(alice, bob);
  assert.equal(rowFor(await leaderboard(), alice).qualified, 1);

  // Season 1 is the closed one seeded by the baseline migration.
  db.prepare('UPDATE games SET season_id = 1').run();

  const rows = await leaderboard();
  assert.equal(rows.length, 0, 'the active season has no games left');
});
