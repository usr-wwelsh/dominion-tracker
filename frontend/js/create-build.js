// Create Build page logic — step wizard (expansions -> cards -> extras -> name)
//
// Card database (DOMINION_CARDS, CARD_COSTS, EXPANSION_ORDER, EXPANSION_DISPLAY,
// reverse maps) lives in js/dominion-cards.js, loaded before this file.

const wiz = {
  expansions: new Set(),
  cards: new Set(),
  landmarks: new Set(),
  events: new Set(),
  prophecies: new Set(),
  traits: new Set(),
  platinumColony: false,
  shelters: false,
  touched: new Set(),
  buildType: 'custom',
};

// Steps not needed for the current selection are skipped entirely (e.g. the
// Extras step disappears if none of the chosen expansions add anything).
const STEPS = [
  { id: 'expansions', needed: () => true },
  { id: 'cards', needed: () => true },
  { id: 'extras', needed: () => extrasNeeded() },
  { id: 'name', needed: () => true },
];

function supplementalNeeded() {
  return wiz.expansions.has('empires') || wiz.expansions.has('rising_sun') || wiz.expansions.has('plunder');
}
function optionPrompts() {
  const out = [];
  if (wiz.expansions.has('prosperity')) out.push({ key: 'platinumColony', label: 'Platinum & Colony', detected: 'Prosperity' });
  if (wiz.expansions.has('dark_ages')) out.push({ key: 'shelters', label: 'Shelters', detected: 'Dark Ages' });
  return out;
}
function extrasNeeded() { return supplementalNeeded() || optionPrompts().length > 0; }

function stepIndex(id) { return STEPS.findIndex(s => s.id === id); }
function walk(fromId, dir) {
  let i = stepIndex(fromId) + dir;
  while (i >= 0 && i < STEPS.length && !STEPS[i].needed()) i += dir;
  if (i < 0 || i >= STEPS.length) return stepIndex(fromId);
  return i;
}

let currentStep = 'expansions';

function goStep(id) {
  currentStep = id;
  document.querySelectorAll('.cb-panel').forEach(p => { p.hidden = true; });
  document.getElementById(`cb-panel-${id}`).hidden = false;
  updateStepper(id);
  renderStep(id);
}
function nextFrom(id) { goStep(STEPS[walk(id, +1)].id); }
function backFrom(id) { goStep(STEPS[walk(id, -1)].id); }

function updateStepper(activeId) {
  document.querySelectorAll('.cb-step-dot').forEach(dot => {
    dot.classList.toggle('active', dot.dataset.step === activeId);
    dot.classList.toggle('done', STEPS.findIndex(s => s.id === dot.dataset.step) < stepIndex(activeId));
  });
}

// Drop any selections that belonged to an expansion the user has since
// deselected, so a stale pick doesn't silently inflate a hidden count.
function pruneSelections() {
  [...wiz.cards].forEach(c => { if (!wiz.expansions.has(CARD_EXPANSION_MAP[c])) wiz.cards.delete(c); });
  [wiz.landmarks, wiz.events, wiz.prophecies, wiz.traits].forEach(set => {
    [...set].forEach(c => { if (!wiz.expansions.has(SUPPLEMENTAL_EXPANSION_MAP[c])) set.delete(c); });
  });
}

function renderStep(id) {
  if (id === 'expansions') renderExpansionsStep();
  else if (id === 'cards') renderCardsStep();
  else if (id === 'extras') renderExtrasStep();
  else if (id === 'name') renderNameStep();
}

// ── Step 1: expansions ──
function renderExpansionsStep() {
  const grid = document.getElementById('cb-expansion-grid');
  grid.innerHTML = '';
  EXPANSION_ORDER.forEach(exp => {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'expansion-tile' + (wiz.expansions.has(exp) ? ' selected' : '');
    tile.textContent = EXPANSION_DISPLAY[exp];
    tile.addEventListener('click', () => {
      if (wiz.expansions.has(exp)) wiz.expansions.delete(exp);
      else wiz.expansions.add(exp);
      pruneSelections();
      tile.classList.toggle('selected');
      updateExpansionsHint();
    });
    grid.appendChild(tile);
  });
  updateExpansionsHint();
}
function updateExpansionsHint() {
  const hint = document.getElementById('cb-expansions-hint');
  hint.textContent = wiz.expansions.size ? `${wiz.expansions.size} expansion${wiz.expansions.size > 1 ? 's' : ''} selected` : '';
  document.querySelector('#cb-panel-expansions .cb-next').classList.toggle('btn-disabled', wiz.expansions.size === 0);
}

