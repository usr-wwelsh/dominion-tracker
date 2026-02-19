const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/leaderboard - Get player leaderboard
router.get('/leaderboard', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT
        p.id,
        p.name,
        p.color,
        COUNT(gp.id) as total_games,
        COALESCE(SUM(gp.league_points), 0) as total_league_points,
        COALESCE(ROUND(AVG(gp.league_points), 2), 0) as avg_league_points,
        COALESCE(SUM(CASE WHEN gp.placement = 1 THEN 1 ELSE 0 END), 0) as total_wins,
        COALESCE(ROUND(AVG(gp.final_score), 2), 0) as avg_score
      FROM players p
      LEFT JOIN game_players gp ON p.id = gp.player_id
      LEFT JOIN games g ON gp.game_id = g.id
      WHERE g.ended_at IS NOT NULL OR g.ended_at IS NULL
      GROUP BY p.id, p.name, p.color
      HAVING COUNT(gp.id) > 0
      ORDER BY total_league_points DESC, total_wins DESC, avg_score DESC
    `);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
