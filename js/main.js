// Runenrucksack – Oberfläche: Bildschirme, Raster, Ziehen und Drehen, Laden, Verschmelzen, Kampfanzeige.
import {
  CFG, income, baseHp, sellValue, newRun, reroll, finishBattle, makeEnemy,
  canPlace, overlapping, findSpot, sizeOf, areaDims,
} from './logic.js';
import {
  GENUS, SIEGEL_BONUS, analyze, buildCompounds, findFusions, wrongOrderNeighbor,
  canRotate, nextRot, isNoun, isRune, runeTargetCell,
} from './grammar.js';
import { Battle, makeFighter, runToEnd } from './battle.js';

const SAVE_KEY = 'runenrucksack.lauf.v1';
const $ = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 });

let ITEMS = [], COMPOUNDS = [], DEFS = {}, RAR = {}, ENEMIES = [], RECIPES = null;
let run = null;
let selected = null;   // { src: 'bag'|'store'|'shop', uid?, slot? }
let drag = null;
let bagInfo = new Map(); // Auswertung von Siegeln und Runen im Rucksack
let cell = 96, mini = 56, bcell = 100;

// ---------- Start ----------

async function boot() {
  const [itemData, enemyData, recipes] = await Promise.all([
    fetch('items.json').then((r) => r.json()),
    fetch('enemies.json').then((r) => r.json()),
    fetch('recipes.json').then((r) => r.json()),
  ]);
  ITEMS = itemData.items;
  RAR = itemData.seltenheiten;
  RECIPES = recipes;
  for (const d of ITEMS) DEFS[d.id] = d;
  COMPOUNDS = buildCompounds(DEFS, RECIPES);
  for (const d of COMPOUNDS) DEFS[d.id] = d;
  ENEMIES = enemyData.gegner;

  run = load();
  $('btn-continue').hidden = !run;
  $('btn-new').classList.toggle('primary', !run);
  $('btn-continue').onclick = () => { showScreen('game'); render(); runFusions(); };
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
    // Items, die es nicht mehr gibt, fallen weg.
    r.items = r.items.filter((p) => DEFS[p.id]);
    r.shop = r.shop.map((s) => (s && DEFS[s.id] ? s : null));
    r.lernen ||= { richtig: 0, falsch: 0 };
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
const genusChip = (g) => `<span class="genus" style="--genus:${GENUS[g].farbe}">${g}</span>`;

function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2200);
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
  const passive = !def.abklingzeit && def.art !== 'siegel' && def.art !== 'rune';
  el.className = `item r-${def.seltenheit}` + (passive ? ' passive' : '');
  el.style.setProperty('--rar', RAR[def.seltenheit]?.farbe || '#9a8f7a');
  el.style.width = s.w * size - 6 + 'px';
  el.style.height = s.h * size - 6 + 'px';

  const cd = document.createElement('div');
  cd.className = 'cd';
  el.append(cd);

  if (def.art === 'siegel') {
    // Artikel-Siegel: Wort auf Genusfarbe
    el.classList.add('siegel');
    el.style.setProperty('--genus', GENUS[def.genus].farbe);
    const w = document.createElement('span');
    w.className = 'word';
    w.textContent = def.name;
    w.style.fontSize = Math.round(size * 0.34) + 'px';
    el.append(w);
    return el;
  }

  const em = document.createElement('span');
  em.className = 'emoji';
  em.textContent = def.emoji;
  em.style.fontSize = Math.round(Math.min(s.w, s.h) * size * (s.w * s.h === 1 ? 0.5 : 0.58)) + 'px';
  if (rot && def.w !== def.h) em.style.transform = 'rotate(90deg)';
  el.append(em);

  if (def.leuchten) {
    el.classList.add('glow');
    el.style.setProperty('--glow', def.leuchten);
  }
  if (isRune(def)) {
    el.classList.add('rune');
    em.style.fontSize = Math.round(size * 0.34) + 'px';
    const a = document.createElement('span');
    a.className = `arrow d${(rot || 0) % 4}`;
    a.textContent = '➤';
    a.style.fontSize = Math.round(size * 0.24) + 'px';
    el.append(a);
  }
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

