// Regenerates frontend/js/cards.js and the falling-cards.js background list
// from whatever image files actually exist in frontend/dominion-cards-used-small/.
// Run this after adding/removing card art so the picker and falling-cards
// animation pick up the change: node backend/scripts/sync-card-art.js
const fs = require('fs');
const path = require('path');

const CARDS_DIR      = path.join(__dirname, '..', '..', 'frontend', 'dominion-cards-used-small');
const CARDS_JS        = path.join(__dirname, '..', '..', 'frontend', 'js', 'cards.js');
const FALLING_CARDS_JS = path.join(__dirname, '..', '..', 'frontend', 'js', 'falling-cards.js');

// Turn a raw filename into a readable card name:
//   300px-Gold_Mine-100x160.jpg -> "Gold Mine"
//   anvil-100x160.jpg           -> "Anvil"
function labelFor(filename) {
  return filename
    .replace(/\.(png|jpg|webp)$/i, '')
    .replace(/^300px-/, '')
    .replace(/-\d+x\d+$/, '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

const filenames = fs.readdirSync(CARDS_DIR).filter(f => /\.(png|jpg|webp)$/i.test(f));

const cardImages = filenames
  .map(filename => ({ filename, label: labelFor(filename) }))
  .sort((a, b) => a.label.localeCompare(b.label));

const cardsJsContent = `// Auto-generated from frontend/dominion-cards-used-small/. Regenerate with:
//   node backend/scripts/sync-card-art.js
const CARD_IMAGES = ${JSON.stringify(cardImages)};
`;
fs.writeFileSync(CARDS_JS, cardsJsContent);

const fallingList = filenames.slice().sort((a, b) => a.localeCompare(b));
const fallingArrayLiteral = fallingList.map(f => `    ${JSON.stringify(f)}`).join(',\n');

const falling = fs.readFileSync(FALLING_CARDS_JS, 'utf8');
const cardsArrayPattern = /const CARDS = \[[\s\S]*?\];/;
if (!cardsArrayPattern.test(falling)) {
  throw new Error('Could not find CARDS array in falling-cards.js to replace');
}
const updated = falling.replace(
  cardsArrayPattern,
  `const CARDS = [\n${fallingArrayLiteral},\n  ];`
);
fs.writeFileSync(FALLING_CARDS_JS, updated);

console.log(`Synced ${cardImages.length} card images into cards.js and falling-cards.js`);
