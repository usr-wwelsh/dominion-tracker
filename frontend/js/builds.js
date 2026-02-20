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

let buildsData = [];
let selectedCards = new Set();
let selectedLandmarks = new Set();
let selectedEvents = new Set();
let selectedProphecies = new Set();
let currentSort = 'recent';

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  renderCardCheckboxes();
  setupCollapsibleSections();
  setupFormHandlers();
  setupSortButtons();
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

  const sorted = buildsData.slice().sort((a, b) => {
    if (currentSort === 'alpha') return a.nickname.localeCompare(b.nickname);
    // most recent: API already returns created_at DESC, preserve that order
    return 0;
  });

  sorted.forEach(build => {
    const buildItem = createBuildItem(build);
    buildsList.appendChild(buildItem);
  });
}

// Render a tag group row (label + tags), returns '' if no items
function renderTagGroup(label, items) {
  if (!items || items.length === 0) return '';
  const tags = items.map(item => `<span class="card-tag">${escapeHtml(item)}</span>`).join('');
  return `<div class="build-tag-group"><span class="tag-group-label">${label}:</span> ${tags}</div>`;
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
        <button class="btn btn-danger btn-sm js-delete-build">Delete</button>
        <span class="build-expand-icon">▼</span>
      </div>
    </div>
    <div class="build-body">
      <div class="build-cards">
        ${renderTagGroup('Kingdom', build.cards)}
        ${renderTagGroup('Landmarks', build.landmarks)}
        ${renderTagGroup('Events', build.events)}
        ${renderTagGroup('Prophecies', build.prophecies)}
      </div>
      <div class="build-comments" id="comments-${build.id}">
        <div class="comments-loading">Loading comments...</div>
      </div>
    </div>
  `;

  // Toggle expand on header click (not delete button)
  div.querySelector('.build-header').addEventListener('click', (e) => {
    if (e.target.closest('.js-delete-build')) return;
    const wasCollapsed = div.classList.contains('collapsed');
    div.classList.toggle('collapsed');
    if (wasCollapsed && !div.dataset.commentsLoaded) {
      div.dataset.commentsLoaded = '1';
      loadBuildComments(build.id, div.querySelector(`#comments-${build.id}`));
    }
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
