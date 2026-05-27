const express = require('express');
const router = express.Router();
const { query } = require('../db');

// GET /api/achievements/:playerId
router.get('/:playerId', async (req, res, next) => {
  try {
    const { playerId } = req.params;

    const allResult = await query('SELECT * FROM achievements ORDER BY id');
    const earnedResult = await query(
      `SELECT pa.achievement_id, pa.earned_at
       FROM player_achievements pa
       WHERE pa.player_id = ?`,
      [playerId]
    );

    const earnedMap = new Map(earnedResult.rows.map(r => [r.achievement_id, r.earned_at]));
    const achievements = allResult.rows.map(a => ({
      ...a,
      earned: earnedMap.has(a.id),
      earned_at: earnedMap.get(a.id) || null,
    }));

    res.json(achievements);
  } catch (error) {
    next(error);
  }
});

// Called after a game ends to check and award new achievements
async function evaluateAchievements(playerIds) {
  for (const playerId of playerIds) {
    const statsResult = await query(`
      SELECT
        COUNT(*) AS total_games,
        SUM(CASE WHEN gp.placement = 1 THEN 1 ELSE 0 END) AS total_wins,
        MAX(gp.final_score) AS best_score
      FROM game_players gp
      JOIN games g ON gp.game_id = g.id
      WHERE gp.player_id = ? AND g.ended_at IS NOT NULL
    `, [playerId]);

    const stats = statsResult.rows[0];
    if (!stats) continue;

    const { total_games, total_wins, best_score } = stats;

    // Win streak: last N games all placement=1
    const recentResult = await query(`
      SELECT gp.placement
      FROM game_players gp
      JOIN games g ON gp.game_id = g.id
      WHERE gp.player_id = ? AND g.ended_at IS NOT NULL
      ORDER BY g.ended_at DESC
      LIMIT 3
    `, [playerId]);
    const streak3 = recentResult.rows.length >= 3 && recentResult.rows.every(r => r.placement === 1);

    // All players: check if this player has played with every other player
    const allPlayersResult = await query('SELECT COUNT(*) AS c FROM players');
    const totalPlayers = allPlayersResult.rows[0].c;
    const distinctOpponentsResult = await query(`
      SELECT COUNT(DISTINCT gp2.player_id) AS c
      FROM game_players gp1
      JOIN game_players gp2 ON gp1.game_id = gp2.game_id AND gp2.player_id != gp1.player_id
      JOIN games g ON gp1.game_id = g.id
      WHERE gp1.player_id = ? AND g.ended_at IS NOT NULL
    `, [playerId]);
    const distinctOpponents = distinctOpponentsResult.rows[0].c;
    const playedWithAll = totalPlayers >= 2 && distinctOpponents >= totalPlayers - 1;

    const conditions = [
      { key: 'first_win',     earned: total_wins >= 1 },
      { key: 'wins_5',        earned: total_wins >= 5 },
      { key: 'wins_25',       earned: total_wins >= 25 },
      { key: 'games_10',      earned: total_games >= 10 },
      { key: 'games_50',      earned: total_games >= 50 },
      { key: 'high_score_60', earned: best_score >= 60 },
      { key: 'high_score_80', earned: best_score >= 80 },
      { key: 'win_streak_3',  earned: streak3 },
      { key: 'all_players',   earned: playedWithAll },
    ];

    const achResult = await query('SELECT id, key FROM achievements');
    const keyToId = new Map(achResult.rows.map(a => [a.key, a.id]));

    for (const { key, earned } of conditions) {
      if (!earned) continue;
      const achId = keyToId.get(key);
      if (!achId) continue;
      // Insert only if not already earned (UNIQUE constraint handles idempotency)
      try {
        await query(
          'INSERT OR IGNORE INTO player_achievements (player_id, achievement_id) VALUES (?, ?)',
          [playerId, achId]
        );
      } catch {}
    }
  }
}

module.exports = router;
module.exports.evaluateAchievements = evaluateAchievements;
