const express = require('express');
const router = express.Router();
const { query, getClient } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { createGameTx } = require('./games');

function nextPow2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

function seedOrder(size) {
  let seeds = [1, 2];
  while (seeds.length < size) {
    const sum = seeds.length * 2 + 1;
    const next = [];
    for (const s of seeds) { next.push(s); next.push(sum - s); }
    seeds = next;
  }
  return seeds;
}

async function advanceWinner(client, match, winnerId) {
  const finalStatus = match.status === 'bye' ? 'bye' : 'complete';
  await client.query(
    'UPDATE tournament_matches SET winner_player_id = ?, status = ? WHERE id = ?',
    [winnerId, finalStatus, match.id]
  );

  if (match.next_match_id) {
    const col = match.next_slot === 1 ? 'player1_id' : 'player2_id';
    await client.query(
      `UPDATE tournament_matches SET ${col} = ? WHERE id = ?`,
      [winnerId, match.next_match_id]
    );
    const nm = await client.query('SELECT * FROM tournament_matches WHERE id = ?', [match.next_match_id]);
    const next = nm.rows[0];
    if (next && next.player1_id && next.player2_id && next.status === 'pending') {
      await client.query("UPDATE tournament_matches SET status = 'ready' WHERE id = ?", [next.id]);
    }
  } else {
    await client.query(
      "UPDATE tournaments SET status = 'complete', winner_player_id = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?",
      [winnerId, match.tournament_id]
    );
    await snapshotSeason(client, match.tournament_id);
  }
}

async function snapshotSeason(client, tournamentId) {
  const existing = await client.query("SELECT id FROM season_snapshots WHERE label = 'Season 1'");
  if (existing.rows.length > 0) return;

  const { rows } = await client.query(`
    SELECT p.id, p.name,
      COUNT(*) AS total_games,
      SUM(gp.league_points) AS total_lp,
      SUM(CASE WHEN gp.placement = 1 THEN 1 ELSE 0 END) AS total_wins
    FROM players p
    JOIN game_players gp ON gp.player_id = p.id
    JOIN games g ON gp.game_id = g.id
    WHERE g.ended_at IS NOT NULL
    GROUP BY p.id, p.name
    ORDER BY CAST(SUM(gp.league_points) AS REAL) / COUNT(*) DESC, total_wins DESC
    LIMIT 1
  `);
  if (rows.length === 0) return;

  const w = rows[0];
  await client.query(
    `INSERT INTO season_snapshots
       (label, player_id, player_name, total_league_points, total_wins, total_games, tournament_id)
     VALUES ('Season 1', ?, ?, ?, ?, ?, ?)`,
    [w.id, w.name, w.total_lp, w.total_wins, w.total_games, tournamentId]
  );
}

async function maybeAdvanceTournament(gameId) {
  const { rows } = await query('SELECT * FROM tournament_matches WHERE game_id = ?', [gameId]);
  if (rows.length === 0) return;

  const match = rows[0];
  if (match.status === 'complete' || match.status === 'bye') return;

  const { rows: winners } = await query(
    'SELECT player_id FROM game_players WHERE game_id = ? AND placement = 1',
    [gameId]
  );

  if (winners.length !== 1) {
    await query("UPDATE tournament_matches SET status = 'tie' WHERE id = ?", [match.id]);
    return;
  }

  const winnerId = winners[0].player_id;
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const fresh = await client.query('SELECT * FROM tournament_matches WHERE id = ?', [match.id]);
    await advanceWinner(client, fresh.rows[0], winnerId);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getBracket(tournamentId) {
  const tRes = await query(
    `SELECT t.*, w.name AS winner_name
     FROM tournaments t
     LEFT JOIN players w ON t.winner_player_id = w.id
     WHERE t.id = ?`,
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
    WHERE tm.tournament_id = ?
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

router.get('/:id', async (req, res, next) => {
  try {
    const bracket = await getBracket(req.params.id);
    if (!bracket) return res.status(404).json({ error: 'Tournament not found' });
    res.json(bracket);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  const client = await getClient();
  try {
    const { name, player_ids, best_of } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Tournament name is required' });
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
      'INSERT INTO tournaments (name, status, best_of) VALUES (?, ?, ?) RETURNING *',
      [name.trim(), 'pending', best_of && best_of > 0 ? best_of : 1]
    );
    const tournament = tRes.rows[0];

    for (let i = 0; i < n; i++) {
      await client.query(
        'INSERT INTO tournament_players (tournament_id, player_id, seed) VALUES (?, ?, ?)',
        [tournament.id, player_ids[i], i + 1]
      );
    }

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
           VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
          [tournament.id, r, m, p1, p2, status]
        );
        matchIds[`${r}_${m}`] = ins.rows[0].id;
      }
    }

    for (let r = 1; r < totalRounds; r++) {
      const numMatches = size / Math.pow(2, r);
      for (let m = 0; m < numMatches; m++) {
        const nextId = matchIds[`${r + 1}_${Math.floor(m / 2)}`];
        const nextSlot = (m % 2 === 0) ? 1 : 2;
        await client.query(
          'UPDATE tournament_matches SET next_match_id = ?, next_slot = ? WHERE id = ?',
          [nextId, nextSlot, matchIds[`${r}_${m}`]]
        );
      }
    }

    for (let m = 0; m < size / 2; m++) {
      const mr = await client.query('SELECT * FROM tournament_matches WHERE id = ?', [matchIds[`1_${m}`]]);
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

router.post('/:id/matches/:matchId/play', async (req, res, next) => {
  const client = await getClient();
  try {
    const { id, matchId } = req.params;
    const { build_id } = req.body || {};

    await client.query('BEGIN');

    const mr = await client.query(
      'SELECT * FROM tournament_matches WHERE id = ? AND tournament_id = ?',
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
    await client.query('UPDATE games SET started_at = CURRENT_TIMESTAMP WHERE id = ?', [game.id]);
    await client.query(
      "UPDATE tournament_matches SET game_id = ?, status = 'in_progress' WHERE id = ?",
      [game.id, match.id]
    );
    await client.query("UPDATE tournaments SET status = 'active' WHERE id = ? AND status = 'pending'", [id]);

    await client.query('COMMIT');
    res.json({ game_id: game.id });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

router.post('/:id/matches/:matchId/winner', async (req, res, next) => {
  const client = await getClient();
  try {
    const { id, matchId } = req.params;
    const { player_id } = req.body || {};

    await client.query('BEGIN');
    const mr = await client.query(
      'SELECT * FROM tournament_matches WHERE id = ? AND tournament_id = ?',
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

router.post('/:id/snapshot-season', requireAuth, async (req, res, next) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    await snapshotSeason(client, req.params.id);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query('DELETE FROM tournaments WHERE id = ? RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tournament not found' });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
module.exports.maybeAdvanceTournament = maybeAdvanceTournament;
