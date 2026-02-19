// Leaderboard page logic

const PRESET_COLORS = [
  '#e05c5c', '#ff8c42', '#f5a623', '#ffd700',
  '#6ddb6d', '#00e0c0', '#4db8ff', '#5c7eff',
  '#c47eff', '#ff4da6', '#c0a464', '#b5e853',
  '#00bcd4', '#80cbc4', '#ff8a80', '#cfcfcf',
];

const FORM_COLORS = ['#6ddb6d', '#ffd700', '#ff8c42', '#e05c5c'];

let leaderboardData = [];
let currentSort = {
  column: 'avg_league_points',
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
    if (player) {
      player.color = hex;
      renderPodium(leaderboardData);
    }
  } catch {
    swatchEl.style.background = prevColor;
  }
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  buildPopover();
  loadLeaderboard();
  setupSorting();
  setupH2HModal();
});

// Load leaderboard data and extras in parallel
async function loadLeaderboard() {
  const loading = document.getElementById('loading');
  const errorMessage = document.getElementById('error-message');
  const container = document.getElementById('leaderboard-container');
  const noData = document.getElementById('no-data');

  try {
    loading.style.display = 'block';
    errorMessage.style.display = 'none';
    container.style.display = 'none';

    const [data, extras] = await Promise.all([
      statsAPI.getLeaderboard(),
      statsAPI.getExtras().catch(() => null),
    ]);

    leaderboardData = data;
    loading.style.display = 'none';

    if (leaderboardData.length === 0) {
      container.style.display = 'block';
      noData.style.display = 'block';
    } else {
      container.style.display = 'block';
      noData.style.display = 'none';
      renderPodium(leaderboardData);
      if (extras) renderExtras(extras);
      renderLeaderboard();
    }
  } catch (error) {
    loading.style.display = 'none';
    errorMessage.textContent = `Failed to load leaderboard: ${error.message}`;
    errorMessage.style.display = 'block';
  }
}

// Render podium for top 3
function renderPodium(data) {
  const section = document.getElementById('podium-section');
  if (data.length < 2) {
    section.style.display = 'none';
    return;
  }

  const sorted = sortData(data, currentSort.column, currentSort.direction);
  const top = sorted.slice(0, Math.min(3, sorted.length));

  // Build podium order: 2nd (left), 1st (center), 3rd (right)
  const order = top.length === 1
    ? [null, top[0], null]
    : top.length === 2
      ? [top[1], top[0], null]
      : [top[1], top[0], top[2]];

  const heights = [80, 110, 60];
  const labels = ['2nd', '1st', '3rd'];
  const medals = ['🥈', '🥇', '🥉'];

  section.innerHTML = '';
  const podium = document.createElement('div');
  podium.className = 'podium';

  order.forEach((player, i) => {
    const slot = document.createElement('div');
    slot.className = `podium-slot podium-slot-${i}`;

    if (!player) {
      slot.innerHTML = `<div class="podium-platform" style="height:${heights[i]}px"></div>`;
      podium.appendChild(slot);
      return;
    }

    const color = player.color || '#4db8ff';

    slot.innerHTML = `
      <div class="podium-player">
<div class="podium-avatar" style="border-color:${color}; box-shadow: 0 0 12px ${color}40">
          <span class="podium-initial" style="color:${color}">${escapeHtml(player.name[0].toUpperCase())}</span>
        </div>
        <div class="podium-name" style="color:${color}">${escapeHtml(player.name)}</div>
        <div class="podium-lp">${player.avg_league_points} avg LP</div>
        <div class="podium-stats">${player.total_league_points} total LP</div>
      </div>
      <div class="podium-platform podium-platform-${i}" style="height:${heights[i]}px">
        <span class="podium-place">${labels[i]}</span>
      </div>
    `;
    podium.appendChild(slot);
  });

  section.appendChild(podium);
  section.style.display = 'block';
}

