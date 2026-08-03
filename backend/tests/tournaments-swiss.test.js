const { startServer, resetData, createPlayers } = require('./helpers/server');
const test = require('node:test');
const assert = require('node:assert/strict');

let server, client;

test.before(async () => {
  server = await startServer();
  client = server.client;
});
test.after(async () => { await server.close(); });
test.beforeEach(() => { resetData(); });

// League points by finishing position, per pod size. Same numbers the scoring
// formula produces; spelled out here so the expectation is independent of it.
const LP_BY_POD_SIZE = {
  2: [100, 0],
  3: [100, 50, 0],
  4: [100, 66.67, 33.33, 0],
};

async function createSwiss(name, players, totalRounds) {
  const res = await client.post('/api/tournaments', {
    name,
    format: 'swiss',
    total_rounds: totalRounds,
    player_ids: players.map(p => p.id),
  });
  assert.equal(res.status, 201);
  return res.body;
}

async function reload(tournamentId) {
  const res = await client.get(`/api/tournaments/${tournamentId}`);
  assert.equal(res.status, 200);
  return res.body;
}

// Play out every pod in a round. `strength` maps player id -> score, so the
// finishing order inside each pod is fixed even though pod membership is not.
// Returns the league points each player earned this round.
async function finishRound(tournamentId, round, strength) {
  const swiss = await reload(tournamentId);
  const pods = swiss.rounds[round - 1].pods;
  const earned = {};

  for (const pod of pods) {
    const game = await client.get(`/api/games/${pod.game_id}`);
    const ids = pod.players.map(p => p.player_id);
    for (const id of ids) {
      const scored = await client.post(`/api/games/${pod.game_id}/scores`, {
        player_id: id, score: strength[id], edit_token: game.body.edit_token,
      });
      assert.equal(scored.status, 200);
    }
    const ended = await client.put(`/api/games/${pod.game_id}/end`);
    assert.equal(ended.status, 200);

    const finishOrder = [...ids].sort((a, b) => strength[b] - strength[a]);
    finishOrder.forEach((id, i) => { earned[id] = LP_BY_POD_SIZE[ids.length][i]; });
  }

  return earned;
}

function strengthsFor(players) {
  // Distinct descending scores, so there are never ties to break.
  return Object.fromEntries(players.map((p, i) => [p.id, 60 - i * 7]));
}

test('a new swiss tournament seats every player in a round-one pod', async () => {
  const players = await createPlayers(client, ['A', 'B', 'C', 'D', 'E', 'F']);
  const swiss = await createSwiss('Six', players, 2);

  assert.equal(swiss.tournament.format, 'swiss');
  assert.equal(swiss.tournament.status, 'active');
  assert.equal(swiss.tournament.current_round, 1);
  assert.equal(swiss.tournament.total_rounds, 2);

  assert.equal(swiss.rounds.length, 1, 'only round one exists up front');
  const pods = swiss.rounds[0].pods;
  assert.deepEqual(pods.map(p => p.players.length), [3, 3], 'six players make two pods of three');

  const seated = pods.flatMap(p => p.players.map(pl => pl.player_id)).sort((a, b) => a - b);
  assert.deepEqual(seated, players.map(p => p.id).sort((a, b) => a - b));

  // Pods are live games, so nothing can advance yet.
  assert.equal(swiss.current_round_complete, false);
  assert.equal(swiss.can_advance, false);
  assert.equal(swiss.can_finish, false);
});

