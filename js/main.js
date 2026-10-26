// Runenrucksack – Oberfläche: Bildschirme, Raster, Ziehen und Drehen, Laden, Kampfanzeige.
import {
  CFG, income, baseHp, sellValue, newRun, reroll, finishBattle, makeEnemy,
  canPlace, overlapping, findSpot, sizeOf, areaDims,
} from './logic.js';
import { Battle, makeFighter, runToEnd } from './battle.js';

const SAVE_KEY = 'runenrucksack.lauf.v1';
const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 });

let ITEMS = [], DEFS = {}, RAR = {}, ENEMIES = [];
let run = null;
let selected = null;   // { src: 'bag'|'store'|'shop', uid?, slot? }
let drag = null;
let cell = 96, mini = 56, bcell = 100;

// ---------- Start ----------

async function boot() {
  const [itemData, enemyData] = await Promise.all([
    fetch('items.json').then((r) => r.json()),
    fetch('enemies.json').then((r) => r.json()),
  ]);
  ITEMS = itemData.items;
  RAR = itemData.seltenheiten;
  for (const d of ITEMS) DEFS[d.id] = d;
  ENEMIES = enemyData.gegner;

  run = load();
  $('btn-continue').hidden = !run;
  $('btn-new').classList.toggle('primary', !run);
  $('btn-continue').onclick = () => { showScreen('game'); render(); };
  $('btn-new').onclick = startNewRun;
  $('btn-reroll').onclick = onReroll;
  $('btn-fight').onclick = onFight;
  $('btn-menu').onclick = openMenu;

  document.addEventListener('pointerdown', onDown, { passive: false });
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onCancel);
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  layout();
  window.addEventListener('resize', layout);
  registerServiceWorker();
}

function startNewRun() {
  run = newRun(ITEMS);
  selected = null;
  showScreen('game');
  render();
}

function showScreen(name) {
  for (const id of ['start', 'game', 'battle']) $(id).hidden = id !== name;
}

// ---------- Speichern (Komfort, nur in diesem Browser) ----------

function save() {
  try {
    if (run && !run.over) localStorage.setItem(SAVE_KEY, JSON.stringify(run));
    else localStorage.removeItem(SAVE_KEY);
  } catch { /* privater Modus o. ä. */ }
}

function load() {
  try {
    const r = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!r || r.version !== 1 || r.over) return null;
    // Items, die es in items.json nicht mehr gibt, fallen weg.
    r.items = r.items.filter((p) => DEFS[p.id]);
    r.shop = r.shop.map((s) => (s && DEFS[s.id] ? s : null));
    return r;
  } catch { return null; }
}

// ---------- Größen ----------

function layout() {
  const w = window.innerWidth, h = window.innerHeight;
  const byW = (w - 380) / 8;
  const byH = (h - 280) / 4.1;
  cell = Math.max(56, Math.min(130, Math.floor(Math.min(byW, byH))));
  mini = Math.round(cell * 0.55);
  bcell = Math.max(48, Math.min(130, Math.floor(Math.min((w - 260) / 8.4, (h - 300) / 3))));
  document.documentElement.style.setProperty('--cell', cell + 'px');
  document.documentElement.style.setProperty('--mini', mini + 'px');
  if (!$('game').hidden) render();
}

// ---------- Hilfsfunktionen ----------

const placedOf = (uid) => run.items.find((p) => p.uid === uid);
const itemsIn = (area, exceptUid) => run.items.filter((p) => p.area === area && p.uid !== exceptUid);
const defOf = (ref) => (ref.src === 'shop' ? DEFS[run.shop[ref.slot].id] : DEFS[placedOf(ref.uid).id]);
const sameRef = (a, b) => a && b && a.src === b.src && a.uid === b.uid && a.slot === b.slot;
const fullName = (d) => (d.artikel ? `${d.artikel} ${d.name}` : d.name);

function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 1800);
}

