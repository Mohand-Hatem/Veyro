/* Features grid engine (SCR-MKT-01), converted from screens/groups/01-public-marketing/bento-engine.js (a vanilla port of React Bits' MagicBento).
 * It animates by writing CSS variables every frame and replaying CSS animations, so it stays plain DOM code outside React; the page mounts it from
 * magic-bento.tsx. Differences from the reference: it is a module with a typed boundary (bento-engine.d.ts), the card text comes from the page's messages,
 * and it returns a cleanup function that removes its listeners, observers, timers and cards (the reference never needed to). */

const CONFIG = { columns: 4, rowHeight: 200, gap: 12, spotlightRadius: 300, enableBorderGlow: true, enableSpotlight: true, clickEffect: true, intro: true };
const MIN_CELL = 150, MIN_PAIR = 200, STAGGER = 80;
let T = (key, fallback) => fallback; // replaced by initBento with the page's messages
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
const css = (node, vars) => { for (const k in vars) node.style.setProperty(k, vars[k]); return node; };

/* ---------- Icons (inline SVG instead of Hugeicons) ---------- */
const ICON = {
  spark: '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3z"/></svg>',
  tick: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>',
  move: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="18" rx="1.5"/><rect x="14" y="3" width="7" height="11" rx="1.5"/></svg>',
  users: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
  lock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  arrow: '<svg width="16" height="18" viewBox="0 0 16 18" aria-hidden="true"><path d="M2.2 1.6 13.4 9.9c.5.4.3 1.2-.4 1.3l-4.6.6-2.2 4.2c-.3.6-1.2.5-1.4-.1L1.2 2.4c-.2-.6.5-1.1 1-.8Z" stroke-width="1.2" stroke-linejoin="round"/></svg>'
};

/* ---------- Card artwork (Veyro data) ---------- */
const CHART = [2, 3, 4, 6, 7, 9, 10, 13, 15, 18, 21, 24]; // tasks completed, cumulative

function curve(values, width, height) {
  const top = 6, bottom = 2;
  const low = Math.min.apply(null, values) * 0.7, high = Math.max.apply(null, values);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, top + (1 - (v - low) / (high - low)) * (height - top - bottom)]);
  const n = pts.length, slopes = [];
  for (let i = 0; i < n - 1; i++) slopes.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]));
  const tan = pts.map((_, i) => i === 0 ? slopes[0] : i === n - 1 ? slopes[n - 2] : (slopes[i - 1] * slopes[i] > 0 ? (slopes[i - 1] + slopes[i]) / 2 : 0));
  for (let i = 0; i < n - 1; i++) {
    if (slopes[i] === 0) { tan[i] = 0; tan[i + 1] = 0; continue; }
    const a = tan[i] / slopes[i], b = tan[i + 1] / slopes[i], l = a * a + b * b;
    if (l > 9) { const s = 3 / Math.sqrt(l); tan[i] = s * a * slopes[i]; tan[i + 1] = s * b * slopes[i]; }
  }
  let line = 'M' + pts[0][0].toFixed(2) + ',' + pts[0][1].toFixed(2);
  const samples = [];
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], t3 = (x1 - x0) / 3;
    const c1 = [x0 + t3, y0 + tan[i] * t3], c2 = [x1 - t3, y1 - tan[i + 1] * t3];
    line += ' C' + c1[0].toFixed(2) + ',' + c1[1].toFixed(2) + ' ' + c2[0].toFixed(2) + ',' + c2[1].toFixed(2) + ' ' + x1.toFixed(2) + ',' + y1.toFixed(2);
    for (let s = 0; s < 12; s++) {
      const t = s / 12, u = 1 - t;
      samples.push([u * u * u * x0 + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * x1, u * u * u * y0 + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * y1]);
    }
  }
  samples.push(pts[n - 1]);
  return { line: line, area: line + ' L' + width.toFixed(2) + ',' + height.toFixed(2) + ' L0,' + height.toFixed(2) + ' Z', samples: samples };
}
function sampleAt(samples, x) {
  let i = 1;
  while (i < samples.length - 1 && samples[i][0] < x) i++;
  const a = samples[i - 1], b = samples[i], t = b[0] === a[0] ? 0 : clamp((x - a[0]) / (b[0] - a[0]), 0, 1);
  return a[1] + (b[1] - a[1]) * t;
}

