const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const CARDS_DIR = path.join(__dirname, '..', '..', 'frontend', 'dominion-cards-used-small');

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

let cards = [];
try {
  cards = fs.readdirSync(CARDS_DIR)
    .filter(f => /\.(png|jpg|webp)$/i.test(f))
    .map(filename => ({ filename, label: labelFor(filename) }))
    .sort((a, b) => a.label.localeCompare(b.label));
} catch { /* assets absent in tests */ }

// GET /api/cards — valid card image filenames + readable labels
router.get('/', (req, res) => {
  res.json(cards);
});

module.exports = router;
