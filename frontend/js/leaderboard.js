// Leaderboard page logic

let leaderboardData = [];
let currentSort = {
  column: 'total_league_points',
  direction: 'desc'
};

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
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

  // Sort data
  const sortedData = sortData(leaderboardData, currentSort.column, currentSort.direction);

  sortedData.forEach((player, index) => {
    const row = document.createElement('tr');

    row.innerHTML = `
      <td>${index + 1}</td>
      <td class="player-name">${escapeHtml(player.name)}</td>
      <td class="stat-highlight">${player.total_league_points}</td>
      <td>${player.avg_league_points}</td>
      <td>${player.total_wins}</td>
      <td>${player.total_games}</td>
      <td>${player.avg_score}</td>
    `;

    tbody.appendChild(row);
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

    // Handle rank specially
    if (column === 'rank') {
      return 0; // Rank is determined by position, not sorted
    }

    // Handle string comparison
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
      return direction === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }

    // Handle numeric comparison
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