function analyticsVisual() {
  const chart = el('div', 'magic-bento__chart');
  const fig = el('div', 'magic-bento__figure');
  const val = el('span', 'magic-bento__figure-value', CHART[CHART.length - 1] + ' done');
  const note = el('span', 'magic-bento__figure-note', T('v_this_sprint', 'this sprint'));
  fig.append(val, note);
  const plot = el('div', 'magic-bento__plot');
  const scrub = el('span', 'magic-bento__scrub');
  const dot = el('span', 'magic-bento__scrub-dot');
  scrub.append(dot);
  plot.append(scrub);
  chart.append(fig, plot);

  let shape = null;
  const draw = () => {
    const w = plot.clientWidth, h = plot.clientHeight;
    if (w < 4 || h < 4) return;
    shape = curve(CHART, w, h);
    let svg = plot.querySelector('svg');
    if (!svg) { svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('aria-hidden', 'true'); plot.insertBefore(svg, scrub); }
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.innerHTML = '<path class="magic-bento__chart-area" d="' + shape.area + '"/><path class="magic-bento__chart-line" d="' + shape.line + '" pathLength="1"/>';
  };
  new ResizeObserver(draw).observe(plot);

  const move = e => {
    if (!shape) return;
    const r = plot.getBoundingClientRect();
    const x = clamp(e.clientX - r.left, 0, r.width), y = sampleAt(shape.samples, x);
    const pos = (x / Math.max(1, r.width)) * (CHART.length - 1), i = Math.floor(pos), nx = Math.min(CHART.length - 1, i + 1);
    const v = CHART[i] + (CHART[nx] - CHART[i]) * (pos - i);
    chart.dataset.scrub = '';
    scrub.style.transform = 'translateX(' + x.toFixed(1) + 'px)';
    dot.style.transform = 'translateY(' + y.toFixed(1) + 'px)';
    val.textContent = Math.round(v) + ' done';
    note.textContent = 'Day ' + (Math.round(pos) + 1);
  };
  const rest = () => { delete chart.dataset.scrub; val.textContent = CHART[CHART.length - 1] + ' done'; note.textContent = T('v_this_sprint', 'this sprint'); };
  chart.addEventListener('pointermove', move);
  chart.addEventListener('pointerdown', move);
  chart.addEventListener('pointerleave', rest);
  return chart;
}

function barsVisual() {
  const BARS = [42, 58, 49, 71, 63, 88, 76], DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const wrap = el('div', 'magic-bento__bars');
  wrap.append(el('div', 'magic-bento__figure', '<span class="magic-bento__figure-value">38 tasks</span><span class="magic-bento__figure-note">' + T('v_per_week', 'per week') + '</span>'));
  const plot = el('div', 'magic-bento__bars-plot');
  BARS.forEach((h, i) => {
    const bar = el('span', 'magic-bento__bar');
    if (h === 88) bar.dataset.peak = '';
    bar.title = DAYS[i];
    css(bar, { '--h': h / 100, '--i': i });
    plot.append(bar);
  });
  wrap.append(plot);
  return wrap;
}

function collabVisual() {
  const w = el('div', 'magic-bento__collab magic-bento__well');
  w.append(el('span', 'magic-bento__doc-title', 'Rate-limit login endpoint'));
  const lines = el('div', 'magic-bento__lines');
  [['92%'], ['78%'], ['86%'], ['44%'], ['88%', 'gap'], ['70%', 'sel'], ['82%']].forEach(l => {
    const line = el('span', 'magic-bento__line' + (l[1] === 'gap' ? ' magic-bento__line--gap' : ''));
    css(line, { '--w': l[0] });
    if (l[1] === 'sel') { const s = el('span', 'magic-bento__selection', '<span class="magic-bento__caret"></span>'); css(s, { '--from': '18%', '--span': '58%' }); line.append(s); }
    lines.append(line);
  });
  w.append(lines);
  [['primary', '58%', '52%', 0, 'a', 'Maya'], ['secondary', '30%', '24%', 1, 'b', 'Leo']].forEach(c => {
    const cur = el('span', 'magic-bento__cursor magic-bento__cursor--' + c[0], ICON.arrow + '<span class="magic-bento__cursor-name">' + c[5] + '</span>');
    css(cur, { '--x': c[1], '--y': c[2], '--i': c[3], '--path': 'magic-bento-path-' + c[4] });
    w.append(cur);
  });
  return w;
}

