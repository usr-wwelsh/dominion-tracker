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

  const winners = game.players ? game.players.filter(p => p.placement === 1) : [];
  const winner = winners[0] || null;
  const tied = winners.length > 1;

  // Single winner: use their color. Tied: fall back to gold accent.
  card.style.setProperty('--winner-color', !tied && winner?.player_color ? winner.player_color : '#a08850');

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
          <span class="game-winner-name">${formatWinnerNames(winners)}</span>
          ${winner ? `<span class="game-winner-score">${winner.final_score} pts</span>` : ''}
        </div>
      </div>
      <div class="game-header-right">
        <button class="delete-game-btn" data-game-id="${game.id}" title="Delete game">✕</button>
        <div class="expand-icon">▼</div>
      </div>
    </div>
    <div class="game-type-banner">
      <span class="game-build">${game.build_nickname || 'No Kingdom'}</span>
      <span class="game-type-stats">${duration} &middot; ${game.players ? game.players.length : 0} Players</span>
    </div>
    <div class="game-details"></div>
  `;

  // Click anywhere on card (except delete btn or comment form) to expand/collapse
  card.addEventListener('click', (e) => {
    if (e.target.closest('.game-comment-form')) return;
    toggleGameCard(card, game);
  });

  // Delete button — stop propagation so it doesn't also expand the card
  card.querySelector('.delete-game-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    showDeleteModal('Delete this game?', async (credentials) => {
      await gamesAPI.delete(game.id, credentials);
      card.remove();
    });
  });

  return card;
}

// Build the inner HTML for game details (chart first, then standings)
function buildGameDetailsHTML(game) {
  const playerOptions = game.players
    ? game.players.map(p =>
        `<option value="${p.player_id}">${escapeHtml(p.player_name)}</option>`
      ).join('')
    : '';

  const commentSection = game.build_id ? `
    <div class="game-comment-form">
      <div class="game-comments-list" id="comments-${game.id}"></div>
      <h3>Leave a Comment</h3>
      <div class="form-group">
        <label>Player</label>
        <select id="comment-player-${game.id}" class="comment-player-select">
          <option value="">Select player...</option>
          ${playerOptions}
        </select>
      </div>
      <div class="form-group">
        <textarea id="comment-text-${game.id}" class="comment-textarea" rows="3" placeholder="Your thoughts on this build..."></textarea>
      </div>
      <button class="btn btn-primary btn-sm js-submit-comment" data-game-id="${game.id}" data-build-id="${game.build_id}">Post Comment</button>
      <div class="comment-feedback" id="comment-feedback-${game.id}"></div>
    </div>
  ` : '';

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
            <tr class="${player.placement === 1 ? 'winner-row' : ''}">
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
    ${commentSection}
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
      const detailsEl = card.querySelector('.game-details');
      detailsEl.innerHTML = buildGameDetailsHTML(game);

      // Wire up comment submit if present
      const submitBtn = detailsEl.querySelector('.js-submit-comment');
      if (submitBtn) {
        async function submitComment() {
          const gameId = submitBtn.dataset.gameId;
          const buildId = submitBtn.dataset.buildId;
          const playerId = detailsEl.querySelector(`#comment-player-${gameId}`).value;
          const commentText = detailsEl.querySelector(`#comment-text-${gameId}`).value.trim();
          const feedback = detailsEl.querySelector(`#comment-feedback-${gameId}`);

          if (!playerId) { feedback.textContent = 'Please select a player.'; feedback.className = 'comment-feedback error-inline'; return; }
          if (!commentText) { feedback.textContent = 'Please enter a comment.'; feedback.className = 'comment-feedback error-inline'; return; }

          submitBtn.disabled = true;
          try {
            await buildsAPI.addComment(buildId, { game_id: parseInt(gameId), player_id: parseInt(playerId), comment_text: commentText });
            feedback.textContent = 'Comment posted!';
            feedback.className = 'comment-feedback success-inline';
            detailsEl.querySelector(`#comment-text-${gameId}`).value = '';
            setTimeout(() => { feedback.textContent = ''; feedback.className = 'comment-feedback'; }, 3000);
            await loadComments(game, detailsEl);
          } catch (err) {
            feedback.textContent = err.message || 'Failed to post comment.';
            feedback.className = 'comment-feedback error-inline';
          } finally {
            submitBtn.disabled = false;
          }
        }

        submitBtn.addEventListener('click', submitComment);

        const textarea = detailsEl.querySelector(`#comment-text-${submitBtn.dataset.gameId}`);
        if (textarea) {
          textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              submitComment();
            }
          });
        }

        // Load existing comments
        await loadComments(game, detailsEl);
      }
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
    ctx.fillStyle = '#b8a884';
    ctx.font = '14px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('No score history available', canvas.width / 2, canvas.height / 2);
    return;
  }

  const ctx = canvas.getContext('2d');
  const width = canvas.width = canvas.offsetWidth;
  const height = canvas.height = canvas.offsetHeight || 300;

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

  // Score range
  const allScores = scoreHistory.map(s => s.score);
  const minScore = Math.min(0, ...allScores);
  const maxScore = Math.max(...allScores);
  const scoreRange = maxScore - minScore || 1;

  // Shared time axis across all players
  const allTimestamps = scoreHistory.map(s => new Date(s.timestamp).getTime());
  const globalFirstTime = Math.min(...allTimestamps);
  const globalLastTime = Math.max(...allTimestamps);
  const globalTimeRange = globalLastTime - globalFirstTime || 1;

  const padding = { top: 30, right: 10, bottom: 45, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const fallbackColors = ['#e05c5c', '#4db8ff', '#6ddb6d', '#f5a623', '#c47eff', '#00e0c0'];

  const playerData = Object.values(playerScores).map((player, index) => {
    const color = player.color || fallbackColors[index % fallbackColors.length];
    const scores = player.scores.sort((a, b) => a.timestamp - b.timestamp);
    if (scores.length === 0) return null;

    // Map to canvas coords using the shared time axis
    const rawPoints = scores.map(point => ({
      x: padding.left + ((point.timestamp - globalFirstTime) / globalTimeRange * chartWidth),
      y: height - padding.bottom - ((point.score - minScore) / scoreRange * chartHeight),
      isData: true,
    }));

    // Build step points: hold value flat until next update, then jump vertically
    const stepPoints = [];
    for (let i = 0; i < rawPoints.length; i++) {
      stepPoints.push(rawPoints[i]);
      if (i < rawPoints.length - 1) {
        // Horizontal segment to next x at current y (no dot here)
        stepPoints.push({ x: rawPoints[i + 1].x, y: rawPoints[i].y, isData: false });
      }
    }

    // Extend the last value horizontally to the right edge
    const lastStep = stepPoints[stepPoints.length - 1];
    const endX = padding.left + chartWidth;
    if (lastStep.x < endX - 1) {
      stepPoints.push({ x: endX, y: lastStep.y, isData: false });
    }

    const finalScore = scores[scores.length - 1].score;
    return { name: player.name, color, points: stepPoints, finalScore };
  }).filter(Boolean);

  drawChartStaticElements(ctx, width, height, padding, chartWidth, chartHeight, minScore, scoreRange, globalTimeRange);

  const totalDuration = 3500;
  const startTime = performance.now();

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / totalDuration, 1);

    // Animate by time position: all players draw up to the same x coordinate each frame
    const animX = padding.left + (progress * chartWidth);

    ctx.clearRect(0, 0, width, height);
    drawChartStaticElements(ctx, width, height, padding, chartWidth, chartHeight, minScore, scoreRange, globalTimeRange);

    playerData.forEach((player, playerIndex) => {
      // Find how many full points fall at or before animX
      let pointsToDraw = 0;
      for (let i = 0; i < player.points.length; i++) {
        if (player.points[i].x <= animX) pointsToDraw = i + 1;
        else break;
      }
      if (pointsToDraw < 1) return;

      ctx.strokeStyle = player.color;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'miter';
      ctx.beginPath();

      for (let i = 0; i < pointsToDraw; i++) {
        const point = player.points[i];
        if (i === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      }

      // Interpolate partial segment to animX if there's a next point
      if (progress < 1 && pointsToDraw < player.points.length) {
        const lastPoint = player.points[pointsToDraw - 1];
        const nextPoint = player.points[pointsToDraw];
        const segProgress = (animX - lastPoint.x) / (nextPoint.x - lastPoint.x);
        if (segProgress > 0) {
          const interpX = animX;
          const interpY = lastPoint.y + (nextPoint.y - lastPoint.y) * segProgress;
          ctx.lineTo(interpX, interpY);
        }
      }

      ctx.stroke();

      // Dots only at real data points (isData === true)
      for (let i = 0; i < pointsToDraw; i++) {
        const point = player.points[i];
        if (!point.isData) continue;
        // Fade in dot as animX passes through it
        const dotProgress = Math.min(1, Math.max(0, (animX - point.x) / (chartWidth * 0.02 + 1)) * 2);
        const pointScale = dotProgress;
        const pointAlpha = dotProgress;

        ctx.fillStyle = player.color;
        ctx.globalAlpha = pointAlpha;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4 * pointScale, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Legend top-left
      if (playerIndex === 0 || progress >= 0.5) {
        const legendProgress = Math.min(1, (progress - 0.3) / 0.4);
        const legendAlpha = Math.max(0, legendProgress);
        const legendX = padding.left + 8;
        const legendY = padding.top + (playerIndex * 20);

        ctx.globalAlpha = legendAlpha;
        ctx.fillStyle = player.color;
        ctx.fillRect(legendX, legendY - 6, 10 * legendProgress, 10 * legendProgress);
        ctx.fillStyle = '#e8dcc8';
        ctx.textAlign = 'left';
        ctx.font = '11px Georgia, serif';
        ctx.fillText(player.name, legendX + 14, legendY + 4);
        ctx.globalAlpha = 1;
      }

      // Final score label at right edge of line
      if (progress >= 0.85) {
        const labelAlpha = Math.min(1, (progress - 0.85) / 0.15);
        const lastPoint = player.points[player.points.length - 1];
        ctx.globalAlpha = labelAlpha;
        ctx.fillStyle = player.color;
        ctx.font = 'bold 11px Georgia, serif';
        ctx.textAlign = 'right';
        ctx.fillText(player.finalScore, lastPoint.x - 3, lastPoint.y - 5);
        ctx.globalAlpha = 1;
      }
    });

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }

  requestAnimationFrame(animate);
}

