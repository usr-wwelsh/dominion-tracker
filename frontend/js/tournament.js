// Tournament bracket page

let allPlayers = [];
let allBuilds = [];
let rankMap = {};
let selectedPlayers = [];
let tournamentId = null;
let pollTimer = null;
let confettiFired = false;
let pendingPlayMatchId = null;

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  tournamentId = params.get('id');
  if (tournamentId) {
    initBracketView();
  } else {
    initListView();
  }
});

// ---------- List + create ----------

async function initListView() {
  document.getElementById('list-view').style.display = 'block';
  try {
    const [players, leaderboard, tournaments] = await Promise.all([
      playersAPI.getAll(),
      statsAPI.getLeaderboard().catch(() => []),
      tournamentsAPI.getAll(),
    ]);
    allPlayers = players;
    leaderboard.forEach((row, i) => { rankMap[row.id] = i; });
    renderRoster();
    renderTournamentList(tournaments);
  } catch (e) {
    showError('Failed to load: ' + e.message);
  }

  document.getElementById('create-tournament-btn').addEventListener('click', createTournament);
  document.getElementById('tournament-name').addEventListener('input', updateCreateButton);
}

function renderRoster() {
  const roster = document.getElementById('player-roster');
  const label = document.getElementById('player-count-label');
  roster.innerHTML = '';
  label.textContent = selectedPlayers.length ? `(${selectedPlayers.length} selected)` : '';

  if (!allPlayers.length) {
    roster.innerHTML = '<span class="roster-empty">No players yet — add some on the Players page.</span>';
    return;
  }

  allPlayers.forEach(player => {
    const isSel = selectedPlayers.some(p => p.id === player.id);
    const color = player.color || '#4db8ff';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'roster-btn' + (isSel ? ' roster-btn-selected' : '');
    btn.innerHTML = `
      <span class="roster-dot" style="background:${color}"></span>
      <span class="roster-name">${escapeHtml(player.name)}</span>
      ${isSel ? '<span class="roster-check">✓</span>' : ''}
    `;
    btn.addEventListener('click', () => {
      const idx = selectedPlayers.findIndex(p => p.id === player.id);
      if (idx === -1) selectedPlayers.push(player); else selectedPlayers.splice(idx, 1);
      renderRoster();
      updateCreateButton();
    });
    roster.appendChild(btn);
  });
}

function updateCreateButton() {
  const name = document.getElementById('tournament-name').value.trim();
  document.getElementById('create-tournament-btn').disabled = !name || selectedPlayers.length < 2;
}

function renderTournamentList(tournaments) {
  const el = document.getElementById('tournament-list');
  if (!tournaments.length) {
    el.innerHTML = '<p class="text-dim">No tournaments yet.</p>';
    return;
  }
  el.innerHTML = '';
  tournaments.forEach(t => {
    const a = document.createElement('a');
    a.className = 'tournament-list-item';
    a.href = 'tournament.html?id=' + t.id;
    const status = t.status === 'complete'
      ? `Champion: ${escapeHtml(t.winner_name || '—')}`
      : t.status;
    a.innerHTML = `
      <span class="tl-name">${escapeHtml(t.name)}</span>
      <span class="tl-status status-${t.status}">${status}</span>
    `;
    el.appendChild(a);
  });
}

async function createTournament() {
  const name = document.getElementById('tournament-name').value.trim();
  if (!name || selectedPlayers.length < 2) return;

  // Handicap seeding: the newest / lowest-ranked players are seeded at the top
  // of the bracket so they receive the round-one byes, while the strongest
  // players are seeded last and must play from round one. Players with no games
  // yet count as the newest, so they get byes first.
  const rankOf = (p) => (p.id in rankMap) ? rankMap[p.id] : Number.MAX_SAFE_INTEGER;
  const ordered = [...selectedPlayers].sort((a, b) => rankOf(b) - rankOf(a));
  const ids = ordered.map(p => p.id);

  const btn = document.getElementById('create-tournament-btn');
  btn.disabled = true;
  btn.textContent = 'Creating…';
  try {
    const bracket = await tournamentsAPI.create(name, ids, 1);
    window.location.href = 'tournament.html?id=' + bracket.tournament.id;
  } catch (e) {
    showError('Failed to create tournament: ' + e.message);
    btn.disabled = false;
    btn.textContent = 'Create Bracket';
  }
}

// ---------- Bracket ----------

async function initBracketView() {
  document.getElementById('bracket-view').style.display = 'block';
  allBuilds = await buildsAPI.getAll().catch(() => []);
  setupPlayModal();
  await loadBracket();
  pollTimer = setInterval(loadBracket, 3000);
}

