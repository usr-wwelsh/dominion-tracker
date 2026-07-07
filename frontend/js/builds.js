// Builds page logic

// Card database (DOMINION_CARDS, CARD_COSTS, EXPANSION_DISPLAY, reverse maps)
// lives in js/dominion-cards.js, loaded before this file.


let buildsData = [];
let selectedCards = new Set();
let selectedLandmarks = new Set();
let selectedEvents = new Set();
let selectedProphecies = new Set();
let selectedTraits = new Set();
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
  renderExpansionCards('dark_ages', 'dark-ages-cards', 'kingdom');
  renderExpansionCards('hinterlands', 'hinterlands-cards', 'kingdom');
  renderExpansionCards('nocturne', 'nocturne-cards', 'kingdom');
  renderExpansionCards('plunder', 'plunder-cards', 'kingdom');

  // Landmarks (Empires)
  renderSupplementalCards(DOMINION_LANDMARKS.empires, 'empires-landmarks', 'landmark');

  // Events
  renderSupplementalCards(DOMINION_EVENTS.empires, 'empires-events', 'event');
  renderSupplementalCards(DOMINION_EVENTS.rising_sun, 'rising-sun-events', 'event');
  renderSupplementalCards(DOMINION_EVENTS.plunder, 'plunder-events', 'event');

  // Prophecies (Rising Sun)
  renderSupplementalCards(DOMINION_PROPHECIES.rising_sun, 'rising-sun-prophecies', 'prophecy');

  // Traits (Plunder)
  renderSupplementalCards(DOMINION_TRAITS.plunder, 'plunder-traits', 'trait');
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
    case 'trait':     return selectedTraits;
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
    const useShelters = document.getElementById('use-shelters').checked;
    await buildsAPI.create(
      nickname,
      Array.from(selectedCards),
      Array.from(selectedLandmarks),
      Array.from(selectedEvents),
      Array.from(selectedProphecies),
      Array.from(selectedTraits),
      usePlatinumColony,
      useShelters
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
  document.getElementById('use-shelters').checked = false;

  document.querySelectorAll('.card-checkbox input[type="checkbox"]').forEach(checkbox => {
    checkbox.checked = false;
    checkbox.parentElement.classList.remove('selected');
  });

  selectedCards.clear();
  selectedLandmarks.clear();
  selectedEvents.clear();
  selectedProphecies.clear();
  selectedTraits.clear();
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
  for (const card of [...(build.landmarks || []), ...(build.events || []), ...(build.prophecies || []), ...(build.traits || [])]) {
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
  const expansionOrder = ['base', 'intrigue', 'seaside', 'prosperity', 'empires', 'rising_sun', 'dark_ages', 'hinterlands', 'nocturne', 'plunder'];
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
          ${build.use_shelters ? '<span class="platinum-colony-badge">Shelters</span>' : ''}
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
        ${renderTagGroup('Traits', build.traits)}
      </div>
      <div class="build-comments" id="comments-${build.id}">
        <div class="comments-loading">Loading comments...</div>
      </div>
      <div class="build-games" id="games-${build.id}"></div>
    </div>
  `;

  // Toggle expand on header click (not action buttons)
  div.querySelector('.build-header').addEventListener('click', (e) => {
    if (e.target.closest('.js-delete-build') || e.target.closest('.js-edit-build')) return;
    const wasCollapsed = div.classList.contains('collapsed');
    div.classList.toggle('collapsed');
    if (wasCollapsed && !div.dataset.contentLoaded) {
      div.dataset.contentLoaded = '1';
      loadBuildComments(build.id, div.querySelector(`#comments-${build.id}`));
      loadBuildGames(build.id, div.querySelector(`#games-${build.id}`));
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
  let editTraits = new Set(build.traits || []);

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
        <label class="toggle-label">
          <input type="checkbox" id="em-shelters">
          Use Shelters (Dark Ages)
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
  overlay.querySelector('#em-shelters').checked = !!build.use_shelters;

  function getEditSet(type) {
    switch (type) {
      case 'landmark': return editLandmarks;
      case 'event':    return editEvents;
      case 'prophecy': return editProphecies;
      case 'trait':    return editTraits;
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
    { key: 'dark_ages',  label: 'Dark Ages',   badge: null, id: 'em-dark-ages-cards' },
    { key: 'hinterlands', label: 'Hinterlands', badge: '2e', id: 'em-hinterlands-cards' },
    { key: 'nocturne',   label: 'Nocturne',    badge: null, id: 'em-nocturne-cards' },
    { key: 'plunder',    label: 'Plunder',     badge: null, id: 'em-plunder-cards' },
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
    [...DOMINION_EVENTS.empires, ...DOMINION_EVENTS.rising_sun, ...DOMINION_EVENTS.plunder].some(c => editEvents.has(c)) ? '' : ' collapsed'
  );
  eventsSection.innerHTML = `
    <h3 class="expansion-header">Events <span class="supplemental-note">(optional)</span></h3>
    <div class="expansion-body">
      <div class="supplemental-group-label">Empires</div>
      <div class="card-grid" id="em-empires-events"></div>
      <div class="supplemental-group-label">Rising Sun</div>
      <div class="card-grid" id="em-rising-sun-events"></div>
      <div class="supplemental-group-label">Plunder</div>
      <div class="card-grid" id="em-plunder-events"></div>
    </div>
  `;
  eventsSection.querySelector('.expansion-header').addEventListener('click', () => {
    eventsSection.classList.toggle('collapsed');
  });
  supplementalSections.appendChild(eventsSection);
  renderEditSupplemental(DOMINION_EVENTS.empires, 'em-empires-events', 'event');
  renderEditSupplemental(DOMINION_EVENTS.rising_sun, 'em-rising-sun-events', 'event');
  renderEditSupplemental(DOMINION_EVENTS.plunder, 'em-plunder-events', 'event');

  const propheciesSection = makeExpansionSection(
    'Prophecies — Rising Sun <span class="supplemental-note">(optional)</span>',
    'em-rising-sun-prophecies',
    DOMINION_PROPHECIES.rising_sun.some(c => editProphecies.has(c))
  );
  supplementalSections.appendChild(propheciesSection);
  renderEditSupplemental(DOMINION_PROPHECIES.rising_sun, 'em-rising-sun-prophecies', 'prophecy');

  const traitsSection = makeExpansionSection(
    'Traits — Plunder <span class="supplemental-note">(optional, no limit)</span>',
    'em-plunder-traits',
    DOMINION_TRAITS.plunder.some(c => editTraits.has(c))
  );
  supplementalSections.appendChild(traitsSection);
  renderEditSupplemental(DOMINION_TRAITS.plunder, 'em-plunder-traits', 'trait');

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
        Array.from(editTraits),
        overlay.querySelector('#em-platinum-colony').checked,
        overlay.querySelector('#em-shelters').checked,
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

function formatGameDate(ts) {
  if (!ts) return 'Unknown date';
  return new Date(ts).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Load and render the list of games played with a build
async function loadBuildGames(buildId, container) {
  try {
    const games = await buildsAPI.getGames(buildId);
    renderBuildGames(buildId, games, container);
  } catch (error) {
    container.innerHTML = '';
  }
}

function renderBuildGames(buildId, games, container) {
  if (!games || games.length === 0) {
    container.innerHTML = '';
    return;
  }

  const rowsHtml = games.map(g => {
    const winners = (g.players || []).filter(p => p.placement === 1);
    const winnerText = winners.length
      ? `${winners.map(w => escapeHtml(w.player_name)).join(', ')} · ${winners[0].final_score}`
      : '—';
    return `
      <button class="build-game-row js-open-game" data-game-id="${g.id}">
        <span class="bg-date">${formatGameDate(g.started_at)}</span>
        <span class="bg-winner">🏆 ${winnerText}</span>
        <span class="bg-count">${(g.players || []).length}p</span>
      </button>`;
  }).join('');

  container.innerHTML = `
    <div class="build-games-header">Games Played (${games.length})</div>
    <div class="build-games-list">${rowsHtml}</div>`;

  container.querySelectorAll('.js-open-game').forEach(btn => {
    const gameId = Number(btn.dataset.gameId);
    const game = games.find(g => g.id === gameId);
    btn.addEventListener('click', () => showGameModal(buildId, game));
  });
}

async function showGameModal(buildId, game) {
  const existing = document.getElementById('game-detail-modal');
  if (existing) existing.remove();

  // Pull comments for this build and keep only this game's
  let gameComments = [];
  try {
    const all = await buildsAPI.getComments(buildId);
    gameComments = all.filter(c => c.game_id === game.id);
  } catch {}

  const scoreRows = (game.players || []).map(p => `
    <div class="game-modal-score-row">
      <span class="gm-placement">${placementLabel(p.placement)}</span>
      <span class="gm-name" style="color:${escapeHtml(p.player_color || '#4db8ff')}">${escapeHtml(p.player_name)}</span>
      <span class="gm-score">${p.final_score}</span>
      <span class="gm-lp">${p.league_points ?? 0} LP</span>
    </div>`).join('');

  const commentsHtml = gameComments.length
    ? `<div class="game-modal-comments">
         <div class="game-modal-subtitle">Comments</div>
         ${gameComments.map(c => `
           <div class="build-comment">
             <div class="comment-meta">
               <span class="comment-player" style="color:${escapeHtml(c.player_color || '#4db8ff')}">${escapeHtml(c.player_name)}</span>
               <span class="comment-placement">${placementLabel(c.placement)}</span>
             </div>
             <div class="comment-text">${escapeHtml(c.comment_text)}</div>
           </div>`).join('')}
       </div>`
    : '';

  const overlay = document.createElement('div');
  overlay.id = 'game-detail-modal';
  overlay.className = 'delete-modal-overlay';
  overlay.innerHTML = `
    <div class="delete-modal-box game-modal-box">
      <div class="delete-modal-title">Game #${game.id} · ${formatGameDate(game.started_at)}</div>
      <div class="game-modal-scores">${scoreRows}</div>
      ${commentsHtml}
      <div class="delete-modal-actions">
        <button class="btn" id="gm-close">Close</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('#gm-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
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
