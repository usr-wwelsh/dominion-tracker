const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ quiet: true });

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
const adminRoutes       = require('./routes/admin');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// Serve frontend. Resolved from __dirname so it does not depend on cwd —
// in the container backend lives at /app and frontend at /frontend, which
// matches the local layout of backend/ and frontend/ side by side.
app.use(express.static(path.join(__dirname, '..', 'frontend')));

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
app.use('/api/admin',        adminRoutes);
app.use('/api',              statsRoutes);

app.get('/api/auth/check', requireAuth, (req, res) => {
  res.json({ ok: true });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use((err, req, res, _next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: { message: err.message || 'Internal server error', status: err.status || 500 }
  });
});

app.use((req, res) => {
  res.status(404).json({ error: { message: 'Not found', status: 404 } });
});

module.exports = app;
