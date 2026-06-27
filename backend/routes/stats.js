const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/leaderboard — active-season stats with trend and recent form
router.get('/leaderboard', async (req, res, next) => {
  try {
    const result = await query(`
      WITH active_season AS (
        SELECT id FROM seasons WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1
      ),
      all_game_data AS (
        SELECT
          gp.player_id,
          gp.placement,
          gp.league_points,
          gp.final_score,
          g.ended_at,
          g.id AS game_id,
          ROW_NUMBER() OVER (
            PARTITION BY gp.player_id
            ORDER BY g.ended_at DESC, g.id DESC
          ) AS player_game_rn
        FROM game_players gp
        JOIN games g ON gp.game_id = g.id
        WHERE g.ended_at IS NOT NULL
          AND g.season_id = (SELECT id FROM active_season)
      ),
      current_stats AS (
        SELECT
          player_id,
          COUNT(*) AS total_games,
          SUM(league_points) AS total_lp,
          SUM(CASE WHEN placement = 1 THEN 1 ELSE 0 END) AS total_wins,
          ROUND(CAST(AVG(final_score) AS REAL), 2) AS avg_score
        FROM all_game_data
        GROUP BY player_id
      ),
      prev_stats AS (
        SELECT
          player_id,
          COUNT(*) AS prev_games,
          SUM(league_points) AS prev_lp,
          SUM(CASE WHEN placement = 1 THEN 1 ELSE 0 END) AS prev_wins,
          ROUND(CAST(AVG(final_score) AS REAL), 2) AS prev_avg_score
        FROM all_game_data
        WHERE player_game_rn > 1
        GROUP BY player_id
      ),
      current_ranked AS (
        SELECT
          player_id,
          RANK() OVER (ORDER BY CAST(total_lp AS REAL) / MAX(total_games, 1) DESC, total_wins DESC, avg_score DESC) AS curr_rank
        FROM current_stats
      ),
      prev_ranked AS (
        SELECT
          player_id,
          RANK() OVER (ORDER BY CAST(prev_lp AS REAL) / MAX(prev_games, 1) DESC, prev_wins DESC, prev_avg_score DESC) AS prev_rank
        FROM prev_stats
      ),
      recent_form_ordered AS (
        SELECT player_id, placement, player_game_rn
        FROM all_game_data
        WHERE player_game_rn <= 5
        ORDER BY player_id, player_game_rn ASC
      ),
      recent_form_agg AS (
        SELECT player_id, json_group_array(placement) AS recent_form
        FROM recent_form_ordered
        GROUP BY player_id
      )
      SELECT
        p.id,
        p.name,
        p.color,
        pp.avatar_card,
        pp.avatar_zoom,
        pp.avatar_x,
        pp.avatar_y,
        cs.total_games,
        cs.total_lp AS total_league_points,
        ROUND(CAST(cs.total_lp AS REAL) / MAX(cs.total_games, 1), 2) AS avg_league_points,
        cs.total_wins,
        cs.avg_score,
        ROUND(CAST(cs.total_wins AS REAL) * 100.0 / MAX(cs.total_games, 1), 1) AS win_rate,
        COALESCE(rf.recent_form, '[]') AS recent_form,
        CASE
          WHEN pr.prev_rank IS NULL THEN NULL
          ELSE CAST(pr.prev_rank - cr.curr_rank AS INTEGER)
        END AS rank_trend
      FROM players p
      LEFT JOIN player_profiles pp ON pp.player_id = p.id
      JOIN current_stats cs ON p.id = cs.player_id
      JOIN current_ranked cr ON p.id = cr.player_id
      LEFT JOIN prev_ranked pr ON p.id = pr.player_id
      LEFT JOIN recent_form_agg rf ON p.id = rf.player_id
      ORDER BY CAST(cs.total_lp AS REAL) / MAX(cs.total_games, 1) DESC, cs.total_wins DESC, cs.avg_score DESC
    `);

    // SQLite returns json_group_array as a string; parse it
    const rows = result.rows.map(r => ({
      ...r,
      recent_form: typeof r.recent_form === 'string' ? JSON.parse(r.recent_form) : r.recent_form,
    }));
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/extras — rivalry, high score, most played build (active season only)
router.get('/extras', async (req, res, next) => {
  try {
    const [rivalryResult, highScoreResult, buildResult] = await Promise.all([
      query(`
        SELECT
          gp1.player_id AS player1_id, p1.name AS player1_name,
          gp2.player_id AS player2_id, p2.name AS player2_name,
          COUNT(*) AS games_together
        FROM game_players gp1
        JOIN game_players gp2
          ON gp1.game_id = gp2.game_id AND gp1.player_id < gp2.player_id
        JOIN games g ON gp1.game_id = g.id
        JOIN players p1 ON gp1.player_id = p1.id
        JOIN players p2 ON gp2.player_id = p2.id
        WHERE g.ended_at IS NOT NULL
          AND g.season_id = (SELECT id FROM seasons WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1)
        GROUP BY gp1.player_id, gp2.player_id, p1.name, p2.name
        ORDER BY games_together DESC
        LIMIT 1
      `),
      query(`
        SELECT gp.player_id, p.name AS player_name, gp.final_score AS score,
          g.id AS game_id, g.ended_at AS game_date
        FROM game_players gp
        JOIN players p ON gp.player_id = p.id
        JOIN games g ON gp.game_id = g.id
        WHERE g.ended_at IS NOT NULL
          AND g.season_id = (SELECT id FROM seasons WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1)
        ORDER BY gp.final_score DESC
        LIMIT 1
      `),
      query(`
        SELECT b.id AS build_id, b.nickname, COUNT(g.id) AS games_count
        FROM builds b
        JOIN games g ON g.build_id = b.id
        WHERE g.ended_at IS NOT NULL
          AND g.season_id = (SELECT id FROM seasons WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1)
        GROUP BY b.id, b.nickname
        ORDER BY games_count DESC
        LIMIT 1
      `),
    ]);

    res.json({
      rivalry: rivalryResult.rows[0] || null,
      high_score: highScoreResult.rows[0] || null,
      most_played_build: buildResult.rows[0] || null,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
