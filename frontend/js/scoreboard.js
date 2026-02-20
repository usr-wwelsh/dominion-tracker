// Scoreboard page logic

let allPlayers = [];
let allBuilds = [];
let selectedPlayers = [];
let currentGame = null;
let gameTimer = null;
let gameStartTime = null;
let scoreUpdateDebounce = {};

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  loadPlayers();
  loadBuilds();
  setupEventListeners();
});

// Load all players for autocomplete
async function loadPlayers() {
  try {
    allPlayers = await playersAPI.getAll();
    renderPlayerRoster();
  } catch (error) {
    console.error('Failed to load players:', error);
  }
}

// Load all builds for dropdown
async function loadBuilds() {
  try {
    allBuilds = await buildsAPI.getAll();
    updateBuildDropdown();
  } catch (error) {
    console.error('Failed to load builds:', error);
  }
}

// Render clickable player roster
function renderPlayerRoster() {
  const roster = document.getElementById('player-roster');
  const label = document.getElementById('player-count-label');
  roster.innerHTML = '';

  const count = selectedPlayers.length;
  label.textContent = count > 0 ? `(${count} selected)` : '';

  if (allPlayers.length === 0) {
    roster.innerHTML = '<span class="roster-empty">No players yet — add one below.</span>';
    return;
  }

  allPlayers.forEach(player => {
    const isSelected = selectedPlayers.some(p => p.id === player.id);
    const color = player.color || '#4db8ff';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'roster-btn' + (isSelected ? ' roster-btn-selected' : '');
    btn.dataset.playerId = player.id;
    btn.style.setProperty('--player-color', color);
    btn.innerHTML = `
      <span class="roster-dot" style="background:${color}"></span>
      <span class="roster-name">${escapeHtml(player.name)}</span>
      ${isSelected ? '<span class="roster-check">✓</span>' : ''}
    `;
    btn.addEventListener('click', () => togglePlayer(player));
    roster.appendChild(btn);
  });
}

// Update build dropdown
function updateBuildDropdown() {
  const select = document.getElementById('build-select');
  select.innerHTML = '<option value="">— Select a build —</option>';

  allBuilds.forEach(build => {
    const option = document.createElement('option');
    option.value = build.id;
    option.textContent = build.nickname;
    select.appendChild(option);
  });

  select.addEventListener('change', updateStartButton);
}

// Setup event listeners
function setupEventListeners() {
  const newPlayerBtn = document.getElementById('new-player-btn');
  const newPlayerInput = document.getElementById('new-player-input');
  const startGameBtn = document.getElementById('start-game-btn');
  const endGameBtn = document.getElementById('end-game-btn');
  const cancelGameBtn = document.getElementById('cancel-game-btn');
  const restartGameBtn = document.getElementById('restart-game-btn');
  const goToGamesBtn = document.getElementById('go-to-games-btn');

  newPlayerBtn.addEventListener('click', addNewPlayer);
  newPlayerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addNewPlayer();
  });

  startGameBtn.addEventListener('click', startGame);
  endGameBtn.addEventListener('click', endGame);
  document.getElementById('confirm-end-yes').addEventListener('click', doEndGame);
  document.getElementById('confirm-end-no').addEventListener('click', () => {
    document.getElementById('confirm-end-modal').style.display = 'none';
  });
  document.getElementById('confirm-cancel-yes').addEventListener('click', doCancelGame);
  document.getElementById('confirm-cancel-no').addEventListener('click', () => {
    document.getElementById('confirm-cancel-modal').style.display = 'none';
  });
  cancelGameBtn.addEventListener('click', cancelGame);
  restartGameBtn.addEventListener('click', restartGame);
  goToGamesBtn.addEventListener('click', goToGamesPage);
}

// Toggle a player in/out of the selected list
function togglePlayer(player) {
  const idx = selectedPlayers.findIndex(p => p.id === player.id);
  if (idx === -1) {
    selectedPlayers.push(player);
  } else {
    selectedPlayers.splice(idx, 1);
  }
  renderPlayerRoster();
  updateStartButton();
}

// Create a brand-new player and add them to the roster
async function addNewPlayer() {
  const input = document.getElementById('new-player-input');
  const name = input.value.trim();
  if (!name) return;

  if (allPlayers.some(p => p.name.toLowerCase() === name.toLowerCase())) {
    showError('A player with that name already exists');
    return;
  }

  try {
    const newPlayer = await playersAPI.create(name);
    allPlayers.unshift(newPlayer);
    selectedPlayers.push(newPlayer);
    input.value = '';
    renderPlayerRoster();
    updateStartButton();
  } catch (error) {
    showError(`Failed to create player: ${error.message}`);
  }
}

