const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/leaderboard - Get player leaderboard with trend, form, win rate
router.get('/leaderboard', async (req, res, next) => {
  try {
    const result = await query(`
      WITH all_game_data AS (
        SELECT
          gp.player_id,
          gp.placement,
          gp.league_points,
          gp.final_score,
          g.ended_at,
          g.id AS game_id,
          ROW_NUMBER() OVER (
            PARTITION BY gp.player_id
            ORDER BY g.ended_at DESC NULLS LAST, g.id DESC
          ) AS player_game_rn
        FROM game_players gp
        JOIN games g ON gp.game_id = g.id
        WHERE g.ended_at IS NOT NULL
      ),
      current_stats AS (
        SELECT
          player_id,
          COUNT(*) AS total_games,
          SUM(league_points) AS total_lp,
          SUM(CASE WHEN placement = 1 THEN 1 ELSE 0 END) AS total_wins,
          ROUND(AVG(final_score)::numeric, 2) AS avg_score
        FROM all_game_data
        GROUP BY player_id
      ),
      prev_stats AS (
        SELECT
          player_id,
          SUM(league_points) AS prev_lp,
          SUM(CASE WHEN placement = 1 THEN 1 ELSE 0 END) AS prev_wins,
          ROUND(AVG(final_score)::numeric, 2) AS prev_avg_score
        FROM all_game_data
        WHERE player_game_rn > 1
        GROUP BY player_id
      ),
      current_ranked AS (
        SELECT
          player_id,
          RANK() OVER (ORDER BY total_lp DESC, total_wins DESC, avg_score DESC) AS curr_rank
        FROM current_stats
      ),
      prev_ranked AS (
        SELECT
          player_id,
          RANK() OVER (ORDER BY prev_lp DESC, prev_wins DESC, prev_avg_score DESC) AS prev_rank
        FROM prev_stats
      ),
      recent_form_agg AS (
        SELECT
          player_id,
          json_agg(placement ORDER BY player_game_rn ASC) AS recent_form
        FROM all_game_data
        WHERE player_game_rn <= 5
        GROUP BY player_id
      )
      SELECT
        p.id,
        p.name,
        p.color,
        cs.total_games,
        cs.total_lp AS total_league_points,
        ROUND(cs.total_lp::numeric / NULLIF(cs.total_games, 0), 2) AS avg_league_points,
        cs.total_wins,
        cs.avg_score,
        ROUND(cs.total_wins::numeric * 100.0 / NULLIF(cs.total_games, 0), 1) AS win_rate,
        COALESCE(rf.recent_form, '[]'::json) AS recent_form,
        CASE
          WHEN pr.prev_rank IS NULL THEN NULL
          ELSE (pr.prev_rank - cr.curr_rank)::int
        END AS rank_trend
      FROM players p
      JOIN current_stats cs ON p.id = cs.player_id
      JOIN current_ranked cr ON p.id = cr.player_id
      LEFT JOIN prev_ranked pr ON p.id = pr.player_id
      LEFT JOIN recent_form_agg rf ON p.id = rf.player_id
      ORDER BY cs.total_lp DESC, cs.total_wins DESC, cs.avg_score DESC
    `);

    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

// GET /api/stats/extras - Rivalry, all-time high score, most played build
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
        ORDER BY gp.final_score DESC
        LIMIT 1
      `),
      query(`
        SELECT b.id AS build_id, b.nickname, COUNT(g.id) AS games_count
        FROM builds b
        JOIN games g ON g.build_id = b.id
        WHERE g.ended_at IS NOT NULL
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
