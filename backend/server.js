require('dotenv').config({ quiet: true });
const app = require('./app');
const { migrate } = require('./migrate');
const { db } = require('./db');
const { maybeAutoImport } = require('./scripts/pg-to-sqlite');

const PORT = process.env.PORT || 3000;

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
