const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');
const { MIN_GAMES_FOR_RANKING } = require('../config');

// Level curve: XP is total play seconds / K, level is floor(sqrt(xp)), so each
// level costs progressively more play time.
const XP_SECONDS_PER_UNIT = 300;

function levelFromSeconds(totalSeconds) {
  const totalXp = Math.max(0, Math.floor((totalSeconds || 0) / XP_SECONDS_PER_UNIT));
  const level = Math.floor(Math.sqrt(totalXp));
  const xpForCurrentLevel = level * level;
  const xpForNextLevel = (level + 1) * (level + 1);
  return {
    total_xp: totalXp,
    level,
    xp_into_level: totalXp - xpForCurrentLevel,
    xp_for_next: xpForNextLevel - xpForCurrentLevel,
  };
}

router.get('/', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT p.*, pp.avatar_card, pp.bio, pp.avatar_zoom, pp.avatar_x, pp.avatar_y,
             (SELECT COUNT(*) FROM game_players gp WHERE gp.player_id = p.id) AS total_games
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

    // Active-season stats only. LEFT JOIN games with the season/ended filter in
    // the ON clause so a player with no qualifying games still returns a zeroed
    // row; aggregates are guarded on g.id so non-matching game_players rows
    // (other seasons, unfinished games) don't leak in.
    const statsResult = await query(`
      SELECT
        p.id,
        p.name,
        COUNT(g.id) AS total_games,
        COALESCE(SUM(CASE WHEN g.id IS NOT NULL THEN gp.league_points END), 0) AS total_league_points,
        COALESCE(ROUND(CAST(AVG(CASE WHEN g.id IS NOT NULL THEN gp.league_points END) AS REAL), 2), 0) AS avg_league_points,
        COALESCE(SUM(CASE WHEN g.id IS NOT NULL AND gp.placement = 1 THEN 1 ELSE 0 END), 0) AS total_wins,
        COALESCE(ROUND(CAST(AVG(CASE WHEN g.id IS NOT NULL THEN gp.final_score END) AS REAL), 2), 0) AS avg_score,
        COALESCE(MAX(CASE WHEN g.id IS NOT NULL THEN gp.final_score END), 0) AS highest_score,
        COALESCE(MIN(CASE WHEN g.id IS NOT NULL THEN gp.final_score END), 0) AS lowest_score
      FROM players p
      LEFT JOIN game_players gp ON p.id = gp.player_id
      LEFT JOIN games g ON gp.game_id = g.id
        AND g.ended_at IS NOT NULL
        AND g.season_id = (SELECT id FROM seasons WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1)
      WHERE p.id = ?
      GROUP BY p.id, p.name
    `, [id]);

    // Leaderboard rank — same qualification/tiebreak rules as GET /leaderboard,
    // scoped to this player's row so the profile can show "Rank X of Y" or
    // "Unranked" without shipping the whole board.
    const rankResult = await query(`
      WITH active_season AS (
        SELECT id FROM seasons WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1
      ),
      current_stats AS (
        SELECT
          gp.player_id,
          COUNT(*) AS total_games,
          SUM(gp.league_points) AS total_lp,
          SUM(CASE WHEN gp.placement = 1 THEN 1 ELSE 0 END) AS total_wins,
          ROUND(CAST(AVG(gp.final_score) AS REAL), 2) AS avg_score
        FROM game_players gp
        JOIN games g ON gp.game_id = g.id
        WHERE g.ended_at IS NOT NULL
          AND g.season_id = (SELECT id FROM active_season)
        GROUP BY gp.player_id
      ),
      qualified AS (
        SELECT
          player_id,
          RANK() OVER (ORDER BY CAST(total_lp AS REAL) / MAX(total_games, 1) DESC, total_wins DESC, avg_score DESC) AS rank
        FROM current_stats
        WHERE total_games >= ${MIN_GAMES_FOR_RANKING}
      )
      SELECT
        (SELECT rank FROM qualified WHERE player_id = ?) AS rank,
        (SELECT COUNT(*) FROM qualified) AS total_ranked
    `, [id]);

    res.json({
      ...statsResult.rows[0],
      rank: rankResult.rows[0]?.rank ?? null,
      total_ranked: rankResult.rows[0]?.total_ranked ?? 0,
      min_games_for_ranking: MIN_GAMES_FOR_RANKING,
    });
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

    res.json({
      player_id: Number(id),
      ...levelFromSeconds(xpResult.rows[0].total_seconds),
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
module.exports.levelFromSeconds = levelFromSeconds;
