// Players page logic

let playersData = [];
let leaderboardData = [];

document.addEventListener('DOMContentLoaded', () => {
  loadPlayers();
});

async function loadPlayers() {
  const loading = document.getElementById('loading');
  const container = document.getElementById('players-container');
  const noPlayers = document.getElementById('no-players');

  try {
    loading.style.display = 'block';
    container.style.display = 'none';

    [playersData, leaderboardData] = await Promise.all([
      playersAPI.getAll(),
      statsAPI.getLeaderboard(),
    ]);

    loading.style.display = 'none';
    container.style.display = 'block';

    if (playersData.length === 0) {
      noPlayers.style.display = 'block';
    } else {
      noPlayers.style.display = 'none';
      renderPlayers();
    }
  } catch (error) {
    loading.style.display = 'none';
    showError(`Failed to load players: ${error.message}`);
  }
}

function getGamesPlayed(playerId) {
  const entry = leaderboardData.find(r => String(r.id) === String(playerId));
  return entry ? parseInt(entry.total_games) || 0 : 0;
}

function renderPlayers() {
  const list = document.getElementById('players-list');
  list.innerHTML = '';

  playersData.forEach(player => {
    const gamesPlayed = getGamesPlayed(player.id);
    const row = document.createElement('div');
    row.className = 'player-row';
    row.dataset.playerId = player.id;

    row.innerHTML = `
      <div class="player-row-info">
        <span class="player-color-swatch" style="background:${escapeHtml(player.color || '#4db8ff')}"></span>
        <span class="player-name">${escapeHtml(player.name)}</span>
        <span class="player-games">${gamesPlayed} game${gamesPlayed !== 1 ? 's' : ''}</span>
      </div>
      <div class="player-row-actions">
        <button class="btn btn-danger btn-sm js-delete-player">Delete</button>
      </div>
    `;

    row.querySelector('.js-delete-player').addEventListener('click', () => {
      showDeleteModal(`Delete player "${player.name}"?`, async (credentials) => {
        await playersAPI.delete(player.id, credentials);
        showSuccess(`Player "${player.name}" deleted.`);
        loadPlayers();
      });
    });

    list.appendChild(row);
  });
}

function showError(message) {
  const errorDiv = document.getElementById('error-message');
  const successDiv = document.getElementById('success-message');
  successDiv.style.display = 'none';
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  setTimeout(() => { errorDiv.style.display = 'none'; }, 5000);
}

function showSuccess(message) {
  const errorDiv = document.getElementById('error-message');
  const successDiv = document.getElementById('success-message');
  errorDiv.style.display = 'none';
  successDiv.textContent = message;
  successDiv.style.display = 'block';
  setTimeout(() => { successDiv.style.display = 'none'; }, 5000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
