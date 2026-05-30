const express = require('express');
const router = express.Router();
const { query, getClient } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { createGameTx } = require('./games');

// --- Bracket helpers ---------------------------------------------------------

function nextPow2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// Standard single-elimination seeding order for a power-of-two bracket.
// size 4 -> [1,4,2,3]; size 8 -> [1,8,4,5,2,7,3,6]. Seeds beyond the player
// count become byes against the top seeds.
function seedOrder(size) {
  let seeds = [1, 2];
  while (seeds.length < size) {
    const sum = seeds.length * 2 + 1;
    const next = [];
    for (const s of seeds) {
      next.push(s);
      next.push(sum - s);
    }
    seeds = next;
  }
  return seeds;
}

// Mark a match's winner and push them into the next match (or finalize the
// tournament). `client` owns the surrounding transaction.
async function advanceWinner(client, match, winnerId) {
  const finalStatus = match.status === 'bye' ? 'bye' : 'complete';
  await client.query(
    'UPDATE tournament_matches SET winner_player_id = $1, status = $2 WHERE id = $3',
    [winnerId, finalStatus, match.id]
  );

  if (match.next_match_id) {
    const col = match.next_slot === 1 ? 'player1_id' : 'player2_id';
    await client.query(
      `UPDATE tournament_matches SET ${col} = $1 WHERE id = $2`,
      [winnerId, match.next_match_id]
    );
    const nm = await client.query('SELECT * FROM tournament_matches WHERE id = $1', [match.next_match_id]);
    const next = nm.rows[0];
    if (next.player1_id && next.player2_id && next.status === 'pending') {
      await client.query("UPDATE tournament_matches SET status = 'ready' WHERE id = $1", [next.id]);
    }
  } else {
    // Final match completed -> crown the tournament champion and snapshot Season 1.
    await client.query(
      "UPDATE tournaments SET status = 'complete', winner_player_id = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2",
      [winnerId, match.tournament_id]
    );
    await snapshotSeason1(client, match.tournament_id);
  }
}

// Capture the current leaderboard #1 as the Season 1 champion (once).
async function snapshotSeason1(client, tournamentId) {
  const existing = await client.query("SELECT id FROM season_snapshots WHERE label = 'Season 1'");
  if (existing.rows.length > 0) return;

  const { rows } = await client.query(`
    SELECT p.id, p.name,
      COUNT(*) AS total_games,
      SUM(gp.league_points) AS total_lp,
      SUM(CASE WHEN gp.placement = 1 THEN 1 ELSE 0 END) AS total_wins,
      AVG(gp.final_score) AS avg_score
    FROM players p
    JOIN game_players gp ON gp.player_id = p.id
    JOIN games g ON gp.game_id = g.id
    WHERE g.ended_at IS NOT NULL
    GROUP BY p.id, p.name
    ORDER BY total_lp DESC, total_wins DESC, avg_score DESC
    LIMIT 1
  `);
  if (rows.length === 0) return;

  const w = rows[0];
  await client.query(
    `INSERT INTO season_snapshots
       (label, player_id, player_name, total_league_points, total_wins, total_games, tournament_id)
     VALUES ('Season 1', $1, $2, $3, $4, $5, $6)`,
    [w.id, w.name, w.total_lp, w.total_wins, w.total_games, tournamentId]
  );
}

