// Builds page logic

// Dominion kingdom card database (organized by expansion)
const DOMINION_CARDS = {
  base: [
    'Cellar', 'Chapel', 'Moat',
    'Harbinger', 'Merchant', 'Vassal', 'Village', 'Workshop',
    'Bureaucrat', 'Gardens', 'Militia', 'Moneylender', 'Poacher', 'Remodel', 'Smithy', 'Throne Room',
    'Bandit', 'Council Room', 'Festival', 'Laboratory', 'Library', 'Market', 'Mine', 'Sentry', 'Witch',
    'Artisan'
  ],
  intrigue: [
    'Courtyard', 'Lurker', 'Pawn',
    'Masquerade', 'Shanty Town', 'Steward', 'Swindler', 'Wishing Well',
    'Baron', 'Bridge', 'Conspirator', 'Diplomat', 'Ironworks', 'Mill', 'Mining Village', 'Secret Passage',
    'Courtier', 'Duke', 'Minion', 'Patrol', 'Replace', 'Torturer', 'Trading Post', 'Upgrade',
    'Harem', 'Nobles'
  ],
  seaside: [
    'Haven', 'Lighthouse', 'Native Village',
    'Astrolabe', 'Fishing Village', 'Lookout', 'Monkey', 'Sea Chart', 'Smugglers', 'Warehouse',
    'Blockade', 'Caravan', 'Cutpurse', 'Island', 'Sailor', 'Salvager', 'Tide Pools', 'Treasure Map',
    'Bazaar', 'Corsair', 'Merchant Ship', 'Outpost', 'Pirate', 'Sea Witch', 'Tactician', 'Treasury', 'Wharf'
  ],
  prosperity: [
    'Anvil', 'Watchtower',
    'Bishop', 'Clerk', 'Investment', 'Monument', 'Quarry', 'Tiara', "Worker's Village",
    'Charlatan', 'City', 'Collection', 'Crystal Ball', 'Magnate', 'Mint', 'Rabble', 'Vault', 'War Chest',
    'Hoard', 'Grand Market',
    'Bank', 'Expand', 'Forge', "King's Court",
    'Peddler'
  ],
  empires: [
    'Engineer',
    'City Quarter', 'Overlord', 'Royal Blacksmith',
    'Encampment/Plunder', 'Patrician/Emporium', 'Settlers/Bustling Village',
    'Castles', 'Catapult/Rocks', 'Chariot Race', 'Enchantress', "Farmers' Market", 'Gladiator/Fortune',
    'Sacrifice', 'Temple', 'Villa',
    'Archive', 'Capital', 'Charm', 'Crown', 'Forum', 'Groundskeeper', 'Legionary', 'Wild Hunt'
  ],
  rising_sun: [
    'Mountain Shrine',
    'Daimyo',
    'Artist',
    'Fishmonger', 'Snake Witch',
    'Aristocrat', 'Craftsman', 'Riverboat', 'Root Cellar',
    'Alley', 'Change', 'Ninja', 'Poet', 'River Shrine', 'Rustic Village',
    'Gold Mine', 'Imperial Envoy', 'Kitsune', 'Litter', 'Rice Broker', 'Ronin', 'Tanuki', 'Tea House',
    'Samurai',
    'Rice'
  ],
};

// Non-kingdom supplemental cards
const DOMINION_LANDMARKS = {
  empires: [
    'Aqueduct', 'Arena', 'Bandit Fort', 'Basilica', 'Baths', 'Battlefield', 'Colonnade',
    'Defiled Shrine', 'Fountain', 'Keep', 'Labyrinth', 'Mountain Pass', 'Museum', 'Obelisk',
    'Orchard', 'Palace', 'Tomb', 'Tower', 'Triumphal Arch', 'Wall', 'Wolf Den'
  ],
};

const DOMINION_EVENTS = {
  empires: [
    'Triumph', 'Annex', 'Donate',
    'Advance',
    'Delve', 'Tax',
    'Banquet',
    'Ritual', 'Salt the Earth', 'Wedding',
    'Windfall',
    'Conquest',
    'Dominate'
  ],
  rising_sun: [
    'Continue',
    'Amass', 'Asceticism', 'Credit', 'Foresight',
    'Kintsugi', 'Practice',
    'Sea Trade',
    'Receive Tribute',
    'Gather'
  ],
};