// ── Step 2: cards (only from the chosen expansions, exactly 10) ──
function buildCheckbox(type, namespace, card, set) {
  const div = document.createElement('div');
  div.className = 'card-checkbox' + (set.has(card) ? ' selected' : '');

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.id = `card-${namespace}-${card.replace(/[^a-zA-Z0-9]/g, '')}`;
  checkbox.value = card;
  checkbox.checked = set.has(card);
  checkbox.addEventListener('change', () => {
    if (checkbox.checked) {
      if (type === 'kingdom' && wiz.cards.size >= 10) {
        checkbox.checked = false;
        showError('You can only select up to 10 kingdom cards');
        return;
      }
      set.add(card);
      div.classList.add('selected');
    } else {
      set.delete(card);
      div.classList.remove('selected');
    }
    if (type === 'kingdom') updateCardCount();
  });

  const label = document.createElement('label');
  label.htmlFor = checkbox.id;
  label.textContent = card;

  div.appendChild(checkbox);
  div.appendChild(label);
  return div;
}

function renderCardsStep() {
  const container = document.getElementById('cb-card-sections');
  container.innerHTML = '';
  EXPANSION_ORDER.filter(exp => wiz.expansions.has(exp)).forEach(exp => {
    const section = document.createElement('div');
    section.className = 'expansion-section';
    section.innerHTML = `<h3 class="expansion-header">${EXPANSION_DISPLAY[exp]}</h3><div class="card-grid"></div>`;
    const grid = section.querySelector('.card-grid');
    DOMINION_CARDS[exp].slice().sort((a, b) => a.localeCompare(b)).forEach(card => {
      grid.appendChild(buildCheckbox('kingdom', exp, card, wiz.cards));
    });
    container.appendChild(section);
  });
  updateCardCount();
}
function updateCardCount() {
  const countDisplay = document.getElementById('card-count');
  countDisplay.textContent = `${wiz.cards.size} / 10 kingdom cards selected`;
  countDisplay.classList.toggle('limit-reached', wiz.cards.size >= 10);
  document.querySelector('#cb-panel-cards .cb-next').classList.toggle('btn-disabled', wiz.cards.size !== 10);
}

// ── Step 3: extras — auto-detected options + optional supplemental cards ──
function renderExtrasStep() {
  const optionsList = document.getElementById('cb-options-list');
  optionsList.innerHTML = '';
  optionPrompts().forEach(p => {
    if (!wiz.touched.has(p.key)) wiz[p.key] = true; // default to Yes: we detected the expansion
    const row = document.createElement('label');
    row.className = 'toggle-label option-toggle-row';
    row.innerHTML = `<input type="checkbox" ${wiz[p.key] ? 'checked' : ''}>
      <span>Detected <strong>${p.detected}</strong> — use ${p.label}?</span>`;
    row.querySelector('input').addEventListener('change', (e) => {
      wiz[p.key] = e.target.checked;
      wiz.touched.add(p.key);
    });
    optionsList.appendChild(row);
  });

  const supplemental = document.getElementById('cb-supplemental-sections');
  supplemental.innerHTML = '';
  const addSupplementalSection = (label, cards, type, set) => {
    if (!cards || !cards.length) return;
    const section = document.createElement('div');
    section.className = 'expansion-section';
    section.innerHTML = `<h3 class="expansion-header">${label} <span class="supplemental-note">(optional)</span></h3><div class="card-grid"></div>`;
    const grid = section.querySelector('.card-grid');
    cards.slice().sort((a, b) => a.localeCompare(b)).forEach(card => {
      grid.appendChild(buildCheckbox(type, type, card, set));
    });
    supplemental.appendChild(section);
  };
  if (wiz.expansions.has('empires')) addSupplementalSection('Landmarks — Empires', DOMINION_LANDMARKS.empires, 'landmark', wiz.landmarks);
  const eventCards = [
    ...(wiz.expansions.has('empires') ? DOMINION_EVENTS.empires : []),
    ...(wiz.expansions.has('rising_sun') ? DOMINION_EVENTS.rising_sun : []),
    ...(wiz.expansions.has('plunder') ? DOMINION_EVENTS.plunder : []),
  ];
  addSupplementalSection('Events', eventCards, 'event', wiz.events);
  if (wiz.expansions.has('rising_sun')) addSupplementalSection('Prophecies — Rising Sun', DOMINION_PROPHECIES.rising_sun, 'prophecy', wiz.prophecies);
  if (wiz.expansions.has('plunder')) addSupplementalSection('Traits — Plunder', DOMINION_TRAITS.plunder, 'trait', wiz.traits);
}