// Update start button state
function updateStartButton() {
  const startBtn = document.getElementById('start-game-btn');
  const buildId = document.getElementById('build-select').value;
  startBtn.disabled = selectedPlayers.length < 2 || !buildId;
}

// Start game
async function startGame() {
  const buildSelect = document.getElementById('build-select');
  const buildId = buildSelect.value;
  if (!buildId) {
    showError('Please select a build before starting.');
    return;
  }

  try {
    // Create players if they don't exist
    for (let i = 0; i < selectedPlayers.length; i++) {
      if (!selectedPlayers[i].id) {
        const newPlayer = await playersAPI.create(selectedPlayers[i].name);
        selectedPlayers[i] = newPlayer;
      }
    }

    // Create game
    const playerIds = selectedPlayers.map(p => p.id);
    currentGame = await gamesAPI.create(buildId, playerIds);

    // Start the game
    currentGame = await gamesAPI.start(currentGame.id);

    // Initialize game state
    gameStartTime = new Date(currentGame.started_at);
    startTimer();

    // Initialize player scores from game (everyone starts with 3 victory points in Dominion)
    selectedPlayers = selectedPlayers.map(player => ({
      ...player,
      score: 3
    }));

    // Show game section
    document.getElementById('setup-section').style.display = 'none';
    document.getElementById('game-section').style.display = 'block';

    renderScoreboard();
    showSuccess('Game started!');
  } catch (error) {
    showError(`Failed to start game: ${error.message}`);
  }
}

// Start timer
function startTimer() {
  const timerDisplay = document.getElementById('timer');

  gameTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;

    timerDisplay.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }, 1000);
}

// Stop timer
function stopTimer() {
  if (gameTimer) {
    clearInterval(gameTimer);
    gameTimer = null;
  }
}

// Render scoreboard
function renderScoreboard() {
  const scoreboard = document.getElementById('scoreboard');
  scoreboard.innerHTML = '';

  selectedPlayers.forEach((player, index) => {
    const div = document.createElement('div');
    div.className = 'score-row';
    div.dataset.playerId = player.id;

    const color = player.color || '#4db8ff';
    div.style.borderColor = color;
    div.innerHTML = `
      <div class="player-rank">${index + 1}</div>
      <div class="player-info">
        <span class="player-color-dot" style="background:${color}"></span>
        <div class="player-info-name">${escapeHtml(player.name)}</div>
      </div>
      <div class="score-display">${player.score}</div>
      <div class="score-controls">
        <button class="btn score-btn" onclick="updateScore(${player.id}, -1)">−</button>
        <button class="btn score-btn" onclick="updateScore(${player.id}, 1)">+</button>
      </div>
    `;

    scoreboard.appendChild(div);
  });
}

// Update player score
async function updateScore(playerId, delta) {
  // Update local state immediately for responsiveness
  const player = selectedPlayers.find(p => p.id === playerId);
  if (!player) return;

  player.score = Math.max(0, player.score + delta);
  renderScoreboard();
  updateLiveChart();

  // Debounce API call
  if (scoreUpdateDebounce[playerId]) {
    clearTimeout(scoreUpdateDebounce[playerId]);
  }

  scoreUpdateDebounce[playerId] = setTimeout(async () => {
    try {
      await gamesAPI.updateScore(currentGame.id, playerId, player.score);
    } catch (error) {
      console.error('Failed to update score:', error);
      showError('Failed to save score update');
    }
  }, 500); // Wait 500ms after last change before saving
}

// End game
function endGame() {
  document.getElementById('confirm-end-modal').style.display = 'flex';
}

async function doEndGame() {
  document.getElementById('confirm-end-modal').style.display = 'none';

  try {
    Object.values(scoreUpdateDebounce).forEach(timeout => clearTimeout(timeout));

    const finalGame = await gamesAPI.end(currentGame.id);

    stopTimer();
    showSuccess('Game ended! Calculating results...');

    const endedGameInfo = {
      game: finalGame,
      selectedPlayerIds: selectedPlayers.map(p => p.id),
      selectedPlayerNames: selectedPlayers.map(p => p.name),
      previousBuildId: currentGame.build_id
    };

    setTimeout(() => {
      showEndGameModal(endedGameInfo);
    }, 500);
  } catch (error) {
    showError(`Failed to end game: ${error.message}`);
  }
}