const DOMINION_PROPHECIES = {
  rising_sun: [
    'Approaching Army', 'Biding Time', 'Bureaucracy', 'Divine Wind', 'Enlightenment',
    'Flourishing Trade', 'Good Harvest', 'Great Leader', 'Growth', 'Harsh Winter',
    'Kind Emperor', 'Panic', 'Progress', 'Rapid Expansion', 'Sickness'
  ],
};

// Card costs keyed by exact card name
const CARD_COSTS = {
  // Base Set
  'Cellar': '$2', 'Chapel': '$2', 'Moat': '$2',
  'Harbinger': '$3', 'Merchant': '$3', 'Vassal': '$3', 'Village': '$3', 'Workshop': '$3',
  'Bureaucrat': '$4', 'Gardens': '$4', 'Militia': '$4', 'Moneylender': '$4', 'Poacher': '$4',
  'Remodel': '$4', 'Smithy': '$4', 'Throne Room': '$4',
  'Bandit': '$5', 'Council Room': '$5', 'Festival': '$5', 'Laboratory': '$5', 'Library': '$5',
  'Market': '$5', 'Mine': '$5', 'Sentry': '$5', 'Witch': '$5',
  'Artisan': '$6',
  // Intrigue 2e
  'Courtyard': '$2', 'Lurker': '$2', 'Pawn': '$2',
  'Masquerade': '$3', 'Shanty Town': '$3', 'Steward': '$3', 'Swindler': '$3', 'Wishing Well': '$3',
  'Baron': '$4', 'Bridge': '$4', 'Conspirator': '$4', 'Diplomat': '$4', 'Ironworks': '$4',
  'Mill': '$4', 'Mining Village': '$4', 'Secret Passage': '$4',
  'Courtier': '$5', 'Duke': '$5', 'Minion': '$5', 'Patrol': '$5', 'Replace': '$5',
  'Torturer': '$5', 'Trading Post': '$5', 'Upgrade': '$5',
  'Harem': '$6', 'Nobles': '$6',
  // Seaside 2e
  'Haven': '$2', 'Lighthouse': '$2', 'Native Village': '$2',
  'Astrolabe': '$3', 'Fishing Village': '$3', 'Lookout': '$3', 'Monkey': '$3',
  'Sea Chart': '$3', 'Smugglers': '$3', 'Warehouse': '$3',
  'Blockade': '$4', 'Caravan': '$4', 'Cutpurse': '$4', 'Island': '$4',
  'Sailor': '$4', 'Salvager': '$4', 'Tide Pools': '$4', 'Treasure Map': '$4',
  'Bazaar': '$5', 'Corsair': '$5', 'Merchant Ship': '$5', 'Outpost': '$5',
  'Pirate': '$5', 'Sea Witch': '$5', 'Tactician': '$5', 'Treasury': '$5', 'Wharf': '$5',
  // Prosperity 2e
  'Anvil': '$3',
  'Bishop': '$4', 'Clerk': '$4', 'Investment': '$4', 'Monument': '$4', 'Quarry': '$4',
  'Tiara': '$4', 'Watchtower': '$4', "Worker's Village": '$4',
  'Charlatan': '$5', 'City': '$5', 'Collection': '$5', 'Crystal Ball': '$5', 'Magnate': '$5',
  'Mint': '$5', 'Rabble': '$5', 'Vault': '$5', 'War Chest': '$5',
  'Grand Market': '$6', 'Hoard': '$6',
  'Bank': '$7', 'Expand': '$7', 'Forge': '$7', "King's Court": '$7',
  'Peddler': '$8*',
  // Empires
  'Engineer': '4D',
  'City Quarter': '8D', 'Overlord': '8D', 'Royal Blacksmith': '8D',
  'Encampment/Plunder': '$2', 'Patrician/Emporium': '$2', 'Settlers/Bustling Village': '$2',
  'Castles': '$3+', 'Catapult/Rocks': '$3', 'Chariot Race': '$3', 'Enchantress': '$3',
  "Farmers' Market": '$3', 'Gladiator/Fortune': '$3',
  'Sacrifice': '$4', 'Temple': '$4', 'Villa': '$4',
  'Archive': '$5', 'Capital': '$5', 'Charm': '$5', 'Crown': '$5', 'Forum': '$5',
  'Groundskeeper': '$5', 'Legionary': '$5', 'Wild Hunt': '$5',
  // Rising Sun
  'Mountain Shrine': '$0',
  'Daimyo': '6D',
  'Artist': '8D',
  'Fishmonger': '$2', 'Snake Witch': '$2',
  'Aristocrat': '$3', 'Craftsman': '$3', 'Riverboat': '$5', 'Root Cellar': '$3',
  'Alley': '$3', 'Change': '$4', 'Ninja': '$5', 'Poet': '$3', 'River Shrine': '$4', 'Rustic Village': '$3',
  'Gold Mine': '$6', 'Imperial Envoy': '$5', 'Kitsune': '$5', 'Litter': '$5',
  'Rice Broker': '$5', 'Ronin': '$5', 'Tanuki': '$5', 'Tea House': '$5',
  'Samurai': '$5',
  'Rice': '$4',
};

