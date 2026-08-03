const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { query, getClient } = require('../db');
const { requireAuth } = require('../middleware/auth');
const EDIT_TOKEN_WORDS = require('../wordlist');

// Per-game SSE subscriber sets: gameId -> Set<res>
const sseClients = new Map();

function sseNotify(gameId, event, data) {
  const clients = sseClients.get(Number(gameId));
  if (!clients || clients.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch {}
  }
}

function parsePlayers(row) {
  if (row && typeof row.players === 'string') {
    row.players = JSON.parse(row.players);
  }
  return row;
}

// GET /api/games  (?live=1 returns in-progress games instead)
router.get('/', async (req, res, next) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit)  || 20, 100);
    const offset = parseInt(req.query.offset) || 0;
    const live   = req.query.live === '1';

    const whereClause = live
      ? 'g.started_at IS NOT NULL AND g.ended_at IS NULL'
      : 'g.ended_at IS NOT NULL';

    const result = await query(`
      SELECT g.*, b.nickname AS build_nickname,
        (SELECT json_group_array(json_object(
          'player_id', gp.player_id,
          'player_name', p.name,
          'player_color', p.color,
          'avatar_card', gp.avatar_card,
          'final_score', gp.final_score,
          'placement', gp.placement,
          'league_points', gp.league_points
        ))
        FROM (
          SELECT gp2.player_id, p2.name, p2.color, pp.avatar_card, gp2.final_score, gp2.placement, gp2.league_points
          FROM game_players gp2
          JOIN players p2 ON gp2.player_id = p2.id
          LEFT JOIN player_profiles pp ON pp.player_id = p2.id
          WHERE gp2.game_id = g.id
          ORDER BY gp2.placement
        ) AS gp JOIN players p ON gp.player_id = p.id) AS players
      FROM games g
      LEFT JOIN builds b ON g.build_id = b.id
      WHERE ${whereClause}
      ORDER BY g.started_at DESC, g.id DESC
      LIMIT ? OFFSET ?
    `, [limit + 1, offset]);

    const hasMore = result.rows.length > limit;
    const games = (hasMore ? result.rows.slice(0, limit) : result.rows).map(parsePlayers);
    res.json({ games, hasMore });
  } catch (error) {
    next(error);
  }
});

