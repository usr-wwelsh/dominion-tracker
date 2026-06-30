// Big Picture Mode — screens. Reuses the existing /api layer (api.js globals).
// No backend changes; this is a parallel, remote-driven front door.

const $ = (id) => document.getElementById(id);
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initial = (name) => (name || '?').trim()[0].toUpperCase();
// DB timestamps are UTC but lack a 'Z'; parse as UTC so the client renders local time.
const parseDbDate = (ts) => ts ? new Date(ts.includes('T') ? ts : ts.replace(' ', 'T') + 'Z') : null;

// Player avatar — card-art crop (shared with the rest of the site via avatarCrop),
// falling back to a colored initial. Accepts leaderboard/player/game-player shapes.
function avatarHtml(obj, cls = '') {
  const name = obj.name || obj.player_name;
  const color = obj.color || obj.player_color || '#4db8ff';
  if (obj.avatar_card) {
    const crop = avatarCrop(obj);
    return `<span class="bp-av ${cls} card-art-avatar ${crop.cls}" style="border-color:${color};${crop.style}">
      <img src="dominion-cards-used-small/${escapeHtml(obj.avatar_card)}" alt=""></span>`;
  }
  return `<span class="bp-av ${cls} bp-av-fallback" style="background:${color};border-color:${color}">${initial(name)}</span>`;
}

// Intervals owned by whatever screen is showing; cleared on every transition.
let screenTimers = [];
function clearScreenTimers() {
  screenTimers.forEach(t => clearInterval(t));
  screenTimers = [];
}
function own(id) { screenTimers.push(id); }

// ── Generic pager: split items so each "page" fills one screen, no scroll. ──
function paginate(items, containerEl, minRowPx) {
  const h = containerEl.clientHeight || window.innerHeight * 0.7;
  const gap = window.innerHeight * 0.01;
  const perPage = Math.max(1, Math.floor((h + gap) / (minRowPx + gap)));
  const pages = [];
  for (let i = 0; i < items.length; i += perPage) pages.push(items.slice(i, i + perPage));
  return pages.length ? pages : [[]];
}

// ─────────────────────────────────────────────────────────────
// Launcher
// ─────────────────────────────────────────────────────────────
const HUE = { gold: '#d4b05a', green: '#5fbf6a', blue: '#4e8fc0', crimson: '#c0494a' };
const LAUNCH_TILES = [
  { icon: '♛', label: 'Leaderboard', sub: 'Season standings',     screen: 'leaderboard', hue: 'gold' },
  { icon: '◉', label: 'Live',        sub: 'Games in progress',    screen: 'live',        hue: 'green' },
  { icon: '↻', label: 'Recent',      sub: 'Past games & charts',  screen: 'recent',      hue: 'blue' },
  { icon: '▶', label: 'Play',        sub: 'Start a new game',     screen: 'play-build',  hue: 'crimson' },
];

function buildLauncher() {
  const track = $('bp-launcher-track');
  track.innerHTML = LAUNCH_TILES.map(t =>
    `<button class="bp-tile bp-focusable" data-screen="${t.screen}" data-hue="${t.hue}" style="--tile:${HUE[t.hue]}">
       <span class="bp-tile-art"><span class="bp-tile-icon">${t.icon}</span></span>
       <span class="bp-tile-meta">
         <span class="bp-tile-label">${t.label}</span>
         <span class="bp-tile-sub">${t.sub}</span>
       </span>
     </button>`).join('');
  track.querySelectorAll('.bp-tile').forEach(btn =>
    btn.addEventListener('click', () => BP.showScreen(btn.dataset.screen)));
  // Reactive ambient backdrop + parallax: emblem layers drift by distance from
  // the focused tile, so the carousel reads as layered depth as it settles.
  // Tile rotation is a constant rest angle (CSS); focus straightens it to 0.
  track.addEventListener('bp:focus', (e) => {
    const tile = e.target.closest && e.target.closest('.bp-tile');
    if (!tile) return;
    $('bp-ambient').style.setProperty('--amb', HUE[tile.dataset.hue]);
    const tiles = [...track.children];
    const fi = tiles.indexOf(tile);
    tiles.forEach((t, i) => {
      const art = t.querySelector('.bp-tile-art');
      if (art) art.style.transform = `translateX(${(fi - i) * 16}px)`;
    });
  });
}

