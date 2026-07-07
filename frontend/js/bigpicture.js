// Big Picture Mode — screens. Reuses the existing /api layer (api.js globals).
// No backend changes; this is a parallel, remote-driven front door.

const $ = (id) => document.getElementById(id);
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const initial = (name) => (name || '?').trim()[0].toUpperCase();
// Join winner names for display, handling ties ("Alice", "Alice & Bob", "Alice, Bob & Carl").
const joinNames = (names) => names.length <= 1 ? (names[0] || '') :
  names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1];
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
const HUE = { gold: '#d4b05a', green: '#5fbf6a', blue: '#4e8fc0', crimson: '#c0494a', violet: '#9b7bd0', steel: '#8a94a6' };

// Inline SVG, not glyph codepoints — several tile glyphs (esp. ⏻ U+23FB) fall back
// to tofu on Smart TV browsers whose bundled fonts lack rare Unicode blocks.
const ICONS = {
  crown:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8l4 3 5-6 5 6 4-3-2 10H5L3 8z"/><path d="M5 21h14"/></svg>',
  live:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none"/></svg>',
  clock:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/></svg>',
  play:   '<svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8V4z" fill="currentColor"/></svg>',
  power:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 3v8"/><path d="M6.3 6.3a9 9 0 1 0 11.4 0"/></svg>',
  swords: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20L15 9"/><path d="M20 4l-4 1-1 4 2 2 4-1 1-4z"/><path d="M20 20L9 9"/><path d="M4 4l4 1 1 4-2 2-4-1-1-4z"/></svg>',
  plus:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  list:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M7 8h10M7 12h10M7 16h7"/></svg>',
};

const LAUNCH_TILES = [
  { icon: 'crown',  label: 'Leaderboard', sub: 'Season standings',     screen: 'leaderboard', hue: 'gold' },
  { icon: 'live',   label: 'Live',        sub: 'Games in progress',    screen: 'live',        hue: 'green' },
  { icon: 'clock',  label: 'Recent',      sub: 'Past games & charts',  screen: 'recent',      hue: 'blue' },
  { icon: '⚒',      label: 'Builds',      sub: 'Browse & make builds', screen: 'builds-menu', hue: 'violet' },
  { icon: 'play',   label: 'Play',        sub: 'Start a new game',     screen: 'play-build',  hue: 'crimson' },
  { icon: 'power',  label: 'Exit',        sub: 'Back to main site',    screen: 'exit',        hue: 'steel' },
];

function exitBigPicture() {
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  window.location.href = 'index.html';
}

