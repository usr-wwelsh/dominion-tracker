const fs = require('fs');
const path = require('path');
const { db } = require('./db');

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT UNIQUE NOT NULL,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const applied = new Set(
    db.prepare('SELECT filename FROM schema_migrations ORDER BY filename').all().map(r => r.filename)
  );

  const migrationsDir = path.join(__dirname, 'migrations', 'sqlite');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) continue;
    console.log(`Applying migration: ${file}`);
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    // db.exec runs arbitrary multi-statement SQL in one shot
    db.exec(`BEGIN; ${sql} INSERT INTO schema_migrations (filename) VALUES ('${file}'); COMMIT;`);
    console.log(`Applied: ${file}`);
    count++;
  }

  if (count === 0) {
    console.log('Database up to date.');
  } else {
    console.log(`Applied ${count} migration(s).`);
  }
}

module.exports = { migrate };
