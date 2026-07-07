// Big Picture Mode — D-pad focus engine, screen router, fullscreen.
// Console-style: arrow keys move a highlight, OK/Enter activates (fires a real
// click so existing handlers Just Work), Back returns to the launcher.
const BP = (() => {
  const screens = {};          // id -> { el, onShow, onArrow, onBack }
  let currentScreen = null;
  let focusables = [];
  let focusIdx = -1;
  let focusedEl = null;   // actual element, so we clear the right one across screen swaps

  // ── Fullscreen ──────────────────────────────────────────────
  // Browsers only allow this from a user gesture, so we fire it on the first
  // OK press and stay fullscreen from then on.
  function ensureFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement && el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    }
  }

  // ── Screen router ───────────────────────────────────────────
  function registerScreen(id, cfg = {}) {
    screens[id] = { el: document.getElementById('screen-' + id), ...cfg };
  }

  function showScreen(id, ctx) {
    Object.values(screens).forEach(s => s.el && s.el.classList.remove('active'));
    const s = screens[id];
    if (!s) return;
    s.el.classList.add('active');
    currentScreen = id;
    if (s.onShow) s.onShow(ctx);
    refreshFocus();
  }

  function activeScreen() { return screens[currentScreen]; }

  // ── Focus management ────────────────────────────────────────
  function refreshFocus(preferEl) {
    const s = activeScreen();
    if (!s) return;
    focusables = [...s.el.querySelectorAll('.bp-focusable')]
      .filter(el => el.offsetParent !== null && !el.classList.contains('bp-disabled'));
    if (preferEl && focusables.includes(preferEl)) setFocus(focusables.indexOf(preferEl));
    else setFocus(focusables.length ? 0 : -1);
  }

  function setFocus(i) {
    if (focusedEl) focusedEl.classList.remove('bp-focus');
    focusIdx = i;
    focusedEl = (i >= 0 && focusables[i]) ? focusables[i] : null;
    if (focusedEl) {
      focusedEl.classList.add('bp-focus');
      centerCarousel(focusedEl);
      // Keep focus visible inside long, scrollable screens (e.g. card pickers).
      if (focusedEl.closest('[data-bp-scroll]')) focusedEl.scrollIntoView({ block: 'nearest' });
      focusedEl.dispatchEvent(new CustomEvent('bp:focus', { bubbles: true, detail: { el: focusedEl } }));
    }
  }

  function centerCarousel(el) {
    const car = el.closest('[data-bp-carousel]');
    if (!car) return;
    const track = car.querySelector('.bp-carousel-track');
    if (!track) return;
    const center = car.clientWidth / 2;
    const tileCenter = el.offsetLeft + el.offsetWidth / 2;
    track.style.transform = `translateX(${center - tileCenter}px)`;
  }

  function rectCenter(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  // Pick the nearest focusable in a direction: closest along the axis of travel,
  // penalising drift on the perpendicular axis so we stay in the same row/column.
  function move(dir) {
    if (focusIdx < 0) { setFocus(focusables.length ? 0 : -1); return; }
    const curEl = focusables[focusIdx];

    // Carousels are a single DOM-ordered row of tiles under a 3D rest transform
    // (rotateY/scale). Some TV browser engines miscompute getBoundingClientRect
    // on transformed elements once a few tiles have diverged from rest, which
    // made the geometric search below snap to the wrong tile. Left/right inside
    // a carousel doesn't need geometry — just step to the next/previous tile.
    if (dir === 'left' || dir === 'right') {
      const car = curEl.closest('[data-bp-carousel]');
      if (car) {
        const tiles = focusables.filter(el => car.contains(el));
        const ci = tiles.indexOf(curEl);
        const ni = ci + (dir === 'right' ? 1 : -1);
        if (ni >= 0 && ni < tiles.length) setFocus(focusables.indexOf(tiles[ni]));
        return;
      }
    }

    const cur = rectCenter(curEl);
    let best = -1, bestScore = Infinity;
    focusables.forEach((el, i) => {
      if (i === focusIdx) return;
      const c = rectCenter(el);
      const dx = c.x - cur.x, dy = c.y - cur.y;
      let primary, secondary;
      if (dir === 'left')  { if (dx > -1) return; primary = -dx; secondary = Math.abs(dy); }
      if (dir === 'right') { if (dx <  1) return; primary =  dx; secondary = Math.abs(dy); }
      if (dir === 'up')    { if (dy > -1) return; primary = -dy; secondary = Math.abs(dx); }
      if (dir === 'down')  { if (dy <  1) return; primary =  dy; secondary = Math.abs(dx); }
      const score = primary + secondary * 2;
      if (score < bestScore) { bestScore = score; best = i; }
    });
    if (best >= 0) setFocus(best);
  }

  // ── Key handling ────────────────────────────────────────────
  function onKey(e) {
    const s = activeScreen();
    if (!s) return;

    const typing = document.activeElement &&
      (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA');

    const k = e.key, code = e.keyCode;
    const isBack = k === 'Escape' || k === 'Backspace' || k === 'GoBack' ||
      code === 461 /* LG */ || code === 10009 /* Tizen */ || code === 8;

    // While typing, only Back/Escape (blur) is intercepted; let the field work.
    if (typing) {
      if (k === 'Escape') { e.preventDefault(); document.activeElement.blur(); }
      return;
    }

    if (isBack) {
      e.preventDefault();
      if (s.onBack) s.onBack(); else showScreen('launcher');
      return;
    }
    if (k === 'Enter' || code === 13) {
      e.preventDefault();
      ensureFullscreen();
      if (focusables[focusIdx]) focusables[focusIdx].click();
      return;
    }

    let dir = null;
    if (k === 'ArrowLeft')  dir = 'left';
    else if (k === 'ArrowRight') dir = 'right';
    else if (k === 'ArrowUp')    dir = 'up';
    else if (k === 'ArrowDown')  dir = 'down';
    if (!dir) return;

    e.preventDefault();
    if (s.onArrow && s.onArrow(dir)) return;  // screen consumed it (e.g. paging)
    move(dir);
  }

  function init(startScreen) {
    document.addEventListener('keydown', onKey);
    showScreen(startScreen);
  }

  return { registerScreen, showScreen, refreshFocus, setFocusTo: (el) => refreshFocus(el),
           ensureFullscreen, init, current: () => currentScreen };
})();
