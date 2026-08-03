require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { translateSql, returnsRows } = require('../db');

// db.js is a compatibility shim left over from the Postgres era: routes may
// still use $1-style placeholders, and the wrapper has to decide whether a
// statement returns rows before choosing stmt.all() vs stmt.run().

test('translateSql rewrites Postgres placeholders to SQLite ones', () => {
  assert.equal(
    translateSql('SELECT * FROM players WHERE id = $1'),
    'SELECT * FROM players WHERE id = ?'
  );
  assert.equal(
    translateSql('INSERT INTO games (build_id, season_id) VALUES ($1, $2)'),
    'INSERT INTO games (build_id, season_id) VALUES (?, ?)'
  );
});

test('translateSql handles double-digit placeholders', () => {
  assert.equal(translateSql('VALUES ($10, $11)'), 'VALUES (?, ?)');
});

test('translateSql leaves native ? placeholders untouched', () => {
  const sql = 'SELECT * FROM players WHERE id = ? AND name = ?';
  assert.equal(translateSql(sql), sql);
});

test('returnsRows detects row-producing statements', () => {
  assert.equal(returnsRows('SELECT * FROM players'), true);
  assert.equal(returnsRows('  select id from games'), true);
  assert.equal(returnsRows('WITH x AS (SELECT 1) SELECT * FROM x'), true);
});

test('returnsRows detects RETURNING clauses on writes', () => {
  assert.equal(returnsRows('INSERT INTO players (name) VALUES (?) RETURNING *'), true);
  assert.equal(returnsRows('UPDATE players SET color = ? WHERE id = ? RETURNING *'), true);
});

test('returnsRows rejects plain writes', () => {
  assert.equal(returnsRows('INSERT INTO players (name) VALUES (?)'), false);
  assert.equal(returnsRows('UPDATE games SET ended_at = CURRENT_TIMESTAMP WHERE id = ?'), false);
  assert.equal(returnsRows('DELETE FROM games WHERE id = ?'), false);
});
