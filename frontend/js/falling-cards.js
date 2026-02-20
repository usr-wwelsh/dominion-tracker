/* Falling card background animation */
(function () {
  const CARDS = [
    'anvil-100x160.jpg','archive-100x160.jpg','artisan-100x159.jpg',
    'astrolabe-100x160.jpg','bandit-100x160.jpg','bank-100x159.jpg',
    'baron-100x161.jpg','bazaar-100x159.jpg','bishop-100x160.jpg',
    'blockade-100x160.jpg','bridge-100x160.jpg','bureaucrat-100x160.jpg',
    'bustling-village-100x159.jpg','capital-100x160.jpg','caravan-100x160.jpg',
    'castles-100x160.jpg','catapult-100x159.jpg','cellar-100x160.jpg',
    'chapel-100x159.jpg','chariot-race-100x159.jpg','charlatan-100x160.jpg',
    'charm-100x160.jpg','city-100x160.jpg','city-quarter-100x159.jpg',
    'clerk-100x160.jpg','colony-100x160.jpg','conspirator-100x160.jpg',
    'copper-100x161.jpg','corsair-100x160.jpg','council-room-100x159.jpg',
    'courtier-100x160.jpg','courtyard-100x160.jpg','crown-100x158.jpg',
    'crystal-ball-100x160.jpg','curse-100x160.jpg','cutpurse-100x159.jpg',
    'diplomat-100x161.jpg','duchy-100x161.jpg','duke-100x160.jpg',
    'emporium-100x159.jpg','encampment-100x159.jpg','enchantress-100x160.jpg',
    'engineer-100x159.jpg','estate-100x160.jpg','expand-100x159.jpg',
    'farmers-market-100x159.jpg','festival-100x159.jpg','fishing-village-100x160.jpg',
    'forge-100x160.jpg','fortune-100x160.jpg','forum-100x159.jpg',
    'gardens-100x159.jpg','gladiator-100x160.jpg','gold-100x159.jpg',
    'grand-market-100x160.jpg','groundskeeper-100x160.jpg','harbinger-100x160.jpg',
    'harem-100x160.jpg','haven-100x159.jpg','hoard-100x160.jpg',
    'investment-100x160.jpg','ironworks-100x160.jpg','island-100x159.jpg',
    'kings-court-100x160.jpg','laboratory-100x160.jpg','legionary-100x160.jpg',
    'library-100x160.jpg','lighthouse-100x161.jpg','lookout-100x158.jpg',
    'lurker-100x160.jpg','magnate-100x160.jpg','market-100x160.jpg',
    'masquerade-100x160.jpg','merchant-100x160.jpg','merchant-ship-100x159.jpg',
    'militia-100x160.jpg','mill-100x160.jpg','mine-100x160.jpg',
    'mining-village-100x160.jpg','minion-100x160.jpg','mint-100x159.jpg',
    'moat-100x161.jpg','moneylender-100x160.jpg','monkey-100x160.jpg',
    'monument-100x158.jpg','native-village-100x159.jpg','nobles-100x160.jpg',
    'outpost-100x160.jpg','overlord-100x159.jpg','patrician-100x160.jpg',
    'patrol-100x160.jpg','pawn-100x160.jpg','peddler-100x158.jpg',
    'platinum-100x160.jpg','plunder-100x159.jpg','poacher-100x160.jpg',
    'province-100x160.jpg','quarry-100x160.jpg','rabble-100x158.jpg',
    'remodel-100x161.jpg','replace-100x161.jpg','rocks-100x160.jpg',
    'royal-blacksmith-100x159.jpg','sacrifice-100x160.jpg','sailor-100x160.jpg',
    'salvager-100x159.jpg','sea-chart-100x160.jpg','sea-witch-100x160.jpg',
    'secret-passage-100x160.jpg','sentry-100x161.jpg','settlers-100x158.jpg',
    'shanty-town-100x160.jpg','silver-100x160.jpg','smithy-100x160.jpg',
    'smugglers-100x159.jpg','steward-100x160.jpg','swindler-100x161.jpg',
    'tactician-100x160.jpg','temple-100x160.jpg','throne-room-100x160.jpg',
    'tiara-100x160.jpg','tide-pools-100x160.jpg','torturer-100x161.jpg',
    'trading-post-100x160.jpg','Trash-Base-100x159.jpg','treasure-map-100x159.jpg',
    'treasury-100x159.jpg','upgrade-100x160.jpg','vassal-100x160.jpg',
    'vault-100x158.jpg','villa-100x159.jpg','village-100x160.jpg',
    'war-chest-100x160.jpg','warehouse-100x160.jpg','watchtower-100x159.jpg',
    'wharf-100x160.jpg','wild-hunt-100x160.jpg','wishing-well-100x160.jpg',
    'witch-100x160.jpg','workers-village-100x160.jpg','workshop-100x160.jpg',
  ];

  if (window.innerWidth < 768) return; // disable on mobile

  const FALL_DURATION_MIN = 8000;
  const FALL_DURATION_MAX = 11000;
  const SPAWN_INTERVAL    = 1900;
  const CARD_OPACITY      = 0.7;
  const STORAGE_KEY       = 'fallingCardsEnabled';

  // default on unless explicitly disabled
  let enabled = localStorage.getItem(STORAGE_KEY) !== 'false';

  // inject styles
  const style = document.createElement('style');
  style.textContent = `
    @keyframes card-fall {
      from { transform: translateY(-220px) rotate(var(--card-rot)); }
      to   { transform: translateY(calc(100vh + 220px)) rotate(var(--card-rot)); }
    }
    #falling-cards-layer {
      position: fixed;
      inset: 0;
      z-index: 0;
      pointer-events: none;
      overflow: hidden;
    }
    .falling-card {
      position: absolute;
      top: 0;
      width: 150px;
      border-radius: 4px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.6);
      opacity: ${CARD_OPACITY};
      animation: card-fall linear forwards;
    }
    #cards-toggle-btn {
      background: none;
      border: 1px solid var(--color-border);
      color: var(--color-text-secondary);
      font-family: var(--font-primary);
      font-size: 0.8rem;
      padding: 3px 10px;
      border-radius: var(--border-radius-sm);
      cursor: pointer;
      letter-spacing: 0.04em;
      transition: all 0.2s ease;
      box-shadow: none;
      transform: none;
      flex-shrink: 0;
    }
    #cards-toggle-btn:hover {
      border-color: var(--color-blue);
      color: var(--color-text-primary);
      background: var(--color-blue-dim);
      transform: none;
      box-shadow: none;
    }
    #cards-toggle-btn.cards-off {
      opacity: 0.5;
    }
  `;
  document.head.appendChild(style);

  // layer for card elements
  const layer = document.createElement('div');
  layer.id = 'falling-cards-layer';
  document.body.insertBefore(layer, document.body.firstChild);

  // toggle button injected into the site header
  const btn = document.createElement('button');
  btn.id = 'cards-toggle-btn';
  btn.title = 'Toggle falling cards animation';
  function updateBtn() {
    btn.textContent = enabled ? 'Cards: On' : 'Cards: Off';
    btn.classList.toggle('cards-off', !enabled);
  }
  updateBtn();

  const header = document.querySelector('.site-header');
  if (header) header.appendChild(btn);

  btn.addEventListener('click', () => {
    enabled = !enabled;
    localStorage.setItem(STORAGE_KEY, enabled);
    updateBtn();
    if (!enabled) {
      // remove all in-flight cards
      layer.innerHTML = '';
    } else {
      spawnCard();
    }
  });

  // animation
  let lastCard = null;
  let intervalId = null;

  function spawnCard() {
    if (!enabled) return;
    const filename = pickCard();
    const img = document.createElement('img');
    img.className = 'falling-card';
    img.src = `dominion-cards-used-small/${filename}`;
    img.alt = '';
    img.draggable = false;

    const xPercent = 5 + Math.random() * 90;
    const rot      = (Math.random() * 16 - 8).toFixed(1);
    const duration = FALL_DURATION_MIN + Math.random() * (FALL_DURATION_MAX - FALL_DURATION_MIN);

    img.style.left = `calc(${xPercent}% - 75px)`;
    img.style.setProperty('--card-rot', `${rot}deg`);
    img.style.animationDuration = `${duration}ms`;

    img.addEventListener('animationend', () => img.remove(), { once: true });
    layer.appendChild(img);
  }

  function pickCard() {
    let idx;
    do { idx = Math.floor(Math.random() * CARDS.length); }
    while (CARDS[idx] === lastCard && CARDS.length > 1);
    lastCard = CARDS[idx];
    return CARDS[idx];
  }

  if (enabled) spawnCard();
  setInterval(() => { if (enabled) spawnCard(); }, SPAWN_INTERVAL);
})();
