const { startServer, resetData, createPlayers, playGame } = require('./helpers/server');
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluateAchievements } = require('../routes/achievements');

let server, client, db;

test.before(async () => {
  server = await startServer();
  client = server.client;
  db = server.db;
});
test.after(async () => { await server.close(); });
test.beforeEach(() => { resetData(); });

// Reaching the volume thresholds through the API would mean hundreds of
// requests, so back-fill finished games straight into the schema instead.
// `results` is one entry per game: { score, placement }.
let clock = 0;
function seedFinishedGames(playerId, results) {
  const insertGame = db.prepare(
    "INSERT INTO games (season_id, started_at, ended_at) VALUES (2, ?, ?) RETURNING id"
  );
  const insertPlayer = db.prepare(
    'INSERT INTO game_players (game_id, player_id, final_score, placement, league_points) VALUES (?, ?, ?, ?, ?)'
  );
  for (const { score, placement } of results) {
    // Distinct, lexically sortable timestamps — the streak query orders on
    // ended_at alone, so equal values would make the recent-games window
    // depend on insertion luck.
    const stamp = `2026-01-01 ${String(Math.floor(clock / 3600) % 24).padStart(2, '0')}:${String(Math.floor(clock / 60) % 60).padStart(2, '0')}:${String(clock % 60).padStart(2, '0')}`;
    clock++;
    const { id } = insertGame.get(stamp, stamp);
    insertPlayer.run(id, playerId, score, placement, placement === 1 ? 100 : 0);
  }
}

async function earnedKeys(playerId) {
  const res = await client.get(`/api/achievements/${playerId}`);
  assert.equal(res.status, 200);
  return res.body.filter(a => a.earned).map(a => a.key).sort();
}

function awardCount(playerId) {
  return db.prepare('SELECT COUNT(*) AS c FROM player_achievements WHERE player_id = ?').get(playerId).c;
}

test('the first finished game awards the starter achievements', async () => {
  const [alice, bob] = await createPlayers(client, ['Alice', 'Bob']);

  await playGame(client, {
    playerIds: [alice.id, bob.id],
    scores: { [alice.id]: 30, [bob.id]: 20 },
  });

  // Both played someone new; only Alice won. Two players in the pool and one
  // opponent each, so all_players lands here too.
  assert.deepEqual(await earnedKeys(alice.id), ['all_players', 'first_game', 'first_win']);
  assert.deepEqual(await earnedKeys(bob.id), ['all_players', 'first_game']);
});

test('all_players waits until every registered player has been faced', async () => {
  const [alice, bob, cara] = await createPlayers(client, ['Alice', 'Bob', 'Cara']);

  await playGame(client, {
    playerIds: [alice.id, bob.id],
    scores: { [alice.id]: 30, [bob.id]: 20 },
  });
  assert.ok(!(await earnedKeys(alice.id)).includes('all_players'), 'Cara is still a stranger');

  await playGame(client, {
    playerIds: [alice.id, cara.id],
    scores: { [alice.id]: 10, [cara.id]: 40 },
  });
  assert.ok((await earnedKeys(alice.id)).includes('all_players'));
  assert.ok(!(await earnedKeys(bob.id)).includes('all_players'), 'Bob never met Cara');
});