// Render rivalry + high score + most played build
function renderExtras(extras) {
  const section = document.getElementById('extras-section');
  const cards = [];

  if (extras.high_score) {
    const hs = extras.high_score;
    const date = hs.game_date ? new Date(hs.game_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
    cards.push(`
      <div class="extras-card">
        <div class="extras-card-icon">⚔</div>
        <div class="extras-card-content">
          <div class="extras-card-label">Province Record</div>
          <div class="extras-card-value">${escapeHtml(hs.player_name)} scored <strong>${hs.score}</strong></div>
          ${date ? `<div class="extras-card-sub">${date}</div>` : ''}
        </div>
      </div>
    `);
  }

  if (extras.rivalry && parseInt(extras.rivalry.games_together) >= 2) {
    const r = extras.rivalry;
    cards.push(`
      <div class="extras-card">
        <div class="extras-card-icon">⚡</div>
        <div class="extras-card-content">
          <div class="extras-card-label">Greatest Rivalry</div>
          <div class="extras-card-value">${escapeHtml(r.player1_name)} vs ${escapeHtml(r.player2_name)}</div>
          <div class="extras-card-sub">${r.games_together} battles</div>
        </div>
      </div>
    `);
  }

  if (extras.most_played_build && parseInt(extras.most_played_build.games_count) >= 2) {
    const b = extras.most_played_build;
    cards.push(`
      <div class="extras-card">
        <div class="extras-card-icon">📜</div>
        <div class="extras-card-content">
          <div class="extras-card-label">Most Played Kingdom</div>
          <div class="extras-card-value">${escapeHtml(b.nickname)}</div>
          <div class="extras-card-sub">${b.games_count} campaigns</div>
        </div>
      </div>
    `);
  }

  if (cards.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.innerHTML = `<div class="extras-row">${cards.join('')}</div>`;
  section.style.display = 'block';
}

// Render leaderboard table
function renderLeaderboard() {
  const tbody = document.getElementById('leaderboard-body');
  tbody.innerHTML = '';

  const sortedData = sortData(leaderboardData, currentSort.column, currentSort.direction);

  sortedData.forEach((player, index) => {
    const row = document.createElement('tr');
    const color = player.color || '#4db8ff';

    const trendHtml = renderTrendArrow(player.rank_trend);
    const winRate = player.win_rate != null ? `${player.win_rate}%` : '—';
    const recentForm = JSON.stringify(player.recent_form || []);

    row.innerHTML = `
      <td class="col-rank">${index + 1}${trendHtml}</td>
      <td class="player-name">
        <span class="player-color-swatch" data-player-id="${player.id}" style="background:${color}" title="Click to change color"></span>
        <span class="player-name-link" data-player-id="${player.id}" data-player-name="${escapeHtml(player.name)}" data-recent-form="${escapeHtml(recentForm)}" title="View stats &amp; head-to-head">${escapeHtml(player.name)}</span>
      </td>
      <td class="stat-highlight">${player.total_league_points}</td>
      <td>${player.avg_league_points}</td>
      <td>${winRate}</td>
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

  tbody.querySelectorAll('.player-name-link').forEach(link => {
    link.addEventListener('click', e => {
      e.stopPropagation();
      const recentForm = JSON.parse(link.dataset.recentForm || '[]');
      openH2HModal(link.dataset.playerId, link.dataset.playerName, recentForm);
    });
  });

  updateSortIndicators();
}

function renderTrendArrow(trend) {
  if (trend == null) return '';
  if (trend > 0) return '<span class="trend-up" title="Moved up">↑</span>';
  if (trend < 0) return '<span class="trend-down" title="Moved down">↓</span>';
  return '';
}

function placementLabel(placement) {
  if (placement === 1) return '1st';
  if (placement === 2) return '2nd';
  if (placement === 3) return '3rd';
  return `${placement}th`;
}

function renderRecentFormSection(form) {
  if (!form || form.length === 0) return '';

  const FORM_LABELS = ['1st', '2nd', '3rd'];
  const pills = form.map(placement => {
    const colorIndex = Math.min(placement - 1, FORM_COLORS.length - 1);
    const color = FORM_COLORS[colorIndex];
    return `<span class="form-pill" style="background:${color}20; border-color:${color}; color:${color}">${placementLabel(placement)}</span>`;
  }).join('');

  return `
    <div class="form-section">
      <div class="form-section-label">Recent form <span class="form-section-sub">(last ${form.length} game${form.length === 1 ? '' : 's'}, newest first)</span></div>
      <div class="form-pills">${pills}</div>
    </div>
  `;
}

// H2H Modal
function setupH2HModal() {
  const modal = document.getElementById('h2h-modal');
  const closeBtn = document.getElementById('h2h-close');

  closeBtn.addEventListener('click', closeH2HModal);
  modal.addEventListener('click', e => {
    if (e.target === modal) closeH2HModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeH2HModal();
  });
}

async function openH2HModal(playerId, playerName, recentForm = []) {
  const modal = document.getElementById('h2h-modal');
  const title = document.getElementById('h2h-title');
  const body = document.getElementById('h2h-body');

  title.textContent = `${playerName} — Head-to-Head`;
  body.innerHTML = '<div class="h2h-loading">Consulting the chronicles...</div>';
  modal.style.display = 'flex';

  try {
    const data = await playersAPI.getH2H(playerId);

    const formSection = renderRecentFormSection(recentForm);

    if (!data.opponents || data.opponents.length === 0) {
      body.innerHTML = formSection + '<p class="h2h-empty">No battles recorded against other players yet.</p>';
      return;
    }

    const rows = data.opponents.map(opp => {
      const total = parseInt(opp.games_together);
      const wins = parseInt(opp.player_wins);
      const losses = parseInt(opp.opponent_wins);
      const draws = total - wins - losses;
      const winPct = total > 0 ? Math.round(wins * 100 / total) : 0;
      const color = opp.opponent_color || '#4db8ff';
      const barWidth = winPct;

      return `
        <tr>
          <td>
            <span class="h2h-color-dot" style="background:${color}"></span>
            ${escapeHtml(opp.opponent_name)}
          </td>
          <td class="h2h-record">${wins}–${losses}${draws > 0 ? `–${draws}` : ''}</td>
          <td class="h2h-games">${total}</td>
          <td class="h2h-bar-cell">
            <div class="h2h-bar-bg">
              <div class="h2h-bar-fill" style="width:${barWidth}%"></div>
              <span class="h2h-bar-label">${winPct}%</span>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    body.innerHTML = formSection + `
      <table class="h2h-table">
        <thead>
          <tr>
            <th>Opponent</th>
            <th title="Win–Loss–Draw">W–L</th>
            <th>Games</th>
            <th>Win Rate</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p class="h2h-note">In multi-player games, a "win" means placing higher than that opponent.</p>
    `;
  } catch (error) {
    body.innerHTML = `<p class="h2h-error">Failed to load records: ${escapeHtml(error.message)}</p>`;
  }
}

function closeH2HModal() {
  document.getElementById('h2h-modal').style.display = 'none';
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
      renderPodium(leaderboardData);
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

    const aNum = parseFloat(aVal);
    const bNum = parseFloat(bVal);

    if (!isNaN(aNum) && !isNaN(bNum)) {
      return direction === 'asc' ? aNum - bNum : bNum - aNum;
    }

    aVal = String(aVal ?? '').toLowerCase();
    bVal = String(bVal ?? '').toLowerCase();
    return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
  });

  return sorted;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