function flowVisual() {
  const STEPS = [['To do', '1d'], ['In progress', '2d'], ['In review', '6h'], ['Done', '—']];
  const flow = el('div', 'magic-bento__flow');
  css(flow, { '--n': STEPS.length });
  flow.append(el('div', 'magic-bento__flow-trigger magic-bento__tile',
    '<span class="magic-bento__flow-glyph">' + ICON.move + '</span><span class="magic-bento__flow-copy"><span class="magic-bento__flow-name">' + T('v_moved', 'Moved to In review') + '</span><span class="magic-bento__flow-meta">Maya · OAuth sign-in gateway</span></span>'));
  const ol = el('ol', 'magic-bento__steps magic-bento__well', '<span class="magic-bento__rail" aria-hidden="true"><span class="magic-bento__rail-fill"></span></span>');
  STEPS.forEach((s, i) => {
    const li = el('li', 'magic-bento__step', '<span class="magic-bento__status"><span class="magic-bento__pending"></span><span class="magic-bento__spinner"></span><span class="magic-bento__done">' + ICON.tick + '</span></span>' + s[0] + '<span class="magic-bento__step-time">' + s[1] + '</span>');
    css(li, { '--i': i });
    ol.append(li);
  });
  flow.append(ol);
  return flow;
}

function hubVisual() {
  const hub = el('div', 'magic-bento__hub');
  const NODES = [['SA', '17%', '24%'], ['MH', '83%', '24%'], ['LK', '17%', '78%'], ['WA', '83%', '78%']];
  hub.append(el('svg', 'magic-bento__hub-links'));
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'magic-bento__hub-links'); svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = NODES.map(n => '<line x1="' + parseFloat(n[1]) + '" y1="' + parseFloat(n[2]) + '" x2="50" y2="51" pathLength="1"/>').join('');
  hub.replaceChild(svg, hub.firstChild);
  NODES.forEach((n, i) => { const p = el('span', 'magic-bento__packet'); css(p, { '--x': n[1], '--y': n[2], '--i': i }); hub.append(p); });
  NODES.forEach((n, i) => { const nd = el('span', 'magic-bento__hub-node magic-bento__tile', '<span class="magic-bento__node-initials">' + n[0] + '</span>'); css(nd, { '--x': n[1], '--y': n[2], '--s': '28px', '--i': i + 1 }); hub.append(nd); });
  const core = el('span', 'magic-bento__hub-node magic-bento__tile', ICON.spark);
  css(core, { '--x': '50%', '--y': '51%', '--s': '34px', '--i': 0 });
  hub.append(core);
  return hub;
}

function switchVisual() {
  const wrap = el('div', 'magic-bento__shield');
  [[ICON.users, 'v_sw1', 'Assigned projects only'], [ICON.lock, 'v_sw2', 'AI asks before it acts']].forEach((s, i) => {
    const row = el('div', 'magic-bento__setting magic-bento__tile', s[0] + '<span class="magic-bento__setting-label">' + T(s[1], s[2]) + '</span><span class="magic-bento__switch"></span>');
    css(row.lastChild, { '--i': i });
    wrap.append(row);
  });
  return wrap;
}