function bump(id) {
  const el = $(id);
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

function itemEl(def, rot, size) {
  const s = sizeOf(def, rot);
  const el = document.createElement('div');
  el.className = `item r-${def.seltenheit}` + (def.abklingzeit > 0 ? '' : ' passive');
  el.style.setProperty('--rar', RAR[def.seltenheit]?.farbe || '#9a8f7a');
  el.style.width = s.w * size - 6 + 'px';
  el.style.height = s.h * size - 6 + 'px';

  const cd = document.createElement('div');
  cd.className = 'cd';
  el.append(cd);

  const em = document.createElement('span');
  em.className = 'emoji';
  em.textContent = def.emoji;
  em.style.fontSize = Math.round(Math.min(s.w, s.h) * size * (s.w * s.h === 1 ? 0.5 : 0.58)) + 'px';
  if (rot && def.w !== def.h) em.style.transform = 'rotate(90deg)';
  el.append(em);

  if (def.abzeichen) {
    const b = document.createElement('span');
    b.className = 'badge';
    b.textContent = def.abzeichen;
    b.style.fontSize = Math.round(size * 0.26) + 'px';
    el.append(b);
  }
  if (size >= 70) {
    const l = document.createElement('span');
    l.className = 'label';
    l.textContent = def.name;
    el.append(l);
  }
  return el;
}

function buildGrid(el, cols, rows, size) {
  el.innerHTML = '';
  el.style.setProperty('--cols', cols);
  el.style.setProperty('--rows', rows);
  el.style.setProperty('--cell', size + 'px');
  for (let i = 0; i < cols * rows; i++) {
    const c = document.createElement('div');
    c.className = 'cell';
    el.append(c);
  }
}

// ---------- Darstellung Tag ----------

function render() {
  if (!run) return;
  renderTop();
  renderGrid('bag');
  renderGrid('store');
  renderShop();
  renderInfo();
  save();
}

function renderTop() {
  $('stat-day').textContent = `☀️ Tag ${run.day}`;
  $('stat-hearts').textContent = '❤️'.repeat(run.hearts) + '🤍'.repeat(CFG.hearts - run.hearts);
  $('stat-wins').textContent = `🏆 ${run.wins} / ${CFG.winsToWin}`;
  $('stat-gold').textContent = `🪙 ${run.gold}`;
  $('btn-reroll').disabled = run.gold < CFG.rerollCost;
}

function renderGrid(area) {
  const el = $('grid-' + area);
  const { cols, rows } = areaDims(area);
  buildGrid(el, cols, rows, cell);
  for (const p of itemsIn(area)) {
    const def = DEFS[p.id];
    const it = itemEl(def, p.rot, cell);
    it.style.left = p.x * cell + 'px';
    it.style.top = p.y * cell + 'px';
    it.dataset.src = area;
    it.dataset.uid = p.uid;
    if (sameRef(selected, { src: area, uid: p.uid })) it.classList.add('selected');
    el.append(it);
  }
}

function renderShop() {
  const box = $('shop-slots');
  box.innerHTML = '';
  // Item-Größe im Laden an den verfügbaren Platz anpassen.
  const slotW = (box.clientWidth - (CFG.shopSlots - 1) * 10) / CFG.shopSlots;
  mini = Math.max(36, Math.floor(Math.min((slotW - 16) / 2, (box.clientHeight - 48) / 2, cell * 0.85)));
  document.documentElement.style.setProperty('--mini', mini + 'px');
  run.shop.forEach((s, i) => {
    const slot = document.createElement('div');
    slot.className = 'slot';
    if (!s) {
      slot.classList.add('empty');
      slot.textContent = 'verkauft';
      box.append(slot);
      return;
    }
    const def = DEFS[s.id];
    const holder = document.createElement('div');
    holder.className = 'holder';
    const it = itemEl(def, 0, mini);
    it.dataset.src = 'shop';
    it.dataset.slot = i;
    if (sameRef(selected, { src: 'shop', slot: i })) it.classList.add('selected');
    holder.append(it);

    const price = document.createElement('div');
    price.className = 'price-tag' + (run.gold < def.preis ? ' cant' : '');
    price.textContent = `${def.preis} 🪙`;

    const lock = document.createElement('button');
    lock.className = 'lock' + (s.locked ? ' on' : '');
    lock.textContent = s.locked ? '🔒' : '🔓';
    lock.setAttribute('aria-label', s.locked ? 'Reservierung aufheben' : 'Reservieren');
    lock.onclick = () => { s.locked = !s.locked; render(); };

    slot.append(holder, price, lock);
    box.append(slot);
  });
}

const STAT_ROWS = [
  ['abklingzeit', '⏱️ Abklingzeit', (v) => `${fmt(v)} s`],
  ['schaden', '⚔️ Schaden', fmt],
  ['block', '🛡️ Block', fmt],
  ['heilung', '💚 Heilung', fmt],
  ['gift', '🧪 Gift', (v) => `+${v} je Treffer`],
  ['brand', '🔥 Brand', (v) => `+${v} je Treffer`],
  ['kaelte', '❄️ Kälte', (v) => `${fmt(v)} s`],
  ['tempo', '💨 Tempo', (v) => `+${v} %`],
  ['leben', '❤️ Leben', (v) => `+${v}`],
  ['startblock', '🧱 Startblock', (v) => `+${v}`],
];

function renderInfo() {
  const box = $('info');
  box.innerHTML = '';
  if (selected && !refExists(selected)) selected = null;
  if (!selected) { renderSummary(box); return; }

  const def = defOf(selected);
  const s = sizeOf(def, 0);
  const rar = RAR[def.seltenheit] || {};
  const head = document.createElement('div');
  head.className = 'info-head';
  head.innerHTML = `
    <div class="info-emoji">${def.emoji}${def.abzeichen ? `<span class="badge">${def.abzeichen}</span>` : ''}</div>
    <div>
      <div class="info-name">${def.artikel ? `<span class="art">${def.artikel}</span> ` : ''}${def.name}</div>
      <div class="info-rar" style="color:${rar.farbe}">${rar.name || ''} · ${s.w}×${s.h}</div>
    </div>`;
  box.append(head);

  const ul = document.createElement('ul');
  ul.className = 'stats';
  for (const [key, label, f] of STAT_ROWS) {
    if (key === 'abklingzeit' && !def.abklingzeit) continue;
    if (!def[key]) continue;
    ul.insertAdjacentHTML('beforeend', `<li><span>${label}</span><b>${f(def[key])}</b></li>`);
  }
  box.append(ul);
  if (!def.abklingzeit) box.insertAdjacentHTML('beforeend', '<p class="muted">Passiv: wirkt den ganzen Kampf, solange es im Rucksack liegt.</p>');
  if (def.gift) box.insertAdjacentHTML('beforeend', '<p class="muted">Gift schadet dem Gegner jede Sekunde und geht durch Block.</p>');
  if (def.brand) box.insertAdjacentHTML('beforeend', '<p class="muted">Brand schadet jede Sekunde und wird dabei schwächer.</p>');
  if (def.kaelte) box.insertAdjacentHTML('beforeend', '<p class="muted">Kälte macht die Items des Gegners langsamer.</p>');

  const actions = document.createElement('div');
  actions.className = 'actions';
  const btn = (text, fn, cls = '') => {
    const b = document.createElement('button');
    b.className = 'btn ' + cls;
    b.innerHTML = text;
    b.onclick = fn;
    actions.append(b);
    return b;
  };
  if (selected.src === 'shop') {
    const slot = selected.slot;
    btn(`Kaufen <span class="price">${def.preis} 🪙</span>`, () => buyAuto(slot), 'primary').disabled = run.gold < def.preis;
  } else {
    const uid = selected.uid;
    if (def.w !== def.h) btn('⟳ Drehen', () => rotateInPlace(uid));
    if (selected.src === 'bag') btn('📦 Ins Lager', () => moveAuto(uid, 'store'));
    else btn('🎒 In den Rucksack', () => moveAuto(uid, 'bag'));
    btn(`Verkaufen <span class="price">+${sellValue(def)} 🪙</span>`, () => sell(uid), 'danger');
  }
  box.append(actions);
}

function refExists(ref) {
  if (ref.src === 'shop') return !!run.shop[ref.slot];
  const p = placedOf(ref.uid);
  return !!p && p.area === ref.src;
}

function renderSummary(box) {
  const bag = itemsIn('bag').map((p) => DEFS[p.id]);
  let leben = baseHp(run.day), startblock = 0, tempo = 0;
  const perSec = { schaden: 0, block: 0, heilung: 0, gift: 0, brand: 0 };
  for (const d of bag) {
    leben += d.leben || 0;
    startblock += d.startblock || 0;
    tempo += d.tempo || 0;
  }
  for (const d of bag) {
    if (!d.abklingzeit) continue;
    for (const k in perSec) perSec[k] += ((d[k] || 0) / d.abklingzeit) * (1 + tempo / 100);
  }
  const rows = [
    ['❤️ Leben', leben],
    ['🧱 Startblock', startblock],
    ['💨 Tempo', `+${tempo} %`],
    ['⚔️ Schaden pro s', fmt(perSec.schaden)],
    ['🛡️ Block pro s', fmt(perSec.block)],
    ['💚 Heilung pro s', fmt(perSec.heilung)],
  ];
  if (perSec.gift) rows.push(['🧪 Gift pro s', fmt(perSec.gift)]);
  if (perSec.brand) rows.push(['🔥 Brand pro s', fmt(perSec.brand)]);

  box.innerHTML = `
    <h2>Dein Rucksack</h2>
    <ul class="stats">${rows.map(([a, b]) => `<li><span>${a}</span><b>${b}</b></li>`).join('')}</ul>
    ${run.day % 5 === 0 ? '<p class="muted"><b>Heute Nacht wartet ein Anführer der Orks!</b></p>' : ''}
    <h3>So geht's</h3>
    <p class="muted">Ziehe Items aus dem Laden in den Rucksack. Tippe ein Item an für Infos, tippe nochmal zum Drehen. Beim Ziehen dreht ein zweiter Finger das Item.</p>
    <p class="muted">Morgen gibt es ${income(run.day + 1)} 🪙. Mit 🔓 reservierst du ein Item im Laden.</p>`;
}

// ---------- Aktionen ----------

function onReroll() {
  if (!reroll(run, ITEMS)) { toast('Zu wenig Gold'); return; }
  if (selected?.src === 'shop') selected = null;
  bump('stat-gold');
  render();
}

function buyAuto(slot) {
  const def = DEFS[run.shop[slot].id];
  if (run.gold < def.preis) { toast('Zu wenig Gold'); return; }
  for (const area of ['bag', 'store']) {
    const { cols, rows } = areaDims(area);
    const spot = findSpot(itemsIn(area), DEFS, def, cols, rows);
    if (spot) {
      buy(slot, area, spot);
      if (area === 'store') toast('Rucksack voll – ins Lager gelegt');
      return;
    }
  }
  toast('Kein Platz mehr – verkaufe etwas');
}

function buy(slot, area, spot) {
  const def = DEFS[run.shop[slot].id];
  run.gold -= def.preis;
  run.shop[slot] = null;
  const uid = run.nextUid++;
  run.items.push({ uid, id: def.id, area, ...spot });
  selected = { src: area, uid };
  bump('stat-gold');
  render();
}

function sell(uid) {
  const p = placedOf(uid);
  const def = DEFS[p.id];
  run.items = run.items.filter((i) => i !== p);
  run.gold += sellValue(def);
  selected = null;
  toast(`${fullName(def)} verkauft: +${sellValue(def)} 🪙`);
  bump('stat-gold');
  render();
}

function moveAuto(uid, area) {
  const p = placedOf(uid);
  const { cols, rows } = areaDims(area);
  const spot = findSpot(itemsIn(area), DEFS, DEFS[p.id], cols, rows);
  if (!spot) { toast(area === 'bag' ? 'Kein Platz im Rucksack' : 'Kein Platz im Lager'); return; }
  Object.assign(p, { area, ...spot });
  selected = { src: area, uid };
  render();
}

function rotateInPlace(uid) {
  const p = placedOf(uid);
  const def = DEFS[p.id];
  if (def.w === def.h) return;
  const { cols, rows } = areaDims(p.area);
  const rot = p.rot ? 0 : 1;
  const others = itemsIn(p.area, uid);
  for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [-1, -1], [1, 0], [0, 1]]) {
    if (canPlace(others, DEFS, def, p.x + dx, p.y + dy, rot, cols, rows)) {
      Object.assign(p, { x: p.x + dx, y: p.y + dy, rot });
      render();
      return;
    }
  }
  toast('Kein Platz zum Drehen');
  const el = document.querySelector(`.item[data-uid="${uid}"]`);
  el?.classList.add('shake');
}

