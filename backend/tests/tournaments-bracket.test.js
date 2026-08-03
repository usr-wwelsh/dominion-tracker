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

async function createBracket(name, players) {
  const res = await client.post('/api/tournaments', {
    name,
    player_ids: players.map(p => p.id),
  });
  assert.equal(res.status, 201);
  return res.body;
}

function match(bracket, round, index) {
  return bracket.rounds[round - 1].find(m => m.match_index === index);
}

async function reload(tournamentId) {
  const res = await client.get(`/api/tournaments/${tournamentId}`);
  assert.equal(res.status, 200);
  return res.body;
}

test('four players are seeded 1v4 and 2v3', async () => {
  const players = await createPlayers(client, ['One', 'Two', 'Three', 'Four']);
  const [p1, p2, p3, p4] = players;

  const bracket = await createBracket('Quads', players);

  assert.equal(bracket.rounds.length, 2, 'four players make a two-round bracket');
  assert.deepEqual(
    [match(bracket, 1, 0).player1_id, match(bracket, 1, 0).player2_id],
    [p1.id, p4.id]
  );
  assert.deepEqual(
    [match(bracket, 1, 1).player1_id, match(bracket, 1, 1).player2_id],
    [p2.id, p3.id]
  );
  // No byes with a power-of-two field, so both openers are playable at once.
  assert.equal(match(bracket, 1, 0).status, 'ready');
  assert.equal(match(bracket, 1, 1).status, 'ready');
  assert.equal(match(bracket, 2, 0).status, 'pending');
});

test('five players give byes to the top seeds and pad the bracket to eight', async () => {
  const players = await createPlayers(client, ['One', 'Two', 'Three', 'Four', 'Five']);
  const [p1, p2, p3, p4, p5] = players;

  const bracket = await createBracket('Fives', players);

  assert.equal(bracket.rounds.length, 3, 'five players round up to an eight-slot bracket');

  // Seed order for eight slots is 1,8,4,5,2,7,3,6 — seeds 6-8 are empty, so
  // the players sitting opposite them walk through.
  assert.equal(match(bracket, 1, 0).status, 'bye');
  assert.equal(match(bracket, 1, 0).winner_player_id, p1.id);
  assert.equal(match(bracket, 1, 1).status, 'ready');
  assert.deepEqual(
    [match(bracket, 1, 1).player1_id, match(bracket, 1, 1).player2_id],
    [p4.id, p5.id]
  );
  assert.equal(match(bracket, 1, 2).winner_player_id, p2.id);
  assert.equal(match(bracket, 1, 3).winner_player_id, p3.id);

  // A bye advances its player immediately. The semifinal fed by two byes has
  // both slots filled and is ready; the one still waiting on 4v5 is not.
  const semiWithByes = match(bracket, 2, 1);
  assert.deepEqual([semiWithByes.player1_id, semiWithByes.player2_id], [p2.id, p3.id]);
  assert.equal(semiWithByes.status, 'ready');

  const semiWaiting = match(bracket, 2, 0);
  assert.equal(semiWaiting.player1_id, p1.id);
  assert.equal(semiWaiting.player2_id, null);
  assert.equal(semiWaiting.status, 'pending');
});

test('reporting a winner fills the next slot and readies the match once both arrive', async () => {
  const players = await createPlayers(client, ['One', 'Two', 'Three', 'Four']);
  const [p1, p2, p3, p4] = players;

  const bracket = await createBracket('Quads', players);
  const tournamentId = bracket.tournament.id;

  const afterFirst = await client.post(
    `/api/tournaments/${tournamentId}/matches/${match(bracket, 1, 0).id}/winner`,
    { player_id: p1.id }
  );
  assert.equal(afterFirst.status, 200);
  assert.equal(match(afterFirst.body, 1, 0).status, 'complete');
  assert.equal(match(afterFirst.body, 2, 0).player1_id, p1.id);
  assert.equal(match(afterFirst.body, 2, 0).status, 'pending', 'one slot filled is not ready');

  const afterSecond = await client.post(
    `/api/tournaments/${tournamentId}/matches/${match(bracket, 1, 1).id}/winner`,
    { player_id: p3.id }
  );
  const final = match(afterSecond.body, 2, 0);
  assert.deepEqual([final.player1_id, final.player2_id], [p1.id, p3.id]);
  assert.equal(final.status, 'ready');

  const afterFinal = await client.post(
    `/api/tournaments/${tournamentId}/matches/${final.id}/winner`,
    { player_id: p3.id }
  );
  assert.equal(afterFinal.body.tournament.status, 'complete');
  assert.equal(afterFinal.body.tournament.winner_player_id, p3.id);
  assert.ok(afterFinal.body.tournament.completed_at);

  // Sanity: p2 and p4 lost in round one and never appear past it.
  const finished = await reload(tournamentId);
  assert.equal(match(finished, 2, 0).winner_player_id, p3.id);
  for (const loser of [p2.id, p4.id]) {
    assert.ok(!finished.rounds[1].some(m => m.winner_player_id === loser));
  }
});

