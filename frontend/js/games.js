// Games page logic

let gamesData = [];
let scoreHistoryCache = {};

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  loadGames();
});

// Load games data
async function loadGames() {
  const loading = document.getElementById('loading');
  const errorMessage = document.getElementById('error-message');
  const container = document.getElementById('games-container');
  const noGames = document.getElementById('no-games');

  try {
    loading.style.display = 'block';
    errorMessage.style.display = 'none';
    container.style.display = 'none';

    gamesData = await gamesAPI.getAll();

    // Filter to only show completed games
    gamesData = gamesData.filter(game => game.ended_at !== null);

    loading.style.display = 'none';
    container.style.display = 'block';

    if (gamesData.length === 0) {
      noGames.style.display = 'block';
    } else {
      noGames.style.display = 'none';
      renderGames();
    }
  } catch (error) {
    loading.style.display = 'none';
    errorMessage.textContent = `Failed to load games: ${error.message}`;
    errorMessage.style.display = 'block';
  }
}

// Render games list
function renderGames() {
  const gamesList = document.getElementById('games-list');
  gamesList.innerHTML = '';

  gamesData.forEach(game => {
    const gameCard = createGameCard(game);
    gamesList.appendChild(gameCard);
  });
}

// Create game card element
function createGameCard(game) {
  const card = document.createElement('div');
  card.className = 'game-card';
  card.dataset.gameId = game.id;

  const winner = game.players && game.players.length > 0
    ? game.players.find(p => p.placement === 1)
    : null;

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
          Winner: ${winner ? escapeHtml(winner.player_name) : 'Unknown'}
          ${winner ? `(${winner.final_score} points)` : ''}
        </div>
        <div class="game-meta">
          <span>Build: <span class="game-build">${game.build_nickname || 'None'}</span></span>
          <span>Duration: ${duration}</span>
          <span>Players: ${game.players ? game.players.length : 0}</span>
        </div>
      </div>
      <div class="expand-icon">▼</div>
    </div>
    <div class="game-details">
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
                <td class="placement-${player.placement}">${player.placement}</td>
                <td>${escapeHtml(player.player_name)}</td>
                <td>${player.final_score}</td>
                <td>${player.league_points}</td>
              </tr>
            `).join('') : ''}
          </tbody>
        </table>
      </div>
      <div class="chart-container">
        <div class="chart-title">Score Progression</div>
        <canvas id="chart-${game.id}"></canvas>
      </div>
    </div>
  `;

  // Add click handler to expand/collapse
  card.querySelector('.game-header').addEventListener('click', () => {
    toggleGameCard(card, game.id);
  });

  return card;
}

// Toggle game card expansion
async function toggleGameCard(card, gameId) {
  const wasExpanded = card.classList.contains('expanded');

  if (wasExpanded) {
    card.classList.remove('expanded');
  } else {
    card.classList.add('expanded');

    // Load score history if not cached
    if (!scoreHistoryCache[gameId]) {
      try {
        const scoreHistory = await gamesAPI.getScoreHistory(gameId);
        scoreHistoryCache[gameId] = scoreHistory;
      } catch (error) {
        console.error('Failed to load score history:', error);
        scoreHistoryCache[gameId] = [];
      }
    }

    // Draw chart after a short delay to ensure container is fully expanded
    const canvas = card.querySelector(`#chart-${gameId}`);
    if (canvas) {
      setTimeout(() => {
        drawScoreChart(canvas, scoreHistoryCache[gameId]);
      }, 50);
    }
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
  const height = canvas.height = 300;

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Group scores by player
  const playerScores = {};
  scoreHistory.forEach(snapshot => {
    if (!playerScores[snapshot.player_id]) {
      playerScores[snapshot.player_id] = {
        name: snapshot.player_name,
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

  // Chart dimensions
  const padding = { top: 30, right: 100, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Player colors
  const colors = ['#8b7355', '#a38968', '#6b6355', '#c4b5a9', '#9a8a72', '#7a6a52'];

  // Draw axes
  ctx.strokeStyle = '#3a2f26';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, height - padding.bottom);
  ctx.lineTo(width - padding.right, height - padding.bottom);
  ctx.stroke();

  // Draw Y-axis labels
  ctx.fillStyle = '#a89a82';
  ctx.font = '12px Georgia, serif';
  ctx.textAlign = 'right';
  const ySteps = 5;
  for (let i = 0; i <= ySteps; i++) {
    const score = minScore + (scoreRange * i / ySteps);
    const y = height - padding.bottom - (chartHeight * i / ySteps);
    ctx.fillText(Math.round(score), padding.left - 10, y + 4);

    // Grid line
    ctx.strokeStyle = '#2b1f1a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  // Draw lines for each player
  Object.values(playerScores).forEach((player, index) => {
    const color = colors[index % colors.length];
    const scores = player.scores.sort((a, b) => a.timestamp - b.timestamp);

    if (scores.length === 0) return;

    // Get time range
    const firstTime = scores[0].timestamp;
    const lastTime = scores[scores.length - 1].timestamp;
    const timeRange = lastTime - firstTime || 1;

    // Draw line
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();

    scores.forEach((point, i) => {
      const x = padding.left + ((point.timestamp - firstTime) / timeRange * chartWidth);
      const y = height - padding.bottom - ((point.score - minScore) / scoreRange * chartHeight);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw points
    ctx.fillStyle = color;
    scores.forEach(point => {
      const x = padding.left + ((point.timestamp - firstTime) / timeRange * chartWidth);
      const y = height - padding.bottom - ((point.score - minScore) / scoreRange * chartHeight);

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw legend
    const legendY = padding.top + (index * 20);
    ctx.fillStyle = color;
    ctx.fillRect(width - padding.right + 5, legendY - 6, 12, 12);
    ctx.fillStyle = '#d4c5a9';
    ctx.textAlign = 'left';
    ctx.font = '11px Georgia, serif';
    ctx.fillText(player.name, width - padding.right + 22, legendY + 4);
  });

  // Draw axis labels
  ctx.fillStyle = '#a89a82';
  ctx.textAlign = 'center';
  ctx.font = '14px Georgia, serif';
  ctx.fillText('Score', padding.left / 2, height / 2);
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

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