// POST /api/games
router.post('/', async (req, res, next) => {
  const client = await getClient();
  try {
    const { build_id, player_ids } = req.body;

    if (!player_ids || !Array.isArray(player_ids) || player_ids.length === 0) {
      return res.status(400).json({ error: 'Player IDs array is required' });
    }

    await client.query('BEGIN');
    const game = await createGameTx(client, { build_id, player_ids });
    await client.query('COMMIT');

    const completeGame = await query(`
      SELECT g.*,
        (SELECT json_group_array(json_object(
          'player_id', gp.player_id,
          'player_name', p.name,
          'final_score', gp.final_score
        ))
        FROM game_players gp
        JOIN players p ON gp.player_id = p.id
        WHERE gp.game_id = g.id) AS players
      FROM games g
      WHERE g.id = ?
    `, [game.id]);

    res.status(201).json(parsePlayers(completeGame.rows[0]));
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// PUT /api/games/:id/start
router.put('/:id/start', async (req, res, next) => {
  try {
    const result = await query(
      'UPDATE games SET started_at = CURRENT_TIMESTAMP WHERE id = ? RETURNING *',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Game not found' });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// PUT /api/games/:id/end
router.put('/:id/end', async (req, res, next) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    await client.query('BEGIN');

    const gameResult = await client.query('SELECT * FROM games WHERE id = ?', [id]);
    if (gameResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = gameResult.rows[0];
    let duration = null;
    if (game.started_at) {
      // SQLite CURRENT_TIMESTAMP is UTC but lacks the 'Z' suffix; add it to avoid
      // timezone misinterpretation in Date.parse().
      const ts = game.started_at.includes('T') ? game.started_at
        : game.started_at.replace(' ', 'T') + 'Z';
      duration = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
      // Cap at 4 hours so a stale game ended long after it started can't award absurd XP
      duration = Math.min(duration, 14400);
    }

    await client.query(
      'UPDATE games SET ended_at = CURRENT_TIMESTAMP, duration = ? WHERE id = ?',
      [duration, id]
    );

    const playersResult = await client.query(
      `SELECT gp.*, p.name AS player_name
       FROM game_players gp
       JOIN players p ON gp.player_id = p.id
       WHERE gp.game_id = ?
       ORDER BY gp.final_score DESC`,
      [id]
    );

    const players = playersResult.rows;
    let currentPlacement = 1;
    let previousScore = null;
    let group = [];

    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      if (previousScore !== null && player.final_score !== previousScore) {
        const avgPoints = calculateAverageLeaguePoints(currentPlacement, group.length, players.length);
        for (const p of group) {
          await client.query(
            'UPDATE game_players SET placement = ?, league_points = ? WHERE id = ?',
            [currentPlacement, avgPoints, p.id]
          );
        }
        currentPlacement += group.length;
        group = [];
      }
      group.push(player);
      previousScore = player.final_score;
    }
    if (group.length > 0) {
      const avgPoints = calculateAverageLeaguePoints(currentPlacement, group.length, players.length);
      for (const p of group) {
        await client.query(
          'UPDATE game_players SET placement = ?, league_points = ? WHERE id = ?',
          [currentPlacement, avgPoints, p.id]
        );
      }
    }

    await client.query('COMMIT');

    // Evaluate achievements (non-fatal)
    try {
      const { evaluateAchievements } = require('./achievements');
      await evaluateAchievements(players.map(p => p.player_id));
    } catch (achErr) {
      console.error('Achievement evaluation failed:', achErr);
    }

    // Tournament advancement (non-fatal)
    try {
      const { maybeAdvanceTournament } = require('./tournaments');
      await maybeAdvanceTournament(id);
    } catch (advanceErr) {
      console.error('Tournament advancement failed:', advanceErr);
    }

    // Push notification for rank changes (non-fatal)
    try {
      const { notifyRankChanges } = require('./push');
      await notifyRankChanges();
    } catch {}

    const completeGame = await query(`
      SELECT g.*,
        (SELECT json_group_array(json_object(
          'player_id', gp.player_id,
          'player_name', p.name,
          'final_score', gp.final_score,
          'placement', gp.placement,
          'league_points', gp.league_points
        ))
        FROM (
          SELECT gp2.player_id, p2.name, gp2.final_score, gp2.placement, gp2.league_points
          FROM game_players gp2
          JOIN players p2 ON gp2.player_id = p2.id
          WHERE gp2.game_id = g.id
          ORDER BY gp2.placement
        ) AS gp JOIN players p ON gp.player_id = p.id) AS players
      FROM games g
      WHERE g.id = ?
    `, [id]);

    sseNotify(id, 'ended', { game_id: Number(id) });
    res.json(parsePlayers(completeGame.rows[0]));
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// DELETE /api/games/:id/cancel
router.delete('/:id/cancel', async (req, res, next) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    await client.query('BEGIN');
    const gameResult = await client.query('SELECT id, ended_at FROM games WHERE id = ?', [id]);
    if (gameResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Game not found' });
    }
    if (gameResult.rows[0].ended_at !== null) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Cannot cancel a game that has already ended' });
    }
    await client.query('DELETE FROM score_snapshots WHERE game_id = ?', [id]);
    await client.query('DELETE FROM game_players WHERE game_id = ?', [id]);
    await client.query('DELETE FROM games WHERE id = ?', [id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// DELETE /api/games/:id
router.delete('/:id', requireAuth, async (req, res, next) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    await client.query('BEGIN');
    const gameResult = await client.query('SELECT id FROM games WHERE id = ?', [id]);
    if (gameResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Game not found' });
    }
    await client.query('DELETE FROM score_snapshots WHERE game_id = ?', [id]);
    await client.query('DELETE FROM game_players WHERE game_id = ?', [id]);
    await client.query('DELETE FROM games WHERE id = ?', [id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// POST /api/games/:id/scores — update player score; edit_token gating
router.post('/:id/scores', async (req, res, next) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const { player_id, score, edit_token } = req.body;

    if (player_id === undefined || score === undefined) {
      return res.status(400).json({ error: 'player_id and score are required' });
    }

    // Verify edit_token if game has one set
    const gameRow = await query('SELECT edit_token FROM games WHERE id = ?', [id]);
    if (gameRow.rows.length === 0) return res.status(404).json({ error: 'Game not found' });
    const stored = gameRow.rows[0].edit_token;
    if (stored && stored !== edit_token) {
      return res.status(403).json({ error: 'Invalid edit token' });
    }

    await client.query('BEGIN');
    const updateResult = await client.query(
      'UPDATE game_players SET final_score = ? WHERE game_id = ? AND player_id = ? RETURNING *',
      [score, id, player_id]
    );
    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Player not found in this game' });
    }
    await client.query(
      'INSERT INTO score_snapshots (game_id, player_id, score) VALUES (?, ?, ?)',
      [id, player_id, score]
    );
    await client.query('COMMIT');

    sseNotify(id, 'score', { player_id: Number(player_id), score: Number(score) });
    res.json(updateResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// GET /api/games/:id/scores
router.get('/:id/scores', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT ss.id, ss.game_id, ss.player_id,
             p.name AS player_name, p.color AS player_color,
             ss.score, ss.timestamp
      FROM score_snapshots ss
      JOIN players p ON ss.player_id = p.id
      WHERE ss.game_id = ?
      ORDER BY ss.timestamp ASC
    `, [req.params.id]);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

const MAX_COMMENT_LEN = 500;

// GET /api/games/:id/comments — full comment history for a game (any state)
router.get('/:id/comments', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT bc.id, bc.game_id, bc.player_id, bc.build_id, bc.comment_text, bc.created_at,
             p.name AS player_name, p.color AS player_color
      FROM build_comments bc
      JOIN players p ON p.id = bc.player_id
      WHERE bc.game_id = ?
      ORDER BY bc.created_at ASC
    `, [req.params.id]);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// POST /api/games/:id/comments — post as any registered player, live or ended.
// Spectators comment on games they aren't in. No edit_token required.
router.post('/:id/comments', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { player_id, comment_text } = req.body;

    if (!player_id || !comment_text || comment_text.trim() === '') {
      return res.status(400).json({ error: 'player_id and comment_text are required' });
    }
    const trimmed = comment_text.trim();
    if (trimmed.length > MAX_COMMENT_LEN) {
      return res.status(400).json({ error: `Comment must be ${MAX_COMMENT_LEN} characters or fewer` });
    }

    const gameRow = await query('SELECT id, build_id FROM games WHERE id = ?', [id]);
    if (gameRow.rows.length === 0) return res.status(404).json({ error: 'Game not found' });
    const game = gameRow.rows[0];

    const valid = await query('SELECT 1 FROM players WHERE id = ?', [player_id]);
    if (valid.rows.length === 0) {
      return res.status(400).json({ error: 'Unknown player' });
    }

    const inserted = await query(
      'INSERT INTO build_comments (build_id, game_id, player_id, comment_text) VALUES (?, ?, ?, ?) RETURNING *',
      [game.build_id, id, player_id, trimmed]
    );

    const joined = await query(`
      SELECT bc.id, bc.game_id, bc.player_id, bc.build_id, bc.comment_text, bc.created_at,
             p.name AS player_name, p.color AS player_color
      FROM build_comments bc JOIN players p ON p.id = bc.player_id
      WHERE bc.id = ?
    `, [inserted.rows[0].id]);

    const commentPayload = joined.rows[0];
    sseNotify(id, 'comment', commentPayload);
    res.status(201).json(commentPayload);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/games/:gameId/comments/:commentId — admin-gated; needed because
// comments without a build_id can't be reached via the builds-nested route.
router.delete('/:gameId/comments/:commentId', requireAuth, async (req, res, next) => {
  try {
    const { gameId, commentId } = req.params;
    const result = await query(
      'DELETE FROM build_comments WHERE id = ? AND game_id = ? RETURNING *',
      [commentId, gameId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Comment not found' });
    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /api/games/:id/stream — SSE live score feed
router.get('/:id/stream', (req, res) => {
  const gameId = Number(req.params.id);
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();

  if (!sseClients.has(gameId)) sseClients.set(gameId, new Set());
  sseClients.get(gameId).add(res);

  // Send current scores immediately on connect
  query(`
    SELECT gp.player_id, p.name AS player_name, p.color AS player_color, gp.final_score
    FROM game_players gp
    JOIN players p ON gp.player_id = p.id
    WHERE gp.game_id = ?
  `, [gameId]).then(r => {
    res.write(`event: init\ndata: ${JSON.stringify(r.rows)}\n\n`);
  }).catch(() => {});

  // Send current comment history immediately on connect (order vs. init/score
  // events not guaranteed — client must merge by id, not append blindly).
  query(`
    SELECT bc.id, bc.game_id, bc.player_id, bc.build_id, bc.comment_text, bc.created_at,
           p.name AS player_name, p.color AS player_color
    FROM build_comments bc JOIN players p ON p.id = bc.player_id
    WHERE bc.game_id = ?
    ORDER BY bc.created_at ASC
  `, [gameId]).then(r => {
    res.write(`event: comments-init\ndata: ${JSON.stringify(r.rows)}\n\n`);
  }).catch(() => {});

  // Heartbeat
  const hb = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 25000);

  req.on('close', () => {
    clearInterval(hb);
    const set = sseClients.get(gameId);
    if (set) { set.delete(res); if (set.size === 0) sseClients.delete(gameId); }
  });
});

// GET /api/games/:id
router.get('/:id', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT g.*, b.nickname AS build_nickname,
        (SELECT json_group_array(json_object(
          'player_id', gp.player_id,
          'player_name', p.name,
          'player_color', p.color,
          'avatar_card', gp.avatar_card,
          'final_score', gp.final_score,
          'placement', gp.placement,
          'league_points', gp.league_points
        ))
        FROM (
          SELECT gp2.player_id, p2.name, p2.color, pp.avatar_card, gp2.final_score, gp2.placement, gp2.league_points
          FROM game_players gp2
          JOIN players p2 ON gp2.player_id = p2.id
          LEFT JOIN player_profiles pp ON pp.player_id = p2.id
          WHERE gp2.game_id = g.id
          ORDER BY gp2.placement
        ) AS gp JOIN players p ON gp.player_id = p.id) AS players
      FROM games g
      LEFT JOIN builds b ON g.build_id = b.id
      WHERE g.id = ?
    `, [req.params.id]);

    if (result.rows.length === 0) return res.status(404).json({ error: 'Game not found' });
    res.json(parsePlayers(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

function calculateAverageLeaguePoints(startPlacement, numTied, totalPlayers) {
  const n = totalPlayers;
  // The 0-100 spread is undefined with fewer than two players — there is no
  // last place to anchor against. Award nothing rather than divide by zero and
  // write NaN into game_players.league_points.
  if (n < 2) return 0;
  const avg = 100 * (n - startPlacement - (numTied - 1) / 2) / (n - 1);
  return Math.round(avg * 100) / 100;
}

async function createGameTx(client, { build_id, player_ids }) {
  // Determine active season
  const seasonRow = await query('SELECT id FROM seasons WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1');
  const seasonId = seasonRow.rows[0]?.id || null;

  const editToken = EDIT_TOKEN_WORDS[crypto.randomInt(EDIT_TOKEN_WORDS.length)];

  // Shelters (Dark Ages) are worth 0 VP, so players start at 0 instead of the 3 starting Estates
  let startingScore = 3;
  if (build_id) {
    const buildRow = await query('SELECT use_shelters FROM builds WHERE id = ?', [build_id]);
    if (buildRow.rows[0]?.use_shelters) startingScore = 0;
  }

  const gameResult = await client.query(
    'INSERT INTO games (build_id, season_id, edit_token) VALUES (?, ?, ?) RETURNING *',
    [build_id || null, seasonId, editToken]
  );
  const game = gameResult.rows[0];

  // game_players has a UNIQUE(game_id, player_id), so a caller that lists the
  // same player twice would fail the whole create on a constraint error.
  // A duplicate is a slip in the picker, not a conflict — seat them once.
  for (const player_id of [...new Set(player_ids)]) {
    await client.query(
      'INSERT INTO game_players (game_id, player_id, final_score) VALUES (?, ?, ?)',
      [game.id, player_id, startingScore]
    );
    await client.query(
      'INSERT INTO score_snapshots (game_id, player_id, score) VALUES (?, ?, ?)',
      [game.id, player_id, startingScore]
    );
  }

  return game;
}

module.exports = router;
module.exports.createGameTx = createGameTx;
module.exports.sseNotify = sseNotify;
module.exports.calculateAverageLeaguePoints = calculateAverageLeaguePoints;
module.exports.parsePlayers = parsePlayers;
