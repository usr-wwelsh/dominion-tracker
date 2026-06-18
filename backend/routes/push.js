const express = require('express');
const router = express.Router();
const { query } = require('../db');
let webpush;
try { webpush = require('web-push'); } catch { webpush = null; }

function isConfigured() {
  return !!(process.env.VAPID_PUBLIC && process.env.VAPID_PRIVATE && webpush);
}

if (isConfigured()) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC,
    process.env.VAPID_PRIVATE
  );
}

// GET /api/push/key — public VAPID key for frontend subscription
router.get('/key', (req, res) => {
  if (!isConfigured()) return res.json({ key: null });
  res.json({ key: process.env.VAPID_PUBLIC });
});

// POST /api/push/subscribe
router.post('/subscribe', async (req, res, next) => {
  try {
    const { subscription, player_id } = req.body;
    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }

    await query(
      `INSERT INTO push_subscriptions (endpoint, p256dh, auth, player_id)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
         p256dh = excluded.p256dh,
         auth = excluded.auth,
         player_id = excluded.player_id`,
      [subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth, player_id || null]
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/push/unsubscribe
router.post('/unsubscribe', async (req, res, next) => {
  try {
    const { endpoint } = req.body;
    if (endpoint) await query('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint]);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Send a push notification to all subscribers
async function sendToAll(title, body, data = {}) {
  if (!isConfigured()) return;
  const subs = await query('SELECT * FROM push_subscriptions');
  const payload = JSON.stringify({ title, body, data });

  for (const sub of subs.rows) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      );
    } catch (err) {
      // Remove expired/invalid subscriptions
      if (err.statusCode === 410 || err.statusCode === 404) {
        await query('DELETE FROM push_subscriptions WHERE endpoint = ?', [sub.endpoint]).catch(() => {});
      }
    }
  }
}

// Called after a game ends — notify if the #1 leaderboard position changed
let lastFirst = null;
async function notifyRankChanges() {
  if (!isConfigured()) return;
  try {
    const result = await query(`
      SELECT p.id, p.name, SUM(gp.league_points) AS lp
      FROM players p
      JOIN game_players gp ON gp.player_id = p.id
      JOIN games g ON gp.game_id = g.id
      WHERE g.ended_at IS NOT NULL
        AND g.season_id = (SELECT id FROM seasons WHERE ended_at IS NULL ORDER BY id DESC LIMIT 1)
      GROUP BY p.id, p.name
      ORDER BY lp DESC
      LIMIT 1
    `);
    if (result.rows.length === 0) return;
    const newFirst = result.rows[0];
    if (lastFirst && lastFirst.id !== newFirst.id) {
      await sendToAll(
        'Leaderboard Update',
        `${newFirst.name} has taken first place on the Season 2 leaderboard!`,
        { type: 'rank_change', player_id: newFirst.id }
      );
    }
    lastFirst = newFirst;
  } catch {}
}

module.exports = router;
module.exports.sendToAll = sendToAll;
module.exports.notifyRankChanges = notifyRankChanges;