test('a resolved match cannot be re-reported and only its own players can win it', async () => {
  const players = await createPlayers(client, ['One', 'Two', 'Three', 'Four']);
  const [p1, p2] = players;

  const bracket = await createBracket('Quads', players);
  const tournamentId = bracket.tournament.id;
  const opener = match(bracket, 1, 0); // p1 vs p4

  const outsider = await client.post(
    `/api/tournaments/${tournamentId}/matches/${opener.id}/winner`,
    { player_id: p2.id }
  );
  assert.equal(outsider.status, 400);

  await client.post(`/api/tournaments/${tournamentId}/matches/${opener.id}/winner`, { player_id: p1.id });
  const again = await client.post(
    `/api/tournaments/${tournamentId}/matches/${opener.id}/winner`,
    { player_id: p1.id }
  );
  assert.equal(again.status, 409);

  // A bye is already resolved too, so it is not replayable.
  const withByes = await createBracket('Fives', [...players, ...(await createPlayers(client, ['Five']))]);
  const bye = match(withByes, 1, 0);
  const replayBye = await client.post(
    `/api/tournaments/${withByes.tournament.id}/matches/${bye.id}/play`,
    {}
  );
  assert.equal(replayBye.status, 409);
});

test('finishing a match game advances the winner through the bracket', async () => {
  const players = await createPlayers(client, ['One', 'Two', 'Three', 'Four']);
  const [p1, , , p4] = players;

  const bracket = await createBracket('Quads', players);
  const tournamentId = bracket.tournament.id;
  const opener = match(bracket, 1, 0); // p1 vs p4

  const played = await client.post(`/api/tournaments/${tournamentId}/matches/${opener.id}/play`, {});
  assert.equal(played.status, 200);
  const gameId = played.body.game_id;

  const inProgress = await reload(tournamentId);
  assert.equal(match(inProgress, 1, 0).status, 'in_progress');
  assert.equal(match(inProgress, 1, 0).game_id, gameId);

  const game = await client.get(`/api/games/${gameId}`);
  await client.post(`/api/games/${gameId}/scores`, {
    player_id: p4.id, score: 40, edit_token: game.body.edit_token,
  });
  await client.post(`/api/games/${gameId}/scores`, {
    player_id: p1.id, score: 20, edit_token: game.body.edit_token,
  });
  await client.put(`/api/games/${gameId}/end`);

  const advanced = await reload(tournamentId);
  assert.equal(match(advanced, 1, 0).status, 'complete');
  assert.equal(match(advanced, 1, 0).winner_player_id, p4.id);
  assert.equal(match(advanced, 2, 0).player1_id, p4.id);
});

test('a drawn match game is flagged rather than advancing an arbitrary player', async () => {
  const players = await createPlayers(client, ['One', 'Two', 'Three', 'Four']);
  const [p1, , , p4] = players;

  const bracket = await createBracket('Quads', players);
  const tournamentId = bracket.tournament.id;
  const opener = match(bracket, 1, 0);

  const played = await client.post(`/api/tournaments/${tournamentId}/matches/${opener.id}/play`, {});
  const gameId = played.body.game_id;
  const game = await client.get(`/api/games/${gameId}`);

  for (const id of [p1.id, p4.id]) {
    await client.post(`/api/games/${gameId}/scores`, {
      player_id: id, score: 30, edit_token: game.body.edit_token,
    });
  }
  await client.put(`/api/games/${gameId}/end`);

  const after = await reload(tournamentId);
  assert.equal(match(after, 1, 0).status, 'tie');
  assert.equal(match(after, 1, 0).winner_player_id, null);
  assert.equal(match(after, 2, 0).player1_id, null, 'nobody should have advanced');
});

test('a bracket rejects fewer than two players and duplicate entries', async () => {
  const players = await createPlayers(client, ['One', 'Two']);

  const tooFew = await client.post('/api/tournaments', { name: 'Solo', player_ids: [players[0].id] });
  assert.equal(tooFew.status, 400);

  const duped = await client.post('/api/tournaments', {
    name: 'Doubled',
    player_ids: [players[0].id, players[1].id, players[0].id],
  });
  assert.equal(duped.status, 400);

  const unnamed = await client.post('/api/tournaments', {
    name: '  ',
    player_ids: players.map(p => p.id),
  });
  assert.equal(unnamed.status, 400);
});