async function loadBracket() {
  try {
    const data = await tournamentsAPI.getById(tournamentId);
    renderBracket(data);
    if (data.tournament.status === 'complete' && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  } catch (e) {
    showError('Failed to load bracket: ' + e.message);
  }
}

function renderBracket(data) {
  const { tournament, rounds } = data;

  const banner = document.getElementById('champion-banner');
  if (tournament.status === 'complete' && tournament.winner_name) {
    banner.style.display = 'block';
    banner.innerHTML = `
      <div class="champion-crown">♛</div>
      <div class="champion-label">Champion</div>
      <div class="champion-name">${escapeHtml(tournament.winner_name)}</div>
      <div class="champion-sub">${escapeHtml(tournament.name)}</div>
    `;
    if (!confettiFired && window.confetti) {
      confettiFired = true;
      window.confetti.fire(5000);
    }
  } else {
    banner.style.display = 'none';
  }

  const bracketEl = document.getElementById('bracket');
  bracketEl.innerHTML = '';
  const names = roundLabels(rounds.length);
  rounds.forEach((matches, ri) => {
    const col = document.createElement('div');
    col.className = 'bracket-round';
    const title = document.createElement('div');
    title.className = 'bracket-round-title';
    title.textContent = names[ri];
    col.appendChild(title);
    matches.forEach(m => col.appendChild(renderMatch(m)));
    bracketEl.appendChild(col);
  });
}

function roundLabels(n) {
  const labels = [];
  for (let i = 0; i < n; i++) {
    const fromEnd = n - 1 - i;
    if (fromEnd === 0) labels.push('Final');
    else if (fromEnd === 1) labels.push('Semifinals');
    else if (fromEnd === 2) labels.push('Quarterfinals');
    else labels.push('Round ' + (i + 1));
  }
  return labels;
}

function renderMatch(m) {
  const box = document.createElement('div');
  box.className = 'match-box status-' + m.status;
  box.appendChild(renderMatchPlayer(m, 1));
  box.appendChild(renderMatchPlayer(m, 2));

  const action = document.createElement('div');
  action.className = 'match-action';

  if (m.status === 'ready') {
    const btn = document.createElement('button');
    btn.className = 'btn btn-sm btn-primary';
    btn.textContent = 'Play Match';
    btn.addEventListener('click', () => openPlayModal(m.id));
    action.appendChild(btn);
  } else if (m.status === 'in_progress') {
    const btn = document.createElement('button');
    btn.className = 'btn btn-sm';
    btn.textContent = 'Open Match';
    btn.addEventListener('click', () => {
      window.location.href = `scoreboard.html?game=${m.game_id}&tournament=${tournamentId}&match=${m.id}`;
    });
    action.appendChild(btn);
    const live = document.createElement('span');
    live.className = 'match-live';
    live.textContent = '● live';
    action.appendChild(live);
  } else if (m.status === 'tie') {
    const note = document.createElement('div');
    note.className = 'match-tie-note';
    note.textContent = 'Tie — pick the winner:';
    action.appendChild(note);
    [1, 2].forEach(slot => {
      const pid = slot === 1 ? m.player1_id : m.player2_id;
      const pname = slot === 1 ? m.player1_name : m.player2_name;
      if (!pid) return;
      const b = document.createElement('button');
      b.className = 'btn btn-sm';
      b.textContent = pname;
      b.addEventListener('click', () => resolveTie(m.id, pid));
      action.appendChild(b);
    });
  }

  if (action.children.length) box.appendChild(action);
  return box;
}

function renderMatchPlayer(m, slot) {
  const pid = slot === 1 ? m.player1_id : m.player2_id;
  const pname = slot === 1 ? m.player1_name : m.player2_name;
  const pcolor = (slot === 1 ? m.player1_color : m.player2_color) || '#4db8ff';

  const row = document.createElement('div');
  row.className = 'match-player';
  if (m.winner_player_id && m.winner_player_id === pid) row.classList.add('match-winner');

  if (!pid) {
    row.classList.add('match-player-empty');
    row.innerHTML = `<span class="mp-name">${m.status === 'bye' ? 'bye' : 'TBD'}</span>`;
    return row;
  }

  row.innerHTML = `
    <span class="mp-dot" style="background:${pcolor}"></span>
    <span class="mp-name">${escapeHtml(pname)}</span>
  `;
  return row;
}

// ---------- Play modal ----------

function setupPlayModal() {
  const select = document.getElementById('play-build-select');
  select.innerHTML = '<option value="">No build</option>';
  allBuilds.forEach(b => {
    const o = document.createElement('option');
    o.value = b.id;
    o.textContent = b.nickname;
    select.appendChild(o);
  });
  document.getElementById('play-cancel-btn').addEventListener('click', closePlayModal);
  document.getElementById('play-start-btn').addEventListener('click', startMatch);
}

function openPlayModal(matchId) {
  pendingPlayMatchId = matchId;
  document.getElementById('play-modal').style.display = 'flex';
}

function closePlayModal() {
  pendingPlayMatchId = null;
  document.getElementById('play-modal').style.display = 'none';
}

async function startMatch() {
  if (!pendingPlayMatchId) return;
  const buildId = document.getElementById('play-build-select').value || null;
  try {
    const { game_id } = await tournamentsAPI.playMatch(tournamentId, pendingPlayMatchId, buildId);
    window.location.href = `scoreboard.html?game=${game_id}&tournament=${tournamentId}&match=${pendingPlayMatchId}`;
  } catch (e) {
    showError('Failed to start match: ' + e.message);
    closePlayModal();
  }
}

async function resolveTie(matchId, playerId) {
  if (!window.confirm('Set this player as the match winner?')) return;
  try {
    await tournamentsAPI.setWinner(tournamentId, matchId, playerId);
    await loadBracket();
  } catch (e) {
    showError('Failed to set winner: ' + e.message);
  }
}

// ---------- utils ----------

function showError(msg) {
  const el = document.getElementById('error-message');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function showSuccess(msg) {
  const el = document.getElementById('success-message');
  el.textContent = msg;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : text;
  return div.innerHTML;
}
