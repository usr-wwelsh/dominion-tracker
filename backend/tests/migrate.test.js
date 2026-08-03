require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { db } = require('../db');
const { migrate } = require('../migrate');

function migrationsDirWith(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dominion-migrate-'));
  for (const [name, sql] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), sql);
  }
  return dir;
}

function silently(fn) {
  const realLog = console.log;
  console.log = () => {};
  try {
    return fn();
  } finally {
    console.log = realLog;
  }
}

test('a migration filename containing an apostrophe applies cleanly', () => {
  // The filename used to be interpolated straight into the INSERT that records
  // it, so "everyone's_rival.sql" closed the string literal and broke the run.
  const filename = "001_everyone's_rival.sql";
  const dir = migrationsDirWith({
    [filename]: 'CREATE TABLE IF NOT EXISTS apostrophe_probe (id INTEGER PRIMARY KEY);',
  });

  silently(() => migrate(dir));

  const table = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'apostrophe_probe'")
    .get();
  assert.ok(table, 'the migration body should have run');

  const recorded = db
    .prepare('SELECT filename FROM schema_migrations WHERE filename = ?')
    .get(filename);
  assert.ok(recorded, 'the migration should be recorded under its exact filename');
});

test('an already-applied migration is not run twice', () => {
  const dir = migrationsDirWith({
    '002_counter.sql': `
      CREATE TABLE IF NOT EXISTS migrate_counter (n INTEGER);
      INSERT INTO migrate_counter (n) VALUES (1);
    `,
  });

  silently(() => migrate(dir));
  silently(() => migrate(dir));

  const { c } = db.prepare('SELECT COUNT(*) AS c FROM migrate_counter').get();
  assert.equal(c, 1, 'the second run should have skipped the applied file');
});

test('a failed migration leaves no half-applied schema behind', () => {
  const dir = migrationsDirWith({
    '003_broken.sql': `
      CREATE TABLE IF NOT EXISTS broken_probe (id INTEGER PRIMARY KEY);
      THIS IS NOT SQL;
    `,
  });

  assert.throws(() => silently(() => migrate(dir)));

  const table = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'broken_probe'")
    .get();
  assert.equal(table, undefined, 'the transaction should have rolled back');
  const recorded = db
    .prepare('SELECT filename FROM schema_migrations WHERE filename = ?')
    .get('003_broken.sql');
  assert.equal(recorded, undefined, 'a failed migration must not be recorded as applied');
});
