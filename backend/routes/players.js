const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/players - List all players
router.get('/', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM players ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// POST /api/players - Create a new player
router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Player name is required' });
    }

    const result = await query(
      'INSERT INTO players (name) VALUES ($1) RETURNING *',
      [name.trim()]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') { // Unique violation
      res.status(409).json({ error: 'Player name already exists' });
    } else {
      next(error);
    }
  }
});

// GET /api/players/:id - Get player by ID
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM players WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// GET /api/players/:id/stats - Get player statistics
router.get('/:id/stats', async (req, res, next) => {
  try {
    const { id } = req.params;

    // First verify player exists
    const playerResult = await query('SELECT * FROM players WHERE id = $1', [id]);
    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Get comprehensive stats
    const statsResult = await query(`
      SELECT
        p.id,
        p.name,
        COUNT(gp.id) as total_games,
        COALESCE(SUM(gp.league_points), 0) as total_league_points,
        COALESCE(ROUND(AVG(gp.league_points), 2), 0) as avg_league_points,
        COALESCE(SUM(CASE WHEN gp.placement = 1 THEN 1 ELSE 0 END), 0) as total_wins,
        COALESCE(ROUND(AVG(gp.final_score), 2), 0) as avg_score,
        COALESCE(MAX(gp.final_score), 0) as highest_score,
        COALESCE(MIN(gp.final_score), 0) as lowest_score
      FROM players p
      LEFT JOIN game_players gp ON p.id = gp.player_id
      WHERE p.id = $1
      GROUP BY p.id, p.name
    `, [id]);

    res.json(statsResult.rows[0]);
  } catch (error) {
    next(error);
  }
});

// GET /api/players/:id/h2h - Head-to-head record vs all opponents
router.get('/:id/h2h', async (req, res, next) => {
  try {
    const { id } = req.params;

    const playerResult = await query('SELECT id, name FROM players WHERE id = $1', [id]);
    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    const result = await query(`
      SELECT
        gp2.player_id AS opponent_id,
        p2.name AS opponent_name,
        p2.color AS opponent_color,
        COUNT(*) AS games_together,
        SUM(CASE WHEN gp1.placement < gp2.placement THEN 1 ELSE 0 END) AS player_wins,
        SUM(CASE WHEN gp2.placement < gp1.placement THEN 1 ELSE 0 END) AS opponent_wins
      FROM game_players gp1
      JOIN game_players gp2
        ON gp1.game_id = gp2.game_id AND gp2.player_id != gp1.player_id
      JOIN games g ON gp1.game_id = g.id
      JOIN players p2 ON gp2.player_id = p2.id
      WHERE gp1.player_id = $1 AND g.ended_at IS NOT NULL
      GROUP BY gp2.player_id, p2.name, p2.color
      ORDER BY games_together DESC
    `, [id]);

    res.json({
      player: playerResult.rows[0],
      opponents: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/players/:id/color - Update player color
router.patch('/:id/color', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { color } = req.body;

    if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return res.status(400).json({ error: 'Valid hex color required' });
    }

    const result = await query(
      'UPDATE players SET color = $1 WHERE id = $2 RETURNING *',
      [color, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
