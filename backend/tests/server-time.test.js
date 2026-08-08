const { test } = require('node:test');
const assert = require('node:assert');

const { parseServerTime } = require('../../frontend/js/api.js');

test('a bare SQLite timestamp is read as UTC, not as local time', () => {
  // SQLite CURRENT_TIMESTAMP writes UTC with no zone suffix. Parsing it with a
  // bare `new Date()` treats it as local, which shifts displayed times by the
  // viewer's UTC offset — the bug this helper exists to prevent.
  assert.equal(parseServerTime('2026-08-08 14:00:00').toISOString(), '2026-08-08T14:00:00.000Z');
});

test('an ISO timestamp that already carries a zone is left alone', () => {
  assert.equal(parseServerTime('2026-08-08T14:00:00Z').toISOString(), '2026-08-08T14:00:00.000Z');
  assert.equal(parseServerTime('2026-08-08T10:00:00-04:00').toISOString(), '2026-08-08T14:00:00.000Z');
});

test('a zoneless ISO timestamp is also read as UTC', () => {
  assert.equal(parseServerTime('2026-08-08T14:00:00').toISOString(), '2026-08-08T14:00:00.000Z');
});

test('a missing timestamp yields null so callers can render a placeholder', () => {
  assert.equal(parseServerTime(null), null);
  assert.equal(parseServerTime(undefined), null);
  assert.equal(parseServerTime(''), null);
});