function tickClock() {
  const now = new Date();
  $('bp-clock').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  $('bp-date').textContent = now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

// ─────────────────────────────────────────────────────────────
// Leaderboard
// ─────────────────────────────────────────────────────────────
let lbPages = [[]], lbIdx = 0;

async function showLeaderboard() {
  clearScreenTimers();
  const list = $('lb-list');
  list.innerHTML = '<div class="bp-empty">Loading…</div>';
  let data = [];
  try { data = await statsAPI.getLeaderboard(); } catch (e) { list.innerHTML = '<div class="bp-empty">Could not load standings.</div>'; return; }
  data.sort((a, b) => b.avg_league_points - a.avg_league_points);
  list.innerHTML = '';
  lbPages = paginate(data, list, 88);
  lbIdx = 0;
  renderLbPage();
}

function renderLbPage() {
  const list = $('lb-list');
  const start = lbIdx * (lbPages[0]?.length || 1);
  list.innerHTML = lbPages[lbIdx].map((p, i) => {
    const color = p.color || '#4db8ff';
    const rank = start + i + 1;
    const bio = p.bio
      ? `<span class="bp-bio">${escapeHtml(p.bio)}</span>` : '';
    return `<div class="bp-row" style="border-left-color:${color}">
      <span class="bp-rank">${rank}</span>
      ${avatarHtml(p)}
      <span class="bp-name-wrap"><span class="bp-name">${escapeHtml(p.name)}</span>${bio}</span>
      <span class="bp-stat">${p.total_wins}<span class="bp-stat-label">wins</span></span>
      <span class="bp-stat">${p.total_games}<span class="bp-stat-label">games</span></span>
      <span class="bp-stat-main">${p.avg_league_points}<span class="bp-stat-label">avg LP</span></span>
    </div>`;
  }).join('');
  $('lb-page').textContent = lbPages.length > 1 ? `Page ${lbIdx + 1} / ${lbPages.length}` : '';
}

function pageList(dir, getIdx, setIdx, pagesLen, render) {
  if (pagesLen <= 1) return true;
  let i = getIdx();
  if (dir === 'left' || dir === 'up') i = (i - 1 + pagesLen) % pagesLen;
  else i = (i + 1) % pagesLen;
  setIdx(i); render();
  return true;
}

// ─────────────────────────────────────────────────────────────
// Live
// ─────────────────────────────────────────────────────────────
let liveGames = [], liveIdx = 0;

async function loadLive(silent) {
  let games = [];
  try { ({ games } = await apiRequest('/games?live=1&limit=10')); } catch (e) { games = []; }
  liveGames = games || [];
  if (liveIdx >= liveGames.length) liveIdx = 0;
  renderLive();
}

function renderLive() {
  const wrap = $('live-wrap');
  if (!liveGames.length) {
    wrap.innerHTML = '<div class="bp-empty">No games in progress.<br>Start one from Play.</div>';
    $('live-page').textContent = '';
    return;
  }
  const g = liveGames[liveIdx];
  const players = [...(g.players || [])].sort((a, b) => b.final_score - a.final_score);
  $('live-page').textContent = liveGames.length > 1 ? `Game ${liveIdx + 1} / ${liveGames.length}` : '';
  wrap.innerHTML =
    `<div class="bp-live-meta">${g.build_nickname ? escapeHtml(g.build_nickname) : 'No build'}</div>
     <div class="bp-list">` +
    players.map((p, i) => {
      const color = p.player_color || '#4db8ff';
      return `<div class="bp-row" style="border-left-color:${color}">
        <span class="bp-rank">${i + 1}</span>
        ${avatarHtml(p)}
        <span class="bp-name">${escapeHtml(p.player_name)}</span>
        <span class="bp-stat-main">${p.final_score}</span>
      </div>`;
    }).join('') + '</div>';
}

// ─────────────────────────────────────────────────────────────
// Recent games
// ─────────────────────────────────────────────────────────────
let recentPages = [[]], recentIdx = 0, recentGames = [];

async function showRecent() {
  clearScreenTimers();
  const list = $('recent-list');
  list.innerHTML = '<div class="bp-empty">Loading…</div>';
  let games = [];
  try { ({ games } = await gamesAPI.getAll({ limit: 40 })); } catch (e) { list.innerHTML = '<div class="bp-empty">Could not load games.</div>'; return; }
  recentGames = (games || []).filter(g => g.ended_at);
  list.innerHTML = '';
  recentPages = paginate(recentGames, list, 96);
  recentIdx = 0;
  renderRecentPage();
}

function renderRecentPage() {
  const list = $('recent-list');
  list.innerHTML = recentPages[recentIdx].map(g => {
    const players = [...(g.players || [])].sort((a, b) => (a.placement || 99) - (b.placement || 99));
    const winner = players[0];
    const color = winner?.player_color || '#a08850';
    const d = parseDbDate(g.ended_at);
    const date = d ? d.toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
    const roster = players.map(p => `${escapeHtml(p.player_name)} ${p.final_score}`).join('  ·  ');
    return `<button class="bp-row bp-focusable" data-gid="${g.id}" style="border-left-color:${color}">
      <span class="bp-rank">★</span>
      ${winner ? avatarHtml(winner) : ''}
      <span class="bp-name"><strong>${escapeHtml(winner?.player_name || '—')}</strong>
        <span style="color:var(--color-text-dim);font-size:0.7em"> &nbsp; ${roster}</span></span>
      <span class="bp-stat">${escapeHtml(g.build_nickname || '')}</span>
      <span class="bp-stat">${date}</span>
    </button>`;
  }).join('');
  list.querySelectorAll('.bp-row').forEach(btn =>
    btn.addEventListener('click', () => openGameDetail(Number(btn.dataset.gid))));
  $('recent-page').textContent = recentPages.length > 1 ? `Page ${recentIdx + 1} / ${recentPages.length}` : '';
  BP.refreshFocus(list.querySelector('.bp-row') || undefined);
}

// Recent game → replay the end-of-game winner banner + animated score chart.
let detailGame = null;

async function openGameDetail(gid) {
  detailGame = recentGames.find(g => g.id === gid) || null;
  if (!detailGame) return;
  BP.showScreen('game-detail');
}

async function showGameDetail() {
  clearScreenTimers();
  const g = detailGame;
  if (!g) { BP.showScreen('recent'); return; }
  const players = [...(g.players || [])].sort((a, b) => (a.placement || 99) - (b.placement || 99));
  const winner = players[0];
  const color = winner?.player_color || '#4db8ff';
  const banner = $('bp-detail-winner');
  banner.textContent = winner ? `${winner.player_name} wins!` : 'Game';
  banner.style.color = color;
  $('bp-detail-sub').textContent = winner ? `${winner.final_score} points` : '';

  $('bp-detail-back').onclick = () => BP.showScreen('recent');

  const canvas = $('bp-detail-chart');
  let history = [];
  try { history = await gamesAPI.getScoreHistory(g.id); } catch (e) { history = []; }
  requestAnimationFrame(() => drawScoreChart(canvas, history));
  if (window.confetti) window.confetti.fire(4000);
}

// ─────────────────────────────────────────────────────────────
// Play — build → players → scoring
// ─────────────────────────────────────────────────────────────
const play = { buildId: null, selected: [], players: [], game: null, scoreDebounce: {}, stream: null };

async function showPlayBuild() {
  clearScreenTimers();
  const track = $('pb-track');
  track.innerHTML = '<div class="bp-empty">Loading…</div>';
  let builds = [];
  try { builds = await buildsAPI.getAll(); } catch (e) { builds = []; }
  const tiles = [{ id: null, nickname: 'No Build' }, ...builds];
  track.innerHTML = tiles.map(b =>
    `<button class="bp-tile bp-focusable" data-build="${b.id ?? ''}" style="--tile:${HUE.crimson}">
       <span class="bp-tile-art"><span class="bp-tile-icon">⚔</span></span>
       <span class="bp-tile-meta"><span class="bp-tile-label">${escapeHtml(b.nickname)}</span></span>
     </button>`).join('');
  track.querySelectorAll('.bp-tile').forEach(btn => btn.addEventListener('click', () => {
    play.buildId = btn.dataset.build ? Number(btn.dataset.build) : null;
    BP.showScreen('play-players');
  }));
  BP.refreshFocus(track.querySelector('.bp-tile') || undefined);   // onShow is async; re-grab focusables now that tiles exist
}

async function showPlayPlayers() {
  clearScreenTimers();
  play.selected = [];
  $('pp-add-row').style.display = 'none';
  const grid = $('pp-grid');
  grid.innerHTML = '<div class="bp-empty">Loading…</div>';
  let players = [];
  try { players = await playersAPI.getAll(); } catch (e) { players = []; }
  play.players = players;
  renderPlayerGrid();
  BP.refreshFocus(grid.querySelector('.bp-player-tile') || undefined);   // onShow is async; re-grab focusables now that tiles exist
}

function renderPlayerGrid() {
  const grid = $('pp-grid');
  grid.innerHTML = play.players.map(p => {
    const color = p.color || '#4db8ff';
    const sel = play.selected.includes(p.id);
    return `<button class="bp-player-tile bp-focusable ${sel ? 'selected' : ''}" data-pid="${p.id}">
      ${avatarHtml(p, 'bp-av-tile')}
      <span class="bp-name">${escapeHtml(p.name)}</span>
      <span class="bp-check">✓</span>
    </button>`;
  }).join('');
  grid.querySelectorAll('.bp-player-tile').forEach(btn =>
    btn.addEventListener('click', () => togglePlayer(Number(btn.dataset.pid), btn)));
  updateStartState();
}

function togglePlayer(id, btn) {
  const i = play.selected.indexOf(id);
  if (i >= 0) { play.selected.splice(i, 1); btn.classList.remove('selected'); }
  else { play.selected.push(id); btn.classList.add('selected'); }
  updateStartState();
}

function updateStartState() {
  $('pp-count').textContent = play.selected.length ? `${play.selected.length} selected` : '';
  $('pp-start').classList.toggle('bp-disabled', play.selected.length < 2);
  BP.refreshFocus(document.querySelector('#pp-grid .bp-focus') || undefined);
}

async function startPlay() {
  if (play.selected.length < 2) return;
  try {
    const created = await gamesAPI.create(play.buildId, play.selected);
    const startScores = {};
    (created.players || []).forEach(p => { startScores[p.player_id] = p.final_score; });
    play.game = await gamesAPI.start(created.id);
    play.players = play.players
      .filter(p => play.selected.includes(p.id))
      .map(p => ({ ...p, score: startScores[p.id] ?? 3 }));
    BP.showScreen('play-score');
  } catch (e) {
    showInfo('Could not start', e.message || 'Please try again.');
  }
}

// ── Scoring ──
function showPlayScore() {
  clearScreenTimers();
  $('ps-rows').innerHTML = play.players.map(p => {
    const color = p.color || '#4db8ff';
    return `<div class="bp-score-row" data-pid="${p.id}" style="border-left-color:${color}">
      ${avatarHtml(p, 'bp-av-score')}
      <span class="bp-sname">${escapeHtml(p.name)}</span>
      <button class="bp-step bp-focusable" data-pid="${p.id}" data-d="-1">−</button>
      <span class="bp-sval">${p.score}</span>
      <button class="bp-step bp-focusable" data-pid="${p.id}" data-d="1">+</button>
    </div>`;
  }).join('');
  $('ps-rows').querySelectorAll('.bp-step').forEach(btn =>
    btn.addEventListener('click', () => adjustScore(Number(btn.dataset.pid), Number(btn.dataset.d))));
  $('ps-end').onclick = confirmEnd;
  $('ps-cancel').onclick = confirmCancel;

  const started = Date.parse((play.game.started_at || '').replace(' ', 'T') + 'Z') || Date.now();
  own(setInterval(() => {
    const s = Math.floor((Date.now() - started) / 1000);
    $('ps-timer').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }, 1000));
  connectStream();
}

function setVal(pid, score) {
  const row = document.querySelector(`.bp-score-row[data-pid="${pid}"] .bp-sval`);
  if (row) row.textContent = score;
}

function adjustScore(pid, delta) {
  const p = play.players.find(x => x.id === pid);
  if (!p) return;
  p.score += delta;
  setVal(pid, p.score);
  if (play.scoreDebounce[pid]) clearTimeout(play.scoreDebounce[pid]);
  play.scoreDebounce[pid] = setTimeout(async () => {
    delete play.scoreDebounce[pid];
    try { await gamesAPI.updateScore(play.game.id, pid, p.score, play.game.edit_token); }
    catch (e) { console.error('score save failed', e); }
  }, 500);
}

function connectStream() {
  if (play.stream) play.stream.close();
  play.stream = new EventSource(`${API_BASE_URL}/games/${play.game.id}/stream`);
  play.stream.addEventListener('score', e => {
    const { player_id, score } = JSON.parse(e.data);
    if (play.scoreDebounce[player_id]) return;       // our newer local edit wins
    const p = play.players.find(x => x.id === player_id);
    if (p && p.score !== score) { p.score = score; setVal(player_id, score); }
  });
  play.stream.addEventListener('ended', () => { closeStream(); BP.showScreen('launcher'); });
  play.stream.onerror = () => {};
}
function closeStream() { if (play.stream) { play.stream.close(); play.stream = null; } }

function confirmEnd() {
  showModal({
    title: 'End the game?',
    bodyHtml: 'Final scores lock in and league points are calculated.',
    actions: [
      { label: 'End Game', go: true, onSelect: doEnd },
      { label: 'Keep Playing', onSelect: () => BP.showScreen('play-score') },
    ],
    back: () => BP.showScreen('play-score'),
  });
}

function confirmCancel() {
  showModal({
    title: 'Cancel the game?',
    bodyHtml: 'The game is discarded — no scores saved, no league points awarded.',
    actions: [
      { label: 'Cancel Game', go: true, onSelect: doCancel },
      { label: 'Keep Playing', onSelect: () => BP.showScreen('play-score') },
    ],
    back: () => BP.showScreen('play-score'),
  });
}

async function doCancel() {
  Object.values(play.scoreDebounce).forEach(t => clearTimeout(t));
  play.scoreDebounce = {};
  try {
    await gamesAPI.cancel(play.game.id);
    closeStream();
    BP.showScreen('launcher');
  } catch (e) {
    showInfo('Could not cancel game', e.message || 'Please try again.');
  }
}

async function doEnd() {
  Object.values(play.scoreDebounce).forEach(t => clearTimeout(t));
  play.scoreDebounce = {};
  try {
    for (const p of play.players) await gamesAPI.updateScore(play.game.id, p.id, p.score, play.game.edit_token);
    await gamesAPI.end(play.game.id);
    const history = await gamesAPI.getScoreHistory(play.game.id).catch(() => []);
    closeStream();
    const winner = [...play.players].sort((a, b) => b.score - a.score)[0];
    play.result = { winner, history };
    BP.showScreen('result');
  } catch (e) {
    showInfo('Could not end game', e.message || 'Please try again.');
  }
}

// End-of-game: winner banner + the animated score-progression chart, plus confetti.
function showResult() {
  const { winner, history } = play.result || {};
  if (!winner) { BP.showScreen('launcher'); return; }
  const color = winner.color || '#4db8ff';
  const banner = $('bp-result-winner');
  banner.textContent = `${winner.name} wins!`;
  banner.style.color = color;
  $('bp-result-sub').textContent = `${winner.score} points`;
  $('bp-result-done').onclick = () => BP.showScreen('launcher');
  // Canvas is now visible (screen is active), so offsetWidth/Height are measured.
  requestAnimationFrame(() => drawScoreChart($('bp-result-chart'), history));
  if (window.confetti) window.confetti.fire(4000);
}

// ─────────────────────────────────────────────────────────────
// Modal
// ─────────────────────────────────────────────────────────────
let modalBack = () => BP.showScreen('launcher');

function showModal({ title, bodyHtml, actions, back }) {
  $('bp-modal-title').textContent = title;
  $('bp-modal-body').innerHTML = bodyHtml || '';
  $('bp-modal-actions').innerHTML = actions.map((a, i) =>
    `<button class="bp-btn ${a.go ? 'bp-btn-go' : ''} bp-focusable" data-i="${i}">${escapeHtml(a.label)}</button>`).join('');
  $('bp-modal-actions').querySelectorAll('.bp-btn').forEach(btn =>
    btn.addEventListener('click', () => actions[Number(btn.dataset.i)].onSelect()));
  modalBack = back || (() => BP.showScreen('launcher'));
  BP.showScreen('modal');
}
function showInfo(title, msg) {
  showModal({ title, bodyHtml: escapeHtml(msg), actions: [{ label: 'OK', go: true, onSelect: () => BP.showScreen('launcher') }] });
}

// ─────────────────────────────────────────────────────────────
// Wire up screens + arrow handlers
// ─────────────────────────────────────────────────────────────
BP.registerScreen('launcher', {
  onShow: () => { clearScreenTimers(); if (!$('bp-launcher-track').children.length) buildLauncher(); tickClock(); own(setInterval(tickClock, 15000)); },
  onBack: () => { if (document.fullscreenElement) document.exitFullscreen(); },
});
BP.registerScreen('leaderboard', {
  onShow: showLeaderboard,
  onArrow: dir => pageList(dir, () => lbIdx, v => lbIdx = v, lbPages.length, renderLbPage),
});
BP.registerScreen('live', {
  onShow: () => { clearScreenTimers(); loadLive(); own(setInterval(() => loadLive(true), 5000)); },
  onArrow: dir => { if (liveGames.length <= 1) return true; liveIdx = (liveIdx + (dir === 'left' || dir === 'up' ? -1 : 1) + liveGames.length) % liveGames.length; renderLive(); return true; },
});
BP.registerScreen('recent', {
  onShow: showRecent,
  onArrow: dir => {
    if (dir === 'left' || dir === 'right')
      return pageList(dir, () => recentIdx, v => recentIdx = v, recentPages.length, renderRecentPage);
    return false;  // up/down move focus between game rows
  },
});
BP.registerScreen('game-detail', {
  onShow: showGameDetail,
  onBack: () => BP.showScreen('recent'),
});
BP.registerScreen('play-build', { onShow: showPlayBuild });
BP.registerScreen('play-players', {
  onShow: showPlayPlayers,
  onBack: () => BP.showScreen('play-build'),
});
BP.registerScreen('play-score', {
  onShow: showPlayScore,
  onBack: () => {},   // no back out of a live game; use Cancel or End
});
BP.registerScreen('result', {
  onShow: () => { clearScreenTimers(); showResult(); },
  onBack: () => BP.showScreen('launcher'),
});
BP.registerScreen('modal', { onShow: () => {}, onBack: () => modalBack() });

// Clickable back buttons (for remotes whose hardware Back key doesn't reach the app).
document.querySelectorAll('.bp-back').forEach(btn =>
  btn.addEventListener('click', () => BP.showScreen(btn.dataset.back)));

// Player-pick add-new wiring
$('pp-add-btn').addEventListener('click', () => {
  const row = $('pp-add-row');
  row.style.display = 'flex';
  $('pp-new-name').value = '';
  $('pp-new-name').focus();
});
$('pp-add-confirm').addEventListener('click', addNewPlayer);
$('pp-new-name').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addNewPlayer(); } });
$('pp-start').addEventListener('click', startPlay);

async function addNewPlayer() {
  const name = $('pp-new-name').value.trim();
  if (!name) return;
  try {
    const p = await playersAPI.create(name);
    play.players.push(p);
    play.selected.push(p.id);
    $('pp-add-row').style.display = 'none';
    renderPlayerGrid();
  } catch (e) { showInfo('Could not add player', e.message || ''); }
}

BP.init('launcher');