function onFight() {
  if (!itemsIn('bag').length) {
    modal(`
      <div class="big-emoji">🎒</div>
      <h2>Dein Rucksack ist leer</h2>
      <p>Ohne Items im Rucksack kannst du nicht kämpfen. Items im Lager wirken nicht.</p>
      <div class="row"><button class="btn primary" data-act="close">Zurück</button></div>`);
    return;
  }
  startNight();
}

function openMenu() {
  modal(`
    <div class="big-emoji">🎒</div>
    <h2>Menü</h2>
    <p>Tag ${run.day} · ${run.wins} Siege · ${run.hearts} Herzen</p>
    <div class="row">
      <button class="btn primary" data-act="close">Weiterspielen</button>
      <button class="btn danger" data-act="new">Neuer Lauf</button>
    </div>`, { new: () => confirmNew() });
}

function confirmNew() {
  modal(`
    <h2>Wirklich neu anfangen?</h2>
    <p>Der laufende Lauf geht verloren.</p>
    <div class="row">
      <button class="btn" data-act="close">Abbrechen</button>
      <button class="btn danger" data-act="yes">Neuer Lauf</button>
    </div>`, { yes: startNewRun });
}

function modal(html, handlers = {}) {
  const m = $('modal');
  $('modal-card').innerHTML = html;
  m.hidden = false;
  $('modal-card').querySelectorAll('[data-act]').forEach((b) => {
    b.onclick = () => {
      m.hidden = true;
      const fn = handlers[b.dataset.act];
      if (fn) fn();
    };
  });
}