// Reverse lookup: card name → expansion key
const CARD_EXPANSION_MAP = {};
Object.entries(DOMINION_CARDS).forEach(([expansion, cards]) => {
  cards.forEach(card => { CARD_EXPANSION_MAP[card] = expansion; });
});

// Reverse lookup for supplemental cards (landmarks, events, prophecies)
const SUPPLEMENTAL_EXPANSION_MAP = {};
[DOMINION_LANDMARKS, DOMINION_EVENTS, DOMINION_PROPHECIES].forEach(group => {
  Object.entries(group).forEach(([expansion, cards]) => {
    cards.forEach(card => { SUPPLEMENTAL_EXPANSION_MAP[card] = expansion; });
  });
});

const EXPANSION_DISPLAY = {
  base: 'Base',
  intrigue: 'Intrigue',
  seaside: 'Seaside',
  prosperity: 'Prosperity',
  empires: 'Empires',
  rising_sun: 'Rising Sun',
};

let buildsData = [];
let selectedCards = new Set();
let selectedLandmarks = new Set();
let selectedEvents = new Set();
let selectedProphecies = new Set();
let currentSort = 'recent';
let activeExpansionFilter = null; // null = no filter

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  renderCardCheckboxes();
  setupCollapsibleSections();
  setupFormHandlers();
  setupSortButtons();
  document.getElementById('filter-builds-btn').addEventListener('click', showFilterModal);
  loadBuilds();
});

function setupSortButtons() {
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSort = btn.dataset.sort;
      renderBuilds();
    });
  });
}

// Make expansion headers collapsible; collapse all by default on mobile
function setupCollapsibleSections() {
  const isMobile = window.innerWidth <= 768;
  document.querySelectorAll('.expansion-header').forEach(header => {
    const section = header.closest('.expansion-section');
    if (!section) return;
    if (isMobile) section.classList.add('collapsed');
    header.addEventListener('click', () => {
      section.classList.toggle('collapsed');
    });
  });
}

// Render all card checkbox sections
function renderCardCheckboxes() {
  // Kingdom cards by expansion
  renderExpansionCards('base', 'base-cards', 'kingdom');
  renderExpansionCards('intrigue', 'intrigue-cards', 'kingdom');
  renderExpansionCards('seaside', 'seaside-cards', 'kingdom');
  renderExpansionCards('prosperity', 'prosperity-cards', 'kingdom');
  renderExpansionCards('empires', 'empires-cards', 'kingdom');
  renderExpansionCards('rising_sun', 'rising-sun-cards', 'kingdom');

  // Landmarks (Empires)
  renderSupplementalCards(DOMINION_LANDMARKS.empires, 'empires-landmarks', 'landmark');

  // Events
  renderSupplementalCards(DOMINION_EVENTS.empires, 'empires-events', 'event');
  renderSupplementalCards(DOMINION_EVENTS.rising_sun, 'rising-sun-events', 'event');

  // Prophecies (Rising Sun)
  renderSupplementalCards(DOMINION_PROPHECIES.rising_sun, 'rising-sun-prophecies', 'prophecy');
}

// Render kingdom card checkboxes for an expansion
function renderExpansionCards(expansion, containerId, type) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const cards = DOMINION_CARDS[expansion].slice().sort((a, b) => a.localeCompare(b));

  cards.forEach(card => {
    container.appendChild(buildCheckbox(type, expansion, card));
  });
}

// Render supplemental card checkboxes (landmarks, events, prophecies)
function renderSupplementalCards(cards, containerId, type) {
  const container = document.getElementById(containerId);
  if (!container) return;

  cards.slice().sort((a, b) => a.localeCompare(b)).forEach(card => {
    container.appendChild(buildCheckbox(type, type, card));
  });
}

// Build a checkbox+label div
function buildCheckbox(type, namespace, card) {
  const div = document.createElement('div');
  div.className = 'card-checkbox';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = `card-${namespace}-${card.replace(/[^a-zA-Z0-9]/g, '')}`;
  checkbox.value = card;
  checkbox.dataset.cardType = type;
  checkbox.addEventListener('change', handleCardSelection);

  const label = document.createElement('label');
  label.htmlFor = checkbox.id;
  label.textContent = card;

  div.appendChild(checkbox);
  div.appendChild(label);
  return div;
}