// ── Step 4: name, notes, build type ──
function renderNameStep() {
  document.querySelectorAll('#build-type-control .segmented-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === wiz.buildType);
  });
  document.getElementById('cb-summary').textContent = summaryText();
}
function summaryText() {
  const exps = EXPANSION_ORDER.filter(e => wiz.expansions.has(e)).map(e => EXPANSION_DISPLAY[e]).join(', ');
  const extras = [];
  if (wiz.landmarks.size) extras.push(`${wiz.landmarks.size} landmark${wiz.landmarks.size > 1 ? 's' : ''}`);
  if (wiz.events.size) extras.push(`${wiz.events.size} event${wiz.events.size > 1 ? 's' : ''}`);
  if (wiz.prophecies.size) extras.push(`${wiz.prophecies.size} prophec${wiz.prophecies.size > 1 ? 'ies' : 'y'}`);
  if (wiz.traits.size) extras.push(`${wiz.traits.size} trait${wiz.traits.size > 1 ? 's' : ''}`);
  if (wiz.expansions.has('prosperity') && wiz.platinumColony) extras.push('Platinum/Colony');
  if (wiz.expansions.has('dark_ages') && wiz.shelters) extras.push('Shelters');
  return `${wiz.cards.size} kingdom cards · ${exps}` + (extras.length ? ` · ${extras.join(' · ')}` : '');
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  wireNavButtons();
  wireBuildTypeControl();
  setupFormHandlers();
  goStep('expansions');
});

function wireNavButtons() {
  document.querySelectorAll('.cb-next').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.classList.contains('btn-disabled')) return;
      nextFrom(btn.dataset.step);
    });
  });
  document.querySelectorAll('.cb-back').forEach(btn => {
    btn.addEventListener('click', () => backFrom(btn.dataset.step));
  });
}

function wireBuildTypeControl() {
  document.querySelectorAll('#build-type-control .segmented-option').forEach(btn => {
    btn.addEventListener('click', () => {
      wiz.buildType = btn.dataset.type;
      document.querySelectorAll('#build-type-control .segmented-option').forEach(b => b.classList.toggle('active', b === btn));
    });
  });
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

  if (wiz.cards.size !== 10) {
    showError('Please select exactly 10 kingdom cards');
    return;
  }

  try {
    const notes = document.getElementById('build-notes').value.trim();
    const platinum = wiz.expansions.has('prosperity') && wiz.platinumColony;
    const shelters = wiz.expansions.has('dark_ages') && wiz.shelters;
    await buildsAPI.create(
      nickname,
      Array.from(wiz.cards),
      Array.from(wiz.landmarks),
      Array.from(wiz.events),
      Array.from(wiz.prophecies),
      Array.from(wiz.traits),
      platinum,
      shelters,
      notes,
      wiz.buildType
    );

    showSuccess(`Build "${nickname}" created successfully!`);
    clearForm();
  } catch (error) {
    showError(`Failed to create build: ${error.message}`);
  }
}

// Clear form back to a fresh wizard
function clearForm() {
  document.getElementById('build-nickname').value = '';
  document.getElementById('build-notes').value = '';

  wiz.expansions.clear();
  wiz.cards.clear();
  wiz.landmarks.clear();
  wiz.events.clear();
  wiz.prophecies.clear();
  wiz.traits.clear();
  wiz.platinumColony = false;
  wiz.shelters = false;
  wiz.touched.clear();
  wiz.buildType = 'custom';

  goStep('expansions');
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
