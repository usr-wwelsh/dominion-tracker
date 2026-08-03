require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { levelFromSeconds } = require('../routes/players');

// XP is total play seconds / 300, level is floor(sqrt(xp)).

test('a player with no completed games is level 0', () => {
  assert.deepEqual(levelFromSeconds(0), {
    total_xp: 0, level: 0, xp_into_level: 0, xp_for_next: 1,
  });
});

test('300 seconds of play is one XP', () => {
  assert.equal(levelFromSeconds(300).total_xp, 1);
  assert.equal(levelFromSeconds(299).total_xp, 0);
  assert.equal(levelFromSeconds(1500).total_xp, 5);
});

test('levels land on perfect squares of XP', () => {
  assert.equal(levelFromSeconds(1 * 300).level, 1);   // 1 xp  -> level 1
  assert.equal(levelFromSeconds(3 * 300).level, 1);   // 3 xp  -> still level 1
  assert.equal(levelFromSeconds(4 * 300).level, 2);   // 4 xp  -> level 2
  assert.equal(levelFromSeconds(9 * 300).level, 3);
  assert.equal(levelFromSeconds(16 * 300).level, 4);
});

test('each level costs more play time than the last', () => {
  let previousCost = 0;
  for (let level = 1; level <= 10; level++) {
    const cost = levelFromSeconds(level * level * 300).xp_for_next;
    assert.ok(cost > previousCost, `level ${level} should cost more than the previous`);
    previousCost = cost;
  }
});

test('progress into a level stays within its cost', () => {
  for (const seconds of [0, 300, 1000, 5000, 50000, 500000]) {
    const { xp_into_level, xp_for_next } = levelFromSeconds(seconds);
    assert.ok(xp_into_level >= 0, 'progress cannot be negative');
    assert.ok(xp_into_level < xp_for_next, 'progress cannot exceed the level cost');
  }
});

test('null or negative play time is treated as zero', () => {
  assert.equal(levelFromSeconds(null).total_xp, 0);
  assert.equal(levelFromSeconds(undefined).total_xp, 0);
  assert.equal(levelFromSeconds(-500).total_xp, 0);
  assert.equal(levelFromSeconds(-500).level, 0);
});