// Handle card selection for all card types
function handleCardSelection(event) {
  const checkbox = event.target;
  const card = checkbox.value;
  const type = checkbox.dataset.cardType;
  const parentDiv = checkbox.parentElement;

  if (checkbox.checked) {
    if (type === 'kingdom' && selectedCards.size >= 10) {
      checkbox.checked = false;
      showError('You can only select up to 10 kingdom cards');
      return;
    }
    getSelectionSet(type).add(card);
    parentDiv.classList.add('selected');
  } else {
    getSelectionSet(type).delete(card);
    parentDiv.classList.remove('selected');
  }

  updateCardCount();
}

function getSelectionSet(type) {
  switch (type) {
    case 'landmark':  return selectedLandmarks;
    case 'event':     return selectedEvents;
    case 'prophecy':  return selectedProphecies;
    default:          return selectedCards;
  }
}

// Update card count display
function updateCardCount() {
  const countDisplay = document.getElementById('card-count');
  countDisplay.textContent = `${selectedCards.size} / 10 kingdom cards selected`;

  if (selectedCards.size >= 10) {
    countDisplay.classList.add('limit-reached');
  } else {
    countDisplay.classList.remove('limit-reached');
  }
}

// Setup form handlers
function setupFormHandlers() {
  const form = document.getElementById('create-build-form');
  const clearButton = document.getElementById('clear-form');

  form.addEventListener('submit', handleFormSubmit);
  clearButton.addEventListener('click', clearForm);
}

// Handle form submission
async function handleFormSubmit(event) {
  event.preventDefault();

  const nickname = document.getElementById('build-nickname').value.trim();

  if (!nickname) {
    showError('Please enter a build nickname');
    return;
  }

  if (selectedCards.size === 0) {
    showError('Please select at least one kingdom card');
    return;
  }

  try {
    const usePlatinumColony = document.getElementById('use-platinum-colony').checked;
    await buildsAPI.create(
      nickname,
      Array.from(selectedCards),
      Array.from(selectedLandmarks),
      Array.from(selectedEvents),
      Array.from(selectedProphecies),
      usePlatinumColony
    );

    showSuccess(`Build "${nickname}" created successfully!`);
    clearForm();
    loadBuilds();
  } catch (error) {
    showError(`Failed to create build: ${error.message}`);
  }
}

// Clear form
function clearForm() {
  document.getElementById('build-nickname').value = '';
  document.getElementById('use-platinum-colony').checked = false;

  document.querySelectorAll('.card-checkbox input[type="checkbox"]').forEach(checkbox => {
    checkbox.checked = false;
    checkbox.parentElement.classList.remove('selected');
  });

  selectedCards.clear();
  selectedLandmarks.clear();
  selectedEvents.clear();
  selectedProphecies.clear();
  updateCardCount();
}

// Load builds data
async function loadBuilds() {
  const loading = document.getElementById('loading');
  const container = document.getElementById('builds-container');
  const noBuilds = document.getElementById('no-builds');

  try {
    loading.style.display = 'block';
    container.style.display = 'none';

    buildsData = await buildsAPI.getAll();

    loading.style.display = 'none';
    container.style.display = 'block';

    if (buildsData.length === 0) {
      noBuilds.style.display = 'block';
    } else {
      noBuilds.style.display = 'none';
      renderBuilds();
    }
  } catch (error) {
    loading.style.display = 'none';
    showError(`Failed to load builds: ${error.message}`);
  }
}

// Render builds list
function renderBuilds() {
  const buildsList = document.getElementById('builds-list');
  buildsList.innerHTML = '';

  let sorted = buildsData.slice().sort((a, b) => {
    if (currentSort === 'alpha') return a.nickname.localeCompare(b.nickname);
    // most recent: API already returns created_at DESC, preserve that order
    return 0;
  });

  if (activeExpansionFilter) {
    sorted = sorted.filter(buildMatchesFilter);
  }

  if (sorted.length === 0) {
    buildsList.innerHTML = '<p class="builds-no-results">No builds match the selected expansions.</p>';
    return;
  }

  sorted.forEach(build => {
    buildsList.appendChild(createBuildItem(build));
  });
}

