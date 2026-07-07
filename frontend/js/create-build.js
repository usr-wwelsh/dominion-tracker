// Create Build page logic

// Card database (DOMINION_CARDS, CARD_COSTS, EXPANSION_DISPLAY, reverse maps)
// lives in js/dominion-cards.js, loaded before this file.

let selectedCards = new Set();
let selectedLandmarks = new Set();
let selectedEvents = new Set();
let selectedProphecies = new Set();
let selectedTraits = new Set();

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  renderCardCheckboxes();
  setupCollapsibleSections();
  setupFormHandlers();
});

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
