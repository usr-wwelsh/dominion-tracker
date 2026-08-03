require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateAverageLeaguePoints } = require('../routes/games');

// League points are a 0-100 scale: first place scores 100, last place 0, and
// the rest are spaced evenly between. A tied group splits the average of the
// slots it occupies.
//   avg = 100 * (n - startPlacement - (numTied - 1) / 2) / (n - 1)

test('four players, no ties, spans the full 0-100 range', () => {
  assert.equal(calculateAverageLeaguePoints(1, 1, 4), 100);
  assert.equal(calculateAverageLeaguePoints(2, 1, 4), 66.67);
  assert.equal(calculateAverageLeaguePoints(3, 1, 4), 33.33);
  assert.equal(calculateAverageLeaguePoints(4, 1, 4), 0);
});

test('two players, no ties', () => {
  assert.equal(calculateAverageLeaguePoints(1, 1, 2), 100);
  assert.equal(calculateAverageLeaguePoints(2, 1, 2), 0);
});

test('a tied group receives the average of the slots it occupies', () => {
  // 4 players, top two tie: they share slots 1 and 2 -> (100 + 66.67) / 2
  assert.equal(calculateAverageLeaguePoints(1, 2, 4), 83.33);
  // ...and the remaining two take slots 3 and 4 unchanged
  assert.equal(calculateAverageLeaguePoints(3, 1, 4), 33.33);
});

test('a tie spanning every player awards everyone the midpoint', () => {
  assert.equal(calculateAverageLeaguePoints(1, 4, 4), 50);
  assert.equal(calculateAverageLeaguePoints(1, 2, 2), 50);
});

test('points across a full game always sum to the same total', () => {
  // Whatever the tie structure, the pot is conserved: no arrangement of ties
  // can be worth more league points than any other.
  const noTies = [1, 2, 3, 4].map(p => calculateAverageLeaguePoints(p, 1, 4));
  const topTwoTied = [
    ...Array(2).fill(calculateAverageLeaguePoints(1, 2, 4)),
    calculateAverageLeaguePoints(3, 1, 4),
    calculateAverageLeaguePoints(4, 1, 4),
  ];
  const allTied = Array(4).fill(calculateAverageLeaguePoints(1, 4, 4));

  const sum = xs => Math.round(xs.reduce((a, b) => a + b, 0));
  assert.equal(sum(noTies), 200);
  assert.equal(sum(topTwoTied), 200);
  assert.equal(sum(allTied), 200);
});

test('results are ordered: better placement never scores fewer points', () => {
  for (let n = 2; n <= 8; n++) {
    for (let p = 1; p < n; p++) {
      assert.ok(
        calculateAverageLeaguePoints(p, 1, n) > calculateAverageLeaguePoints(p + 1, 1, n),
        `n=${n}: placement ${p} should outscore ${p + 1}`
      );
    }
  }
});

test('a solo game yields a real number, not NaN', () => {
  // The formula divides by (n - 1), so a single-player game is a degenerate
  // case. It must not write NaN into game_players.league_points.
  const points = calculateAverageLeaguePoints(1, 1, 1);
  assert.ok(Number.isFinite(points), `expected a finite number, got ${points}`);
  assert.equal(points, 0);
});

test('an empty game yields a real number, not NaN', () => {
  const points = calculateAverageLeaguePoints(1, 0, 0);
  assert.ok(Number.isFinite(points), `expected a finite number, got ${points}`);
});
