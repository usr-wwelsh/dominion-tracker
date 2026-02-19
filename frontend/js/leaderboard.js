// Leaderboard page logic

const PRESET_COLORS = [
  '#e05c5c', '#ff8c42', '#f5a623', '#ffd700',
  '#6ddb6d', '#00e0c0', '#4db8ff', '#5c7eff',
  '#c47eff', '#ff4da6', '#c0a464', '#b5e853',
  '#00bcd4', '#80cbc4', '#ff8a80', '#cfcfcf',
];

let leaderboardData = [];
let currentSort = {
  column: 'total_league_points',
  direction: 'desc'
};

// Single shared popover
let activeSwatchEl = null;
let activePlayerId = null;

function buildPopover() {
  const popover = document.createElement('div');
  popover.id = 'color-popover';

  const grid = document.createElement('div');
  grid.className = 'color-popover-grid';

  PRESET_COLORS.forEach(hex => {
    const dot = document.createElement('button');
    dot.className = 'color-option';
    dot.style.background = hex;
    dot.dataset.color = hex;
    dot.title = hex;
    dot.addEventListener('click', () => selectColor(hex));
    grid.appendChild(dot);
  });

  popover.appendChild(grid);
  document.body.appendChild(popover);

  document.addEventListener('click', e => {
    if (!popover.contains(e.target) && e.target !== activeSwatchEl) {
      closePopover();
    }
  });

  return popover;
}

function openPopover(swatchEl, playerId) {
  const popover = document.getElementById('color-popover');
  activeSwatchEl = swatchEl;
  activePlayerId = playerId;

  const rect = swatchEl.getBoundingClientRect();
  popover.style.top = `${rect.bottom + window.scrollY + 8}px`;
  popover.style.left = `${rect.left + window.scrollX}px`;
  popover.classList.add('open');

  // Highlight current color
  const currentColor = swatchEl.style.background;
  popover.querySelectorAll('.color-option').forEach(dot => {
    dot.classList.toggle('active', dot.dataset.color.toLowerCase() === currentColor.toLowerCase());
  });
}

function closePopover() {
  document.getElementById('color-popover')?.classList.remove('open');
  activeSwatchEl = null;
  activePlayerId = null;
}

async function selectColor(hex) {
  if (!activeSwatchEl || !activePlayerId) return;
  const swatchEl = activeSwatchEl;
  const playerId = activePlayerId;
  const prevColor = swatchEl.style.background;
  swatchEl.style.background = hex;
  closePopover();
  try {
    await playersAPI.updateColor(playerId, hex);
    const player = leaderboardData.find(p => String(p.id) === String(playerId));
    if (player) player.color = hex;
  } catch {
    swatchEl.style.background = prevColor;
  }
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  buildPopover();
  loadLeaderboard();
  setupSorting();
});

// Load leaderboard data
async function loadLeaderboard() {
  const loading = document.getElementById('loading');
  const errorMessage = document.getElementById('error-message');
  const container = document.getElementById('leaderboard-container');
  const noData = document.getElementById('no-data');

  try {
    loading.style.display = 'block';
    errorMessage.style.display = 'none';
    container.style.display = 'none';

    leaderboardData = await statsAPI.getLeaderboard();

    loading.style.display = 'none';

    if (leaderboardData.length === 0) {
      container.style.display = 'block';
      noData.style.display = 'block';
    } else {
      container.style.display = 'block';
      noData.style.display = 'none';
      renderLeaderboard();
    }
  } catch (error) {
    loading.style.display = 'none';
    errorMessage.textContent = `Failed to load leaderboard: ${error.message}`;
    errorMessage.style.display = 'block';
  }
}

// Render leaderboard table
function renderLeaderboard() {
  const tbody = document.getElementById('leaderboard-body');
  tbody.innerHTML = '';

  const sortedData = sortData(leaderboardData, currentSort.column, currentSort.direction);

  sortedData.forEach((player, index) => {
    const row = document.createElement('tr');
    const color = player.color || '#4db8ff';

    row.innerHTML = `
      <td>${index + 1}</td>
      <td class="player-name">
        <span class="player-color-swatch" data-player-id="${player.id}" style="background:${color}" title="Click to change color"></span>
        ${escapeHtml(player.name)}
      </td>
      <td class="stat-highlight">${player.total_league_points}</td>
      <td>${player.avg_league_points}</td>
      <td>${player.total_wins}</td>
      <td>${player.total_games}</td>
      <td>${player.avg_score}</td>
    `;

    tbody.appendChild(row);
  });

  tbody.querySelectorAll('.player-color-swatch').forEach(swatch => {
    swatch.addEventListener('click', e => {
      e.stopPropagation();
      if (activeSwatchEl === swatch) {
        closePopover();
      } else {
        openPopover(swatch, swatch.dataset.playerId);
      }
    });
  });

  updateSortIndicators();
}

// Setup column sorting
function setupSorting() {
  const headers = document.querySelectorAll('th.sortable');

  headers.forEach(header => {
    header.addEventListener('click', () => {
      const column = header.dataset.column;

      if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
      } else {
        currentSort.column = column;
        currentSort.direction = 'desc';
      }

      renderLeaderboard();
    });
  });
}

// Update sort indicators
function updateSortIndicators() {
  const headers = document.querySelectorAll('th.sortable');

  headers.forEach(header => {
    header.classList.remove('sorted-asc', 'sorted-desc');

    if (header.dataset.column === currentSort.column) {
      header.classList.add(currentSort.direction === 'asc' ? 'sorted-asc' : 'sorted-desc');
    }
  });
}

// Sort data helper
function sortData(data, column, direction) {
  const sorted = [...data].sort((a, b) => {
    let aVal = a[column];
    let bVal = b[column];

    if (column === 'rank') return 0;

    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
      return direction === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    aVal = parseFloat(aVal) || 0;
    bVal = parseFloat(bVal) || 0;

    return direction === 'asc' ? aVal - bVal : bVal - aVal;
  });

  return sorted;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
