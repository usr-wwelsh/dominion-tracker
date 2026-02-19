const express = require('express');
const router = express.Router();
const { query, getClient } = require('../db');

// GET /api/games - List completed games with pagination
router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;

    const result = await query(`
      SELECT
        g.*,
        b.nickname as build_nickname,
        json_agg(
          json_build_object(
            'player_id', gp.player_id,
            'player_name', p.name,
            'player_color', p.color,
            'final_score', gp.final_score,
            'placement', gp.placement,
            'league_points', gp.league_points
          ) ORDER BY gp.placement
        ) as players
      FROM games g
      LEFT JOIN builds b ON g.build_id = b.id
      LEFT JOIN game_players gp ON g.id = gp.game_id
      LEFT JOIN players p ON gp.player_id = p.id
      WHERE g.ended_at IS NOT NULL
      GROUP BY g.id, b.nickname
      ORDER BY g.started_at DESC NULLS LAST, g.id DESC
      LIMIT $1 OFFSET $2
    `, [limit + 1, offset]);

    const hasMore = result.rows.length > limit;
    const games = hasMore ? result.rows.slice(0, limit) : result.rows;

    res.json({ games, hasMore });
  } catch (error) {
    next(error);
  }
});

// POST /api/games - Create a new game
router.post('/', async (req, res, next) => {
  const client = await getClient();

  try {
    const { build_id, player_ids } = req.body;

    if (!player_ids || !Array.isArray(player_ids) || player_ids.length === 0) {
      return res.status(400).json({ error: 'Player IDs array is required' });
    }

    await client.query('BEGIN');

    // Create the game
    const gameResult = await client.query(
      'INSERT INTO games (build_id) VALUES ($1) RETURNING *',
      [build_id || null]
    );

    const game = gameResult.rows[0];

    // Add players to the game (everyone starts with 3 victory points in Dominion)
    for (const player_id of player_ids) {
      await client.query(
        'INSERT INTO game_players (game_id, player_id, final_score) VALUES ($1, $2, 3)',
        [game.id, player_id]
      );

      // Record initial score snapshot
      await client.query(
        'INSERT INTO score_snapshots (game_id, player_id, score) VALUES ($1, $2, 3)',
        [game.id, player_id]
      );
    }

    await client.query('COMMIT');

    // Fetch the complete game with players
    const completeGame = await query(`
      SELECT
        g.*,
        json_agg(
          json_build_object(
            'player_id', gp.player_id,
            'player_name', p.name,
            'final_score', gp.final_score
          )
        ) as players
      FROM games g
      LEFT JOIN game_players gp ON g.id = gp.game_id
      LEFT JOIN players p ON gp.player_id = p.id
      WHERE g.id = $1
      GROUP BY g.id
    `, [game.id]);

    res.status(201).json(completeGame.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// PUT /api/games/:id/start - Start a game
router.put('/:id/start', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      'UPDATE games SET started_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// PUT /api/games/:id/end - End a game
router.put('/:id/end', async (req, res, next) => {
  const client = await getClient();

  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Get game start time
    const gameResult = await client.query(
      'SELECT * FROM games WHERE id = $1',
      [id]
    );

    if (gameResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Game not found' });
    }

    const game = gameResult.rows[0];

    // Calculate duration
    let duration = null;
    if (game.started_at) {
      duration = Math.floor((Date.now() - new Date(game.started_at).getTime()) / 1000);
    }

    // Update game end time and duration
    await client.query(
      'UPDATE games SET ended_at = CURRENT_TIMESTAMP, duration = $1 WHERE id = $2',
      [duration, id]
    );

    // Get all players with their scores, ordered by score descending
    const playersResult = await client.query(
      `SELECT gp.*, p.name as player_name
       FROM game_players gp
       JOIN players p ON gp.player_id = p.id
       WHERE gp.game_id = $1
       ORDER BY gp.final_score DESC`,
      [id]
    );

    const players = playersResult.rows;

    // Calculate placements and league points
    let currentPlacement = 1;
    let previousScore = null;
    let playersWithSameScore = [];

    for (let i = 0; i < players.length; i++) {
      const player = players[i];

      if (previousScore !== null && player.final_score !== previousScore) {
        // Assign placement and points to all players with the previous score
        const avgPoints = calculateAverageLeaguePoints(currentPlacement, playersWithSameScore.length);

        for (const p of playersWithSameScore) {
          await client.query(
            'UPDATE game_players SET placement = $1, league_points = $2 WHERE id = $3',
            [currentPlacement, avgPoints, p.id]
          );
        }

        currentPlacement += playersWithSameScore.length;
        playersWithSameScore = [];
      }

      playersWithSameScore.push(player);
      previousScore = player.final_score;
    }

    // Handle the last group
    if (playersWithSameScore.length > 0) {
      const avgPoints = calculateAverageLeaguePoints(currentPlacement, playersWithSameScore.length);

      for (const p of playersWithSameScore) {
        await client.query(
          'UPDATE game_players SET placement = $1, league_points = $2 WHERE id = $3',
          [currentPlacement, avgPoints, p.id]
        );
      }
    }

    await client.query('COMMIT');

    // Fetch the complete game with updated data
    const completeGame = await query(`
      SELECT
        g.*,
        json_agg(
          json_build_object(
            'player_id', gp.player_id,
            'player_name', p.name,
            'final_score', gp.final_score,
            'placement', gp.placement,
            'league_points', gp.league_points
          ) ORDER BY gp.placement
        ) as players
      FROM games g
      LEFT JOIN game_players gp ON g.id = gp.game_id
      LEFT JOIN players p ON gp.player_id = p.id
      WHERE g.id = $1
      GROUP BY g.id
    `, [id]);

    res.json(completeGame.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// DELETE /api/games/:id - Delete a game and all related data
router.delete('/:id', async (req, res, next) => {
  const client = await getClient();

  try {
    const { id } = req.params;

    await client.query('BEGIN');

    const gameResult = await client.query('SELECT id FROM games WHERE id = $1', [id]);
    if (gameResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Game not found' });
    }

    await client.query('DELETE FROM score_snapshots WHERE game_id = $1', [id]);
    await client.query('DELETE FROM game_players WHERE game_id = $1', [id]);
    await client.query('DELETE FROM games WHERE id = $1', [id]);

    await client.query('COMMIT');

    res.json({ success: true });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// Helper function to calculate average league points for tied players
function calculateAverageLeaguePoints(startPlacement, numPlayers) {
  const pointsMap = { 1: 5, 2: 3, 3: 1 };
  let totalPoints = 0;

  for (let i = 0; i < numPlayers; i++) {
    const placement = startPlacement + i;
    totalPoints += pointsMap[placement] || 0;
  }

  return Math.round(totalPoints / numPlayers);
}

// POST /api/games/:id/scores - Update player score
router.post('/:id/scores', async (req, res, next) => {
  const client = await getClient();

  try {
    const { id } = req.params;
    const { player_id, score } = req.body;

    if (player_id === undefined || score === undefined) {
      return res.status(400).json({ error: 'player_id and score are required' });
    }

    await client.query('BEGIN');

    // Update the player's score in game_players
    const updateResult = await client.query(
      'UPDATE game_players SET final_score = $1 WHERE game_id = $2 AND player_id = $3 RETURNING *',
      [score, id, player_id]
    );

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Player not found in this game' });
    }

    // Record score snapshot
    await client.query(
      'INSERT INTO score_snapshots (game_id, player_id, score) VALUES ($1, $2, $3)',
      [id, player_id, score]
    );

    await client.query('COMMIT');

    res.json(updateResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// GET /api/games/:id/scores - Get score history
router.get('/:id/scores', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(`
      SELECT
        ss.id,
        ss.game_id,
        ss.player_id,
        p.name as player_name,
        p.color as player_color,
        ss.score,
        ss.timestamp
      FROM score_snapshots ss
      JOIN players p ON ss.player_id = p.id
      WHERE ss.game_id = $1
      ORDER BY ss.timestamp ASC
    `, [id]);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/games/:id - Get game by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(`
      SELECT
        g.*,
        b.nickname as build_nickname,
        json_agg(
          json_build_object(
            'player_id', gp.player_id,
            'player_name', p.name,
            'final_score', gp.final_score,
            'placement', gp.placement,
            'league_points', gp.league_points
          ) ORDER BY gp.placement
        ) as players
      FROM games g
      LEFT JOIN builds b ON g.build_id = b.id
      LEFT JOIN game_players gp ON g.id = gp.game_id
      LEFT JOIN players p ON gp.player_id = p.id
      WHERE g.id = $1
      GROUP BY g.id, b.nickname
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