// ---------- Ziehen, Tippen, Drehen ----------

function onDown(e) {
  if (drag) {
    // Zweiter Finger während des Ziehens: drehen.
    if (e.pointerId !== drag.pointerId) {
      e.preventDefault();
      if (drag.started) rotateDrag();
    }
    return;
  }
  if ($('game').hidden || !$('modal').hidden) return;
  const el = e.target.closest('.item[data-src]');
  if (!el) {
    if (selected && e.target.closest('.board') && !e.target.closest('.info-panel, .btn, .lock')) {
      selected = null;
      render();
    }
    return;
  }
  e.preventDefault();
  const src = el.dataset.src;
  const ref = src === 'shop' ? { src, slot: +el.dataset.slot } : { src, uid: +el.dataset.uid };
  const r = el.getBoundingClientRect();
  drag = {
    pointerId: e.pointerId, ref, el,
    def: defOf(ref),
    rot: ref.uid ? placedOf(ref.uid).rot : 0,
    sx: e.clientX, sy: e.clientY, px: e.clientX, py: e.clientY,
    fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height,
    started: false, target: null, ghost: null, preview: null,
  };
}

function onMove(e) {
  if (!drag || e.pointerId !== drag.pointerId) return;
  e.preventDefault();
  drag.px = e.clientX;
  drag.py = e.clientY;
  if (!drag.started) {
    if (Math.hypot(drag.px - drag.sx, drag.py - drag.sy) < 8) return;
    startDrag();
  }
  positionGhost();
  updateTarget();
}