// Called by games.js after a game ends: if the game backs a tournament match,
// advance the winner. A tied match (no single placement-1) is parked as 'tie'
// for the operator to resolve manually.
async function maybeAdvanceTournament(gameId) {
  const { rows } = await query('SELECT * FROM tournament_matches WHERE game_id = $1', [gameId]);
  if (rows.length === 0) return;

  const match = rows[0];
  if (match.status === 'complete' || match.status === 'bye') return;

  const { rows: winners } = await query(
    'SELECT player_id FROM game_players WHERE game_id = $1 AND placement = 1',
    [gameId]
  );

  if (winners.length !== 1) {
    await query("UPDATE tournament_matches SET status = 'tie' WHERE id = $1", [match.id]);
    return;
  }

  const winnerId = winners[0].player_id;
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const fresh = await client.query('SELECT * FROM tournament_matches WHERE id = $1', [match.id]);
    await advanceWinner(client, fresh.rows[0], winnerId);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Assemble the full bracket response: tournament row + rounds (array of arrays).
async function getBracket(tournamentId) {
  const tRes = await query(
    `SELECT t.*, w.name AS winner_name
     FROM tournaments t
     LEFT JOIN players w ON t.winner_player_id = w.id
     WHERE t.id = $1`,
    [tournamentId]
  );
  if (tRes.rows.length === 0) return null;

  const mRes = await query(`
    SELECT tm.*,
      p1.name AS player1_name, p1.color AS player1_color,
      p2.name AS player2_name, p2.color AS player2_color,
      w.name AS winner_name,
      g.started_at AS game_started_at, g.ended_at AS game_ended_at
    FROM tournament_matches tm
    LEFT JOIN players p1 ON tm.player1_id = p1.id
    LEFT JOIN players p2 ON tm.player2_id = p2.id
    LEFT JOIN players w ON tm.winner_player_id = w.id
    LEFT JOIN games g ON tm.game_id = g.id
    WHERE tm.tournament_id = $1
    ORDER BY tm.round, tm.match_index
  `, [tournamentId]);

  const rounds = [];
  for (const m of mRes.rows) {
    const r = m.round - 1;
    if (!rounds[r]) rounds[r] = [];
    rounds[r].push(m);
  }

  return { tournament: tRes.rows[0], rounds };
}

// --- Swiss (pods) ------------------------------------------------------------

// Split n players into pods of mostly 3. The leftover is absorbed into a 4
// (or a single 2-pod for n=5) so every count from 5 up works. Larger pods come
// last, i.e. they hold the lower-ranked players when filling top-down.
// 5->[3,2] 6->[3,3] 7->[3,4] 8->[4,4] 9->[3,3,3] 10->[3,3,4] 11->[3,4,4]
function podSizes(n) {
  if (n < 3) return [n];
  const pods = Math.floor(n / 3);
  const rem = n % 3;
  const sizes = new Array(pods).fill(3);
  if (rem === 1) {
    sizes[pods - 1] += 1;
  } else if (rem === 2) {
    if (pods >= 2) { sizes[pods - 1] += 1; sizes[pods - 2] += 1; }
    else sizes.push(2);
  }
  return sizes;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Create a round's pods. Each pod is a normal game (started immediately) linked
// back via tournament_games. `orderedIds` is consumed top-down into the pods.
async function createSwissPodsTx(client, tournamentId, round, orderedIds, buildId) {
  const sizes = podSizes(orderedIds.length);
  let cursor = 0;
  for (let i = 0; i < sizes.length; i++) {
    const podIds = orderedIds.slice(cursor, cursor + sizes[i]);
    cursor += sizes[i];
    const game = await createGameTx(client, { build_id: buildId || null, player_ids: podIds });
    await client.query('UPDATE games SET started_at = CURRENT_TIMESTAMP WHERE id = $1', [game.id]);
    await client.query(
      'INSERT INTO tournament_games (tournament_id, round, pod_index, game_id) VALUES ($1, $2, $3, $4)',
      [tournamentId, round, i, game.id]
    );
  }
}

// Standings: SUM(league_points) over the tournament's games. Only ended pods
// have league_points, so in-progress pods don't count yet. Ordered best-first.
async function getStandings(tournamentId, client = null) {
  const run = client ? client.query.bind(client) : query;
  const { rows } = await run(`
    SELECT p.id AS player_id, p.name, p.color,
      COALESCE(SUM(gp.league_points), 0) AS total_lp,
      COALESCE(SUM(CASE WHEN gp.placement = 1 THEN 1 ELSE 0 END), 0) AS wins,
      COUNT(gp.id) FILTER (WHERE g.ended_at IS NOT NULL) AS games_played,
      COALESCE(AVG(gp.final_score) FILTER (WHERE g.ended_at IS NOT NULL), 0) AS avg_score
    FROM tournament_players tp
    JOIN players p ON p.id = tp.player_id
    LEFT JOIN tournament_games tg ON tg.tournament_id = tp.tournament_id
    LEFT JOIN game_players gp ON gp.game_id = tg.game_id AND gp.player_id = tp.player_id
    LEFT JOIN games g ON g.id = tg.game_id
    WHERE tp.tournament_id = $1
    GROUP BY p.id, p.name, p.color
    ORDER BY total_lp DESC, wins DESC, avg_score DESC, p.name ASC
  `, [tournamentId]);
  return rows;
}

// Assemble the full swiss response: tournament + standings + per-round pods.
async function getSwiss(tournamentId) {
  const tRes = await query(
    `SELECT t.*, w.name AS winner_name
     FROM tournaments t
     LEFT JOIN players w ON t.winner_player_id = w.id
     WHERE t.id = $1`,
    [tournamentId]
  );
  if (tRes.rows.length === 0) return null;
  const tournament = tRes.rows[0];

  const standings = await getStandings(tournamentId);

  const podRes = await query(`
    SELECT tg.round, tg.pod_index, tg.game_id, g.ended_at, g.started_at
    FROM tournament_games tg
    JOIN games g ON g.id = tg.game_id
    WHERE tg.tournament_id = $1
    ORDER BY tg.round, tg.pod_index
  `, [tournamentId]);

  const gameIds = podRes.rows.map(r => r.game_id);
  let playersByGame = {};
  if (gameIds.length) {
    const ppRes = await query(`
      SELECT gp.game_id, gp.player_id, p.name, p.color,
        gp.final_score, gp.placement, gp.league_points
      FROM game_players gp
      JOIN players p ON p.id = gp.player_id
      WHERE gp.game_id = ANY($1)
      ORDER BY gp.placement NULLS LAST, gp.final_score DESC
    `, [gameIds]);
    for (const row of ppRes.rows) {
      (playersByGame[row.game_id] ||= []).push(row);
    }
  }

  const rounds = [];
  let currentRoundComplete = tournament.current_round > 0;
  for (const pod of podRes.rows) {
    const r = pod.round - 1;
    if (!rounds[r]) rounds[r] = { round: pod.round, pods: [] };
    const ended = pod.ended_at !== null;
    if (pod.round === tournament.current_round && !ended) currentRoundComplete = false;
    rounds[r].pods.push({
      pod_index: pod.pod_index,
      game_id: pod.game_id,
      ended,
      players: playersByGame[pod.game_id] || [],
    });
  }

  const active = tournament.status === 'active';
  return {
    tournament,
    standings,
    rounds,
    current_round_complete: currentRoundComplete,
    can_advance: active && currentRoundComplete && tournament.current_round < tournament.total_rounds,
    can_finish: active && currentRoundComplete && tournament.current_round >= tournament.total_rounds,
  };
}

// --- Routes ------------------------------------------------------------------

// GET /api/tournaments - list tournaments
router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT t.*, w.name AS winner_name
       FROM tournaments t
       LEFT JOIN players w ON t.winner_player_id = w.id
       ORDER BY t.created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/tournaments/:id - full bracket (single-elim) or standings (swiss)
router.get('/:id', async (req, res, next) => {
  try {
    const fRes = await query('SELECT format FROM tournaments WHERE id = $1', [req.params.id]);
    if (fRes.rows.length === 0) return res.status(404).json({ error: 'Tournament not found' });

    if (fRes.rows[0].format === 'swiss') {
      const data = await getSwiss(req.params.id);
      return res.json(data);
    }
    const bracket = await getBracket(req.params.id);
    if (!bracket) return res.status(404).json({ error: 'Tournament not found' });
    res.json(bracket);
  } catch (error) {
    next(error);
  }
});

// POST /api/tournaments - create a tournament and generate the bracket
router.post('/', async (req, res, next) => {
  const client = await getClient();
  try {
    const { name, player_ids, best_of, format, total_rounds, build_id } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Tournament name is required' });
    }

    // ----- Swiss (pods) -----
    if (format === 'swiss') {
      if (!Array.isArray(player_ids) || player_ids.length < 5) {
        return res.status(400).json({ error: 'A Swiss tournament needs at least 5 players' });
      }
      if (new Set(player_ids).size !== player_ids.length) {
        return res.status(400).json({ error: 'Duplicate players are not allowed' });
      }
      const rounds = parseInt(total_rounds, 10);
      if (!rounds || rounds < 1 || rounds > 20) {
        return res.status(400).json({ error: 'Rounds must be between 1 and 20' });
      }

      await client.query('BEGIN');
      const tRes = await client.query(
        `INSERT INTO tournaments (name, status, best_of, format, total_rounds, current_round)
         VALUES ($1, 'active', 1, 'swiss', $2, 1) RETURNING *`,
        [name.trim(), rounds]
      );
      const tournament = tRes.rows[0];
      for (let i = 0; i < player_ids.length; i++) {
        await client.query(
          'INSERT INTO tournament_players (tournament_id, player_id, seed) VALUES ($1, $2, $3)',
          [tournament.id, player_ids[i], i + 1]
        );
      }
      // Round 1 pods are random.
      await createSwissPodsTx(client, tournament.id, 1, shuffle([...player_ids]), build_id || null);
      await client.query('COMMIT');

      const data = await getSwiss(tournament.id);
      return res.status(201).json(data);
    }

    if (!Array.isArray(player_ids) || player_ids.length < 2) {
      return res.status(400).json({ error: 'At least 2 players are required' });
    }
    const uniqueIds = [...new Set(player_ids)];
    if (uniqueIds.length !== player_ids.length) {
      return res.status(400).json({ error: 'Duplicate players are not allowed' });
    }

    const n = player_ids.length;
    const size = nextPow2(n);
    const totalRounds = Math.log2(size);
    const order = seedOrder(size);
    const slotPlayers = order.map(seed => (seed <= n ? player_ids[seed - 1] : null));

    await client.query('BEGIN');

    const tRes = await client.query(
      'INSERT INTO tournaments (name, status, best_of) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), 'pending', best_of && best_of > 0 ? best_of : 1]
    );
    const tournament = tRes.rows[0];

    for (let i = 0; i < n; i++) {
      await client.query(
        'INSERT INTO tournament_players (tournament_id, player_id, seed) VALUES ($1, $2, $3)',
        [tournament.id, player_ids[i], i + 1]
      );
    }

    // Create all matches; remember their ids by round/index.
    const matchIds = {};
    for (let r = 1; r <= totalRounds; r++) {
      const numMatches = size / Math.pow(2, r);
      for (let m = 0; m < numMatches; m++) {
        let p1 = null, p2 = null, status = 'pending';
        if (r === 1) {
          p1 = slotPlayers[2 * m];
          p2 = slotPlayers[2 * m + 1];
          status = (p1 && p2) ? 'ready' : 'bye';
        }
        const ins = await client.query(
          `INSERT INTO tournament_matches
             (tournament_id, round, match_index, player1_id, player2_id, status)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [tournament.id, r, m, p1, p2, status]
        );
        matchIds[`${r}_${m}`] = ins.rows[0].id;
      }
    }

    // Link each match to its parent (second pass, since parents are created last).
    for (let r = 1; r < totalRounds; r++) {
      const numMatches = size / Math.pow(2, r);
      for (let m = 0; m < numMatches; m++) {
        const nextId = matchIds[`${r + 1}_${Math.floor(m / 2)}`];
        const nextSlot = (m % 2 === 0) ? 1 : 2;
        await client.query(
          'UPDATE tournament_matches SET next_match_id = $1, next_slot = $2 WHERE id = $3',
          [nextId, nextSlot, matchIds[`${r}_${m}`]]
        );
      }
    }

    // Auto-resolve first-round byes and propagate the present player onward.
    for (let m = 0; m < size / 2; m++) {
      const mr = await client.query('SELECT * FROM tournament_matches WHERE id = $1', [matchIds[`1_${m}`]]);
      const match = mr.rows[0];
      if (match.status === 'bye') {
        const winner = match.player1_id || match.player2_id;
        await advanceWinner(client, match, winner);
      }
    }

    await client.query('COMMIT');

    const bracket = await getBracket(tournament.id);
    res.status(201).json(bracket);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// POST /api/tournaments/:id/matches/:matchId/play - create the backing game
router.post('/:id/matches/:matchId/play', async (req, res, next) => {
  const client = await getClient();
  try {
    const { id, matchId } = req.params;
    const { build_id } = req.body || {};

    await client.query('BEGIN');

    const mr = await client.query(
      'SELECT * FROM tournament_matches WHERE id = $1 AND tournament_id = $2',
      [matchId, id]
    );
    if (mr.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Match not found' });
    }
    const match = mr.rows[0];
    if (match.game_id) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Match already has a game' });
    }
    if (match.status !== 'ready' || !match.player1_id || !match.player2_id) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Match is not ready to play' });
    }

    const game = await createGameTx(client, {
      build_id: build_id || null,
      player_ids: [match.player1_id, match.player2_id],
    });
    await client.query('UPDATE games SET started_at = CURRENT_TIMESTAMP WHERE id = $1', [game.id]);
    await client.query(
      "UPDATE tournament_matches SET game_id = $1, status = 'in_progress' WHERE id = $2",
      [game.id, match.id]
    );
    await client.query("UPDATE tournaments SET status = 'active' WHERE id = $1 AND status = 'pending'", [id]);

    await client.query('COMMIT');
    res.json({ game_id: game.id });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// POST /api/tournaments/:id/matches/:matchId/winner - resolve a tied match
router.post('/:id/matches/:matchId/winner', async (req, res, next) => {
  const client = await getClient();
  try {
    const { id, matchId } = req.params;
    const { player_id } = req.body || {};

    await client.query('BEGIN');
    const mr = await client.query(
      'SELECT * FROM tournament_matches WHERE id = $1 AND tournament_id = $2',
      [matchId, id]
    );
    if (mr.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Match not found' });
    }
    const match = mr.rows[0];
    if (match.status === 'complete' || match.status === 'bye') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Match is already resolved' });
    }
    if (player_id !== match.player1_id && player_id !== match.player2_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Winner must be one of the match players' });
    }

    await advanceWinner(client, match, player_id);
    await client.query('COMMIT');

    const bracket = await getBracket(id);
    res.json(bracket);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// POST /api/tournaments/:id/next-round - generate the next swiss round's pods
router.post('/:id/next-round', async (req, res, next) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const { build_id } = req.body || {};

    await client.query('BEGIN');
    const tRes = await client.query(
      "SELECT * FROM tournaments WHERE id = $1 FOR UPDATE", [id]
    );
    if (tRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Tournament not found' });
    }
    const t = tRes.rows[0];
    if (t.format !== 'swiss' || t.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Tournament is not an active Swiss tournament' });
    }
    if (t.current_round >= t.total_rounds) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'All rounds have been played — finish the tournament' });
    }

    const { rows: unfinished } = await client.query(`
      SELECT 1 FROM tournament_games tg JOIN games g ON g.id = tg.game_id
      WHERE tg.tournament_id = $1 AND tg.round = $2 AND g.ended_at IS NULL LIMIT 1
    `, [id, t.current_round]);
    if (unfinished.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Finish every pod in the current round first' });
    }

    const standings = await getStandings(id, client);
    const orderedIds = standings.map(s => s.player_id);
    const round = t.current_round + 1;
    await createSwissPodsTx(client, id, round, orderedIds, build_id || null);
    await client.query('UPDATE tournaments SET current_round = $1 WHERE id = $2', [round, id]);
    await client.query('COMMIT');

    res.json(await getSwiss(id));
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// POST /api/tournaments/:id/finish - crown the swiss winner after the last round
router.post('/:id/finish', async (req, res, next) => {
  const client = await getClient();
  try {
    const { id } = req.params;

    await client.query('BEGIN');
    const tRes = await client.query("SELECT * FROM tournaments WHERE id = $1 FOR UPDATE", [id]);
    if (tRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Tournament not found' });
    }
    const t = tRes.rows[0];
    if (t.format !== 'swiss' || t.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Tournament is not an active Swiss tournament' });
    }
    if (t.current_round < t.total_rounds) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Play all rounds before finishing' });
    }

    const { rows: unfinished } = await client.query(`
      SELECT 1 FROM tournament_games tg JOIN games g ON g.id = tg.game_id
      WHERE tg.tournament_id = $1 AND g.ended_at IS NULL LIMIT 1
    `, [id]);
    if (unfinished.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Finish every pod before crowning a winner' });
    }

    const standings = await getStandings(id, client);
    const winnerId = standings.length ? standings[0].player_id : null;
    await client.query(
      "UPDATE tournaments SET status = 'complete', winner_player_id = $1, completed_at = CURRENT_TIMESTAMP WHERE id = $2",
      [winnerId, id]
    );
    await client.query('COMMIT');

    res.json(await getSwiss(id));
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// POST /api/tournaments/:id/snapshot-season - manually capture the Season 1 champion
router.post('/:id/snapshot-season', requireAuth, async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await snapshotSeason1(client, req.params.id);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// DELETE /api/tournaments/:id - remove a tournament (backing games are kept)
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query('DELETE FROM tournaments WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
module.exports.maybeAdvanceTournament = maybeAdvanceTournament;
