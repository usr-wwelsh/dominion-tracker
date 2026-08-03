require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { nextPow2, seedOrder, podSizes } = require('../routes/tournaments');

test('nextPow2 rounds up to the next bracket size', () => {
  assert.equal(nextPow2(1), 1);
  assert.equal(nextPow2(2), 2);
  assert.equal(nextPow2(3), 4);
  assert.equal(nextPow2(5), 8);
  assert.equal(nextPow2(8), 8);
  assert.equal(nextPow2(9), 16);
});

test('seedOrder produces a bracket of the requested size', () => {
  for (const size of [2, 4, 8, 16]) {
    const order = seedOrder(size);
    assert.equal(order.length, size);
    // every seed from 1..size appears exactly once
    assert.deepEqual([...order].sort((a, b) => a - b), Array.from({ length: size }, (_, i) => i + 1));
  }
});

test('seedOrder pairs strongest against weakest in the first round', () => {
  // Standard tournament seeding: adjacent pairs sum to size + 1, so seed 1
  // faces the bottom seed, seed 2 faces the second-from-bottom, and so on.
  for (const size of [2, 4, 8, 16]) {
    const order = seedOrder(size);
    for (let i = 0; i < size; i += 2) {
      assert.equal(order[i] + order[i + 1], size + 1);
    }
  }
});

test('seedOrder keeps the top two seeds apart until the final', () => {
  const order = seedOrder(8);
  assert.equal(order[0], 1);
  // seed 2 sits in the opposite half of the bracket
  assert.ok(order.indexOf(2) >= 4, 'seed 2 should be in the bottom half');
});

test('podSizes seats every player in a playable pod', () => {
  const sum = xs => xs.reduce((a, b) => a + b, 0);
  for (let n = 3; n <= 24; n++) {
    const sizes = podSizes(n);
    assert.equal(sum(sizes), n, `pods for ${n} players must seat everyone`);
    for (const s of sizes) {
      assert.ok(s >= 2 && s <= 4, `pod size ${s} out of range for n=${n}`);
    }
  }
});

test('podSizes prefers pods of three or four', () => {
  // Five is the one count that cannot be split into 3s and 4s, so it takes a
  // pair; every other count avoids two-player pods.
  for (let n = 3; n <= 24; n++) {
    if (n === 5) continue;
    for (const s of podSizes(n)) {
      assert.ok(s === 3 || s === 4, `n=${n} should not need a pod of ${s}`);
    }
  }
  assert.deepEqual(podSizes(5), [3, 2]);
});

test('podSizes distributes the remainder rather than making a tiny pod', () => {
  assert.deepEqual(podSizes(3), [3]);
  assert.deepEqual(podSizes(4), [4]);
  assert.deepEqual(podSizes(6), [3, 3]);
  assert.deepEqual(podSizes(7), [3, 4]);
  assert.deepEqual(podSizes(8), [4, 4]);
  assert.deepEqual(podSizes(11), [3, 4, 4]);
});

test('podSizes creates no pods when there are no players', () => {
  // An empty pod would produce a game with zero players attached.
  assert.deepEqual(podSizes(0), []);
});
