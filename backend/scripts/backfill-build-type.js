/**
 * One-time backfill: derive build_type from the legacy nickname-prefix
 * convention, then strip the prefix so nickname holds just the display name.
 *
 *   "* Name"  -> build_type = suggested   (from the book)
 *   "? Name"  -> build_type = experimental
 *   "Name"    -> build_type = custom      (default, untouched)
 *
 * Prefix may or may not be followed by a space in older data.
 *
 * Usage: node backend/scripts/backfill-build-type.js [--dry-run]
 */

const { db } = require('../db');

// Returns null when nickname carries no legacy prefix — callers must leave
// build_type untouched in that case (already-clean rows are not "custom" by
// derivation, just unclassified, and re-running this script must be a no-op).
function classify(nickname) {
  const m = nickname.match(/^([*?])\s*(.*)$/s);
  if (!m) return null;
  const [, prefix, rest] = m;
  const build_type = prefix === '*' ? 'suggested' : 'experimental';
  return { build_type, nickname: rest.trim() };
}

function run({ dryRun } = {}) {
  const builds = db.prepare('SELECT id, nickname, build_type FROM builds').all();
  const update = db.prepare('UPDATE builds SET nickname = ?, build_type = ? WHERE id = ?');

  const changes = [];
  const apply = db.transaction((rows) => {
    for (const row of rows) {
      const classified = classify(row.nickname);
      if (!classified) continue;
      const { build_type, nickname } = classified;
      if (build_type === row.build_type && nickname === row.nickname) continue;
      changes.push({ id: row.id, from: row.nickname, to: nickname, build_type });
      if (!dryRun) update.run(nickname, build_type, row.id);
    }
  });
  apply(builds);

  if (changes.length === 0) {
    console.log('No builds needed backfilling.');
    return changes;
  }

  console.log(`${dryRun ? '[dry run] ' : ''}Backfilled ${changes.length} build(s):`);
  for (const c of changes) {
    console.log(`  #${c.id}: "${c.from}" -> "${c.to}" (${c.build_type})`);
  }
  return changes;
}

if (require.main === module) {
  run({ dryRun: process.argv.includes('--dry-run') });
}

module.exports = { run, classify };
