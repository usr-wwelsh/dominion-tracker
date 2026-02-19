// Games page logic

let gamesData = [];
let scoreHistoryCache = {};
let currentOffset = 0;
const PAGE_SIZE = 20;

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  loadGames();
  setupFilters();
  document.getElementById('load-more-btn').addEventListener('click', loadMoreGames);
});

// Load games data (first page)
async function loadGames() {
  const loading = document.getElementById('loading');
  const errorMessage = document.getElementById('error-message');
  const container = document.getElementById('games-container');
  const noGames = document.getElementById('no-games');
  const loadMoreContainer = document.getElementById('load-more-container');

  try {
    loading.style.display = 'block';
    errorMessage.style.display = 'none';
    container.style.display = 'none';

    const result = await gamesAPI.getAll({ limit: PAGE_SIZE, offset: 0 });
    gamesData = result.games;
    currentOffset = PAGE_SIZE;

    loading.style.display = 'none';
    container.style.display = 'block';
    loadMoreContainer.style.display = result.hasMore ? 'block' : 'none';

    if (gamesData.length === 0) {
      noGames.style.display = 'block';
    } else {
      noGames.style.display = 'none';
      populateFilterDropdowns();
      renderGames();
    }
  } catch (error) {
    loading.style.display = 'none';
    errorMessage.textContent = `Failed to load games: ${error.message}`;
    errorMessage.style.display = 'block';
  }
}