function onUp(e) {
  if (!drag || e.pointerId !== drag.pointerId) return;
  const d = drag;
  endDrag();
  if (!d.started) tap(d.ref);
  else drop(d);
}

function onCancel(e) {
  if (!drag || e.pointerId !== drag.pointerId) return;
  endDrag();
  render();
}

function startDrag() {
  drag.started = true;
  drag.el.classList.add('dragging');
  makeGhost();
  if (drag.ref.src !== 'shop') $('shop').classList.add('selling');
}

function makeGhost() {
  drag.ghost?.remove();
  drag.ghost = itemEl(drag.def, drag.rot, cell);
  drag.ghost.classList.add('ghost');
  document.body.append(drag.ghost);
}

function rotateDrag() {
  if (drag.def.w === drag.def.h) return;
  drag.rot = drag.rot ? 0 : 1;
  [drag.fx, drag.fy] = [drag.fy, drag.fx];
  makeGhost();
  positionGhost();
  updateTarget();
}

function ghostBox() {
  const s = sizeOf(drag.def, drag.rot);
  const gw = s.w * cell - 6, gh = s.h * cell - 6;
  return { s, left: drag.px - drag.fx * gw, top: drag.py - drag.fy * gh };
}

function positionGhost() {
  const { left, top } = ghostBox();
  drag.ghost.style.left = left + 'px';
  drag.ghost.style.top = top + 'px';
}

