// Tournament bracket page

let allPlayers = [];
let allBuilds = [];
let rankMap = {};
let selectedPlayers = [];
let tournamentId = null;
let pollTimer = null;
let confettiFired = false;
let pendingPlayMatchId = null;
let roundsEdited = false;
let swissAdvancing = false;

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

function selectedFormat() {
  const el = document.querySelector('input[name="format"]:checked');
  return el ? el.value : 'single_elim';
}

async function initListView() {
  document.getElementById('list-view').style.display = 'block';
  try {
    const [players, leaderboard, tournaments, builds] = await Promise.all([
      playersAPI.getAll(),
      statsAPI.getLeaderboard().catch(() => []),
      tournamentsAPI.getAll(),
      buildsAPI.getAll().catch(() => []),
    ]);
    allPlayers = players;
    allBuilds = builds;
    leaderboard.forEach((row, i) => { rankMap[row.id] = i; });
    renderRoster();
    renderTournamentList(tournaments);
    populateBuildSelect(document.getElementById('swiss-build'));
  } catch (e) {
    showError('Failed to load: ' + e.message);
  }

  document.getElementById('create-tournament-btn').addEventListener('click', createTournament);
  document.getElementById('tournament-name').addEventListener('input', updateCreateButton);
  document.querySelectorAll('input[name="format"]').forEach(r => {
    r.addEventListener('change', onFormatChange);
  });
  document.getElementById('swiss-rounds').addEventListener('input', () => { roundsEdited = true; });
  onFormatChange();
}

function populateBuildSelect(select) {
  if (!select) return;
  select.innerHTML = '<option value="">No build</option>';
  allBuilds.forEach(b => {
    const o = document.createElement('option');
    o.value = b.id;
    o.textContent = b.nickname;
    select.appendChild(o);
  });
}

function onFormatChange() {
  const swiss = selectedFormat() === 'swiss';
  document.getElementById('swiss-options').style.display = swiss ? 'block' : 'none';
  document.getElementById('single-elim-hint').style.display = swiss ? 'none' : 'block';
  document.getElementById('create-tournament-btn').textContent = swiss ? 'Start Tournament' : 'Create Bracket';
  updateRoundsHint();
  updateCreateButton();
}

// Suggest a round count that scales with turnout; the user can override it.
function suggestedRounds(n) {
  return Math.min(7, Math.max(3, Math.ceil(n / 3) + 1));
}

function updateRoundsHint() {
  const n = selectedPlayers.length;
  const hint = document.getElementById('swiss-rounds-hint');
  if (!hint) return;
  if (n < 5) {
    hint.textContent = 'Swiss needs at least 5 players.';
    return;
  }
  const sizes = podSizes(n);
  hint.textContent = `${n} players → pods of ${sizes.join(' + ')} each round. Suggested: ${suggestedRounds(n)} rounds.`;
}

// Mirrors the server's pod-splitting so the create form can preview it.
function podSizes(n) {
  if (n < 3) return [n];
  const pods = Math.floor(n / 3);
  const rem = n % 3;
  const sizes = new Array(pods).fill(3);
  if (rem === 1) sizes[pods - 1] += 1;
  else if (rem === 2) {
    if (pods >= 2) { sizes[pods - 1] += 1; sizes[pods - 2] += 1; }
    else sizes.push(2);
  }
  return sizes;
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
      syncSuggestedRounds();
      updateRoundsHint();
      updateCreateButton();
    });
    roster.appendChild(btn);
  });
}

// Keep the rounds field on the suggestion until the user types their own value.
function syncSuggestedRounds() {
  const input = document.getElementById('swiss-rounds');
  if (input && !roundsEdited && selectedPlayers.length >= 5) {
    input.value = suggestedRounds(selectedPlayers.length);
  }
}

function updateCreateButton() {
  const name = document.getElementById('tournament-name').value.trim();
  const min = selectedFormat() === 'swiss' ? 5 : 2;
  document.getElementById('create-tournament-btn').disabled = !name || selectedPlayers.length < min;
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
  const btn = document.getElementById('create-tournament-btn');

  if (selectedFormat() === 'swiss') {
    if (!name || selectedPlayers.length < 5) return;
    const rounds = parseInt(document.getElementById('swiss-rounds').value, 10);
    if (!rounds || rounds < 1) { showError('Enter a valid number of rounds'); return; }
    const buildId = document.getElementById('swiss-build').value || null;
    const ids = selectedPlayers.map(p => p.id);
    btn.disabled = true;
    btn.textContent = 'Starting…';
    try {
      const data = await tournamentsAPI.createSwiss(name, ids, rounds, buildId);
      window.location.href = 'tournament.html?id=' + data.tournament.id;
    } catch (e) {
      showError('Failed to start tournament: ' + e.message);
      btn.disabled = false;
      btn.textContent = 'Start Tournament';
    }
    return;
  }

  if (!name || selectedPlayers.length < 2) return;

  // Handicap seeding: the newest / lowest-ranked players are seeded at the top
  // of the bracket so they receive the round-one byes, while the strongest
  // players are seeded last and must play from round one. Players with no games
  // yet count as the newest, so they get byes first.
  const rankOf = (p) => (p.id in rankMap) ? rankMap[p.id] : Number.MAX_SAFE_INTEGER;
  const ordered = [...selectedPlayers].sort((a, b) => rankOf(b) - rankOf(a));
  const ids = ordered.map(p => p.id);

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
  allBuilds = await buildsAPI.getAll().catch(() => []);
  setupPlayModal();
  await loadBracket();
  pollTimer = setInterval(loadBracket, 3000);
}