function buildMatchesFilter(build) {
  for (const card of (build.cards || [])) {
    const exp = CARD_EXPANSION_MAP[card];
    if (exp && !activeExpansionFilter.has(exp)) return false;
  }
  for (const card of [...(build.landmarks || []), ...(build.events || []), ...(build.prophecies || [])]) {
    const exp = SUPPLEMENTAL_EXPANSION_MAP[card];
    if (exp && !activeExpansionFilter.has(exp)) return false;
  }
  return true;
}

function showFilterModal() {
  const existing = document.getElementById('filter-builds-modal');
  if (existing) existing.remove();

  const allExpansions = Object.keys(EXPANSION_DISPLAY);
  const currentFilter = activeExpansionFilter || new Set(allExpansions);

  const overlay = document.createElement('div');
  overlay.id = 'filter-builds-modal';
  overlay.className = 'delete-modal-overlay';

  const checkboxesHtml = allExpansions.map(key => `
    <label class="filter-expansion-option">
      <input type="checkbox" value="${key}" ${currentFilter.has(key) ? 'checked' : ''}>
      ${EXPANSION_DISPLAY[key]}
    </label>
  `).join('');

  overlay.innerHTML = `
    <div class="delete-modal-box">
      <div class="delete-modal-title">Filter by Expansions</div>
      <div class="filter-expansion-list">${checkboxesHtml}</div>
      <div class="delete-modal-actions">
        <button class="btn btn-primary" id="fm-apply">Apply</button>
        <button class="btn" id="fm-clear">Show All</button>
        <button class="btn" id="fm-cancel">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  function close() { overlay.remove(); }

  overlay.querySelector('#fm-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  overlay.querySelector('#fm-clear').addEventListener('click', () => {
    activeExpansionFilter = null;
    updateFilterButton();
    renderBuilds();
    close();
  });

  overlay.querySelector('#fm-apply').addEventListener('click', () => {
    const checked = Array.from(overlay.querySelectorAll('.filter-expansion-list input:checked')).map(el => el.value);
    activeExpansionFilter = (checked.length === 0 || checked.length === allExpansions.length)
      ? null
      : new Set(checked);
    updateFilterButton();
    renderBuilds();
    close();
  });
}

function updateFilterButton() {
  const btn = document.getElementById('filter-builds-btn');
  if (!btn) return;
  if (activeExpansionFilter) {
    btn.classList.add('active');
    btn.textContent = `Expansions (${activeExpansionFilter.size})`;
  } else {
    btn.classList.remove('active');
    btn.textContent = 'Expansions';
  }
}

// Render a tag group row (label + tags), returns '' if no items
function renderTagGroup(label, items) {
  if (!items || items.length === 0) return '';
  const tags = items.map(item => `<span class="card-tag">${escapeHtml(item)}</span>`).join('');
  return `<div class="build-tag-group"><span class="tag-group-label">${label}:</span> ${tags}</div>`;
}

// Render kingdom cards grouped by expansion with costs
function renderKingdomByExpansion(cards) {
  if (!cards || cards.length === 0) return '';
  const expansionOrder = ['base', 'intrigue', 'seaside', 'prosperity', 'empires', 'rising_sun'];
  const groups = {};
  cards.forEach(card => {
    const exp = CARD_EXPANSION_MAP[card] || 'unknown';
    if (!groups[exp]) groups[exp] = [];
    groups[exp].push(card);
  });
  const groupsHtml = expansionOrder
    .filter(exp => groups[exp] && groups[exp].length > 0)
    .map(exp => {
      const label = EXPANSION_DISPLAY[exp] || exp;
      const sorted = groups[exp].slice().sort((a, b) => a.localeCompare(b));
      const tags = sorted.map(card => {
        const cost = CARD_COSTS[card] || '';
        const costHtml = cost ? ` <span class="card-cost">${escapeHtml(cost)}</span>` : '';
        return `<span class="card-tag">${escapeHtml(card)}${costHtml}</span>`;
      }).join('');
      return `<div class="build-expansion-group"><span class="build-expansion-label">${escapeHtml(label)}</span>${tags}</div>`;
    })
    .join('');
  return `<div class="build-kingdom-section">${groupsHtml}</div>`;
}

// Create build item element
function createBuildItem(build) {
  const div = document.createElement('div');
  div.className = 'build-item collapsed';
  div.dataset.buildId = build.id;

  const gamesPlayed = parseInt(build.games_played) || 0;
  const avgScore = parseFloat(build.avg_score_per_game) || 0;

  div.innerHTML = `
    <div class="build-header">
      <div class="build-header-main">
        <div class="build-title">${escapeHtml(build.nickname)}</div>
        <div class="build-stats">
          <span>Games: ${gamesPlayed}</span>
          <span>Avg Score: ${avgScore.toFixed(2)}</span>
          ${build.use_platinum_colony ? '<span class="platinum-colony-badge">Platinum / Colony</span>' : ''}
        </div>
      </div>
      <div class="build-header-right">
        <button class="btn btn-sm js-edit-build">Edit</button>
        <button class="btn btn-danger btn-sm js-delete-build">Delete</button>
        <span class="build-expand-icon">▼</span>
      </div>
    </div>
    <div class="build-body">
      <div class="build-cards">
        ${renderKingdomByExpansion(build.cards)}
        ${renderTagGroup('Landmarks', build.landmarks)}
        ${renderTagGroup('Events', build.events)}
        ${renderTagGroup('Prophecies', build.prophecies)}
      </div>
      <div class="build-comments" id="comments-${build.id}">
        <div class="comments-loading">Loading comments...</div>
      </div>
    </div>
  `;

  // Toggle expand on header click (not action buttons)
  div.querySelector('.build-header').addEventListener('click', (e) => {
    if (e.target.closest('.js-delete-build') || e.target.closest('.js-edit-build')) return;
    const wasCollapsed = div.classList.contains('collapsed');
    div.classList.toggle('collapsed');
    if (wasCollapsed && !div.dataset.commentsLoaded) {
      div.dataset.commentsLoaded = '1';
      loadBuildComments(build.id, div.querySelector(`#comments-${build.id}`));
    }
  });

  div.querySelector('.js-edit-build').addEventListener('click', () => {
    showDeleteModal(`Edit build "${build.nickname}"?`, async (credentials) => {
      await authAPI.check(credentials);
      showEditModal(build, credentials);
    }, { confirmLabel: 'Continue', pendingLabel: 'Verifying...' });
  });

  div.querySelector('.js-delete-build').addEventListener('click', () => {
    showDeleteModal(`Delete build "${build.nickname}"?`, async (credentials) => {
      await buildsAPI.delete(build.id, credentials);
      showSuccess('Build deleted successfully');
      loadBuilds();
    });
  });

  return div;
}