function drawChartStaticElements(ctx, width, height, padding, chartWidth, chartHeight, minScore, scoreRange, globalTimeRange) {
  // Dark background matching site theme
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0,   '#18222e');
  bg.addColorStop(0.5, '#1b2636');
  bg.addColorStop(1,   '#18222e');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Subtle inset vignette
  const inset = ctx.createRadialGradient(width / 2, height / 2, height * 0.35, width / 2, height / 2, Math.max(width, height) * 0.8);
  inset.addColorStop(0, 'rgba(0,0,0,0)');
  inset.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = inset;
  ctx.fillRect(0, 0, width, height);

  // Axes
  ctx.strokeStyle = '#4a6080';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

  // Y-axis labels and horizontal gridlines
  ctx.fillStyle = '#b8a884';
  ctx.font = '12px Georgia, serif';
  ctx.textAlign = 'right';
  const ySteps = 5;
  for (let i = 0; i <= ySteps; i++) {
    const score = minScore + (scoreRange * i / ySteps);
    const y = height - padding.bottom - (chartHeight * i / ySteps);
    ctx.fillText(Math.round(score), padding.left - 6, y + 4);

    ctx.strokeStyle = 'rgba(74, 96, 128, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  // X-axis time labels and vertical gridlines
  const totalMinutes = globalTimeRange / 60000;
  const intervalMinutes = totalMinutes <= 20 ? 5 : totalMinutes <= 60 ? 10 : totalMinutes <= 120 ? 20 : 30;
  const intervalMs = intervalMinutes * 60000;

  ctx.fillStyle = '#b8a884';
  ctx.font = '11px Georgia, serif';
  ctx.textAlign = 'center';
  for (let t = intervalMs; t < globalTimeRange; t += intervalMs) {
    const x = padding.left + (t / globalTimeRange * chartWidth);
    ctx.fillText(`${Math.round(t / 60000)}m`, x, height - padding.bottom + 14);

    ctx.strokeStyle = 'rgba(74, 96, 128, 0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, height - padding.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Score axis label
  ctx.fillStyle = '#b8a884';
  ctx.textAlign = 'left';
  ctx.font = '13px Georgia, serif';
  ctx.fillText('Score', 4, padding.top - 14);
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
  return placement === 1 ? '♛' : '';
}

// Format winner name(s) with player colors, handling ties
function formatWinnerNames(winners) {
  if (!winners || winners.length === 0) return 'Unknown';
  const spans = winners.map(w =>
    `<span ${w.player_color ? `style="color:${w.player_color}"` : ''}>${escapeHtml(w.player_name)}</span>`
  );
  if (spans.length === 1) return spans[0];
  return spans.slice(0, -1).join(', ') + ' &amp; ' + spans[spans.length - 1];
}

// Load and render existing comments for a game into its details element
async function loadComments(game, detailsEl) {
  const container = detailsEl.querySelector(`#comments-${game.id}`);
  if (!container) return;

  try {
    const allComments = await buildsAPI.getComments(game.build_id);
    const comments = allComments.filter(c => String(c.game_id) === String(game.id));

    if (comments.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = `
      <h3>Comments</h3>
      <ul class="comments-list">
        ${comments.map(c => `
          <li class="comment-item">
            <span class="comment-author" ${c.player_color ? `style="color:${c.player_color}"` : ''}>${escapeHtml(c.player_name)}</span>
            <span class="comment-text">${escapeHtml(c.comment_text)}</span>
          </li>
        `).join('')}
      </ul>
    `;
  } catch (err) {
    // Silently ignore — comments are non-critical
  }
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
