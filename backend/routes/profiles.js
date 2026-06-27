const express = require('express');
const router = express.Router();
const { query } = require('../db');
const fs = require('fs');
const path = require('path');

const CARDS_DIR = path.join(__dirname, '..', '..', 'frontend', 'dominion-cards-used-small');

function getValidCards() {
  try {
    return new Set(fs.readdirSync(CARDS_DIR).filter(f => /\.(png|jpg|webp)$/i.test(f)));
  } catch { return new Set(); }
}

const ACCENT_PRESETS = new Set([
  '#a08850', '#3d6a8a', '#8a3d3d', '#3d8a5a', '#7a3d8a',
  '#8a6a28', '#2a5a8a', '#8a4428', '#285a44', '#5a2a8a',
  '#c0a464', '#5183a8', '#b05050', '#50b078', '#9050b0',
]);

// Avatar crop: null clears it; otherwise zoom is a scale >= 1 and x/y are
// object-position percentages in [0,100]. Only validated when avatar_card is set.
function validateCropField(v, min, max) {
  if (v === null || v === undefined) return true;
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
}

function validateProfile(body) {
  const { bio, avatar_card, background_card, accent_color, avatar_zoom, avatar_x, avatar_y } = body;
  const validCards = getValidCards();
  if (avatar_card && !validCards.has(avatar_card)) return 'Invalid avatar card filename';
  if (background_card && !validCards.has(background_card)) return 'Invalid background card filename';
  if (accent_color && !ACCENT_PRESETS.has(accent_color)) return 'Color must be one of the preset options';
  if (bio && bio.length > 500) return 'Bio must be 500 characters or fewer';
  if (!validateCropField(avatar_zoom, 1, 5)) return 'Invalid avatar zoom';
  if (!validateCropField(avatar_x, 0, 100)) return 'Invalid avatar crop position';
  if (!validateCropField(avatar_y, 0, 100)) return 'Invalid avatar crop position';
  return null;
}

// GET /api/profiles/:playerId
router.get('/:playerId', async (req, res, next) => {
  try {
    const { playerId } = req.params;
    const playerResult = await query('SELECT id, name, color FROM players WHERE id = ?', [playerId]);
    if (playerResult.rows.length === 0) return res.status(404).json({ error: 'Player not found' });

    const profResult = await query(
      'SELECT * FROM player_profiles WHERE player_id = ?', [playerId]
    );

    res.json({
      player: playerResult.rows[0],
      profile: profResult.rows[0] || null,
      accent_presets: [...ACCENT_PRESETS],
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/profiles/:playerId — open edit (no auth), validated inputs only
router.put('/:playerId', async (req, res, next) => {
  try {
    const { playerId } = req.params;

    const playerResult = await query('SELECT id FROM players WHERE id = ?', [playerId]);
    if (playerResult.rows.length === 0) return res.status(404).json({ error: 'Player not found' });

    const err = validateProfile(req.body);
    if (err) return res.status(400).json({ error: err });

    const { bio = null, avatar_card = null, background_card = null, accent_color = null, theme_json = null,
            avatar_zoom = null, avatar_x = null, avatar_y = null } = req.body;
    // Crop only makes sense alongside an avatar; clear it when none is set.
    const zoom = avatar_card ? avatar_zoom : null;
    const cropX = avatar_card ? avatar_x : null;
    const cropY = avatar_card ? avatar_y : null;

    await query(
      `INSERT INTO player_profiles (player_id, bio, avatar_card, background_card, accent_color, theme_json, avatar_zoom, avatar_x, avatar_y, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(player_id) DO UPDATE SET
         bio = excluded.bio,
         avatar_card = excluded.avatar_card,
         background_card = excluded.background_card,
         accent_color = excluded.accent_color,
         theme_json = excluded.theme_json,
         avatar_zoom = excluded.avatar_zoom,
         avatar_x = excluded.avatar_x,
         avatar_y = excluded.avatar_y,
         updated_at = CURRENT_TIMESTAMP`,
      [playerId, bio || null, avatar_card || null, background_card || null, accent_color || null, theme_json || null,
       zoom, cropX, cropY]
    );

    const result = await query('SELECT * FROM player_profiles WHERE player_id = ?', [playerId]);
    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
