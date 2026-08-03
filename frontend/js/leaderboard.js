// Leaderboard page logic

const PRESET_COLORS = [
  // reds / pinks
  '#c0392b', '#e05c5c', '#ff8a80', '#ff4da6', '#e91e8c', '#c2185b',
  // oranges / yellows
  '#e67e22', '#ff8c42', '#f5a623', '#ffd700', '#f9e23c', '#b5e853',
  // greens / teals
  '#27ae60', '#6ddb6d', '#00c853', '#00e0c0', '#1de9b6', '#80cbc4',
  // blues / purples
  '#00bcd4', '#4db8ff', '#2196f3', '#5c7eff', '#7c4dff', '#c47eff',
  // neutrals
  '#c0a464', '#a0826d', '#8d6e63', '#90a4ae', '#cfcfcf', '#ffffff',
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

// Render podium for top 3 (ranked/qualified players only)
function renderPodium(data) {
  const section = document.getElementById('podium-section');
  const qualifiedData = data.filter(p => p.qualified);
  if (qualifiedData.length < 2) {
    section.style.display = 'none';
    return;
  }

  const sorted = sortData(qualifiedData, currentSort.column, currentSort.direction);
  const top = sorted.slice(0, Math.min(3, sorted.length));

  // Build podium order: 2nd (left), 1st (center), 3rd (right)
  const order = top.length === 1
    ? [null, top[0], null]
    : top.length === 2
      ? [top[1], top[0], null]
      : [top[1], top[0], top[2]];

  const heights = [80, 110, 60];
  const labels = ['2nd', '1st', '3rd'];

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

    const crop = avatarCrop(player);
    const avatarHtml = player.avatar_card
      ? `<div class="podium-avatar card-art-avatar ${crop.cls}" style="border-color:${color}; box-shadow: 0 0 12px ${color}40; ${crop.style}">
          <img src="dominion-cards-used-small/${escapeHtml(player.avatar_card)}" alt="">
        </div>`
      : `<div class="podium-avatar" style="border-color:${color}; box-shadow: 0 0 12px ${color}40">
          <span class="podium-initial" style="color:${color}">${escapeHtml(player.name[0].toUpperCase())}</span>
        </div>`;

    slot.innerHTML = `
      <div class="podium-player">
        ${avatarHtml}
        <a class="podium-name" href="profile.html?id=${player.id}" style="color:${color};text-decoration:none;">${escapeHtml(player.name)}</a>
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
        <div class="extras-card-icon"><svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/><line x1="7" x2="4" y1="17" y2="20"/><line x1="3" x2="5" y1="19" y2="21"/></svg></div>
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
        <div class="extras-card-icon"><svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg></div>
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
        <div class="extras-card-icon"><svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 12h-5"/><path d="M15 8h-5"/><path d="M19 17V5a2 2 0 0 0-2-2H4"/><path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3"/></svg></div>
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

  let rank = 0;
  sortedData.forEach(player => {
    const row = document.createElement('tr');
    const color = player.color || '#4db8ff';
    const minGames = player.min_games_for_ranking ?? 5;

    if (player.qualified) rank += 1;
    if (!player.qualified) row.classList.add('row-provisional');

    const trendHtml = player.qualified ? renderTrendArrow(player.rank_trend) : '';
    const recentForm = JSON.stringify(player.recent_form || []);

    const rowCrop = avatarCrop(player);
    const rowAvatar = player.avatar_card
      ? `<a class="row-avatar card-art-avatar ${rowCrop.cls}" href="profile.html?id=${player.id}" style="border-color:${color}; ${rowCrop.style}"><img src="dominion-cards-used-small/${escapeHtml(player.avatar_card)}" alt=""></a>`
      : `<a class="row-avatar row-avatar-fallback" href="profile.html?id=${player.id}" style="background:${color}">${escapeHtml(player.name[0].toUpperCase())}</a>`;

    const rankCell = player.qualified
      ? `${rank}${trendHtml}`
      : `<span class="rank-provisional" title="Needs ${minGames} games played to be ranked (${player.total_games}/${minGames})">&mdash;</span>`;

    row.innerHTML = `
      <td class="col-rank">${rankCell}</td>
      <td class="player-name">
        ${rowAvatar}
        <span class="player-color-swatch" data-player-id="${player.id}" style="background:${color}" title="Click to change color"></span>
        <a class="player-name-link" href="profile.html?id=${player.id}" data-player-id="${player.id}" data-player-name="${escapeHtml(player.name)}" data-recent-form="${escapeHtml(recentForm)}" title="View profile">${escapeHtml(player.name)}</a>
        ${!player.qualified ? `<span class="provisional-badge" title="Needs ${minGames} games played to be ranked">${player.total_games}/${minGames} games</span>` : ''}
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

// Sort data helper — ranked (qualified) players always sort above provisional ones
function sortData(data, column, direction) {
  const compare = (a, b) => {
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
  };

  const qualified = data.filter(p => p.qualified).sort(compare);
  const provisional = data.filter(p => !p.qualified).sort(compare);

  return [...qualified, ...provisional];
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
