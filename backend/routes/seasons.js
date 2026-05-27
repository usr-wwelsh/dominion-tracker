const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/seasons
router.get('/', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT s.*, p.name AS champion_name
       FROM seasons s
       LEFT JOIN players p ON s.champion_player_id = p.id
       ORDER BY s.number ASC`
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/seasons/active
router.get('/active', async (req, res, next) => {
  try {
    const result = await query(
      `SELECT s.*, p.name AS champion_name
       FROM seasons s
       LEFT JOIN players p ON s.champion_player_id = p.id
       WHERE s.ended_at IS NULL
       ORDER BY s.id DESC LIMIT 1`
    );
    res.json(result.rows[0] || null);
  } catch (error) {
    next(error);
  }
});

// GET /api/seasons/:id/standings — final archived standings for a past season
router.get('/:id/standings', async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(`
      SELECT
        p.id, p.name, p.color,
        COUNT(gp.id) AS total_games,
        SUM(gp.league_points) AS total_league_points,
        SUM(CASE WHEN gp.placement = 1 THEN 1 ELSE 0 END) AS total_wins,
        ROUND(CAST(AVG(gp.final_score) AS REAL), 2) AS avg_score,
        RANK() OVER (ORDER BY SUM(gp.league_points) DESC,
                              SUM(CASE WHEN gp.placement = 1 THEN 1 ELSE 0 END) DESC) AS rank
      FROM players p
      JOIN game_players gp ON gp.player_id = p.id
      JOIN games g ON gp.game_id = g.id
      WHERE g.ended_at IS NOT NULL AND g.season_id = ?
      GROUP BY p.id, p.name, p.color
      ORDER BY total_league_points DESC, total_wins DESC
    `, [id]);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/seasons/:id/champion
router.get('/:id/champion', async (req, res, next) => {
  try {
    const { id } = req.params;
    // Check season_snapshots first (captured at tournament end)
    const snap = await query(
      `SELECT ss.*, t.name AS tournament_name
       FROM season_snapshots ss
       LEFT JOIN tournaments t ON ss.tournament_id = t.id
       WHERE ss.label = (SELECT 'Season ' || number FROM seasons WHERE id = ?)
       LIMIT 1`,
      [id]
    );
    if (snap.rows.length > 0) return res.json(snap.rows[0]);

    // Fall back to computed leaderboard top
    const result = await query(`
      SELECT p.id AS player_id, p.name AS player_name,
        SUM(gp.league_points) AS total_league_points,
        SUM(CASE WHEN gp.placement = 1 THEN 1 ELSE 0 END) AS total_wins,
        COUNT(*) AS total_games
      FROM players p
      JOIN game_players gp ON gp.player_id = p.id
      JOIN games g ON gp.game_id = g.id
      WHERE g.ended_at IS NOT NULL AND g.season_id = ?
      GROUP BY p.id, p.name
      ORDER BY total_league_points DESC, total_wins DESC
      LIMIT 1
    `, [id]);
    res.json(result.rows[0] || null);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
