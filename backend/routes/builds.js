const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

function hydrateBuild(row) {
  if (!row) return row;
  row.cards      = typeof row.cards      === 'string' ? JSON.parse(row.cards)      : (row.cards      || []);
  row.landmarks  = typeof row.landmarks  === 'string' ? JSON.parse(row.landmarks)  : (row.landmarks  || []);
  row.events     = typeof row.events     === 'string' ? JSON.parse(row.events)     : (row.events     || []);
  row.prophecies = typeof row.prophecies === 'string' ? JSON.parse(row.prophecies) : (row.prophecies || []);
  row.use_platinum_colony = !!row.use_platinum_colony;
  return row;
}

const BUILD_SELECT = `
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
`;

router.get('/', async (req, res, next) => {
  try {
    const result = await query(`${BUILD_SELECT} ORDER BY b.created_at DESC`);
    res.json(result.rows.map(hydrateBuild));
  } catch (error) {
    next(error);
  }
});

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
      `INSERT INTO builds (nickname, cards, landmarks, events, prophecies, use_platinum_colony)
       VALUES (?, ?, ?, ?, ?, ?) RETURNING *`,
      [
        nickname.trim(),
        JSON.stringify(cards),
        JSON.stringify(Array.isArray(landmarks) ? landmarks : []),
        JSON.stringify(Array.isArray(events) ? events : []),
        JSON.stringify(Array.isArray(prophecies) ? prophecies : []),
        use_platinum_colony === true ? 1 : 0,
      ]
    );

    res.status(201).json(hydrateBuild(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await query(`${BUILD_SELECT} WHERE b.id = ?`, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Build not found' });
    }
    res.json(hydrateBuild(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { nickname, cards, landmarks, events, prophecies, use_platinum_colony } = req.body;

    if (!nickname || nickname.trim() === '') {
      return res.status(400).json({ error: 'Build nickname is required' });
    }
    if (!cards || !Array.isArray(cards) || cards.length === 0) {
      return res.status(400).json({ error: 'Cards array is required and must not be empty' });
    }

    const result = await query(
      `UPDATE builds SET nickname = ?, cards = ?, landmarks = ?, events = ?, prophecies = ?,
       use_platinum_colony = ? WHERE id = ? RETURNING *`,
      [
        nickname.trim(),
        JSON.stringify(cards),
        JSON.stringify(Array.isArray(landmarks) ? landmarks : []),
        JSON.stringify(Array.isArray(events) ? events : []),
        JSON.stringify(Array.isArray(prophecies) ? prophecies : []),
        use_platinum_colony === true ? 1 : 0,
        req.params.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Build not found' });
    }
    res.json(hydrateBuild(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const result = await query('DELETE FROM builds WHERE id = ? RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Build not found' });
    }
    res.json({ message: 'Build deleted successfully', build: hydrateBuild(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/comments', async (req, res, next) => {
  try {
    const result = await query(`
      SELECT bc.*, p.name as player_name, p.color as player_color,
             gp.placement, g.started_at as game_started_at
      FROM build_comments bc
      JOIN players p ON bc.player_id = p.id
      JOIN game_players gp ON gp.game_id = bc.game_id AND gp.player_id = bc.player_id
      JOIN games g ON g.id = bc.game_id
      WHERE bc.build_id = ?
      ORDER BY g.started_at DESC, bc.created_at ASC
    `, [req.params.id]);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.post('/:id/comments', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { game_id, player_id, comment_text } = req.body;

    if (!game_id || !player_id || !comment_text || comment_text.trim() === '') {
      return res.status(400).json({ error: 'game_id, player_id, and comment_text are required' });
    }

    const valid = await query(`
      SELECT gp.id FROM game_players gp
      JOIN games g ON gp.game_id = g.id
      WHERE gp.game_id = ? AND gp.player_id = ? AND g.build_id = ?
    `, [game_id, player_id, id]);

    if (valid.rows.length === 0) {
      return res.status(400).json({ error: 'Player did not participate in this game or game does not use this build' });
    }

    const result = await query(
      'INSERT INTO build_comments (build_id, game_id, player_id, comment_text) VALUES (?, ?, ?, ?) RETURNING *',
      [id, game_id, player_id, comment_text.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.delete('/:buildId/comments/:commentId', requireAuth, async (req, res, next) => {
  try {
    const { buildId, commentId } = req.params;
    const result = await query(
      'DELETE FROM build_comments WHERE id = ? AND build_id = ? RETURNING *',
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
