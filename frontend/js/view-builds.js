// View Builds page logic

// Card database (DOMINION_CARDS, CARD_COSTS, EXPANSION_DISPLAY, reverse maps)
// lives in js/dominion-cards.js, loaded before this file.

let buildsData = [];
let currentSort = 'recent';
let activeExpansionFilter = null; // null = no filter

const BUILD_TYPE_SORT_ORDER = { custom: 0, suggested: 1, experimental: 2 };

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
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
    if (currentSort === 'type') {
      const ta = BUILD_TYPE_SORT_ORDER[a.build_type] ?? 0;
      const tb = BUILD_TYPE_SORT_ORDER[b.build_type] ?? 0;
      if (ta !== tb) return ta - tb;
      return a.nickname.localeCompare(b.nickname);
    }
    if (currentSort === 'rating') {
      const ra = parseFloat(a.avg_rating) || 0;
      const rb = parseFloat(b.avg_rating) || 0;
      if (ra !== rb) return rb - ra;
      const ca = parseInt(a.rating_count) || 0;
      const cb = parseInt(b.rating_count) || 0;
      if (ca !== cb) return cb - ca;
      return a.nickname.localeCompare(b.nickname);
    }
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
      <button type="button" class="filter-select-none-link" id="fm-select-none">Select None</button>
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

  overlay.querySelector('#fm-select-none').addEventListener('click', () => {
    overlay.querySelectorAll('.filter-expansion-list input[type="checkbox"]').forEach(el => { el.checked = false; });
  });

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

// Render a static 5-star display for an average rating (rounded to nearest star)
function renderStars(avg) {
  const rounded = Math.round(avg);
  const stars = Array.from({ length: 5 }, (_, i) =>
    `<span class="star-display-item ${i < rounded ? 'star-filled' : ''}">★</span>`
  ).join('');
  return `<span class="star-display">${stars}</span>`;
}