function showEditModal(build, credentials) {
  const existing = document.getElementById('edit-build-modal');
  if (existing) existing.remove();

  let editCards = new Set(build.cards || []);
  let editLandmarks = new Set(build.landmarks || []);
  let editEvents = new Set(build.events || []);
  let editProphecies = new Set(build.prophecies || []);

  const overlay = document.createElement('div');
  overlay.id = 'edit-build-modal';
  overlay.className = 'edit-modal-overlay';
  overlay.innerHTML = `
    <div class="edit-modal-box">
      <div class="edit-modal-title">Edit Build</div>
      <div class="form-group">
        <label for="em-nickname">Build Nickname</label>
        <input type="text" id="em-nickname">
      </div>
      <div id="em-card-count" class="card-count">0 / 10 kingdom cards selected</div>
      <div class="expansion-sections" id="em-kingdom-sections"></div>
      <div class="expansion-sections" id="em-supplemental-sections"></div>
      <div class="form-group">
        <label class="toggle-label">
          <input type="checkbox" id="em-platinum-colony">
          Use Platinum &amp; Colony
        </label>
      </div>
      <div class="edit-modal-error" id="em-error"></div>
      <div class="edit-modal-actions">
        <button class="btn btn-primary" id="em-confirm">Save Changes</button>
        <button class="btn" id="em-cancel">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('#em-nickname').value = build.nickname;
  overlay.querySelector('#em-platinum-colony').checked = !!build.use_platinum_colony;

  function getEditSet(type) {
    switch (type) {
      case 'landmark': return editLandmarks;
      case 'event':    return editEvents;
      case 'prophecy': return editProphecies;
      default:         return editCards;
    }
  }

  function updateEditCardCount() {
    const countEl = overlay.querySelector('#em-card-count');
    countEl.textContent = `${editCards.size} / 10 kingdom cards selected`;
    countEl.classList.toggle('limit-reached', editCards.size >= 10);
  }

  function buildEditCheckbox(type, namespace, card) {
    const div = document.createElement('div');
    div.className = 'card-checkbox';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `em-card-${namespace}-${card.replace(/[^a-zA-Z0-9]/g, '')}`;
    checkbox.value = card;
    const set = getEditSet(type);
    if (set.has(card)) {
      checkbox.checked = true;
      div.classList.add('selected');
    }
    checkbox.addEventListener('change', () => {
      const s = getEditSet(type);
      if (checkbox.checked) {
        if (type === 'kingdom' && editCards.size >= 10) {
          checkbox.checked = false;
          return;
        }
        s.add(card);
        div.classList.add('selected');
      } else {
        s.delete(card);
        div.classList.remove('selected');
      }
      updateEditCardCount();
    });
    const label = document.createElement('label');
    label.htmlFor = checkbox.id;
    label.textContent = card;
    div.appendChild(checkbox);
    div.appendChild(label);
    return div;
  }

  function renderEditExpansion(expansion, containerId) {
    const container = overlay.querySelector(`#${containerId}`);
    if (!container) return;
    DOMINION_CARDS[expansion].slice().sort((a, b) => a.localeCompare(b)).forEach(card => {
      container.appendChild(buildEditCheckbox('kingdom', expansion, card));
    });
  }

  function renderEditSupplemental(cards, containerId, type) {
    const container = overlay.querySelector(`#${containerId}`);
    if (!container) return;
    cards.slice().sort((a, b) => a.localeCompare(b)).forEach(card => {
      container.appendChild(buildEditCheckbox(type, type, card));
    });
  }

  function makeExpansionSection(labelHtml, gridId, hasPreselected) {
    const section = document.createElement('div');
    section.className = 'expansion-section' + (hasPreselected ? '' : ' collapsed');
    section.innerHTML = `
      <h3 class="expansion-header">${labelHtml}</h3>
      <div class="card-grid" id="${gridId}"></div>
    `;
    section.querySelector('.expansion-header').addEventListener('click', () => {
      section.classList.toggle('collapsed');
    });
    return section;
  }

  // Kingdom sections
  const kingdomSections = overlay.querySelector('#em-kingdom-sections');
  const kingdomExpansions = [
    { key: 'base',       label: 'Base Set',    badge: null, id: 'em-base-cards' },
    { key: 'intrigue',   label: 'Intrigue',    badge: '2e', id: 'em-intrigue-cards' },
    { key: 'seaside',    label: 'Seaside',     badge: '2e', id: 'em-seaside-cards' },
    { key: 'prosperity', label: 'Prosperity',  badge: '2e', id: 'em-prosperity-cards' },
    { key: 'empires',    label: 'Empires',     badge: '1e', id: 'em-empires-cards' },
    { key: 'rising_sun', label: 'Rising Sun',  badge: '1e', id: 'em-rising-sun-cards' },
  ];
  kingdomExpansions.forEach(({ key, label, badge, id }) => {
    const badgeHtml = badge ? ` <span class="edition-badge">${badge}</span>` : '';
    const hasPreselected = DOMINION_CARDS[key].some(c => editCards.has(c));
    const section = makeExpansionSection(`${label}${badgeHtml}`, id, hasPreselected);
    kingdomSections.appendChild(section);
    renderEditExpansion(key, id);
  });

  // Supplemental sections
  const supplementalSections = overlay.querySelector('#em-supplemental-sections');

  const landmarksSection = makeExpansionSection(
    'Landmarks — Empires <span class="supplemental-note">(optional)</span>',
    'em-empires-landmarks',
    DOMINION_LANDMARKS.empires.some(c => editLandmarks.has(c))
  );
  supplementalSections.appendChild(landmarksSection);
  renderEditSupplemental(DOMINION_LANDMARKS.empires, 'em-empires-landmarks', 'landmark');

  const eventsSection = document.createElement('div');
  eventsSection.className = 'expansion-section' + (
    [...DOMINION_EVENTS.empires, ...DOMINION_EVENTS.rising_sun].some(c => editEvents.has(c)) ? '' : ' collapsed'
  );
  eventsSection.innerHTML = `
    <h3 class="expansion-header">Events <span class="supplemental-note">(optional)</span></h3>
    <div class="expansion-body">
      <div class="supplemental-group-label">Empires</div>
      <div class="card-grid" id="em-empires-events"></div>
      <div class="supplemental-group-label">Rising Sun</div>
      <div class="card-grid" id="em-rising-sun-events"></div>
    </div>
  `;
  eventsSection.querySelector('.expansion-header').addEventListener('click', () => {
    eventsSection.classList.toggle('collapsed');
  });
  supplementalSections.appendChild(eventsSection);
  renderEditSupplemental(DOMINION_EVENTS.empires, 'em-empires-events', 'event');
  renderEditSupplemental(DOMINION_EVENTS.rising_sun, 'em-rising-sun-events', 'event');

  const propheciesSection = makeExpansionSection(
    'Prophecies — Rising Sun <span class="supplemental-note">(optional)</span>',
    'em-rising-sun-prophecies',
    DOMINION_PROPHECIES.rising_sun.some(c => editProphecies.has(c))
  );
  supplementalSections.appendChild(propheciesSection);
  renderEditSupplemental(DOMINION_PROPHECIES.rising_sun, 'em-rising-sun-prophecies', 'prophecy');

  updateEditCardCount();

  const nicknameInput = overlay.querySelector('#em-nickname');
  const errorEl = overlay.querySelector('#em-error');
  const confirmBtn = overlay.querySelector('#em-confirm');
  const cancelBtn = overlay.querySelector('#em-cancel');

  nicknameInput.focus();

  function close() { overlay.remove(); }

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  confirmBtn.addEventListener('click', async () => {
    errorEl.textContent = '';
    const nickname = nicknameInput.value.trim();
    if (!nickname) {
      errorEl.textContent = 'Nickname is required';
      return;
    }
    if (editCards.size === 0) {
      errorEl.textContent = 'Select at least one kingdom card';
      return;
    }
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Saving...';
    try {
      await buildsAPI.update(
        build.id,
        nickname,
        Array.from(editCards),
        Array.from(editLandmarks),
        Array.from(editEvents),
        Array.from(editProphecies),
        overlay.querySelector('#em-platinum-colony').checked,
        credentials
      );
      close();
      showSuccess('Build updated successfully');
      loadBuilds();
    } catch (err) {
      errorEl.textContent = err.message || 'Failed to save';
      confirmBtn.disabled = false;
      confirmBtn.textContent = 'Save Changes';
    }
  });

}