function buildLauncher() {
  const track = $('bp-launcher-track');
  track.innerHTML = LAUNCH_TILES.map(t =>
    `<button class="bp-tile bp-focusable" data-screen="${t.screen}" data-hue="${t.hue}" style="--tile:${HUE[t.hue]}">
       <span class="bp-tile-art"><span class="bp-tile-icon">${ICONS[t.icon] || t.icon}</span></span>
       <span class="bp-tile-meta">
         <span class="bp-tile-label">${t.label}</span>
         <span class="bp-tile-sub">${t.sub}</span>
       </span>
     </button>`).join('');
  track.querySelectorAll('.bp-tile').forEach(btn =>
    btn.addEventListener('click', () => btn.dataset.screen === 'exit' ? exitBigPicture() : BP.showScreen(btn.dataset.screen)));
  // Reactive ambient backdrop + parallax: emblem layers drift by distance from
  // the focused tile, so the carousel reads as layered depth as it settles.
  // Tile rotation is a constant rest angle (CSS); focus straightens it to 0.
  track.addEventListener('bp:focus', (e) => {
    const tile = e.target.closest && e.target.closest('.bp-tile');
    if (!tile) return;
    $('bp-ambient').querySelectorAll('.bp-ambient-layer').forEach(l =>
      l.classList.toggle('active', l.dataset.hue === tile.dataset.hue));
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
    const winners = players.filter(p => p.placement === 1);
    const tied = winners.length > 1;
    const color = !tied && winners[0]?.player_color || '#a08850';
    const d = parseDbDate(g.ended_at);
    const date = d ? d.toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
    const roster = players.map(p => `${escapeHtml(p.player_name)} ${p.final_score}`).join('  ·  ');
    return `<button class="bp-row bp-focusable" data-gid="${g.id}" style="border-left-color:${color}">
      <span class="bp-rank">★</span>
      ${winners.map(w => avatarHtml(w)).join('')}
      <span class="bp-name"><strong>${escapeHtml(joinNames(winners.map(w => w.player_name)) || '—')}</strong>
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
  const winners = players.filter(p => p.placement === 1);
  const tied = winners.length > 1;
  const color = !tied && winners[0]?.player_color || '#a08850';
  const banner = $('bp-detail-winner');
  banner.textContent = winners.length
    ? `${joinNames(winners.map(w => w.player_name))} ${tied ? 'tie!' : 'wins!'}`
    : 'Game';
  banner.style.color = color;
  $('bp-detail-sub').textContent = winners.length ? `${winners[0].final_score} points` : '';

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
const play = { buildId: null, selected: [], players: [], game: null, scoreDebounce: {}, stream: null, initialScores: {}, firstBloodShown: false };

async function showPlayBuild() {
  clearScreenTimers();
  const track = $('pb-track');
  track.innerHTML = '<div class="bp-empty">Loading…</div>';
  let builds = [];
  try { builds = await buildsAPI.getAll(); } catch (e) { builds = []; }
  const tiles = [{ id: null, nickname: 'No Build' }, ...builds];
  track.innerHTML = tiles.map(b =>
    `<button class="bp-tile bp-focusable" data-build="${b.id ?? ''}" style="--tile:${HUE.crimson}">
       <span class="bp-tile-art"><span class="bp-tile-icon">${ICONS.swords}</span></span>
       <span class="bp-tile-meta"><span class="bp-tile-label">${escapeHtml(b.nickname)}</span></span>
     </button>`).join('') +
    // "Don't see your build? Make one" — drops into the creator, returns here when saved.
    `<button class="bp-tile bp-focusable" data-make="1" style="--tile:${HUE.violet}">
       <span class="bp-tile-art"><span class="bp-tile-icon">${ICONS.plus}</span></span>
       <span class="bp-tile-meta">
         <span class="bp-tile-label">New Build</span>
         <span class="bp-tile-sub">Don't see your build?</span>
       </span>
     </button>`;
  track.querySelectorAll('.bp-tile').forEach(btn => btn.addEventListener('click', () => {
    if (btn.dataset.make) { startBuildCreator('play-build'); return; }
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
    play.initialScores = {};
    play.players.forEach(p => { play.initialScores[p.id] = p.score; });
    play.firstBloodShown = false;
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

// First blood — the first player to score above the starting baseline this game.
let firstBloodTimer = null;
function maybeFirstBlood(p) {
  if (play.firstBloodShown) return;
  const base = play.initialScores[p.id];
  if (base === undefined || p.score <= base) return;
  play.firstBloodShown = true;
  const el = $('bp-first-blood');
  $('bp-first-blood-sub').textContent = `${p.name} draws first blood`;
  el.classList.remove('show');
  void el.offsetWidth;   // restart the CSS animation
  el.classList.add('show');
  clearTimeout(firstBloodTimer);
  firstBloodTimer = setTimeout(() => el.classList.remove('show'), 6500);
}
function hideFirstBlood() {
  clearTimeout(firstBloodTimer);
  $('bp-first-blood').classList.remove('show');
}

function adjustScore(pid, delta) {
  const p = play.players.find(x => x.id === pid);
  if (!p) return;
  p.score += delta;
  setVal(pid, p.score);
  maybeFirstBlood(p);
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
    if (p && p.score !== score) { p.score = score; setVal(player_id, score); maybeFirstBlood(p); }
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
  hideFirstBlood();
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
  hideFirstBlood();
  try {
    for (const p of play.players) await gamesAPI.updateScore(play.game.id, p.id, p.score, play.game.edit_token);
    await gamesAPI.end(play.game.id);
    const history = await gamesAPI.getScoreHistory(play.game.id).catch(() => []);
    closeStream();
    const maxScore = Math.max(...play.players.map(p => p.score));
    const winners = play.players.filter(p => p.score === maxScore);
    play.result = { winners, history };
    BP.showScreen('result');
  } catch (e) {
    showInfo('Could not end game', e.message || 'Please try again.');
  }
}

// End-of-game: winner banner + the animated score-progression chart, plus confetti.
function showResult() {
  const { winners, history } = play.result || {};
  if (!winners || !winners.length) { BP.showScreen('launcher'); return; }
  const tied = winners.length > 1;
  const color = !tied && winners[0].color || '#a08850';
  const banner = $('bp-result-winner');
  banner.textContent = `${joinNames(winners.map(w => w.name))} ${tied ? 'tie!' : 'wins!'}`;
  banner.style.color = color;
  $('bp-result-sub').textContent = `${winners[0].score} points`;
  $('bp-result-done').onclick = () => BP.showScreen('launcher');
  // Canvas is now visible (screen is active), so offsetWidth/Height are measured.
  requestAnimationFrame(() => drawScoreChart($('bp-result-chart'), history));
  if (window.confetti) window.confetti.fire(4000);
}

// ─────────────────────────────────────────────────────────────
// Builds — menu, browser, detail, and the remote-friendly creator
// ─────────────────────────────────────────────────────────────
const EXPANSION_ORDER = ['base', 'intrigue', 'seaside', 'prosperity', 'empires', 'rising_sun', 'dark_ages', 'hinterlands', 'nocturne', 'plunder'];

// ── Builds menu (View / Make) ──
const BUILDS_MENU = [
  { icon: 'list', label: 'View Builds',  sub: 'Browse the library', action: 'view', hue: 'blue' },
  { icon: 'plus', label: 'Make a Build', sub: 'Create a new one',    action: 'make', hue: 'crimson' },
];
function showBuildsMenu() {
  clearScreenTimers();
  const track = $('bm-track');
  track.innerHTML = BUILDS_MENU.map(t =>
    `<button class="bp-tile bp-focusable" data-action="${t.action}" style="--tile:${HUE[t.hue]}">
       <span class="bp-tile-art"><span class="bp-tile-icon">${ICONS[t.icon] || t.icon}</span></span>
       <span class="bp-tile-meta">
         <span class="bp-tile-label">${t.label}</span>
         <span class="bp-tile-sub">${t.sub}</span>
       </span>
     </button>`).join('');
  track.querySelectorAll('.bp-tile').forEach(btn => btn.addEventListener('click', () => {
    if (btn.dataset.action === 'make') startBuildCreator('builds-menu');
    else BP.showScreen('builds-view');
  }));
  BP.refreshFocus(track.querySelector('.bp-tile') || undefined);
}

// ── Browse builds ──
let bvPages = [[]], bvIdx = 0, bvBuilds = [];

// Naming convention: '*' prefix = book build, '?' or anything else = custom
function buildKind(b) { return (b.nickname || '').trim().startsWith('*') ? 'book' : 'custom'; }
function buildHue(b) { return buildKind(b) === 'book' ? HUE.gold : HUE.blue; }

function buildExpansionsOf(b) {
  const set = new Set();
  (b.cards || []).forEach(c => { const e = CARD_EXPANSION_MAP[c]; if (e) set.add(e); });
  return EXPANSION_ORDER.filter(e => set.has(e)).map(e => EXPANSION_DISPLAY[e]).join(' · ');
}

async function showBuildsView() {
  clearScreenTimers();
  const list = $('bv-list');
  list.innerHTML = '<div class="bp-empty">Loading…</div>';
  let builds = [];
  try { builds = await buildsAPI.getAll(); } catch (e) { list.innerHTML = '<div class="bp-empty">Could not load builds.</div>'; return; }
  bvBuilds = builds || [];
  if (!bvBuilds.length) { list.innerHTML = '<div class="bp-empty">No builds yet.<br>Make one from the Builds menu.</div>'; $('bv-page').textContent = ''; return; }
  list.innerHTML = '';
  bvPages = paginate(bvBuilds, list, 88);
  bvIdx = 0;
  renderBvPage();
}

function renderBvPage() {
  const list = $('bv-list');
  list.innerHTML = bvPages[bvIdx].map(b => {
    const games = parseInt(b.games_played) || 0;
    const avg = parseFloat(b.avg_score_per_game) || 0;
    return `<button class="bp-row bp-focusable" data-bid="${b.id}" style="border-left-color:${buildHue(b)}">
      <span class="bp-rank" style="color:${buildHue(b)}">⚒</span>
      <span class="bp-name-wrap"><span class="bp-name">${escapeHtml(b.nickname)}</span>
        <span class="bp-bio">${escapeHtml(buildExpansionsOf(b) || '—')}</span></span>
      <span class="bp-stat">${games}<span class="bp-stat-label">games</span></span>
      <span class="bp-stat-main">${avg.toFixed(1)}<span class="bp-stat-label">avg score</span></span>
    </button>`;
  }).join('');
  list.querySelectorAll('.bp-row').forEach(btn =>
    btn.addEventListener('click', () => openBuildDetail(Number(btn.dataset.bid))));
  $('bv-page').textContent = bvPages.length > 1 ? `Page ${bvIdx + 1} / ${bvPages.length}` : '';
  BP.refreshFocus(list.querySelector('.bp-row') || undefined);
}

// ── Build detail (read-only) ──
let bvDetail = null;
function openBuildDetail(id) { bvDetail = bvBuilds.find(b => b.id === id) || null; if (bvDetail) BP.showScreen('build-detail'); }

function renderKingdomGroups(cards) {
  if (!cards || !cards.length) return '';
  const groups = {};
  cards.forEach(c => { const e = CARD_EXPANSION_MAP[c] || 'unknown'; (groups[e] = groups[e] || []).push(c); });
  return EXPANSION_ORDER.filter(e => groups[e]).map(e => {
    const tags = groups[e].slice().sort((a, b) => a.localeCompare(b)).map(c => {
      const cost = CARD_COSTS[c] ? `<span class="bp-card-cost">${escapeHtml(CARD_COSTS[c])}</span>` : '';
      return `<span class="bp-detail-tag">${escapeHtml(c)}${cost}</span>`;
    }).join('');
    return `<div class="bp-exp-section"><div class="bp-exp-label">${escapeHtml(EXPANSION_DISPLAY[e] || e)}</div><div class="bp-detail-tags">${tags}</div></div>`;
  }).join('');
}

function renderTagSection(label, items) {
  if (!items || !items.length) return '';
  const tags = items.slice().sort((a, b) => a.localeCompare(b)).map(c => `<span class="bp-detail-tag">${escapeHtml(c)}</span>`).join('');
  return `<div class="bp-exp-section"><div class="bp-exp-label">${label}</div><div class="bp-detail-tags">${tags}</div></div>`;
}

function showBuildDetail() {
  clearScreenTimers();
  const b = bvDetail;
  if (!b) { BP.showScreen('builds-view'); return; }
  $('bd-title').textContent = b.nickname;
  $('bd-title').style.color = buildHue(b);
  const games = parseInt(b.games_played) || 0;
  const avg = parseFloat(b.avg_score_per_game) || 0;
  $('bd-meta').textContent = `${games} games · ${avg.toFixed(1)} avg`;
  const badges = [];
  badges.push(buildKind(b) === 'book' ? 'Book Build' : 'Custom Build');
  if (b.use_platinum_colony) badges.push('Platinum / Colony');
  if (b.use_shelters) badges.push('Shelters');
  const badgeHtml = badges.length ? `<div class="bp-detail-badges">${badges.map(x => `<span class="bp-detail-badge">${escapeHtml(x)}</span>`).join('')}</div>` : '';
  const body = $('bd-body');
  body.innerHTML = badgeHtml + renderKingdomGroups(b.cards) +
    renderTagSection('Landmarks', b.landmarks) +
    renderTagSection('Events', b.events) +
    renderTagSection('Prophecies', b.prophecies) +
    renderTagSection('Traits', b.traits);
  body.scrollTop = 0;
}

function scrollDetail(dir) {
  const body = $('bd-body');
  const amt = body.clientHeight * 0.8;
  if (dir === 'up') body.scrollBy({ top: -amt, behavior: 'smooth' });
  else if (dir === 'down') body.scrollBy({ top: amt, behavior: 'smooth' });
  return true;   // consume arrows; the only focusable here is Back
}

// ── Creator state + step sequencer (skips steps the expansions don't need) ──
const mk = { name: '', expansions: new Set(), cards: new Set(), landmarks: new Set(), events: new Set(), prophecies: new Set(), traits: new Set(), platinumColony: false, shelters: false, touched: new Set(), returnTo: 'builds-menu' };

function startBuildCreator(returnTo) {
  mk.name = '';
  mk.expansions = new Set(); mk.cards = new Set();
  mk.landmarks = new Set(); mk.events = new Set(); mk.prophecies = new Set(); mk.traits = new Set();
  mk.platinumColony = false; mk.shelters = false; mk.touched = new Set();
  mk.returnTo = returnTo || 'builds-menu';
  BP.showScreen('build-expansions');
}

function mkSupplementalNeeded() { return mk.expansions.has('empires') || mk.expansions.has('rising_sun') || mk.expansions.has('plunder'); }
function mkOptionPrompts() {
  const out = [];
  if (mk.expansions.has('prosperity')) out.push({ key: 'platinumColony', label: 'Platinum & Colony', detected: 'Prosperity' });
  if (mk.expansions.has('dark_ages')) out.push({ key: 'shelters', label: 'Shelters', detected: 'Dark Ages' });
  return out;
}
const MK_STEPS = [
  { id: 'build-expansions',   needed: () => true },
  { id: 'build-cards',        needed: () => true },
  { id: 'build-supplemental', needed: mkSupplementalNeeded },
  { id: 'build-options',      needed: () => mkOptionPrompts().length > 0 },
  { id: 'build-name',         needed: () => true },
];
function mkStep(fromId, dir) {
  let i = MK_STEPS.findIndex(s => s.id === fromId) + dir;
  while (i >= 0 && i < MK_STEPS.length && !MK_STEPS[i].needed()) i += dir;
  if (i < 0) return mk.returnTo;
  return MK_STEPS[Math.min(i, MK_STEPS.length - 1)].id;
}
function mkNext(fromId) { BP.showScreen(mkStep(fromId, +1)); }
function mkBack(fromId) { BP.showScreen(mkStep(fromId, -1)); }

function mkSetFor(kind) {
  switch (kind) {
    case 'landmark': return mk.landmarks;
    case 'event':    return mk.events;
    case 'prophecy': return mk.prophecies;
    case 'trait':    return mk.traits;
    default:         return mk.cards;
  }
}
function mkCardChip(kind, card) {
  const set = mkSetFor(kind);
  const cost = (kind === 'card' && CARD_COSTS[card]) ? `<span class="bp-card-cost">${escapeHtml(CARD_COSTS[card])}</span>` : '';
  return `<button class="bp-card-chip bp-focusable ${set.has(card) ? 'selected' : ''}" data-card="${escapeHtml(card)}" data-kind="${kind}">
    <span class="bp-card-name">${escapeHtml(card)}</span>${cost}
    <span class="bp-card-tick">✓</span>
  </button>`;
}
function wireMkChips(container) {
  container.querySelectorAll('.bp-card-chip').forEach(btn => btn.addEventListener('click', () => {
    const kind = btn.dataset.kind;
    const card = btn.dataset.card;
    const set = mkSetFor(kind);
    if (set.has(card)) { set.delete(card); btn.classList.remove('selected'); }
    else {
      if (kind === 'card' && mk.cards.size >= 10) { flashCardLimit(); return; }
      set.add(card); btn.classList.add('selected');
    }
    if (kind === 'card') updateMkCards(); else updateMkSupplemental();
  }));
}

// Step 1: expansions
function showMkExpansions() {
  clearScreenTimers();
  const grid = $('be-grid');
  grid.innerHTML = EXPANSION_ORDER.map(e =>
    `<button class="bp-player-tile bp-focusable ${mk.expansions.has(e) ? 'selected' : ''}" data-exp="${e}">
      <span class="bp-name">${escapeHtml(EXPANSION_DISPLAY[e])}</span>
      <span class="bp-check">✓</span>
    </button>`).join('');
  grid.querySelectorAll('.bp-player-tile').forEach(btn => btn.addEventListener('click', () => {
    const e = btn.dataset.exp;
    if (mk.expansions.has(e)) { mk.expansions.delete(e); btn.classList.remove('selected'); }
    else { mk.expansions.add(e); btn.classList.add('selected'); }
    updateMkExpansions();
  }));
  updateMkExpansions();
  BP.refreshFocus(grid.querySelector('.bp-player-tile') || undefined);
}
function updateMkExpansions() {
  $('be-count').textContent = mk.expansions.size ? `${mk.expansions.size} selected` : '';
  $('be-next').classList.toggle('bp-disabled', mk.expansions.size === 0);
  BP.refreshFocus(document.querySelector('#be-grid .bp-focus') || undefined);
}

// Step 2: kingdom cards (grouped by expansion, capped at 10)
function showMkCards() {
  clearScreenTimers();
  const body = $('bc-body');
  body.innerHTML = EXPANSION_ORDER.filter(e => mk.expansions.has(e)).map(e => {
    const cards = DOMINION_CARDS[e].slice().sort((a, b) => a.localeCompare(b));
    return `<div class="bp-exp-section">
      <div class="bp-exp-label">${escapeHtml(EXPANSION_DISPLAY[e])}</div>
      <div class="bp-card-grid">${cards.map(c => mkCardChip('card', c)).join('')}</div>
    </div>`;
  }).join('');
  wireMkChips(body);
  updateMkCards();
  body.scrollTop = 0;
  BP.refreshFocus(body.querySelector('.bp-card-chip') || undefined);
}
function updateMkCards() {
  const n = mk.cards.size;
  // A standard Dominion kingdom is exactly 10 piles — gate Next on that.
  $('bc-count').textContent = n === 10 ? '10 / 10 — ready' : `${n} / 10 cards`;
  $('bc-next').classList.toggle('bp-disabled', n !== 10);
  BP.refreshFocus(document.querySelector('#bc-body .bp-focus') || undefined);
}
function flashCardLimit() { $('bc-count').textContent = '10 cards max'; setTimeout(updateMkCards, 1200); }

// Step 3: supplemental — only the groups the chosen expansions provide
function mkSupSection(label, groups) {
  const inner = groups.map(([sub, cards, kind]) => {
    const subLabel = sub ? `<div class="bp-exp-sublabel">${escapeHtml(sub)}</div>` : '';
    const chips = cards.slice().sort((a, b) => a.localeCompare(b)).map(c => mkCardChip(kind, c)).join('');
    return `${subLabel}<div class="bp-card-grid">${chips}</div>`;
  }).join('');
  return `<div class="bp-exp-section"><div class="bp-exp-label">${escapeHtml(label)}</div>${inner}</div>`;
}
function showMkSupplemental() {
  clearScreenTimers();
  const e = mk.expansions;
  let html = '';
  if (e.has('empires')) html += mkSupSection('Landmarks', [['', DOMINION_LANDMARKS.empires, 'landmark']]);
  const evGroups = [];
  if (e.has('empires')) evGroups.push(['Empires', DOMINION_EVENTS.empires, 'event']);
  if (e.has('rising_sun')) evGroups.push(['Rising Sun', DOMINION_EVENTS.rising_sun, 'event']);
  if (e.has('plunder')) evGroups.push(['Plunder', DOMINION_EVENTS.plunder, 'event']);
  if (evGroups.length) html += mkSupSection('Events', evGroups);
  if (e.has('rising_sun')) html += mkSupSection('Prophecies', [['', DOMINION_PROPHECIES.rising_sun, 'prophecy']]);
  if (e.has('plunder')) html += mkSupSection('Traits', [['', DOMINION_TRAITS.plunder, 'trait']]);
  const body = $('bsup-body');
  body.innerHTML = html;
  wireMkChips(body);
  updateMkSupplemental();
  body.scrollTop = 0;
  BP.refreshFocus(body.querySelector('.bp-card-chip') || undefined);
}
function updateMkSupplemental() {
  const n = mk.landmarks.size + mk.events.size + mk.prophecies.size + mk.traits.size;
  $('bsup-count').textContent = n ? `${n} selected` : 'Optional';
}

// Step 4: game setup (platinum/colony, shelters) — "we detected X"
function showMkOptions() {
  clearScreenTimers();
  const list = $('bo-list');
  const prompts = mkOptionPrompts();
  // Default to Yes: we detected the expansion, so assume it's in play until the user says otherwise.
  prompts.forEach(p => { if (!mk.touched.has(p.key)) mk[p.key] = true; });
  list.innerHTML = prompts.map(p =>
    `<button class="bp-opt-row bp-focusable ${mk[p.key] ? 'on' : ''}" data-key="${p.key}">
      <span class="bp-opt-text">
        <span>${escapeHtml(p.label)}</span>
        <span class="bp-opt-detected">Detected ${escapeHtml(p.detected)} — using ${escapeHtml(p.label)}?</span>
      </span>
      <span class="bp-opt-val">${mk[p.key] ? 'Yes' : 'No'}</span>
    </button>`).join('');
  list.querySelectorAll('.bp-opt-row').forEach(btn => btn.addEventListener('click', () => {
    const key = btn.dataset.key;
    mk[key] = !mk[key];
    mk.touched.add(key);
    btn.classList.toggle('on', mk[key]);
    btn.querySelector('.bp-opt-val').textContent = mk[key] ? 'Yes' : 'No';
  }));
  BP.refreshFocus(list.querySelector('.bp-opt-row') || undefined);
}

// Step 5: name + save
function mkSummaryText() {
  const exps = EXPANSION_ORDER.filter(e => mk.expansions.has(e)).map(e => EXPANSION_DISPLAY[e]).join(', ');
  const extras = [];
  if (mk.landmarks.size) extras.push(`${mk.landmarks.size} landmark${mk.landmarks.size > 1 ? 's' : ''}`);
  if (mk.events.size) extras.push(`${mk.events.size} event${mk.events.size > 1 ? 's' : ''}`);
  if (mk.prophecies.size) extras.push(`${mk.prophecies.size} prophec${mk.prophecies.size > 1 ? 'ies' : 'y'}`);
  if (mk.traits.size) extras.push(`${mk.traits.size} trait${mk.traits.size > 1 ? 's' : ''}`);
  if (mk.platinumColony) extras.push('Platinum/Colony');
  if (mk.shelters) extras.push('Shelters');
  return `${mk.cards.size} kingdom cards · ${exps}` + (extras.length ? ` · ${extras.join(' · ')}` : '');
}
function showMkName() {
  clearScreenTimers();
  $('bn-summary').textContent = mkSummaryText();
  const input = $('bn-input');
  input.value = mk.name || '';
  setTimeout(() => input.focus(), 50);
}
async function saveBuild() {
  const name = $('bn-input').value.trim();
  if (!name) { $('bn-summary').textContent = 'Please enter a name.'; setTimeout(() => $('bn-input').focus(), 50); return; }
  // Only honor a toggle if its expansion is actually in the build (guards a
  // deselected expansion leaving a stale Yes behind).
  const platinum = mk.expansions.has('prosperity') && mk.platinumColony;
  const shelters = mk.expansions.has('dark_ages') && mk.shelters;
  try {
    await buildsAPI.create(name, [...mk.cards], [...mk.landmarks], [...mk.events], [...mk.prophecies], [...mk.traits], platinum, shelters);
    const back = mk.returnTo;
    showModal({
      title: 'Build saved!',
      bodyHtml: escapeHtml(`"${name}" is ready to play.`),
      actions: [{ label: back === 'play-build' ? 'Back to Game Setup' : 'Done', go: true, onSelect: () => BP.showScreen(back) }],
      back: () => BP.showScreen(back),
    });
  } catch (e) {
    showInfo('Could not save build', e.message || 'Please try again.');
  }
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

// Builds: menu, browser, detail
BP.registerScreen('builds-menu', { onShow: showBuildsMenu });
BP.registerScreen('builds-view', {
  onShow: showBuildsView,
  onArrow: dir => (dir === 'left' || dir === 'right')
    ? pageList(dir, () => bvIdx, v => bvIdx = v, bvPages.length, renderBvPage)
    : false,   // up/down move focus between build rows
});
BP.registerScreen('build-detail', { onShow: showBuildDetail, onArrow: scrollDetail, onBack: () => BP.showScreen('builds-view') });

// Builds: creator steps (onBack uses the skip-aware sequencer)
BP.registerScreen('build-expansions',   { onShow: showMkExpansions,   onBack: () => mkBack('build-expansions') });
BP.registerScreen('build-cards',        { onShow: showMkCards,        onBack: () => mkBack('build-cards') });
BP.registerScreen('build-supplemental', { onShow: showMkSupplemental, onBack: () => mkBack('build-supplemental') });
BP.registerScreen('build-options',      { onShow: showMkOptions,      onBack: () => mkBack('build-options') });
BP.registerScreen('build-name',         { onShow: showMkName,         onBack: () => mkBack('build-name') });

// Clickable back buttons (for remotes whose hardware Back key doesn't reach the app).
document.querySelectorAll('.bp-back[data-back]').forEach(btn =>
  btn.addEventListener('click', () => BP.showScreen(btn.dataset.back)));
// Creator back buttons route through the skip-aware sequencer instead of a fixed target.
document.querySelectorAll('[data-mkback]').forEach(btn =>
  btn.addEventListener('click', () => mkBack(btn.dataset.mkback)));

// Creator: Next / Save wiring
$('be-next').addEventListener('click', () => { if (mk.expansions.size) mkNext('build-expansions'); });
$('bc-next').addEventListener('click', () => { if (mk.cards.size === 10) mkNext('build-cards'); });
$('bsup-next').addEventListener('click', () => mkNext('build-supplemental'));
$('bo-next').addEventListener('click', () => mkNext('build-options'));
$('bn-save').addEventListener('click', saveBuild);
$('bn-input').addEventListener('input', e => { mk.name = e.target.value; });
$('bn-input').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); saveBuild(); } });

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
