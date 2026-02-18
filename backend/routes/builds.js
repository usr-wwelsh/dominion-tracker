const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/builds - List all builds
router.get('/', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        b.*,
        COUNT(g.id) as games_played,
        COALESCE(ROUND(AVG(gp.final_score), 2), 0) as avg_score_per_game
      FROM builds b
      LEFT JOIN games g ON b.id = g.build_id
      LEFT JOIN game_players gp ON g.id = gp.game_id
      GROUP BY b.id
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
        COUNT(g.id) as games_played,
        COALESCE(ROUND(AVG(gp.final_score), 2), 0) as avg_score_per_game
      FROM builds b
      LEFT JOIN games g ON b.id = g.build_id
      LEFT JOIN game_players gp ON g.id = gp.game_id
      WHERE b.id = $1
      GROUP BY b.id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Build not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/builds/:id - Delete a build
router.delete('/:id', async (req, res, next) => {
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

module.exports = router;