function updateTarget() {
  drag.preview?.remove();
  drag.preview = null;
  drag.target = null;
  const shop = $('shop');
  shop.classList.remove('hot');

  const { s, left, top } = ghostBox();
  for (const area of ['bag', 'store']) {
    const g = $('grid-' + area);
    const r = g.getBoundingClientRect();
    const ox = r.left + 3, oy = r.top + 3; // innerhalb des Rahmens
    const cx = left - 3 + (s.w * cell) / 2, cy = top - 3 + (s.h * cell) / 2;
    if (cx < r.left - cell / 2 || cx > r.right + cell / 2 || cy < r.top - cell / 2 || cy > r.bottom + cell / 2) continue;
    const { cols, rows } = areaDims(area);
    const x = Math.max(0, Math.min(cols - s.w, Math.round((left - 3 - ox) / cell)));
    const y = Math.max(0, Math.min(rows - s.h, Math.round((top - 3 - oy) / cell)));
    drag.target = { area, x, y, ...evaluate(area, x, y, s) };

    const pv = document.createElement('div');
    pv.className = 'preview ' + drag.target.status;
    pv.style.left = x * cell + 'px';
    pv.style.top = y * cell + 'px';
    pv.style.width = s.w * cell + 'px';
    pv.style.height = s.h * cell + 'px';
    g.append(pv);
    drag.preview = pv;
    return;
  }
  if (drag.ref.src !== 'shop') {
    const r = shop.getBoundingClientRect();
    if (drag.px >= r.left && drag.px <= r.right && drag.py >= r.top && drag.py <= r.bottom) {
      drag.target = { sell: true };
      shop.classList.add('hot');
    }
  }
}

// Darf das gezogene Item hier hin? Im Rucksack werden überdeckte Items ins Lager geschoben.
function evaluate(area, x, y, s) {
  const selfUid = drag.ref.uid;
  if (drag.ref.src === 'shop' && run.gold < drag.def.preis) return { status: 'bad', reason: 'gold' };
  const { cols, rows } = areaDims(area);
  const list = itemsIn(area, selfUid);
  if (canPlace(list, DEFS, drag.def, x, y, drag.rot, cols, rows)) return { status: 'ok' };
  if (area !== 'bag') return { status: 'bad' };

  const hit = overlapping(list, DEFS, x, y, s.w, s.h);
  const store = itemsIn('store', selfUid);
  const moves = [];
  for (const o of hit) {
    const spot = findSpot(store, DEFS, DEFS[o.id], CFG.storeCols, CFG.storeRows);
    if (!spot) return { status: 'bad' };
    store.push({ ...o, ...spot });
    moves.push({ uid: o.uid, ...spot });
  }
  return { status: 'push', moves };
}

function endDrag() {
  if (!drag) return;
  drag.ghost?.remove();
  drag.preview?.remove();
  drag.el.classList.remove('dragging');
  $('shop').classList.remove('selling', 'hot');
  drag = null;
}

function drop(d) {
  const t = d.target;
  if (!t) { render(); return; }
  if (t.sell) { sell(d.ref.uid); return; }
  if (t.status === 'bad') {
    if (t.reason === 'gold') toast('Zu wenig Gold');
    render();
    return;
  }
  for (const m of t.moves || []) Object.assign(placedOf(m.uid), { area: 'store', x: m.x, y: m.y });
  if (t.moves?.length) toast(t.moves.length === 1 ? '1 Item ins Lager geschoben' : `${t.moves.length} Items ins Lager geschoben`);
  const spot = { x: t.x, y: t.y, rot: d.rot };
  if (d.ref.src === 'shop') { buy(d.ref.slot, t.area, spot); return; }
  Object.assign(placedOf(d.ref.uid), { area: t.area, ...spot });
  selected = { src: t.area, uid: d.ref.uid };
  render();
}

function tap(ref) {
  if (sameRef(selected, ref) && ref.src !== 'shop') rotateInPlace(ref.uid);
  else { selected = ref; render(); }
}

// ---------- Nacht: Kampf ----------

let battle = null, enemy = null, speed = 1, rafId = 0, lastFrame = 0, itemEls = {};