// Show end game modal with restart options
function showEndGameModal(endedGameInfo) {
  const modal = document.getElementById('end-game-modal');
  const winner = endedGameInfo.game.players[0];
  
  document.getElementById('result-winner').textContent = winner.player_name;
  document.getElementById('result-score').textContent = winner.final_score;
  document.getElementById('result-points').textContent = winner.league_points;
  
  const buildSelect = document.getElementById('restart-build-select');
  buildSelect.innerHTML = '<option value="">— Select a build —</option>';
  allBuilds.forEach(build => {
    const option = document.createElement('option');
    option.value = build.id;
    option.textContent = build.nickname;
    if (build.id === endedGameInfo.previousBuildId) {
      option.selected = true;
    }
    buildSelect.appendChild(option);
  });
  
  modal.dataset.endedGameInfo = JSON.stringify(endedGameInfo);
  
  modal.style.display = 'flex';
}

// Hide end game modal
function hideEndGameModal() {
  document.getElementById('end-game-modal').style.display = 'none';
}

// Restart game with same players
async function restartGame() {
  const modal = document.getElementById('end-game-modal');
  const endedGameInfo = JSON.parse(modal.dataset.endedGameInfo);
  const buildSelect = document.getElementById('restart-build-select');
  const newBuildId = buildSelect.value;
  if (!newBuildId) {
    showError('Please select a build before restarting.');
    return;
  }

  hideEndGameModal();

  try {
    selectedPlayers = endedGameInfo.selectedPlayerIds
      .map(id => allPlayers.find(p => p.id === id))
      .filter(Boolean);

    document.getElementById('build-select').value = newBuildId || '';
    document.getElementById('setup-section').style.display = 'block';
    document.getElementById('game-section').style.display = 'none';

    renderPlayerRoster();
    updateStartButton();
    showSuccess('Ready to start new game with same players!');
  } catch (error) {
    showError(`Failed to restart game: ${error.message}`);
  }
}

// Go to games page
function goToGamesPage() {
  hideEndGameModal();
  resetGame();
  window.location.href = 'games.html';
}

// Cancel game
function cancelGame() {
  document.getElementById('confirm-cancel-modal').style.display = 'flex';
}

async function doCancelGame() {
  document.getElementById('confirm-cancel-modal').style.display = 'none';
  stopTimer();
  if (currentGame) {
    try {
      await gamesAPI.cancel(currentGame.id);
    } catch (err) {
      console.error('Failed to delete cancelled game:', err);
    }
  }
  resetGame();
  showSuccess('Game cancelled');
}

// Reset game state
function resetGame() {
  currentGame = null;
  selectedPlayers = [];
  gameStartTime = null;
  scoreUpdateDebounce = {};

  document.getElementById('setup-section').style.display = 'block';
  document.getElementById('game-section').style.display = 'none';
  document.getElementById('timer').textContent = '00:00';

  renderPlayerRoster();
  updateStartButton();
}

// Update live chart
function updateLiveChart() {
  const canvas = document.getElementById('live-score-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const width = canvas.width = canvas.offsetWidth;
  const height = canvas.height = 300;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  if (selectedPlayers.length === 0) return;

  // Get score range
  const scores = selectedPlayers.map(p => p.score);
  const minScore = Math.min(0, ...scores);
  const maxScore = Math.max(...scores);
  const scoreRange = maxScore - minScore || 1;

  // Chart dimensions
  const padding = { top: 30, right: 120, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Draw axes
  ctx.strokeStyle = '#3a2f26';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

  // Draw Y-axis labels and grid
  ctx.fillStyle = '#a89a82';
  ctx.font = '12px Georgia, serif';
  ctx.textAlign = 'right';
  const ySteps = 5;
  for (let i = 0; i <= ySteps; i++) {
    const score = minScore + (scoreRange * i / ySteps);
    const y = height - padding.bottom - (chartHeight * i / ySteps);
    ctx.fillText(Math.round(score), padding.left - 10, y + 4);

    ctx.strokeStyle = '#2b1f1a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  // Draw bars for each player
  const barWidth = chartWidth / selectedPlayers.length * 0.8;
  const barSpacing = chartWidth / selectedPlayers.length;

  selectedPlayers.forEach((player, index) => {
    const color = player.color || '#4db8ff';
    const x = padding.left + (barSpacing * index) + (barSpacing - barWidth) / 2;
    const barHeight = ((player.score - minScore) / scoreRange) * chartHeight;
    const y = height - padding.bottom - barHeight;

    // Draw bar
    ctx.fillStyle = color;
    ctx.fillRect(x, y, barWidth, barHeight);

    // Draw score on top
    ctx.fillStyle = '#d4c5a9';
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px Georgia, serif';
    ctx.fillText(player.score, x + barWidth / 2, y - 5);

    // Draw player name at bottom
    ctx.font = '11px Georgia, serif';
    ctx.fillText(player.name, x + barWidth / 2, height - padding.bottom + 20);
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
  }, 3000);
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