// Zeichnet Items in ein Raster; info (aus analyze) liefert Markierungen und Leuchtlinien.
function drawItems(grid, placed, size, info, area) {
  const els = {};
  const fusing = new Set();
  if (area === 'bag') for (const f of findFusions(placed, DEFS, RECIPES)) fusing.add(f.kraft.uid).add(f.traeger.uid);

  for (const p of placed) {
    const def = DEFS[p.id];
    const it = itemEl(def, p.rot, size);
    it.style.left = p.x * size + 'px';
    it.style.top = p.y * size + 'px';
    const i = info?.get(p.uid);
    if (i) {
      const seal = i.siegel.find((s) => s.ok);
      if (seal) {
        const m = document.createElement('span');
        m.className = 'mark-siegel';
        m.style.setProperty('--genus', GENUS[seal.genus].farbe);
        m.title = `Siegel „${seal.genus}“ passt: +25 %`;
        it.append(m);
      }
      if (i.adjektive.length) {
        const m = document.createElement('span');
        m.className = 'mark-rune';
        m.textContent = '✦';
        it.append(m);
      }
      const idle = (def.art === 'siegel' && !i.ziele.some((z) => z.ok)) || (isRune(def) && !i.ziel?.ok);
      if (idle) it.classList.add('idle');
    }
    if (fusing.has(p.uid)) it.classList.add('fuses');
    grid.append(it);
    els[p.uid] = it;
  }

  if (info) drawRuneLines(grid, placed, size, info);
  return els;
}

function drawRuneLines(grid, placed, size, info) {
  const lines = [];
  for (const p of placed) {
    const i = info.get(p.uid);
    if (!isRune(DEFS[p.id]) || !i?.ziel?.ok) continue;
    const t = runeTargetCell(p);
    lines.push([(p.x + 0.5) * size, (p.y + 0.5) * size, (t.x + 0.5) * size, (t.y + 0.5) * size]);
  }
  if (!lines.length) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('rune-lines');
  svg.setAttribute('width', CFG.bagCols * size);
  svg.setAttribute('height', CFG.bagRows * size);
  for (const [x1, y1, x2, y2] of lines) {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    Object.entries({ x1, y1, x2, y2 }).forEach(([k, v]) => l.setAttribute(k, v));
    svg.append(l);
  }
  grid.append(svg);
}

// ---------- Darstellung Tag ----------