test('seven players split into a pod of three and a pod of four', async () => {
  const players = await createPlayers(client, ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
  const swiss = await createSwiss('Seven', players, 1);

  assert.deepEqual(swiss.rounds[0].pods.map(p => p.players.length), [3, 4]);
});

test('standings total league points across the tournament, best first', async () => {
  const players = await createPlayers(client, ['A', 'B', 'C', 'D', 'E', 'F']);
  const strength = strengthsFor(players);
  const swiss = await createSwiss('Six', players, 2);
  const id = swiss.tournament.id;

  const earned = await finishRound(id, 1, strength);
  const after = await reload(id);

  const actual = after.standings.map(s => [s.player_id, s.total_lp, s.games_played]);
  const expected = Object.entries(earned)
    .map(([playerId, lp]) => [Number(playerId), lp, 1])
    .sort((a, b) => b[1] - a[1] || strength[b[0]] - strength[a[0]]);
  assert.deepEqual(actual, expected);

  // Every pod is finished, so the round is complete and the next one is
  // unlocked — but not the finish, there is still a round to play.
  assert.equal(after.current_round_complete, true);
  assert.equal(after.can_advance, true);
  assert.equal(after.can_finish, false);
});

test('the next round pods players by standing, strongest pod first', async () => {
  const players = await createPlayers(client, ['A', 'B', 'C', 'D', 'E', 'F']);
  const strength = strengthsFor(players);
  const swiss = await createSwiss('Six', players, 2);
  const id = swiss.tournament.id;

  await finishRound(id, 1, strength);
  const standings = (await reload(id)).standings.map(s => s.player_id);

  const next = await client.post(`/api/tournaments/${id}/next-round`, {});
  assert.equal(next.status, 200);
  assert.equal(next.body.tournament.current_round, 2);
  assert.equal(next.body.rounds.length, 2);

  const pods = next.body.rounds[1].pods;
  assert.deepEqual(pods.map(p => p.players.length), [3, 3]);
  const podIds = pods.map(p => p.players.map(pl => pl.player_id).sort((a, b) => a - b));
  assert.deepEqual(podIds[0], standings.slice(0, 3).sort((a, b) => a - b));
  assert.deepEqual(podIds[1], standings.slice(3, 6).sort((a, b) => a - b));

  // Fresh pods are unplayed, so the round is incomplete again.
  assert.equal(next.body.current_round_complete, false);
  assert.equal(next.body.can_advance, false);
});

test('the last round unlocks finishing, and finishing crowns the standings leader', async () => {
  const players = await createPlayers(client, ['A', 'B', 'C', 'D', 'E', 'F']);
  const strength = strengthsFor(players);
  const swiss = await createSwiss('Six', players, 2);
  const id = swiss.tournament.id;

  await finishRound(id, 1, strength);
  await client.post(`/api/tournaments/${id}/next-round`, {});
  await finishRound(id, 2, strength);

  const ready = await reload(id);
  assert.equal(ready.can_advance, false, 'no rounds left to advance to');
  assert.equal(ready.can_finish, true);

  const leader = ready.standings[0].player_id;
  const finished = await client.post(`/api/tournaments/${id}/finish`, {});
  assert.equal(finished.status, 200);
  assert.equal(finished.body.tournament.status, 'complete');
  assert.equal(finished.body.tournament.winner_player_id, leader);
  assert.ok(finished.body.tournament.completed_at);

  // A complete tournament offers no further actions.
  assert.equal(finished.body.can_advance, false);
  assert.equal(finished.body.can_finish, false);
});

test('a round cannot be advanced or the tournament finished with pods still live', async () => {
  const players = await createPlayers(client, ['A', 'B', 'C', 'D', 'E', 'F']);
  const swiss = await createSwiss('Six', players, 2);
  const id = swiss.tournament.id;

  const early = await client.post(`/api/tournaments/${id}/next-round`, {});
  assert.equal(early.status, 409);

  const earlyFinish = await client.post(`/api/tournaments/${id}/finish`, {});
  assert.equal(earlyFinish.status, 409, 'rounds remain unplayed');

  await finishRound(id, 1, strengthsFor(players));
  const stillEarly = await client.post(`/api/tournaments/${id}/finish`, {});
  assert.equal(stillEarly.status, 409, 'round two has not been played');
});

test('advancing past the final round is refused', async () => {
  const players = await createPlayers(client, ['A', 'B', 'C', 'D', 'E']);
  const swiss = await createSwiss('Five', players, 1);
  const id = swiss.tournament.id;

  assert.deepEqual(swiss.rounds[0].pods.map(p => p.players.length), [3, 2]);

  await finishRound(id, 1, strengthsFor(players));
  const beyond = await client.post(`/api/tournaments/${id}/next-round`, {});
  assert.equal(beyond.status, 409);

  const finished = await client.post(`/api/tournaments/${id}/finish`, {});
  assert.equal(finished.status, 200);

  // Once complete it is no longer an active swiss tournament.
  const again = await client.post(`/api/tournaments/${id}/next-round`, {});
  assert.equal(again.status, 409);
});

test('swiss creation rejects a short field, duplicates and a bad round count', async () => {
  const players = await createPlayers(client, ['A', 'B', 'C', 'D', 'E']);
  const ids = players.map(p => p.id);

  const tooFew = await client.post('/api/tournaments', {
    name: 'Four', format: 'swiss', total_rounds: 2, player_ids: ids.slice(0, 4),
  });
  assert.equal(tooFew.status, 400);

  const duped = await client.post('/api/tournaments', {
    name: 'Duped', format: 'swiss', total_rounds: 2, player_ids: [...ids.slice(0, 4), ids[0]],
  });
  assert.equal(duped.status, 400);

  for (const total_rounds of [0, 21, 'many']) {
    const badRounds = await client.post('/api/tournaments', {
      name: 'Rounds', format: 'swiss', total_rounds, player_ids: ids,
    });
    assert.equal(badRounds.status, 400, `total_rounds=${total_rounds} should be rejected`);
  }
});