// Load the next page and append matching cards
async function loadMoreGames() {
  const btn = document.getElementById('load-more-btn');
  const loadMoreContainer = document.getElementById('load-more-container');
  btn.disabled = true;
  btn.textContent = 'Loading...';

  try {
    const result = await gamesAPI.getAll({ limit: PAGE_SIZE, offset: currentOffset });
    currentOffset += PAGE_SIZE;

    gamesData = gamesData.concat(result.games);
    appendFilterOptions(result.games);

    const playerFilter = document.getElementById('filter-player').value;
    const buildFilter = document.getElementById('filter-build').value;
    const gamesList = document.getElementById('games-list');
    const noFiltered = document.getElementById('no-filtered-games');

    result.games.forEach(game => {
      if (gameMatchesFilters(game, playerFilter, buildFilter)) {
        gamesList.appendChild(createGameCard(game));
        noFiltered.style.display = 'none';
      }
    });

    loadMoreContainer.style.display = result.hasMore ? 'block' : 'none';
  } catch (error) {
    alert(`Failed to load more games: ${error.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Load More';
  }
}

// Populate filter dropdowns from the initial game list
function populateFilterDropdowns() {
  const playerSelect = document.getElementById('filter-player');
  const buildSelect = document.getElementById('filter-build');
  const filtersEl = document.getElementById('games-filters');

  const players = new Map();
  gamesData.forEach(game => {
    if (game.players) {
      game.players.forEach(p => {
        if (p.player_id && p.player_name) players.set(p.player_id, p.player_name);
      });
    }
  });

  const builds = new Map();
  gamesData.forEach(game => {
    if (game.build_id && game.build_nickname) builds.set(game.build_id, game.build_nickname);
  });

  [...players.entries()].sort((a, b) => a[1].localeCompare(b[1])).forEach(([id, name]) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = name;
    playerSelect.appendChild(opt);
  });

  [...builds.entries()].sort((a, b) => a[1].localeCompare(b[1])).forEach(([id, name]) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = name;
    buildSelect.appendChild(opt);
  });

  if (players.size > 1 || builds.size > 0) {
    filtersEl.style.display = 'flex';
  }
}

// Append filter options for newly loaded games (skips duplicates)
function appendFilterOptions(newGames) {
  const playerSelect = document.getElementById('filter-player');
  const buildSelect = document.getElementById('filter-build');
  const filtersEl = document.getElementById('games-filters');

  const existingPlayers = new Set([...playerSelect.options].map(o => String(o.value)));
  const existingBuilds = new Set([...buildSelect.options].map(o => String(o.value)));

  const newPlayers = new Map();
  const newBuilds = new Map();

  newGames.forEach(game => {
    if (game.players) {
      game.players.forEach(p => {
        if (p.player_id && p.player_name && !existingPlayers.has(String(p.player_id))) {
          newPlayers.set(p.player_id, p.player_name);
        }
      });
    }
    if (game.build_id && game.build_nickname && !existingBuilds.has(String(game.build_id))) {
      newBuilds.set(game.build_id, game.build_nickname);
    }
  });

  [...newPlayers.entries()].sort((a, b) => a[1].localeCompare(b[1])).forEach(([id, name]) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = name;
    playerSelect.appendChild(opt);
  });

  [...newBuilds.entries()].sort((a, b) => a[1].localeCompare(b[1])).forEach(([id, name]) => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = name;
    buildSelect.appendChild(opt);
  });

  if (playerSelect.options.length > 1 || buildSelect.options.length > 1) {
    filtersEl.style.display = 'flex';
  }
}

// Check if a single game matches the active filters
function gameMatchesFilters(game, playerFilter, buildFilter) {
  if (playerFilter) {
    const hasPlayer = game.players && game.players.some(
      p => String(p.player_id) === String(playerFilter)
    );
    if (!hasPlayer) return false;
  }
  if (buildFilter) {
    if (String(game.build_id) !== String(buildFilter)) return false;
  }
  return true;
}

function setupFilters() {
  const playerSelect = document.getElementById('filter-player');
  const buildSelect = document.getElementById('filter-build');
  const clearBtn = document.getElementById('filter-clear');

  function onFilterChange() {
    const hasFilter = playerSelect.value || buildSelect.value;
    clearBtn.style.display = hasFilter ? 'inline-block' : 'none';
    renderGames();
  }

  playerSelect.addEventListener('change', onFilterChange);
  buildSelect.addEventListener('change', onFilterChange);
  clearBtn.addEventListener('click', () => {
    playerSelect.value = '';
    buildSelect.value = '';
    clearBtn.style.display = 'none';
    renderGames();
  });
}

// Get currently filtered game list
function getFilteredGames() {
  const playerFilter = document.getElementById('filter-player').value;
  const buildFilter = document.getElementById('filter-build').value;
  return gamesData.filter(game => gameMatchesFilters(game, playerFilter, buildFilter));
}

// Render games list
function renderGames() {
  const gamesList = document.getElementById('games-list');
  const noFiltered = document.getElementById('no-filtered-games');
  const noGames = document.getElementById('no-games');
  gamesList.innerHTML = '';

  const filtered = getFilteredGames();

  const playerFilter = document.getElementById('filter-player').value;
  const buildFilter = document.getElementById('filter-build').value;
  const hasFilter = playerFilter || buildFilter;

  if (filtered.length === 0 && hasFilter) {
    noFiltered.style.display = 'block';
    noGames.style.display = 'none';
  } else {
    noFiltered.style.display = 'none';
    noGames.style.display = 'none';
  }

  filtered.forEach(game => {
    const gameCard = createGameCard(game);
    gamesList.appendChild(gameCard);
  });
}

// Create game card element (header only; details rendered lazily on first expand)
function createGameCard(game) {
  const card = document.createElement('div');
  card.className = 'game-card';
  card.dataset.gameId = game.id;

  const winner = game.players && game.players.length > 0
    ? game.players.find(p => p.placement === 1)
    : null;

  card.style.setProperty('--winner-color', winner?.player_color || '#a08850');

  const startDate = game.started_at ? new Date(game.started_at) : null;
  const formattedDate = startDate
    ? startDate.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Unknown date';

  const duration = game.duration
    ? formatDuration(game.duration)
    : 'Unknown duration';

  card.innerHTML = `
    <div class="game-header">
      <div class="game-info">
        <div class="game-date">${formattedDate}</div>
        <div class="game-winner">
          Winner: <span class="game-winner-name" ${winner?.player_color ? `style="color:${winner.player_color}"` : ''}>${winner ? escapeHtml(winner.player_name) : 'Unknown'}</span>
          ${winner ? `<span class="game-winner-score">(${winner.final_score} pts)</span>` : ''}
        </div>
        <div class="game-meta">
          <span>Build: <span class="game-build">${game.build_nickname || 'None'}</span></span>
          <span>Duration: ${duration}</span>
          <span>Players: ${game.players ? game.players.length : 0}</span>
        </div>
      </div>
      <div class="game-header-right">
        <button class="delete-game-btn" data-game-id="${game.id}" title="Delete game">✕</button>
        <div class="expand-icon">▼</div>
      </div>
    </div>
    <div class="game-details"></div>
  `;

  // Add click handler to expand/collapse
  card.querySelector('.game-header').addEventListener('click', () => {
    toggleGameCard(card, game);
  });

  // Delete button — stop propagation so it doesn't also expand the card
  card.querySelector('.delete-game-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!confirm(`Delete this game? This cannot be undone.`)) return;
    try {
      await gamesAPI.delete(game.id);
      card.remove();
    } catch (error) {
      alert(`Failed to delete game: ${error.message}`);
    }
  });

  return card;
}

// Build the inner HTML for game details (chart first, then standings)
function buildGameDetailsHTML(game) {
  return `
    <div class="chart-container">
      <div class="chart-title">Score Progression</div>
      <canvas id="chart-${game.id}"></canvas>
    </div>
    <div class="players-table">
      <h3>Final Standings</h3>
      <table>
        <thead>
          <tr>
            <th>Place</th>
            <th>Player</th>
            <th>Score</th>
            <th>League Points</th>
          </tr>
        </thead>
        <tbody>
          ${game.players ? game.players.map(player => `
            <tr>
              <td class="placement-${player.placement}">
                <div class="placement-cell">
                  <span class="placement-star">${getPlacementStar(player.placement)}</span>
                  ${player.placement}
                </div>
              </td>
              <td><span ${player.player_color ? `style="color:${player.player_color}"` : ''}>${escapeHtml(player.player_name)}</span></td>
              <td>${player.final_score}</td>
              <td>${player.league_points}</td>
            </tr>
          `).join('') : ''}
        </tbody>
      </table>
    </div>
  `;
}

// Toggle game card expansion
async function toggleGameCard(card, game) {
  const wasExpanded = card.classList.contains('expanded');

  if (wasExpanded) {
    card.classList.remove('expanded');
    removeSparkles(card);
  } else {
    card.classList.add('expanded');
    createSparkles(card);

    // Inject details HTML on first expand
    if (!card.dataset.rendered) {
      card.dataset.rendered = '1';
      card.querySelector('.game-details').innerHTML = buildGameDetailsHTML(game);
    }

    // Load score history if not cached
    if (!scoreHistoryCache[game.id]) {
      try {
        const scoreHistory = await gamesAPI.getScoreHistory(game.id);
        scoreHistoryCache[game.id] = scoreHistory;
      } catch (error) {
        console.error('Failed to load score history:', error);
        scoreHistoryCache[game.id] = [];
      }
    }

    // Draw chart after a short delay to ensure container is fully expanded
    const canvas = card.querySelector(`#chart-${game.id}`);
    if (canvas) {
      setTimeout(() => {
        drawScoreChart(canvas, scoreHistoryCache[game.id]);
      }, 50);
    }
  }
}

function createSparkles(card) {
  const sparklesContainer = document.createElement('div');
  sparklesContainer.className = 'sparkles-container';
  card.appendChild(sparklesContainer);

  const sparkleCount = 12;
  for (let i = 0; i < sparkleCount; i++) {
    const sparkle = document.createElement('span');
    sparkle.className = 'sparkle';
    sparkle.innerHTML = ['✦', '✧', '★', '☆', '✶', '✷'][Math.floor(Math.random() * 6)];
    sparkle.style.cssText = `
      position: absolute;
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      color: ${['#ffd700', '#ffcc00', '#ff9900', '#fff5cc'][Math.floor(Math.random() * 4)]};
      font-size: ${12 + Math.random() * 12}px;
      pointer-events: none;
      z-index: 10;
      animation: sparkle 0.6s ease-out forwards;
      animation-delay: ${Math.random() * 0.3}s;
    `;
    sparklesContainer.appendChild(sparkle);
  }

  setTimeout(() => {
    sparklesContainer.remove();
  }, 1000);
}

function removeSparkles(card) {
  const sparkles = card.querySelector('.sparkles-container');
  if (sparkles) {
    sparkles.remove();
  }
}

// Draw score progression chart using Canvas
function drawScoreChart(canvas, scoreHistory) {
  if (!scoreHistory || scoreHistory.length === 0) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#6b6355';
    ctx.font = '14px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('No score history available', canvas.width / 2, canvas.height / 2);
    return;
  }

  const ctx = canvas.getContext('2d');
  const width = canvas.width = canvas.offsetWidth;
  const height = canvas.height = canvas.offsetHeight || 300;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Group scores by player
  const playerScores = {};
  scoreHistory.forEach(snapshot => {
    if (!playerScores[snapshot.player_id]) {
      playerScores[snapshot.player_id] = {
        name: snapshot.player_name,
        color: snapshot.player_color,
        scores: []
      };
    }
    playerScores[snapshot.player_id].scores.push({
      timestamp: new Date(snapshot.timestamp),
      score: snapshot.score
    });
  });

  // Find min/max values
  const allScores = scoreHistory.map(s => s.score);
  const minScore = Math.min(0, ...allScores);
  const maxScore = Math.max(...allScores);
  const scoreRange = maxScore - minScore || 1;

  const padding = { top: 30, right: 10, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const fallbackColors = ['#e05c5c', '#4db8ff', '#6ddb6d', '#f5a623', '#c47eff', '#00e0c0'];

  const playerData = Object.values(playerScores).map((player, index) => {
    const color = player.color || fallbackColors[index % fallbackColors.length];
    const scores = player.scores.sort((a, b) => a.timestamp - b.timestamp);

    if (scores.length === 0) return null;

    const firstTime = scores[0].timestamp;
    const lastTime = scores[scores.length - 1].timestamp;
    const timeRange = lastTime - firstTime || 1;

    const points = scores.map(point => ({
      x: padding.left + ((point.timestamp - firstTime) / timeRange * chartWidth),
      y: height - padding.bottom - ((point.score - minScore) / scoreRange * chartHeight)
    }));

    return { name: player.name, color, points };
  }).filter(Boolean);

  drawChartStaticElements(ctx, width, height, padding, chartWidth, chartHeight, minScore, scoreRange);

  const totalDuration = 3500;
  const startTime = performance.now();

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / totalDuration, 1);

    ctx.clearRect(0, 0, width, height);
    drawChartStaticElements(ctx, width, height, padding, chartWidth, chartHeight, minScore, scoreRange);

    playerData.forEach((player, playerIndex) => {
      const pointsToDraw = Math.floor(player.points.length * progress);
      if (pointsToDraw < 1) return;

      ctx.strokeStyle = player.color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();

      for (let i = 0; i < pointsToDraw; i++) {
        const point = player.points[i];
        if (i === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      }

      if (progress < 1 && player.points.length > 1) {
        const partialProgress = (player.points.length * progress) % 1;
        if (partialProgress > 0) {
          const lastPoint = player.points[pointsToDraw - 1];
          const nextPoint = player.points[pointsToDraw];
          const currentX = lastPoint.x + (nextPoint.x - lastPoint.x) * partialProgress;
          const currentY = lastPoint.y + (nextPoint.y - lastPoint.y) * partialProgress;
          ctx.lineTo(currentX, currentY);
        }
      }

      ctx.stroke();

      const pointsToShow = Math.min(pointsToDraw, player.points.length);
      for (let i = 0; i < pointsToShow; i++) {
        const point = player.points[i];
        const pointProgress = Math.max(0, (progress * player.points.length - i) * 2);
        const pointScale = Math.min(1, pointProgress);
        const pointAlpha = Math.min(1, pointProgress);

        ctx.fillStyle = player.color;
        ctx.globalAlpha = pointAlpha;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4 * pointScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      if (playerIndex === 0 || progress >= 0.5) {
        const legendProgress = Math.min(1, (progress - 0.3) / 0.4);
        const legendAlpha = Math.max(0, legendProgress);
        const legendY = padding.top + (playerIndex * 20);

        const legendX = padding.left + 8;
        ctx.globalAlpha = legendAlpha;
        ctx.fillStyle = player.color;
        ctx.fillRect(legendX, legendY - 6, 10 * legendProgress, 10 * legendProgress);
        ctx.fillStyle = '#d4c5a9';
        ctx.textAlign = 'left';
        ctx.font = '11px Georgia, serif';
        ctx.fillText(player.name, legendX + 14, legendY + 4);
        ctx.globalAlpha = 1;
      }
    });

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }

  requestAnimationFrame(animate);
}

function drawChartStaticElements(ctx, width, height, padding, chartWidth, chartHeight, minScore, scoreRange) {
  ctx.strokeStyle = '#3a2f26';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

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

  ctx.fillStyle = '#a89a82';
  ctx.textAlign = 'center';
  ctx.font = '14px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText('Score', 4, padding.top - 16);
  ctx.fillText('Time', width / 2, height - 10);
}

// Format duration in seconds to human-readable string
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function getPlacementStar(placement) {
  return '';
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