function render() {
  if (!run) return;
  bagInfo = analyze(itemsIn('bag'), DEFS);
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
  const placed = itemsIn(area);
  const els = drawItems(el, placed, cell, area === 'bag' ? bagInfo : null, area);
  for (const p of placed) {
    const it = els[p.uid];
    it.dataset.src = area;
    it.dataset.uid = p.uid;
    if (sameRef(selected, { src: area, uid: p.uid })) it.classList.add('selected');
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
  ['gift', '🧪 Gift', (v) => `+${fmt(v)} je Treffer`],
  ['brand', '🔥 Brand', (v) => `+${fmt(v)} je Treffer`],
  ['kaelte', '❄️ Kälte', (v) => `${fmt(v)} s`],
  ['betaeubung', '💫 Betäubung', (v) => `${fmt(v)} s`],
  ['regeneration', '🌙 Heilung über Zeit', (v) => `+${fmt(v)}`],
  ['glueck', '🍀 Glück', (v) => `${fmt(v)} %`],
  ['tempo', '💨 Tempo', (v) => `+${fmt(v)} %`],
  ['leben', '❤️ Leben', (v) => `+${fmt(v)}`],
  ['startblock', '🧱 Startblock', (v) => `+${fmt(v)}`],
];

const EXPLAIN = {
  gift: 'Gift schadet dem Gegner jede Sekunde und geht durch Block.',
  brand: 'Brand schadet jede Sekunde und wird dabei schwächer.',
  kaelte: 'Kälte macht die Items des Gegners langsamer.',
  betaeubung: 'Betäubung hält die Items des Gegners kurz ganz an.',
  regeneration: 'Heilung über Zeit heilt jede Sekunde und wird dabei schwächer.',
  glueck: 'Glück ist die Chance, dass ein Item doppelt wirkt.',
};

function renderInfo() {
  const box = $('info');
  box.innerHTML = '';
  if (selected && !refExists(selected)) selected = null;
  if (!selected) { renderSummary(box); return; }

  const base = defOf(selected);
  const inBag = selected.src === 'bag';
  const ana = inBag ? bagInfo.get(selected.uid) : null;
  const def = ana ? ana.def : base;
  const s = sizeOf(base, 0);
  const rar = RAR[base.seltenheit] || {};

  const title = ana?.phrase
    ? `<span class="phrase">${ana.phrase}</span>`
    : `${base.artikel ? `<span class="art">${base.artikel}</span> ` : ''}${base.name}`;
  const icon = base.art === 'siegel'
    ? `<span class="seal-icon" style="--genus:${GENUS[base.genus].farbe}">${base.name}</span>`
    : `${base.emoji}${base.abzeichen ? `<span class="badge">${base.abzeichen}</span>` : ''}`;
  box.insertAdjacentHTML('beforeend', `
    <div class="info-head">
      <div class="info-emoji">${icon}</div>
      <div>
        <div class="info-name">${title}</div>
        <div class="info-rar" style="color:${rar.farbe}">${rar.name || ''} · ${s.w}×${s.h} · ${artLabel(base)}</div>
      </div>
    </div>`);

  const ul = document.createElement('ul');
  ul.className = 'stats';
  for (const [key, label, f] of STAT_ROWS) {
    if (key === 'abklingzeit' && !def.abklingzeit) continue;
    if (!def[key]) continue;
    const diff = key === 'abklingzeit' ? 0 : def[key] - (base[key] || 0);
    const extra = diff > 0 ? ` <span class="plus">(+${fmt(Math.round(diff * 10) / 10)})</span>` : '';
    ul.insertAdjacentHTML('beforeend', `<li><span>${label}</span><b>${f(def[key])}${extra}</b></li>`);
  }
  if (ul.children.length) box.append(ul);

  const notes = [];
  if (base.art !== 'siegel' && base.art !== 'rune' && !base.abklingzeit) notes.push('Passiv: wirkt den ganzen Kampf, solange es im Rucksack liegt.');
  if (base.abklingzeit && base.tempo) notes.push('Tempo: Dieses Item lädt schneller auf.');
  if (base.aura?.tempo) notes.push(`Wirkt außerdem auf den ganzen Rucksack: +${base.aura.tempo} % Tempo.`);
  if (base.aura?.glueck) notes.push(`Wirkt außerdem auf den ganzen Rucksack: +${base.aura.glueck} % Glück.`);
  for (const k of Object.keys(EXPLAIN)) if (def[k]) notes.push(EXPLAIN[k]);
  for (const n of notes) box.insertAdjacentHTML('beforeend', `<p class="muted">${n}</p>`);

  const gram = grammarNotes(base, ana, selected);
  if (gram.length) {
    box.insertAdjacentHTML('beforeend', '<h3>Grammatik</h3>');
    for (const g of gram) box.insertAdjacentHTML('beforeend', `<p class="gram ${g.cls || ''}">${g.html}</p>`);
  }

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
    btn(`Kaufen <span class="price">${base.preis} 🪙</span>`, () => buyAuto(slot), 'primary').disabled = run.gold < base.preis;
  } else {
    const uid = selected.uid;
    if (canRotate(base)) btn(isRune(base) ? '⟳ Pfeil drehen' : '⟳ Drehen', () => rotateInPlace(uid));
    if (selected.src === 'bag') btn('📦 Ins Lager', () => moveAuto(uid, 'store'));
    else btn('🎒 In den Rucksack', () => moveAuto(uid, 'bag'));
    btn(`Verkaufen <span class="price">+${sellValue(base)} 🪙</span>`, () => sell(uid), 'danger');
  }
  box.append(actions);
}