function startNight() {
  selected = null;
  enemy = makeEnemy(run.day, ENEMIES, ITEMS, DEFS);
  const player = makeFighter('Dein Rucksack', itemsIn('bag'), DEFS, run.day);
  const foe = makeFighter(enemy.name, enemy.items, DEFS, run.day);
  battle = new Battle(player, foe);
  itemEls = { player: {}, enemy: {} };

  $('battle-title').textContent = `🌙 Nacht ${run.day}`;
  buildFighter('player', '🎒', 'Dein Rucksack', '', itemsIn('bag'));
  buildFighter('enemy', enemy.emoji, enemy.name, enemy.ruestung, enemy.items);
  updateBattleUi();
  setSpeed(speed);
  $('btn-start-battle').hidden = false;
  $('btn-start-battle').onclick = beginBattle;
  $('btn-skip').onclick = skipBattle;
  $('btn-skip').disabled = false;
  $('speed').onclick = (e) => { const b = e.target.closest('[data-speed]'); if (b) setSpeed(+b.dataset.speed); };
  showScreen('battle');
}

function buildFighter(side, emoji, name, armor, placed) {
  const box = $('fighter-' + side);
  box.innerHTML = `
    <div class="f-head">
      <div class="f-portrait">${emoji}</div>
      <div>
        <div class="f-name">${name}</div>
        ${armor ? `<div class="f-armor">Auf der Rüstung steht: <b>${armor}</b></div>` : '<div class="f-armor">Tag ' + run.day + '</div>'}
      </div>
    </div>
    <div class="hpbar"><div class="fill"></div><div class="text"></div></div>
    <div class="f-status"></div>
    <div class="grid"></div>`;
  const grid = box.querySelector('.grid');
  buildGrid(grid, CFG.bagCols, CFG.bagRows, bcell);
  for (const p of placed) {
    const el = itemEl(DEFS[p.id], p.rot, bcell);
    el.style.left = p.x * bcell + 'px';
    el.style.top = p.y * bcell + 'px';
    el.style.cursor = 'default';
    grid.append(el);
    itemEls[side][p.uid] = el;
  }
}

function setSpeed(s) {
  speed = s;
  document.querySelectorAll('#speed [data-speed]').forEach((b) => b.classList.toggle('active', +b.dataset.speed === s));
}

function beginBattle() {
  $('btn-start-battle').hidden = true;
  lastFrame = performance.now();
  rafId = requestAnimationFrame(frame);
}

function frame(now) {
  const dt = Math.min(0.1, (now - lastFrame) / 1000) * speed;
  lastFrame = now;
  const events = battle.advance(dt);
  for (const ev of events) showEvent(ev);
  updateBattleUi();
  if (battle.result) {
    $('btn-skip').disabled = true;
    setTimeout(battleOver, 700);
    return;
  }
  rafId = requestAnimationFrame(frame);
}

function skipBattle() {
  cancelAnimationFrame(rafId);
  $('btn-start-battle').hidden = true;
  $('btn-skip').disabled = true;
  runToEnd(battle);
  updateBattleUi();
  battleOver();
}

function updateBattleUi() {
  $('battle-time').textContent = `⏳ ${fmt(Math.floor(battle.time * 10) / 10)} s`;
  for (const side of ['player', 'enemy']) {
    const f = battle.sides[side];
    const box = $('fighter-' + side);
    const hp = Math.max(0, Math.ceil(f.hp));
    box.querySelector('.fill').style.width = (100 * Math.max(0, f.hp)) / f.maxHp + '%';
    box.querySelector('.hpbar .text').textContent = `${hp} / ${f.maxHp}`;
    const chips = [];
    if (f.block > 0) chips.push(`<span class="chip block">🛡️ ${Math.round(f.block)}</span>`);
    if (f.gift > 0) chips.push(`<span class="chip gift">🧪 ${f.gift}</span>`);
    if (f.brand > 0) chips.push(`<span class="chip brand">🔥 ${f.brand}</span>`);
    if (f.kaelte > 0) chips.push(`<span class="chip kaelte">❄️ ${fmt(Math.ceil(f.kaelte * 10) / 10)} s</span>`);
    if (f.tempo > 0) chips.push(`<span class="chip">💨 +${Math.round(f.tempo * 100)} %</span>`);
    box.querySelector('.f-status').innerHTML = chips.join('');
    for (const it of f.items) {
      const el = itemEls[side][it.uid];
      if (el) el.style.setProperty('--p', Math.min(1, it.t / it.def.abklingzeit));
    }
  }
}

