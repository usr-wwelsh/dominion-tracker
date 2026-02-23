const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

// GET /api/builds - List all builds
router.get('/', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        b.*,
        (SELECT COUNT(*) FROM games WHERE build_id = b.id AND ended_at IS NOT NULL) AS games_played,
        COALESCE((
          SELECT ROUND(AVG(gp.final_score), 2)
          FROM game_players gp
          JOIN games g ON gp.game_id = g.id
          WHERE g.build_id = b.id AND g.ended_at IS NOT NULL
        ), 0) AS avg_score_per_game
      FROM builds b
      ORDER BY b.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// POST /api/builds - Create a new build
router.post('/', async (req, res, next) => {
  try {
    const { nickname, cards, landmarks, events, prophecies, use_platinum_colony } = req.body;

    if (!nickname || nickname.trim() === '') {
      return res.status(400).json({ error: 'Build nickname is required' });
    }

    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({ error: 'Cards array is required and must not be empty' });
    }

    const result = await query(
      'INSERT INTO builds (nickname, cards, landmarks, events, prophecies, use_platinum_colony) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [
        nickname.trim(),
        cards,
        Array.isArray(landmarks) ? landmarks : [],
        Array.isArray(events) ? events : [],
        Array.isArray(prophecies) ? prophecies : [],
        use_platinum_colony === true,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// GET /api/builds/:id - Get build by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(`
      SELECT
        b.*,
        (SELECT COUNT(*) FROM games WHERE build_id = b.id AND ended_at IS NOT NULL) AS games_played,
        COALESCE((
          SELECT ROUND(AVG(gp.final_score), 2)
          FROM game_players gp
          JOIN games g ON gp.game_id = g.id
          WHERE g.build_id = b.id AND g.ended_at IS NOT NULL
        ), 0) AS avg_score_per_game
      FROM builds b
      WHERE b.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Build not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// PUT /api/builds/:id - Update a build (requires auth)
router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nickname, cards, landmarks, events, prophecies, use_platinum_colony } = req.body;

    if (!nickname || nickname.trim() === '') {
      return res.status(400).json({ error: 'Build nickname is required' });
    }

    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({ error: 'Cards array is required and must not be empty' });
    }

    const result = await query(
      'UPDATE builds SET nickname = $1, cards = $2, landmarks = $3, events = $4, prophecies = $5, use_platinum_colony = $6 WHERE id = $7 RETURNING *',
      [
        nickname.trim(),
        cards,
        Array.isArray(landmarks) ? landmarks : [],
        Array.isArray(events) ? events : [],
        Array.isArray(prophecies) ? prophecies : [],
        use_platinum_colony === true,
        id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Build not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/builds/:id - Delete a build (requires auth)
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM builds WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Build not found' });
    }

    res.json({ message: 'Build deleted successfully', build: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /api/builds/:id/comments - Get all comments for a build
router.get('/:id/comments', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT bc.*, p.name as player_name, p.color as player_color,
             gp.placement, g.started_at as game_started_at
      FROM build_comments bc
      JOIN players p ON bc.player_id = p.id
      JOIN game_players gp ON gp.game_id = bc.game_id AND gp.player_id = bc.player_id
      JOIN games g ON g.id = bc.game_id
      WHERE bc.build_id = $1
      ORDER BY g.started_at DESC, bc.created_at ASC
    `, [id]);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// POST /api/builds/:id/comments - Add a comment to a build
router.post('/:id/comments', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { game_id, player_id, comment_text } = req.body;

    if (!game_id || !player_id || !comment_text || comment_text.trim() === '') {
      return res.status(400).json({ error: 'game_id, player_id, and comment_text are required' });
    }

    // Validate player participated in the game and the game used this build
    const valid = await query(`
      SELECT gp.id FROM game_players gp
      JOIN games g ON gp.game_id = g.id
      WHERE gp.game_id = $1 AND gp.player_id = $2 AND g.build_id = $3
    `, [game_id, player_id, id]);

    if (valid.rows.length === 0) {
      return res.status(400).json({ error: 'Player did not participate in this game or game does not use this build' });
    }

    const result = await query(
      'INSERT INTO build_comments (build_id, game_id, player_id, comment_text) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, game_id, player_id, comment_text.trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/builds/:buildId/comments/:commentId - Delete a comment (requires auth)
router.delete('/:buildId/comments/:commentId', requireAuth, async (req, res, next) => {
  try {
    const { buildId, commentId } = req.params;
    const result = await query(
      'DELETE FROM build_comments WHERE id = $1 AND build_id = $2 RETURNING *',
      [commentId, buildId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