// Load and render comments for a build
async function loadBuildComments(buildId, container) {
  try {
    const comments = await buildsAPI.getComments(buildId);
    renderBuildComments(buildId, comments, container);
  } catch (error) {
    container.innerHTML = '';
  }
}

function placementLabel(n) {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return `${n}th`;
}

function renderBuildComments(buildId, comments, container) {
  if (comments.length === 0) {
    container.innerHTML = '';
    return;
  }

  // Group comments by game_id, preserving order (games already sorted by started_at DESC)
  const gameGroups = [];
  const seenGames = new Map();
  comments.forEach(c => {
    if (!seenGames.has(c.game_id)) {
      const gameDate = c.game_started_at
        ? new Date(c.game_started_at).toLocaleString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
          })
        : 'Unknown date';
      const group = { game_id: c.game_id, gameDate, comments: [] };
      seenGames.set(c.game_id, group);
      gameGroups.push(group);
    }
    seenGames.get(c.game_id).comments.push(c);
  });

  const groupsHtml = gameGroups.map(group => {
    const commentsHtml = group.comments.map(c => `
      <div class="build-comment" data-comment-id="${c.id}">
        <div class="comment-meta">
          <span class="comment-player" style="color:${escapeHtml(c.player_color || '#4db8ff')}">${escapeHtml(c.player_name)}</span>
          <span class="comment-placement">${placementLabel(c.placement)}</span>
          <button class="btn btn-danger btn-sm js-delete-comment" data-comment-id="${c.id}">✕</button>
        </div>
        <div class="comment-text">${escapeHtml(c.comment_text)}</div>
      </div>
    `).join('');

    return `
      <div class="comment-game-group">
        <div class="comment-game-header">${group.gameDate}</div>
        ${commentsHtml}
      </div>
    `;
  }).join('');

  container.innerHTML = `<div class="comments-list">${groupsHtml}</div>`;

  container.querySelectorAll('.js-delete-comment').forEach(btn => {
    const commentId = btn.dataset.commentId;
    btn.addEventListener('click', () => {
      showDeleteModal('Delete this comment?', async (credentials) => {
        await buildsAPI.deleteComment(buildId, commentId, credentials);
        loadBuildComments(buildId, container);
      });
    });
  });
}

// Show error message
function showError(message) {
  const errorDiv = document.getElementById('error-message');
  const successDiv = document.getElementById('success-message');

  successDiv.style.display = 'none';
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';

  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
}

// Show success message
function showSuccess(message) {
  const errorDiv = document.getElementById('error-message');
  const successDiv = document.getElementById('success-message');

  errorDiv.style.display = 'none';
  successDiv.textContent = message;
  successDiv.style.display = 'block';

  setTimeout(() => {
    successDiv.style.display = 'none';
  }, 5000);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