function showEvent(ev) {
  const box = $('fighter-' + ev.side);
  if (ev.type === 'trigger') {
    const el = itemEls[ev.side][ev.uid];
    if (el) { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }
    return;
  }
  let text = '', cls = '';
  if (ev.type === 'damage') {
    if (ev.amount > 0) {
      text = `-${ev.amount}`;
      cls = ev.kind;
      const p = box.querySelector('.f-portrait');
      p.classList.remove('hit'); void p.offsetWidth; p.classList.add('hit');
    } else if (ev.blocked > 0) { text = '🛡️ geblockt'; cls = 'block'; }
  } else if (ev.type === 'block') { text = `+${ev.amount} 🛡️`; cls = 'block'; }
  else if (ev.type === 'heal') { text = `+${ev.amount} 💚`; cls = 'heal'; }
  else if (ev.type === 'status') {
    const icon = { gift: '🧪', brand: '🔥', kaelte: '❄️' }[ev.kind];
    text = `${icon} +${ev.kind === 'kaelte' ? fmt(ev.amount) + ' s' : ev.amount}`;
    cls = ev.kind;
  }
  if (!text) return;
  // Bei hohem Tempo nicht zu viele Zahlen gleichzeitig.
  if (box.querySelectorAll('.floater').length > 8) return;
  const f = document.createElement('div');
  f.className = 'floater ' + cls;
  f.textContent = text;
  f.style.left = 30 + Math.random() * 50 + '%';
  f.style.top = 150 + Math.random() * 120 + 'px';
  box.append(f);
  setTimeout(() => f.remove(), 1000);
}

function battleOver() {
  const won = battle.result === 'win';
  finishBattle(run, ITEMS, won, enemy.name);
  save();
  const heartsLeft = run.hearts;
  modal(won ? `
      <div class="big-emoji">🏆</div>
      <h2>Sieg!</h2>
      <p>Du hast ${enemy.name} besiegt.</p>
      <p>Siege: <b>${run.wins} / ${CFG.winsToWin}</b></p>
      <div class="row"><button class="btn primary big" data-act="next">Weiter</button></div>` : `
      <div class="big-emoji">💔</div>
      <h2>Niederlage</h2>
      <p>${enemy.name} war heute stärker. Du verlierst ein Herz.</p>
      <p>Herzen: <b>${'❤️'.repeat(heartsLeft)}${'🤍'.repeat(CFG.hearts - heartsLeft)}</b></p>
      <div class="row"><button class="btn primary big" data-act="next">Weiter</button></div>`,
  { next: afterBattle });
}

function afterBattle() {
  if (run.over) { showRunEnd(); return; }
  showScreen('game');
  render();
  toast(`Neuer Tag: +${income(run.day)} 🪙`);
}

function showRunEnd() {
  const won = run.over === 'won';
  modal(won ? `
      <div class="big-emoji">👑</div>
      <h2>Lauf gewonnen!</h2>
      <p>Zehn Siege in ${run.day} Tagen – mit ${run.hearts} ${run.hearts === 1 ? 'Herz' : 'Herzen'} übrig.</p>
      <p>Die Wörter der Wanderlande sind ein Stück sicherer.</p>
      <div class="row"><button class="btn primary big" data-act="new">Neuer Lauf</button><button class="btn" data-act="home">Zum Start</button></div>` : `
      <div class="big-emoji">🪦</div>
      <h2>Lauf verloren</h2>
      <p>Alle Herzen sind weg. Du hast <b>${run.wins} von ${CFG.winsToWin}</b> Siegen geschafft.</p>
      <p>Probier es gleich nochmal – jeder Lauf ist anders.</p>
      <div class="row"><button class="btn primary big" data-act="new">Neuer Lauf</button><button class="btn" data-act="home">Zum Start</button></div>`,
  {
    new: startNewRun,
    home: () => {
      run = null;
      $('btn-continue').hidden = true;
      $('btn-new').classList.add('primary');
      showScreen('start');
    },
  });
}

// ---------- Offline ----------

function registerServiceWorker() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

boot();
