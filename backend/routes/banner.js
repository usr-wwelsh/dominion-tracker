const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { requireAuth } = require('../middleware/auth');

// GET /api/banner — public, returns current banner text (or null)
router.get('/', async (req, res, next) => {
  try {
    const result = await query("SELECT value FROM site_settings WHERE key = 'banner'");
    res.json({ banner: result.rows[0]?.value || null });
  } catch (error) {
    next(error);
  }
});

// PUT /api/banner — auth-gated; empty string clears the banner
router.put('/', requireAuth, async (req, res, next) => {
  try {
    const { text } = req.body;
    const value = typeof text === 'string' ? text.trim() : '';

    if (value) {
      await query(
        `INSERT INTO site_settings (key, value, updated_at) VALUES ('banner', ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
        [value]
      );
    } else {
      await query("DELETE FROM site_settings WHERE key = 'banner'");
    }

    res.json({ banner: value || null });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
