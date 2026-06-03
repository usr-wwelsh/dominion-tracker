const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config({ quiet: true });

const dbPath = process.env.SQLITE_PATH || path.join(__dirname, 'data', 'dominion.db');

// Ensure the data directory exists
const fs = require('fs');
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

console.log(`SQLite database opened at ${dbPath}`);

// Translate Postgres $1,$2,... placeholders to SQLite ?
function translateSql(text) {
  return text.replace(/\$\d+/g, '?');
}

// Determine if the SQL statement returns rows
function returnsRows(text) {
  const t = text.trimStart().toUpperCase();
  return t.startsWith('SELECT') || t.startsWith('WITH') || /\bRETURNING\b/i.test(text);
}

function executeQuery(text, params = []) {
  const sql = translateSql(text);
  try {
    const stmt = db.prepare(sql);
    if (returnsRows(text)) {
      const rows = stmt.all(...params);
      return { rows, rowCount: rows.length };
    } else {
      const result = stmt.run(...params);
      return { rows: [], rowCount: result.changes, lastInsertRowid: result.lastInsertRowid };
    }
  } catch (err) {
    // Map SQLite unique constraint errors to the Postgres code routes expect
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      err.code = '23505';
    }
    console.error('Query error', { text: text.slice(0, 120), err: err.message });
    throw err;
  }
}

// Async query wrapper — same signature as the pg pool helper
const query = (text, params) => Promise.resolve(executeQuery(text, params));

// Transaction client — maps BEGIN/COMMIT/ROLLBACK strings; everything else
// goes through the shared executeQuery. Returns a plain object (not async ctor)
// so existing `await getClient()` calls resolve immediately.
const getClient = () => {
  let active = false;

  const clientQuery = (text, params = []) => {
    const trimmed = text.trim().toUpperCase();
    if (trimmed === 'BEGIN') {
      if (!active) { db.prepare('BEGIN').run(); active = true; }
      return Promise.resolve({ rows: [], rowCount: 0 });
    }
    if (trimmed === 'COMMIT') {
      if (active) { db.prepare('COMMIT').run(); active = false; }
      return Promise.resolve({ rows: [], rowCount: 0 });
    }
    if (trimmed === 'ROLLBACK') {
      if (active) { try { db.prepare('ROLLBACK').run(); } catch {} active = false; }
      return Promise.resolve({ rows: [], rowCount: 0 });
    }
    return query(text, params);
  };

  return Promise.resolve({
    query: clientQuery,
    release: () => {},
  });
};

// Expose the raw db instance for migrate.js (needs db.exec for multi-statement SQL)
module.exports = { query, getClient, db };