// Show modal to rate a build: select a player, then pick 1-5 stars
async function showRateModal(build) {
  const existing = document.getElementById('rate-build-modal');
  if (existing) existing.remove();

  let players = [];
  try { players = await playersAPI.getAll(); } catch {}

  const ratingsByPlayer = new Map();
  try {
    const ratings = await buildsAPI.getRatings(build.id);
    ratings.forEach(r => ratingsByPlayer.set(String(r.player_id), r.rating));
  } catch {}

  const playerOptions = players.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');

  const overlay = document.createElement('div');
  overlay.id = 'rate-build-modal';
  overlay.className = 'delete-modal-overlay';
  overlay.innerHTML = `
    <div class="delete-modal-box">
      <div class="delete-modal-title">Rate "${escapeHtml(build.nickname)}"</div>
      <div class="form-group">
        <label for="rm-player">Player</label>
        <select id="rm-player">
          <option value="">Select player...</option>
          ${playerOptions}
        </select>
      </div>
      <div class="form-group">
        <label>Your Rating</label>
        <div class="star-picker" id="rm-star-picker">
          ${[1, 2, 3, 4, 5].map(n => `<span class="star-input" data-value="${n}">★</span>`).join('')}
        </div>
      </div>
      <div class="delete-modal-error" id="rm-error"></div>
      <div class="delete-modal-actions">
        <button class="btn btn-primary" id="rm-submit">Submit Rating</button>
        <button class="btn" id="rm-cancel">Cancel</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  let selectedRating = 0;
  let ratingTouched = false;
  const starEls = Array.from(overlay.querySelectorAll('#rm-star-picker .star-input'));
  const starPicker = overlay.querySelector('#rm-star-picker');
  const playerSelect = overlay.querySelector('#rm-player');
  const errorEl = overlay.querySelector('#rm-error');
  const submitBtn = overlay.querySelector('#rm-submit');
  const cancelBtn = overlay.querySelector('#rm-cancel');

  function paintStars(value) {
    starEls.forEach(el => el.classList.toggle('active', Number(el.dataset.value) <= value));
  }

  starEls.forEach(el => {
    el.addEventListener('click', () => {
      ratingTouched = true;
      selectedRating = Number(el.dataset.value);
      paintStars(selectedRating);
    });
    el.addEventListener('mouseenter', () => paintStars(Number(el.dataset.value)));
  });
  starPicker.addEventListener('mouseleave', () => paintStars(selectedRating));

  playerSelect.addEventListener('change', () => {
    if (ratingTouched) return;
    selectedRating = ratingsByPlayer.get(playerSelect.value) || 0;
    paintStars(selectedRating);
  });

  function close() { overlay.remove(); }

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  submitBtn.addEventListener('click', async () => {
    errorEl.textContent = '';
    const playerId = playerSelect.value;
    if (!playerId) { errorEl.textContent = 'Please select a player.'; return; }
    if (!selectedRating) { errorEl.textContent = 'Please select a star rating.'; return; }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';
    try {
      await buildsAPI.rate(build.id, parseInt(playerId, 10), selectedRating);
      close();
      showSuccess('Rating submitted!');
      loadBuilds();
    } catch (err) {
      errorEl.textContent = err.message || 'Failed to submit rating';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Rating';
    }
  });
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
  const groups = {};
  cards.forEach(card => {
    const exp = CARD_EXPANSION_MAP[card] || 'unknown';
    if (!groups[exp]) groups[exp] = [];
    groups[exp].push(card);
  });
  const groupsHtml = EXPANSION_ORDER
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
  const buildType = build.build_type === 'suggested' || build.build_type === 'experimental' ? build.build_type : 'custom';
  div.className = `build-item collapsed build-type-${buildType}`;
  div.dataset.buildId = build.id;

  const gamesPlayed = parseInt(build.games_played) || 0;
  const avgScore = parseFloat(build.avg_score_per_game) || 0;
  const avgRating = parseFloat(build.avg_rating) || 0;
  const ratingCount = parseInt(build.rating_count) || 0;

  const buildTypeLabel = build.build_type === 'suggested' ? 'Suggested' : build.build_type === 'experimental' ? 'Experimental' : 'Custom';

  div.innerHTML = `
    <div class="build-header">
      <div class="build-header-main">
        <div class="build-title-row">
          <div class="build-title">${escapeHtml(build.nickname)}${buildTypeLabel ? ` <span class="platinum-colony-badge">${buildTypeLabel}</span>` : ''}</div>
          <div class="expansion-icon-row">${renderExpansionIcons(buildExpansionKeys(build), 'expansion-icon-badge')}</div>
        </div>
        <div class="build-stats">
          <span>Games: ${gamesPlayed}</span>
          <span>Avg Score: ${avgScore.toFixed(2)}</span>
          <span class="build-rating-summary">${renderStars(avgRating)} ${ratingCount ? `${avgRating.toFixed(1)} (${ratingCount})` : 'No ratings'}</span>
          ${build.use_platinum_colony ? '<span class="platinum-colony-badge">Platinum / Colony</span>' : ''}
          ${build.use_shelters ? '<span class="platinum-colony-badge">Shelters</span>' : ''}
        </div>
      </div>
      <div class="build-header-right">
        <button class="btn btn-sm js-rate-build">Rate</button>
        <button class="btn btn-sm js-edit-build">Edit</button>
        <button class="btn btn-danger btn-sm js-delete-build">Delete</button>
        <span class="build-expand-icon">▼</span>
      </div>
    </div>
    <div class="build-body">
      ${build.notes ? `<div class="build-notes">${escapeHtml(build.notes)}</div>` : ''}
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
    if (e.target.closest('.js-delete-build') || e.target.closest('.js-edit-build') || e.target.closest('.js-rate-build')) return;
    const wasCollapsed = div.classList.contains('collapsed');
    div.classList.toggle('collapsed');
    if (wasCollapsed && !div.dataset.contentLoaded) {
      div.dataset.contentLoaded = '1';
      loadBuildComments(build.id, div.querySelector(`#comments-${build.id}`));
      loadBuildGames(build.id, div.querySelector(`#games-${build.id}`));
    }
  });

  div.querySelector('.js-rate-build').addEventListener('click', () => {
    showRateModal(build);
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
      <div class="form-group">
        <label for="em-notes">Notes</label>
        <textarea id="em-notes" rows="3" placeholder="Strategy notes, combos to watch for, etc."></textarea>
      </div>
      <div class="form-group">
        <label>Build Type</label>
        <div class="segmented-control" id="em-build-type">
          <button type="button" class="segmented-option" data-type="custom">Custom</button>
          <button type="button" class="segmented-option" data-type="suggested">Suggested</button>
          <button type="button" class="segmented-option" data-type="experimental">Experimental</button>
        </div>
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
  overlay.querySelector('#em-notes').value = build.notes || '';
  overlay.querySelector('#em-platinum-colony').checked = !!build.use_platinum_colony;
  overlay.querySelector('#em-shelters').checked = !!build.use_shelters;

  let editBuildType = build.build_type || 'custom';
  const buildTypeButtons = overlay.querySelectorAll('#em-build-type .segmented-option');
  buildTypeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === editBuildType);
    btn.addEventListener('click', () => {
      editBuildType = btn.dataset.type;
      buildTypeButtons.forEach(b => b.classList.toggle('active', b === btn));
    });
  });

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
        overlay.querySelector('#em-notes').value.trim(),
        editBuildType,
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