test('win and game count thresholds fire at their exact totals', async () => {
  const [alice] = await createPlayers(client, ['Alice']);

  seedFinishedGames(alice.id, Array(4).fill({ score: 30, placement: 1 }));
  await evaluateAchievements([alice.id]);
  let keys = await earnedKeys(alice.id);
  assert.ok(keys.includes('first_win'));
  assert.ok(!keys.includes('wins_5'), 'four wins is not five');
  assert.ok(!keys.includes('games_10'));

  seedFinishedGames(alice.id, [{ score: 30, placement: 1 }]);
  await evaluateAchievements([alice.id]);
  keys = await earnedKeys(alice.id);
  assert.ok(keys.includes('wins_5'), 'the fifth win should award it');
  assert.ok(!keys.includes('wins_25'));

  seedFinishedGames(alice.id, Array(5).fill({ score: 30, placement: 2 }));
  await evaluateAchievements([alice.id]);
  keys = await earnedKeys(alice.id);
  assert.ok(keys.includes('games_10'), 'ten games played');
  assert.ok(!keys.includes('games_50'));

  seedFinishedGames(alice.id, Array(20).fill({ score: 30, placement: 1 }));
  seedFinishedGames(alice.id, Array(20).fill({ score: 30, placement: 3 }));
  await evaluateAchievements([alice.id]);
  keys = await earnedKeys(alice.id);
  assert.ok(keys.includes('wins_25'));
  assert.ok(keys.includes('games_50'));
});

test('high score thresholds compare against a player best, not an average', async () => {
  const [alice] = await createPlayers(client, ['Alice']);

  seedFinishedGames(alice.id, [{ score: 59, placement: 1 }]);
  await evaluateAchievements([alice.id]);
  assert.ok(!(await earnedKeys(alice.id)).includes('high_score_60'), '59 is short');

  seedFinishedGames(alice.id, [{ score: 60, placement: 1 }]);
  await evaluateAchievements([alice.id]);
  let keys = await earnedKeys(alice.id);
  assert.ok(keys.includes('high_score_60'));
  assert.ok(!keys.includes('high_score_80'));

  // A weak game afterwards must not take the award back.
  seedFinishedGames(alice.id, [{ score: 5, placement: 4 }, { score: 81, placement: 1 }]);
  await evaluateAchievements([alice.id]);
  keys = await earnedKeys(alice.id);
  assert.ok(keys.includes('high_score_60'));
  assert.ok(keys.includes('high_score_80'));
});

test('the win streak needs three wins in a row, most recent first', async () => {
  const [alice] = await createPlayers(client, ['Alice']);

  seedFinishedGames(alice.id, [
    { score: 30, placement: 1 },
    { score: 30, placement: 1 },
    { score: 20, placement: 2 },
  ]);
  await evaluateAchievements([alice.id]);
  assert.ok(!(await earnedKeys(alice.id)).includes('win_streak_3'), 'the latest game was a loss');

  seedFinishedGames(alice.id, Array(3).fill({ score: 30, placement: 1 }));
  await evaluateAchievements([alice.id]);
  assert.ok((await earnedKeys(alice.id)).includes('win_streak_3'));
});

test('re-running the evaluation awards nothing new and keeps the original date', async () => {
  const [alice, bob] = await createPlayers(client, ['Alice', 'Bob']);
  await playGame(client, {
    playerIds: [alice.id, bob.id],
    scores: { [alice.id]: 70, [bob.id]: 20 },
  });

  const before = await client.get(`/api/achievements/${alice.id}`);
  const countBefore = awardCount(alice.id);
  assert.ok(countBefore > 0, 'the game should have awarded something to re-check');

  await evaluateAchievements([alice.id]);
  await evaluateAchievements([alice.id]);
  await evaluateAchievements([alice.id]);

  assert.equal(awardCount(alice.id), countBefore, 'no duplicate rows');
  const after = await client.get(`/api/achievements/${alice.id}`);
  assert.deepEqual(
    after.body.map(a => [a.key, a.earned, a.earned_at]),
    before.body.map(a => [a.key, a.earned, a.earned_at])
  );
});

test('unfinished games count for nothing', async () => {
  const [alice, bob] = await createPlayers(client, ['Alice', 'Bob']);

  const created = await client.post('/api/games', { player_ids: [alice.id, bob.id] });
  await client.put(`/api/games/${created.body.id}/start`);
  await client.post(`/api/games/${created.body.id}/scores`, {
    player_id: alice.id, score: 90, edit_token: created.body.edit_token,
  });

  await evaluateAchievements([alice.id]);
  assert.deepEqual(await earnedKeys(alice.id), [], 'a live game is not a played game');
});