function artLabel(d) {
  return {
    traeger: 'Nomen · Träger', nomen: 'Nomen', kraft: 'Nomen · Kraft', kompositum: 'Kompositum',
    verb: 'Verb', siegel: 'Artikel-Siegel', rune: 'Adjektiv-Rune',
  }[d.art] || '';
}

// Erklärungen zu Genus, Siegeln, Runen und Komposita für das Info-Feld.
function grammarNotes(base, ana, ref) {
  const out = [];
  const where = ref.src === 'bag' ? '' : ' (wirkt nur im Rucksack)';

  if (isNoun(base)) {
    out.push({ html: `${genusChip(base.artikel)} <b>${base.name}</b> – Genus ${GENUS[base.artikel].name}` });
  }
  if (base.art === 'kompositum') {
    const k = DEFS[base.teile.kraft], t = DEFS[base.teile.traeger];
    out.push({ html: `${k.name} + ${t.name} = ${base.name}. Das letzte Wort bestimmt den Artikel: ${fullName(t)} → ${fullName(base)}.` });
  }
  if (base.art === 'kraft') {
    const fus = ref.src === 'bag' && findFusions(itemsIn('bag'), DEFS, RECIPES).find((f) => f.kraft.uid === ref.uid);
    const wrong = ref.src === 'bag' && !fus && wrongOrderNeighbor(placedOf(ref.uid), itemsIn('bag'), DEFS, RECIPES);
    if (fus) {
      out.push({ cls: 'ok', html: `✓ Verschmilzt zu Beginn des nächsten Tages: ${base.name} + ${DEFS[fus.traeger.id].name} = <b>${DEFS[fus.id].name}</b>` });
    } else if (wrong) {
      const t = DEFS[wrong.id];
      out.push({ cls: 'bad', html: `✗ Liegt rechts neben oder unter ${fullName(t).replace(/^der /, 'dem ').replace(/^die /, 'der ').replace(/^das /, 'dem ')}. So entstünde „${t.name}${base.name.toLowerCase()}“. Das Bestimmungswort steht vorne: Lege ${fullName(base)} links neben oder über das Item.` });
    } else {
      out.push({ html: `Lege ${fullName(base)} direkt links neben oder über einen Träger (Schwert, Bogen, Schild …). Zu Beginn des nächsten Tages verschmelzen beide zum Kompositum.` });
    }
  }
  if (base.art === 'siegel') {
    out.push({ html: `Gibt einem Nomen daneben +${SIEGEL_BONUS * 100} % Wirkung – aber nur, wenn es „${base.genus}“ heißt${where}.` });
    for (const z of ana?.ziele || []) {
      out.push(z.ok
        ? { cls: 'ok', html: `✓ ${fullName(z.def)}: passt, +25 %` }
        : { cls: 'bad', html: `✗ ${z.def.name}: Es heißt „${fullName(z.def)}“ (${GENUS[z.def.artikel].name}). Dazu passt nur das Siegel ${genusChip(z.def.artikel)}.` });
    }
    if (ana && !ana.ziele.length) out.push({ cls: 'bad', html: 'Kein Nomen direkt daneben.' });
  }
  if (isRune(base)) {
    const bonus = Object.entries(base.adjektiv.bonus).map(([k, v]) => {
      const label = STAT_ROWS.find((r) => r[0] === k)?.[1].split(' ').slice(1).join(' ') || k;
      return k === 'tempo' ? `+${v} % ${label}` : `+${v} ${label}`;
    }).join(', ');
    out.push({ html: `Der Pfeil muss auf ein passendes Nomen zeigen: ${base.adjektiv.passtText}. Wirkung: ${bonus}${where}.` });
    const z = ana?.ziel;
    if (ana && !z) out.push({ cls: 'bad', html: '✗ Der Pfeil zeigt auf kein Item. Tippe nochmal, um ihn zu drehen.' });
    else if (z?.ok) {
      const phrase = bagInfo.get(z.uid)?.phrase || z.def.name;
      out.push({ cls: 'ok', html: `✓ Zeigt auf ${fullName(z.def)} → <b>${phrase}</b>` });
    } else if (z) {
      out.push({
        cls: 'bad',
        html: isNoun(z.def)
          ? `✗ Zeigt auf ${fullName(z.def)}. „${base.name}“ passt nur zu ${base.adjektiv.passtText}.`
          : `✗ Zeigt auf „${z.def.name}“ – das ist kein Nomen.`,
      });
    }
  }
  if (ana && isNoun(base)) {
    for (const sg of ana.siegel) {
      out.push(sg.ok
        ? { cls: 'ok', html: `✓ Siegel ${genusChip(sg.genus)} daneben: +25 %` }
        : { cls: 'bad', html: `✗ Siegel ${genusChip(sg.genus)} daneben wirkt nicht: Es heißt „${fullName(base)}“.` });
    }
    for (const r of ana.runen) {
      if (r.ok) out.push({ cls: 'ok', html: `✓ Rune „${r.def.name}“ zeigt hierher: ${ana.phrase}` });
      else out.push({ cls: 'bad', html: `✗ Rune „${r.def.name}“ zeigt hierher, passt aber nur zu ${r.def.adjektiv.passtText}.` });
    }
  }
  return out;
}