const ITEMS = [
  { tk: 'b1_t', t: 'Live project progress', dk: 'b1_d', d: 'See how far every project is at a glance.', visual: analyticsVisual },
  { tk: 'b2_t', t: 'Workload at a glance', dk: 'b2_d', d: 'Spot overloaded teammates before deadlines slip.', visual: barsVisual },
  { tk: 'b3_t', t: 'Work on tasks together', dk: 'b3_d', d: 'Assignees, comments and due dates in one place.', visual: collabVisual, colSpan: 2, rowSpan: 2 },
  { tk: 'b4_t', t: 'A lifecycle that enforces process', dk: 'b4_d', d: 'Every status change follows the rules. Reopening needs a reason.', visual: flowVisual, colSpan: 2, rowSpan: 2 },
  { tk: 'b5_t', t: 'Invite your whole team', dk: 'b5_d', d: 'Owners, Admins and Members, each with the right access.', visual: hubVisual },
  { tk: 'b6_t', t: 'Private by default', dk: 'b6_d', d: 'Guarantees that hold on every request.', visual: switchVisual }
];

/* ---------- Engine ---------- */
const REPLAY = new Set(['magic-bento-draw', 'magic-bento-fade', 'magic-bento-grow', 'magic-bento-pop', 'magic-bento-select', 'magic-bento-wait', 'magic-bento-run', 'magic-bento-check', 'magic-bento-rail', 'magic-bento-switch-track', 'magic-bento-switch-knob']);
const FLOW = new Set(['magic-bento-wait', 'magic-bento-run', 'magic-bento-check', 'magic-bento-rail', 'magic-bento-fade']);
const finite = a => { const t = a.effect && a.effect.getTiming && a.effect.getTiming(); return t ? t.iterations !== Infinity : false; };