async function loadBracket() {
  try {
    const data = await tournamentsAPI.getById(tournamentId);
    if (data.tournament.format === 'swiss') {
      renderSwiss(data);
    } else {
      document.getElementById('bracket-view').style.display = 'block';
      renderBracket(data);
    }
    if (data.tournament.status === 'complete' && pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  } catch (e) {
    showError('Failed to load bracket: ' + e.message);
  }
}

// ---------- Swiss rendering ----------

function renderSwiss(data) {
  document.getElementById('swiss-view').style.display = 'block';
  const { tournament, standings, rounds } = data;

  const banner = document.getElementById('swiss-champion-banner');
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

  document.getElementById('swiss-title').textContent = tournament.status === 'complete'
    ? `${tournament.name} — Final Standings`
    : `${tournament.name} — Standings · Round ${tournament.current_round} of ${tournament.total_rounds}`;

  renderStandings(standings);
  renderSwissActionBar(data);
  renderSwissRounds(rounds);
}

function renderStandings(standings) {
  const el = document.getElementById('swiss-standings');
  if (!standings.length) { el.innerHTML = '<p class="text-dim">No players.</p>'; return; }
  const rows = standings.map((s, i) => `
    <tr class="${i === 0 ? 'is-leader' : ''}">
      <td class="standings-rank">${i + 1}</td>
      <td><span class="standings-name"><span class="roster-dot" style="background:${s.color || '#4db8ff'}"></span>${escapeHtml(s.name)}</span></td>
      <td class="num standings-lp">${fmt(s.total_lp)}</td>
      <td class="num">${s.wins}</td>
      <td class="num">${s.games_played}</td>
      <td class="num">${fmt(s.avg_score)}</td>
    </tr>
  `).join('');
  el.innerHTML = `
    <table class="standings-table">
      <thead>
        <tr><th class="standings-rank">#</th><th>Player</th><th class="num">Points</th><th class="num">Wins</th><th class="num">Pods</th><th class="num">Avg VP</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function renderSwissActionBar(data) {
  const bar = document.getElementById('swiss-action-bar');
  const { tournament, can_advance, can_finish, current_round_complete } = data;
  bar.innerHTML = '';

  if (tournament.status === 'complete') return;

  if (can_finish) {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = 'Crown Champion';
    btn.disabled = swissAdvancing;
    btn.addEventListener('click', finishSwiss);
    bar.appendChild(btn);
    return;
  }

  if (can_advance) {
    const select = document.createElement('select');
    populateBuildSelect(select);
    bar.appendChild(select);

    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = `Start Round ${tournament.current_round + 1}`;
    btn.disabled = swissAdvancing;
    btn.addEventListener('click', () => advanceSwiss(select.value || null));
    bar.appendChild(btn);
    return;
  }

  if (!current_round_complete) {
    const note = document.createElement('span');
    note.className = 'swiss-status-note';
    note.textContent = `Round ${tournament.current_round} in progress — finish all pods to continue.`;
    bar.appendChild(note);
  }
}

function renderSwissRounds(rounds) {
  const el = document.getElementById('swiss-rounds-list');
  el.innerHTML = '';
  // Newest round first.
  [...rounds].reverse().forEach(round => {
    if (!round) return;
    const section = document.createElement('div');
    section.className = 'swiss-round';
    const title = document.createElement('div');
    title.className = 'swiss-round-title';
    title.textContent = 'Round ' + round.round;
    section.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'pod-grid';
    round.pods.forEach(pod => grid.appendChild(renderPod(pod)));
    section.appendChild(grid);
    el.appendChild(section);
  });
}

function renderPod(pod) {
  const card = document.createElement('div');
  card.className = 'pod-card ' + (pod.ended ? 'pod-done' : 'pod-live');

  const head = document.createElement('div');
  head.className = 'pod-head';
  head.innerHTML = `<span class="pod-label">Pod ${pod.pod_index + 1}</span>` +
    (pod.ended ? '' : '<span class="pod-live-tag">● live</span>');
  card.appendChild(head);

  pod.players.forEach(p => {
    const row = document.createElement('div');
    row.className = 'pod-player' + (pod.ended && p.placement === 1 ? ' pod-winner' : '');
    row.innerHTML = `
      <span class="pod-place">${pod.ended ? (p.placement != null ? p.placement : '') : ''}</span>
      <span class="roster-dot" style="background:${p.color || '#4db8ff'}"></span>
      <span class="pod-pname">${escapeHtml(p.name)}</span>
      <span class="pod-score">${p.final_score} VP</span>
      <span class="pod-lp">${pod.ended && p.league_points != null ? fmt(p.league_points) : '—'}</span>
    `;
    card.appendChild(row);
  });

  if (!pod.ended) {
    const action = document.createElement('div');
    action.className = 'match-action';
    const btn = document.createElement('button');
    btn.className = 'btn btn-sm btn-primary';
    btn.textContent = 'Open Pod';
    btn.addEventListener('click', () => {
      window.location.href = `scoreboard.html?game=${pod.game_id}&tournament=${tournamentId}`;
    });
    action.appendChild(btn);
    card.appendChild(action);
  }

  return card;
}

async function advanceSwiss(buildId) {
  if (swissAdvancing) return;
  swissAdvancing = true;
  try {
    await tournamentsAPI.nextRound(tournamentId, buildId);
    await loadBracket();
  } catch (e) {
    showError('Failed to start next round: ' + e.message);
  } finally {
    swissAdvancing = false;
  }
}

async function finishSwiss() {
  if (swissAdvancing) return;
  if (!window.confirm('Crown the current leader as champion? This ends the tournament.')) return;
  swissAdvancing = true;
  try {
    await tournamentsAPI.finish(tournamentId);
    await loadBracket();
  } catch (e) {
    showError('Failed to finish tournament: ' + e.message);
  } finally {
    swissAdvancing = false;
  }
}

function fmt(v) {
  const n = Number(v);
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
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
