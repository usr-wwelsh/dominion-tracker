const express = require('express');
const cors = require('cors');
require('dotenv').config({ quiet: true });
const { migrate } = require('./migrate');
const { db } = require('./db');
const { maybeAutoImport } = require('./scripts/pg-to-sqlite');

const { requireAuth } = require('./middleware/auth');
const playersRoutes     = require('./routes/players');
const buildsRoutes      = require('./routes/builds');
const gamesRoutes       = require('./routes/games');
const tournamentsRoutes = require('./routes/tournaments');
const statsRoutes       = require('./routes/stats');
const seasonsRoutes     = require('./routes/seasons');
const bannerRoutes      = require('./routes/banner');
const profilesRoutes    = require('./routes/profiles');
const achievementsRoutes = require('./routes/achievements');
const pushRoutes        = require('./routes/push');
const cardsRoutes       = require('./routes/cards');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Serve frontend
app.use(express.static('../frontend'));

// Routes
app.use('/api/players',      playersRoutes);
app.use('/api/builds',       buildsRoutes);
app.use('/api/games',        gamesRoutes);
app.use('/api/tournaments',  tournamentsRoutes);
app.use('/api/seasons',      seasonsRoutes);
app.use('/api/banner',       bannerRoutes);
app.use('/api/profiles',     profilesRoutes);
app.use('/api/achievements', achievementsRoutes);
app.use('/api/push',         pushRoutes);
app.use('/api/cards',        cardsRoutes);
app.use('/api',              statsRoutes);

app.get('/api/auth/check', requireAuth, (req, res) => {
  res.json({ ok: true });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: { message: err.message || 'Internal server error', status: err.status || 500 }
  });
});

app.use((req, res) => {
  res.status(404).json({ error: { message: 'Not found', status: 404 } });
});

async function start() {
  migrate();
  try {
    await maybeAutoImport(db);
  } catch (err) {
    console.error('[pg-import] Auto-import failed; continuing with current SQLite data:', err.message);
  }
  try {
    const { backfillAchievements } = require('./routes/achievements');
    await backfillAchievements();
  } catch (err) {
    console.error('Achievement backfill failed:', err.message);
  }
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

start();