/** Builds the grid inside `root`. Returns a function that removes everything it added (listeners, observers, timers, the cards). */
export function initBento(root, { theme, texts }) {
  T = (key, fallback) => (texts && texts[key]) || fallback;
  const offs = [], timers = [];
  const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); offs.push(() => target.removeEventListener(type, fn, opts)); };
  const cfg = CONFIG;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = !reduced;
  root.className = 'magic-bento';
  root.dataset.theme = theme || 'light';
  root.dataset.autohide = '';
  if (motion) { root.dataset.motion = ''; if (cfg.intro) root.dataset.intro = ''; }
  root.style.gap = cfg.gap + 'px';

  const cells = [], cards = [];
  ITEMS.forEach(item => {
    const cell = el('div', 'magic-bento__cell');
    const card = el('div', 'magic-bento__card');
    const light = el('span', 'magic-bento__light');
    const content = el('div', 'magic-bento__content');
    const visual = el('div', 'magic-bento__visual');
    visual.setAttribute('aria-hidden', 'true');
    visual.append(item.visual());
    const text = el('div', 'magic-bento__text');
    text.append(el('h3', 'magic-bento__title', ''), el('p', 'magic-bento__description', ''));
    text.firstChild.textContent = T(item.tk, item.t);
    text.lastChild.textContent = T(item.dk, item.d);
    content.append(visual, text);
    card.append(light, content, el('span', 'magic-bento__rim'), el('span', 'magic-bento__border'));
    cell.append(card);
    cell._item = item;
    root.append(cell);
    cells.push(cell); cards.push(card);
  });

  let cols = cfg.columns, rects = [], bounds = null, dirty = true, raf = 0, last = 0, visible = true, entered = !(motion && cfg.intro);
  const pointer = { x: -1e5, y: -1e5, inside: false, down: -1 };
  const lightS = { x: -1e5, y: -1e5, near: 0, ready: false };
  const wave = { x: 0, y: 0, t: -1, duration: 1.1, reach: 800 };
  const states = [], lastFlow = [];
  const stateFor = i => states[i] || (states[i] = { hot: 0, press: 1, vpress: 0, active: false, w: {} });
  const write = (node, st, name, v) => { if (st.w[name] !== v) { st.w[name] = v; node.style.setProperty(name, v); } };

  const layout = () => {
    const width = root.clientWidth, g = cfg.gap, cell = n => (width - g * (n - 1)) / n;
    cols = cell(cfg.columns) >= MIN_CELL ? cfg.columns : (cell(2) >= MIN_PAIR ? 2 : 1);
    root.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';
    root.style.gridAutoRows = cols === 1 ? 'minmax(' + cfg.rowHeight + 'px, auto)' : cfg.rowHeight + 'px';
    cells.forEach(c => { c.style.gridColumn = 'span ' + Math.min(cols, c._item.colSpan || 1); c.style.gridRow = 'span ' + (c._item.rowSpan || 1); });
    dirty = true;
  };
  const measure = () => { dirty = false; bounds = root.getBoundingClientRect(); rects = cells.map(c => c.getBoundingClientRect()); };

  const replay = (card, filter) => {
    if (!motion || !card.getAnimations) return;
    card.getAnimations({ subtree: true }).forEach(a => {
      if (!filter.has(a.animationName || '') || !finite(a)) return;
      const t = a.effect instanceof KeyframeEffect ? a.effect.target : null;
      if (t instanceof Element && t.classList.contains('magic-bento__cursor')) return;
      a.currentTime = 0; a.play();
    });
  };
  const startWave = (x, y, d) => {
    if (!motion || !bounds) return;
    wave.x = x; wave.y = y; wave.t = 0; wave.duration = d;
    wave.reach = Math.max(Math.hypot(x - bounds.left, y - bounds.top), Math.hypot(x - bounds.right, y - bounds.top), Math.hypot(x - bounds.left, y - bounds.bottom), Math.hypot(x - bounds.right, y - bounds.bottom)) + 140;
  };

  const frame = now => {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (dirty) measure();
    let busy = false;
    const margin = cfg.spotlightRadius * 0.5;
    const near = pointer.inside && bounds && pointer.x > bounds.left - margin && pointer.x < bounds.right + margin && pointer.y > bounds.top - margin && pointer.y < bounds.bottom + margin ? 1 : 0;
    if (!lightS.ready && near) { lightS.x = pointer.x; lightS.y = pointer.y; lightS.ready = true; }
    const follow = 1 - Math.exp(-dt / 0.05);
    lightS.x += (pointer.x - lightS.x) * follow; lightS.y += (pointer.y - lightS.y) * follow;
    lightS.near += (near - lightS.near) * (1 - Math.exp(-dt / (near > lightS.near ? 0.12 : 0.4)));
    if (Math.abs(near - lightS.near) < 0.002) lightS.near = near; else busy = true;
    if (Math.abs(pointer.x - lightS.x) + Math.abs(pointer.y - lightS.y) > 0.3) busy = true;

    let wr = 0, wa = 0;
    if (wave.t >= 0) {
      wave.t += dt;
      const p = Math.min(1, wave.t / wave.duration);
      wr = wave.reach * (1 - Math.pow(1 - p, 2.2)); wa = Math.pow(1 - p, 1.3);
      if (p >= 1) { wave.t = -1; wa = 0; } else busy = true;
    }

    cards.forEach((card, i) => {
      const r = rects[i]; if (!r) return;
      const st = stateFor(i);
      const px = pointer.x - r.left, py = pointer.y - r.top;
      const inside = pointer.inside && entered && px >= 0 && py >= 0 && px <= r.width && py <= r.height;
      if (inside !== st.active) {
        st.active = inside;
        if (inside) {
          card.dataset.active = '';
          if (now - (lastFlow[i] || -1e9) > 3200 && card.querySelector('.magic-bento__steps')) { lastFlow[i] = now; replay(card, FLOW); }
        } else delete card.dataset.active;
      }
      const hotT = inside && cfg.enableSpotlight ? 1 : 0;
      st.hot += (hotT - st.hot) * (1 - Math.exp(-dt / (hotT > st.hot ? 0.14 : 0.32)));
      if (Math.abs(hotT - st.hot) < 0.002) st.hot = hotT; else busy = true;
      const pressT = pointer.down === i && cfg.clickEffect && motion ? 0.985 : 1;
      const steps = Math.max(1, Math.ceil(dt / (1 / 240))), h = dt / steps;
      for (let s = 0; s < steps; s++) { st.vpress += (420 * (pressT - st.press) - 28 * st.vpress) * h; st.press += st.vpress * h; }
      if (Math.abs(pressT - st.press) < 0.0002 && Math.abs(st.vpress) < 0.001) { st.press = pressT; st.vpress = 0; } else busy = true;

      write(card, st, '--mb-x', (lightS.x - r.left).toFixed(1) + 'px');
      write(card, st, '--mb-y', (lightS.y - r.top).toFixed(1) + 'px');
      write(card, st, '--mb-near', (cfg.enableBorderGlow ? lightS.near : 0).toFixed(3));
      write(card, st, '--mb-hot', st.hot.toFixed(3));
      write(card, st, '--mb-press', st.press.toFixed(4));
      write(card, st, '--mb-wx', (wave.x - r.left).toFixed(1) + 'px');
      write(card, st, '--mb-wy', (wave.y - r.top).toFixed(1) + 'px');
      write(card, st, '--mb-wr', wr.toFixed(1) + 'px');
      write(card, st, '--mb-wa', wa.toFixed(3));
    });
    if (busy && visible) raf = requestAnimationFrame(frame);
  };
  const wake = () => { if (raf || !visible) return; last = performance.now(); raf = requestAnimationFrame(frame); };
  const idx = t => { const c = t instanceof Element ? t.closest('.magic-bento__card') : null; return c ? cards.indexOf(c) : -1; };

  on(window, 'pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.inside = true; wake(); }, { passive: true });
  on(window, 'pointerdown', e => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.inside = true; pointer.down = idx(e.target); wake(); }, { passive: true });
  const release = () => { if (pointer.down < 0) return; pointer.down = -1; wake(); };
  on(window, 'pointerup', release, { passive: true });
  on(window, 'pointercancel', release, { passive: true });
  on(window, 'scroll', () => { dirty = true; wake(); }, { passive: true, capture: true });
  on(window, 'resize', () => { dirty = true; wake(); }, { passive: true });
  on(document, 'pointerout', e => { if (e.relatedTarget) return; pointer.inside = false; pointer.down = -1; wake(); });
  on(root, 'click', e => {
    const i = idx(e.target); if (i < 0 || !cfg.clickEffect) return;
    if (dirty) measure();
    const r = cards[i].getBoundingClientRect();
    startWave(e.detail === 0 ? r.left + r.width / 2 : e.clientX, e.detail === 0 ? r.top + r.height / 2 : e.clientY, 1.1);
    replay(cards[i], REPLAY); lastFlow[i] = performance.now(); wake();
  });

  const resize = new ResizeObserver(() => { layout(); wake(); });
  resize.observe(root);
  offs.push(() => resize.disconnect());
  layout();

  const enter = () => {
    entered = true;
    cells.forEach((c, i) => { c.style.setProperty('--mb-delay', (i * STAGGER) + 'ms'); c.dataset.state = 'in'; });
    if (dirty) measure();
    timers.push(setTimeout(() => { if (bounds) startWave(bounds.left, bounds.top, 1.7); wake(); }, 260));
    timers.push(setTimeout(() => cells.forEach(c => c.style.setProperty('--mb-delay', '0ms')), cells.length * STAGGER + 2600));
    wake();
  };
  if (motion && cfg.intro && 'IntersectionObserver' in window) {
    const gate = new IntersectionObserver((en, ob) => { if (en.some(x => x.isIntersecting)) { ob.disconnect(); enter(); } }, { threshold: 0.15 });
    gate.observe(root);
    offs.push(() => gate.disconnect());
  } else {
    cells.forEach(c => { c.style.setProperty('--mb-delay', '0ms'); c.dataset.state = 'in'; });
    if (motion) root.getAnimations({ subtree: true }).forEach(a => { if (REPLAY.has(a.animationName || '') && finite(a)) a.finish(); });
  }
  const seen = new IntersectionObserver(en => { visible = en.some(x => x.isIntersecting); if (visible) { dirty = true; wake(); } });
  seen.observe(root);
  offs.push(() => seen.disconnect());

  return () => {
    offs.forEach(off => off());
    timers.forEach(clearTimeout);
    cancelAnimationFrame(raf);
    visible = false;
    root.replaceChildren();
    root.removeAttribute('class'); root.removeAttribute('style');
    ['theme', 'autohide', 'motion', 'intro'].forEach(k => delete root.dataset[k]);
  };
}