function refExists(ref) {
  if (ref.src === 'shop') return !!run.shop[ref.slot];
  const p = placedOf(ref.uid);
  return !!p && p.area === ref.src;
}

function renderSummary(box) {
  const bag = itemsIn('bag').map((p) => bagInfo.get(p.uid).def);
  let leben = baseHp(run.day), startblock = 0, tempo = 0, glueck = 0;
  const perSec = { schaden: 0, block: 0, heilung: 0, gift: 0, brand: 0 };
  for (const d of bag) {
    leben += d.leben || 0;
    startblock += d.startblock || 0;
    if (!d.abklingzeit) { tempo += d.tempo || 0; glueck += d.glueck || 0; }
    tempo += d.aura?.tempo || 0;
    glueck += d.aura?.glueck || 0;
  }
  for (const d of bag) {
    if (!d.abklingzeit) continue;
    const speed = (1 + tempo / 100) * (1 + (d.tempo || 0) / 100);
    for (const k in perSec) perSec[k] += ((d[k] || 0) / d.abklingzeit) * speed;
  }
  const rows = [
    ['❤️ Leben', leben],
    ['🧱 Startblock', startblock],
    ['💨 Tempo', `+${tempo} %`],
    ['⚔️ Schaden pro s', fmt(perSec.schaden)],
    ['🛡️ Block pro s', fmt(perSec.block)],
    ['💚 Heilung pro s', fmt(perSec.heilung)],
  ];
  if (glueck) rows.push(['🍀 Glück', `${glueck} %`]);
  if (perSec.gift) rows.push(['🧪 Gift pro s', fmt(perSec.gift)]);
  if (perSec.brand) rows.push(['🔥 Brand pro s', fmt(perSec.brand)]);

  const fusions = findFusions(itemsIn('bag'), DEFS, RECIPES);
  box.innerHTML = `
    <h2>Dein Rucksack</h2>
    <ul class="stats">${rows.map(([a, b]) => `<li><span>${a}</span><b>${b}</b></li>`).join('')}</ul>
    ${fusions.length ? `<p class="gram ok">✓ Morgen verschmelzen: ${fusions.map((f) => DEFS[f.id].name).join(', ')}</p>` : ''}
    ${run.day % 5 === 0 ? '<p class="muted"><b>Heute Nacht wartet ein Anführer der Orks!</b></p>' : ''}
    <h3>So geht's</h3>
    <p class="muted">Ziehe Items aus dem Laden in den Rucksack. Tippe ein Item an für Infos, tippe nochmal zum Drehen. Beim Ziehen dreht ein zweiter Finger das Item.</p>
    <p class="muted">🔥 Kraft links neben oder über einen Träger legen → verschmilzt morgen. ${genusChip('der')} ${genusChip('die')} ${genusChip('das')} Siegel neben ein passendes Nomen: +25 %. ➤ Runen-Pfeil auf ein passendes Nomen richten.</p>
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
  if (isRune(DEFS[p.id])) p.rot = 0;
  selected = { src: area, uid };
  render();
}

function rotateInPlace(uid) {
  const p = placedOf(uid);
  const def = DEFS[p.id];
  if (!canRotate(def)) return;
  const rot = nextRot(def, p.rot || 0);
  if (isRune(def)) { p.rot = rot; render(); return; }
  const { cols, rows } = areaDims(p.area);
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
  const l = run.lernen;
  modal(`
    <div class="big-emoji">🎒</div>
    <h2>Menü</h2>
    <p>Tag ${run.day} · ${run.wins} Siege · ${run.hearts} Herzen</p>
    ${l.richtig + l.falsch ? `<p>Artikel beim Verschmelzen: ${l.richtig} richtig, ${l.falsch} daneben</p>` : ''}
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

function openModal(html) {
  $('modal-card').innerHTML = html;
  $('modal').hidden = false;
  return $('modal-card');
}

const closeModal = () => { $('modal').hidden = true; };

function modal(html, handlers = {}) {
  const card = openModal(html);
  card.querySelectorAll('[data-act]').forEach((b) => {
    b.onclick = () => {
      closeModal();
      const fn = handlers[b.dataset.act];
      if (fn) fn();
    };
  });
}

// ---------- Verschmelzen (zu Beginn des Tages) ----------

function runFusions() {
  if (!run?.pendingFusion) return;
  const list = findFusions(itemsIn('bag'), DEFS, RECIPES);
  showFusion(list, 0);
}

function showFusion(list, i) {
  if (i >= list.length) {
    run.pendingFusion = false;
    render();
    return;
  }
  const f = list[i];
  const k = placedOf(f.kraft.uid), t = placedOf(f.traeger.uid);
  if (!k || !t || k.area !== 'bag' || t.area !== 'bag') { showFusion(list, i + 1); return; }
  const kd = DEFS[k.id], td = DEFS[t.id], cd = DEFS[f.id];
  let tries = 0;
  let feedback = '';
  const wrong = new Set();

  const draw = () => {
    const paid = tries > 0;
    const broke = paid && run.gold < 1;
    const card = openModal(`
      <div class="fusion-eq">
        <span class="fi">${kd.emoji}<small>${kd.name}</small></span><span class="op">+</span>
        <span class="fi">${td.emoji}<small>${td.name}</small></span><span class="op">=</span>
        <span class="fi glowing" style="--glow:${cd.leuchten}">${td.emoji}<em>${kd.emoji}</em><small>?</small></span>
      </div>
      <h2 class="fusion-q"><span class="blank">___</span> ${cd.name}</h2>
      <div class="row">${['der', 'die', 'das'].map((g) => `
        <button class="btn genus-btn" data-g="${g}" style="--genus:${GENUS[g].farbe}" ${wrong.has(g) || broke ? 'disabled' : ''}>${g}</button>`).join('')}
      </div>
      <p class="cost">${paid ? `Jeder weitere Versuch kostet 1 🪙 · du hast ${run.gold} 🪙` : 'Erster Versuch kostenlos'}</p>
      ${feedback ? `<p class="feedback">${feedback}</p>` : ''}
      ${broke ? '<p class="feedback">Kein Gold für einen weiteren Versuch.</p>' : ''}
      <div class="row"><button class="btn small" data-later>Heute nicht verschmelzen</button></div>`);
    card.querySelectorAll('[data-g]').forEach((b) => { b.onclick = () => guess(b.dataset.g); });
    card.querySelector('[data-later]').onclick = () => { closeModal(); showFusion(list, i + 1); };
  };

  const guess = (g) => {
    if (tries > 0) {
      if (run.gold < 1) return;
      run.gold -= 1;
      bump('stat-gold');
    }
    tries++;
    if (g === cd.artikel) {
      run.lernen.richtig++;
      run.items = run.items.filter((p) => p !== k);
      t.id = cd.id;
      selected = { src: 'bag', uid: t.uid };
      render();
      const card = openModal(`
        <div class="big-emoji glowing" style="--glow:${cd.leuchten}">${td.emoji}<em>${kd.emoji}</em></div>
        <h2>${genusChip(cd.artikel)} ${cd.name}</h2>
        <p>Richtig! ${tries > 1 ? '' : 'Gleich beim ersten Versuch. '}Das letzte Wort bestimmt den Artikel: ${fullName(td)} → ${fullName(cd)}.</p>
        <div class="row"><button class="btn primary big" data-next>Weiter</button></div>`);
      card.querySelector('[data-next]').onclick = () => { closeModal(); showFusion(list, i + 1); };
      return;
    }
    run.lernen.falsch++;
    wrong.add(g);
    feedback = `Das letzte Wort bestimmt den Artikel: ${fullName(td)} → ${fullName(cd)}`;
    save();
    draw();
  };

  draw();
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
    rot: ref.uid ? placedOf(ref.uid).rot || 0 : 0,
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
  if (!canRotate(drag.def)) return;
  drag.rot = nextRot(drag.def, drag.rot);
  if (drag.def.w !== drag.def.h) [drag.fx, drag.fy] = [drag.fy, drag.fx];
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

function enemyPool(day) {
  const base = ITEMS.filter((d) => d.art !== 'siegel' && d.art !== 'rune');
  return day >= 3 ? base.concat(COMPOUNDS) : base;
}

function startNight() {
  selected = null;
  enemy = makeEnemy(run.day, ENEMIES, enemyPool(run.day), DEFS);
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
  itemEls[side] = drawItems(grid, placed, bcell, analyze(placed, DEFS), 'battle');
  for (const el of Object.values(itemEls[side])) el.style.cursor = 'default';
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
    if (f.betaeubt > 0) chips.push(`<span class="chip betaeubung">💫 ${fmt(Math.ceil(f.betaeubt * 10) / 10)} s</span>`);
    if (f.regeneration > 0) chips.push(`<span class="chip regeneration">🌙 ${f.regeneration}</span>`);
    if (f.tempo > 0) chips.push(`<span class="chip">💨 +${Math.round(f.tempo * 100)} %</span>`);
    if (f.glueck > 0) chips.push(`<span class="chip">🍀 ${Math.round(f.glueck * 100)} %</span>`);
    box.querySelector('.f-status').innerHTML = chips.join('');
    for (const it of f.items) {
      const el = itemEls[side][it.uid];
      if (el) el.style.setProperty('--p', Math.min(1, it.t / it.def.abklingzeit));
    }
  }
}

function showEvent(ev) {
  const box = $('fighter-' + ev.side);
  let text = '', cls = '';
  if (ev.type === 'trigger') {
    const el = itemEls[ev.side][ev.uid];
    if (el) { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }
    if (!ev.crit) return;
    text = '🍀 Glück! ×2';
    cls = 'glueck';
  } else if (ev.type === 'damage') {
    if (ev.amount > 0) {
      text = `-${ev.amount}`;
      cls = ev.kind;
      const p = box.querySelector('.f-portrait');
      p.classList.remove('hit'); void p.offsetWidth; p.classList.add('hit');
    } else if (ev.blocked > 0) { text = '🛡️ geblockt'; cls = 'block'; }
  } else if (ev.type === 'block') { text = `+${ev.amount} 🛡️`; cls = 'block'; }
  else if (ev.type === 'heal') { text = `+${ev.amount} ${ev.kind === 'regeneration' ? '🌙' : '💚'}`; cls = 'heal'; }
  else if (ev.type === 'status') {
    const icon = { gift: '🧪', brand: '🔥', kaelte: '❄️', betaeubung: '💫', regeneration: '🌙' }[ev.kind];
    const secs = ev.kind === 'kaelte' || ev.kind === 'betaeubung';
    text = `${icon} +${secs ? fmt(ev.amount) + ' s' : ev.amount}`;
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
  runFusions();
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
