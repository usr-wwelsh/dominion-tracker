require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const { hydrateBuild } = require('../routes/builds');
const { parsePlayers } = require('../routes/games');
const { labelFor } = require('../routes/cards');

// SQLite has no array or boolean types, so builds store their card lists as
// JSON text and their flags as 0/1. hydrateBuild turns a raw row back into the
// shape the frontend expects.

test('hydrateBuild parses JSON list columns', () => {
  const row = hydrateBuild({
    cards: '["Village","Smithy"]',
    landmarks: '["Aqueduct"]',
    events: '[]',
    prophecies: '["Good Harvest"]',
    traits: '["Cursed"]',
  });
  assert.deepEqual(row.cards, ['Village', 'Smithy']);
  assert.deepEqual(row.landmarks, ['Aqueduct']);
  assert.deepEqual(row.events, []);
  assert.deepEqual(row.prophecies, ['Good Harvest']);
  assert.deepEqual(row.traits, ['Cursed']);
});

test('hydrateBuild defaults missing list columns to empty arrays', () => {
  const row = hydrateBuild({ cards: '["Village"]' });
  assert.deepEqual(row.landmarks, []);
  assert.deepEqual(row.events, []);
  assert.deepEqual(row.prophecies, []);
  assert.deepEqual(row.traits, []);
});

test('hydrateBuild converts SQLite 0/1 flags to booleans', () => {
  const on = hydrateBuild({ use_platinum_colony: 1, use_shelters: 1 });
  assert.equal(on.use_platinum_colony, true);
  assert.equal(on.use_shelters, true);

  const off = hydrateBuild({ use_platinum_colony: 0, use_shelters: 0 });
  assert.equal(off.use_platinum_colony, false);
  assert.equal(off.use_shelters, false);
});

test('hydrateBuild passes through a null row', () => {
  assert.equal(hydrateBuild(null), null);
});

test('hydrateBuild is idempotent on already-parsed rows', () => {
  const once = hydrateBuild({ cards: '["Village"]', use_shelters: 1 });
  const twice = hydrateBuild({ ...once });
  assert.deepEqual(twice.cards, ['Village']);
  assert.equal(twice.use_shelters, true);
});

test('parsePlayers expands the aggregated players JSON', () => {
  const row = parsePlayers({
    id: 1,
    players: '[{"player_id":2,"player_name":"Ada","final_score":42}]',
  });
  assert.deepEqual(row.players, [{ player_id: 2, player_name: 'Ada', final_score: 42 }]);
});

test('parsePlayers leaves a row without a players column alone', () => {
  assert.deepEqual(parsePlayers({ id: 1 }), { id: 1 });
  assert.equal(parsePlayers(null), null);
});

test('labelFor turns card filenames into readable names', () => {
  assert.equal(labelFor('300px-Gold_Mine-100x160.jpg'), 'Gold Mine');
  assert.equal(labelFor('anvil-100x159.jpg'), 'Anvil');
  assert.equal(labelFor('300px-Imperial_Envoy-100x160.jpg'), 'Imperial Envoy');
  assert.equal(labelFor('abandoned-mine-100x159.jpg'), 'Abandoned Mine');
});
