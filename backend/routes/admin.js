const express = require('express');
const router = express.Router();
const os = require('os');
const path = require('path');
const fs = require('fs');
const { db } = require('../db');
const { requireAuth } = require('../middleware/auth');

// GET /api/admin/export-db — auth-gated; downloads a consistent snapshot of the live SQLite db
router.get('/export-db', requireAuth, async (req, res, next) => {
  const tmpPath = path.join(os.tmpdir(), `dominion-export-${Date.now()}.db`);
  try {
    await db.backup(tmpPath);
    const stamp = new Date().toISOString().slice(0, 10);
    res.download(tmpPath, `dominion-backup-${stamp}.db`, (err) => {
      fs.unlink(tmpPath, () => {});
      if (err && !res.headersSent) next(err);
    });
  } catch (error) {
    fs.unlink(tmpPath, () => {});
    next(error);
  }
});

module.exports = router;
