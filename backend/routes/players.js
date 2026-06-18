const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

router.get('/', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT p.*, pp.avatar_card, pp.bio
      FROM players p
      LEFT JOIN player_profiles pp ON pp.player_id = p.id
      ORDER BY p.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Player name is required' });
    }
    const result = await query(
      'INSERT INTO players (name) VALUES (?) RETURNING *',
      [name.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      res.status(409).json({ error: 'Player name already exists' });
    } else {
      next(error);
    }
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await query('SELECT * FROM players WHERE id = ?', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Player not found' });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.get('/:id/stats', async (req, res, next) => {
  try {
    const { id } = req.params;
    const playerResult = await query('SELECT * FROM players WHERE id = ?', [id]);
    if (playerResult.rows.length === 0) return res.status(404).json({ error: 'Player not found' });

    const statsResult = await query(`
      SELECT
        p.id,
        p.name,
        COUNT(gp.id) AS total_games,
        COALESCE(SUM(gp.league_points), 0) AS total_league_points,
        COALESCE(ROUND(CAST(AVG(gp.league_points) AS REAL), 2), 0) AS avg_league_points,
        COALESCE(SUM(CASE WHEN gp.placement = 1 THEN 1 ELSE 0 END), 0) AS total_wins,
        COALESCE(ROUND(CAST(AVG(gp.final_score) AS REAL), 2), 0) AS avg_score,
        COALESCE(MAX(gp.final_score), 0) AS highest_score,
        COALESCE(MIN(gp.final_score), 0) AS lowest_score
      FROM players p
      LEFT JOIN game_players gp ON p.id = gp.player_id
      WHERE p.id = ?
      GROUP BY p.id, p.name
    `, [id]);

    res.json(statsResult.rows[0]);
  } catch (error) {
    next(error);
  }
});

// GET /api/players/:id/level — XP derived from total game playtime
router.get('/:id/level', async (req, res, next) => {
  try {
    const { id } = req.params;
    const playerResult = await query('SELECT id, name FROM players WHERE id = ?', [id]);
    if (playerResult.rows.length === 0) return res.status(404).json({ error: 'Player not found' });

    const xpResult = await query(`
      SELECT COALESCE(SUM(COALESCE(g.duration, 0)), 0) AS total_seconds
      FROM game_players gp
      JOIN games g ON gp.game_id = g.id
      WHERE gp.player_id = ? AND g.ended_at IS NOT NULL
    `, [id]);

    const K = 300; // seconds per XP unit; tunes level curve
    const totalXp = Math.max(0, Math.floor((xpResult.rows[0].total_seconds || 0) / K));
    const level = Math.floor(Math.sqrt(totalXp));
    const xpForCurrentLevel = level * level;
    const xpForNextLevel = (level + 1) * (level + 1);

    res.json({
      player_id: Number(id),
      total_xp: totalXp,
      level,
      xp_into_level: totalXp - xpForCurrentLevel,
      xp_for_next: xpForNextLevel - xpForCurrentLevel,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/h2h', async (req, res, next) => {
  try {
    const { id } = req.params;
    const playerResult = await query('SELECT id, name FROM players WHERE id = ?', [id]);
    if (playerResult.rows.length === 0) return res.status(404).json({ error: 'Player not found' });

    const result = await query(`
      SELECT
        gp2.player_id AS opponent_id,
        p2.name AS opponent_name,
        p2.color AS opponent_color,
        COUNT(*) AS games_together,
        SUM(CASE WHEN gp1.placement < gp2.placement THEN 1 ELSE 0 END) AS player_wins,
        SUM(CASE WHEN gp2.placement < gp1.placement THEN 1 ELSE 0 END) AS opponent_wins
      FROM game_players gp1
      JOIN game_players gp2 ON gp1.game_id = gp2.game_id AND gp2.player_id != gp1.player_id
      JOIN games g ON gp1.game_id = g.id
      JOIN players p2 ON gp2.player_id = p2.id
      WHERE gp1.player_id = ? AND g.ended_at IS NOT NULL
      GROUP BY gp2.player_id, p2.name, p2.color
      ORDER BY games_together DESC
    `, [id]);

    res.json({ player: playerResult.rows[0], opponents: result.rows });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/color', async (req, res, next) => {
  try {
    const { color } = req.body;
    if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) {
      return res.status(400).json({ error: 'Valid hex color required' });
    }
    const result = await query(
      'UPDATE players SET color = ? WHERE id = ? RETURNING *',
      [color, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Player not found' });
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const gamesCheck = await query(
      `SELECT gp.id FROM game_players gp
       JOIN games g ON gp.game_id = g.id
       WHERE gp.player_id = ? AND g.ended_at IS NOT NULL
       LIMIT 1`,
      [id]
    );
    if (gamesCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Player has completed game history and cannot be deleted' });
    }
    await query(
      `DELETE FROM game_players WHERE player_id = ?
       AND game_id IN (SELECT id FROM games WHERE ended_at IS NULL)`,
      [id]
    );
    const result = await query('DELETE FROM players WHERE id = ? RETURNING *', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Player not found' });
    res.json({ message: 'Player deleted successfully', player: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
