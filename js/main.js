// Runenrucksack – Ablauf eines Laufs, Laden, Rucksack (Ziehen und Drehen) und Info-Feld.
import {
  CFG, income, baseHp, sellValue, newRun, reroll, finishBattle,
  canPlace, overlapping, findSpot, sizeOf, shuffle, attachTasche,
} from './logic.js';
import {
  GENUS, SIEGEL_BONUS, findFusions, findSteigerungen, wrongOrderNeighbor, canRotate, nextRot, isNoun, isRune, runeBase,
} from './grammar.js';
import { G, loadData, save, loadRun, placedOf, itemsIn, gridOf, region, hero, playerCtx, emit } from './state.js';
import { evaluateBag } from './mods.js';
import {
  $, fmt, fullName, genusChip, toast, bump, openModal, closeModal, modal, itemEl, buildGrid, drawItems,
} from './ui.js';
import { startNight } from './battle-ui.js';
import { runEncounter } from './encounters.js';
import { initTutorial, startTutorial, tutorialDone, showHelp, tipsOn, setTips } from './tutorial.js';

let selected = null;   // { src: 'bag'|'store'|'shop', uid?, slot? }
let drag = null;
let bagInfo = new Map(); // wirksame Werte im Rucksack (Siegel, Runen, Boni)
let cell = 96, mini = 56;

// ---------- Start ----------

async function boot() {
  await loadData();
  G.run = loadRun();
  $('btn-continue').onclick = continueSaved;
  $('btn-new').onclick = showHeroes;
  $('btn-tutorial').onclick = startTutorial;
  $('btn-first').onclick = startTutorial;
  $('btn-known').onclick = showStart;
  $('btn-help').onclick = () => showHelp();
  initTutorial({ render, showGame, showStart, showHeroes, runFusions, continueSaved, hasSavedRun: () => !!loadRun() });
  showAsk();
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

// Startbildschirm: zuerst die Frage, ob man zum ersten Mal hier ist.
function showAsk() {
  showScreen('start');
  $('start-ask').hidden = false;
  $('start-menu').hidden = true;
  // Auf diesem Gerät schon gelernt? Dann ist „Ich kenne das schon“ hervorgehoben.
  $('btn-known').classList.toggle('primary', tutorialDone());
  $('btn-first').classList.toggle('primary', !tutorialDone());
}

// Normales Startmenü (Weiterspielen, Neuer Lauf).
function showStart() {
  G.run = G.run?.tutorial ? loadRun() : G.run || loadRun();
  showScreen('start');
  $('start-ask').hidden = true;
  $('start-menu').hidden = false;
  $('btn-continue').hidden = !G.run;
  $('btn-new').classList.toggle('primary', !G.run);
}

function continueSaved() {
  G.run = loadRun();
  if (!G.run) { showStart(); return; }
  showGame();
  continueFlow();
}

// Vor jedem Lauf: Figur wählen.
function showHeroes() {
  const box = $('hero-cards');
  box.innerHTML = '';
  for (const h of G.HEROES) {
    const card = document.createElement('button');
    card.className = 'hero-card';
    card.style.setProperty('--hero', h.farbe);
    card.innerHTML = `
      <div class="hero-emoji">${h.emoji}</div>
      <div class="hero-name">${h.name}</div>
      <div class="hero-volk">${h.volk}</div>
      <p class="hero-staerke">${h.staerke}</p>
      <div class="hero-start">Start mit: ${h.start.map((s) => `<span>${G.DEFS[s.id].emoji} ${fullName(G.DEFS[s.id])}</span>`).join('')}</div>`;
    card.onclick = () => startNewRun(h);
    box.append(card);
  }
  showScreen('heroes');
}

function startNewRun(h) {
  if (!h?.id) { showHeroes(); return; }
  G.run = newRun(G.ITEMS, G.REGIONS, { hero: h, fates: G.FATES });
  selected = null;
  showGame();
  continueFlow();
}

function showScreen(name) {
  for (const id of ['start', 'heroes', 'game', 'battle']) $(id).hidden = id !== name;
}

function showGame() {
  showScreen('game');
  layout();
}

// ---------- Ablauf: Schritte am Morgen, dann Laden ----------

function continueFlow() {
  save();
  render();
  const step = G.run.queue?.[0];
  if (!step) return;
  const next = () => { G.run.queue.shift(); continueFlow(); };
  if (step === 'gebiet') showRegion(next);
  else if (step === 'schicksal') showFate(next);
  else if (step === 'unterklasse') chooseSubclass(next);
  else if (step === 'begegnung') runEncounter(next, render);
  else if (step === 'verschmelzen') runFusions(next);
  else next();
}

function applyTheme() {
  const s = region().stimmung;
  const root = document.documentElement.style;
  root.setProperty('--bg-top', s.oben);
  root.setProperty('--bg-bottom', s.unten);
  root.setProperty('--accent', s.akzent);
}

function showRegion(next) {
  const reg = region();
  if (reg.tage[0] > 1) emit('tipp', { key: 'gebiet' });
  const boss = G.ENEMIES.find((e) => e.id === reg.boss);
  applyTheme();
  modal(`
    <div class="region-card">
      <div class="big-emoji">${reg.emoji}</div>
      <p class="region-over">${reg.tage[0] === 1 ? 'Deine Reise beginnt in' : 'Du erreichst'}</p>
      <h2>${reg.name}</h2>
      <p>${reg.text}</p>
      <p class="region-facts">📖 Wortfeld: <b>${reg.wortfeldName}</b><br>
      ${boss.emoji} Am ${reg.tage[1]}. Tag wartet: <b>${boss.name}</b></p>
      <div class="row"><button class="btn primary big" data-act="go">Los geht's</button></div>
    </div>`, { go: next }, 'region');
}

function showFate(next) {
  const f = playerCtx().fate;
  if (!f) { next(); return; }
  modal(`
    <p class="region-over">Die Schicksalsrune für deine Reise</p>
    <div class="big-emoji fate-rune">${f.emoji}</div>
    <h2>${f.name}</h2>
    <p class="fate-text">${f.text}</p>
    <p class="muted">Sie gilt für den ganzen Lauf. Im Info-Feld siehst du sie jederzeit.</p>
    <div class="row"><button class="btn primary big" data-act="go">Aufbrechen</button></div>`, { go: next });
}

// Ankunft in Hrossmark: Unterklasse aus zwei Angeboten passend zur Figur.
function chooseSubclass(next) {
  const h = hero();
  if (!h?.unterklassen?.length || G.run.unterklasse) { next(); return; }
  emit('tipp', { key: 'unterklasse' });
  const card = openModal(`
    <div class="enc-top">${h.emoji} ${h.name}</div>
    <h2>Wähle deinen Weg</h2>
    <p>In Hrossmark lernst du dazu. Welche Unterklasse nimmst du?</p>
    <div class="enc-choices">${h.unterklassen.map((u) => `
      <button class="enc-choice" data-id="${u.id}">
        <span class="enc-emoji">${u.emoji}</span><b>${u.name}</b>
        <span class="enc-reward">${u.text}</span>
      </button>`).join('')}
    </div>`, 'wide');
  card.querySelectorAll('[data-id]').forEach((b) => {
    b.onclick = () => {
      G.run.unterklasse = b.dataset.id;
      closeModal();
      toast(`Du bist jetzt ${h.unterklassen.find((u) => u.id === b.dataset.id).name}!`);
      next();
    };
  });
}

// ---------- Größen ----------

function layout() {
  computeCell();
  if (!$('game').hidden) render();
}

// Feldgröße aus Fenstergröße und aktueller Rucksackgröße.
function computeCell() {
  const w = window.innerWidth, h = window.innerHeight;
  const bag = G.run ? gridOf('bag') : { cols: 4, rows: 3 };
  const byW = (w - 380) / (bag.cols + CFG.storeCols);
  const byH = (h - 280) / (Math.max(bag.rows, CFG.storeRows) + 1.1);
  cell = Math.max(52, Math.min(130, Math.floor(Math.min(byW, byH))));
  document.documentElement.style.setProperty('--cell', cell + 'px');
}

// ---------- Hilfsfunktionen ----------

const defOf = (ref) => (ref.src === 'shop' ? G.DEFS[G.run.shop[ref.slot].id] : G.DEFS[placedOf(ref.uid).id]);
const sameRef = (a, b) => a && b && a.src === b.src && a.uid === b.uid && a.slot === b.slot;

// ---------- Darstellung Tag ----------

function render() {
  if (!G.run) return;
  applyTheme();
  computeCell();
  bagInfo = evaluateBag(itemsIn('bag'), G.DEFS, playerCtx());
  renderTop();
  renderGrid('bag');
  renderGrid('store');
  renderShop();
  renderInfo();
  save();
  emit('render');
}

function renderTop() {
  const run = G.run, reg = region();
  const c = playerCtx();
  $('stat-hero').textContent = `${hero()?.emoji || ''} ${hero()?.kurz || ''}${c.unterklasse ? ` ${c.unterklasse.emoji}` : ''}${c.fate ? ` ${c.fate.emoji}` : ''}`;
  $('stat-hero').title = [c.unterklasse?.name, c.fate?.name].filter(Boolean).join(' · ');
  $('stat-hero').hidden = !hero();
  $('stat-day').textContent = `${reg.emoji} ${reg.name} · Tag ${run.day} / ${CFG.lastDay}`;
  $('stat-hearts').textContent = '❤️'.repeat(Math.max(0, run.hearts)) + '🤍'.repeat(CFG.hearts - Math.max(0, run.hearts));
  $('stat-wins').textContent = `🏆 ${run.wins}`;
  $('stat-gold').textContent = `🪙 ${run.gold}`;
  $('btn-reroll').disabled = run.gold < CFG.rerollCost;
}

function renderGrid(area) {
  const el = $('grid-' + area);
  const grid = gridOf(area);
  buildGrid(el, grid, cell);
  const placed = itemsIn(area);
  const els = drawItems(el, grid, placed, cell, area === 'bag' ? bagInfo : null, area);
  for (const p of placed) {
    const it = els[p.uid];
    it.dataset.src = area;
    it.dataset.uid = p.uid;
    if (sameRef(selected, { src: area, uid: p.uid })) it.classList.add('selected');
  }
}

function renderShop() {
  const run = G.run;
  const box = $('shop-slots');
  box.innerHTML = '';
  // Item-Größe im Laden an den verfügbaren Platz anpassen.
  const n = run.shop.length;
  const slotW = (box.clientWidth - (n - 1) * 10) / n;
  mini = Math.max(36, Math.floor(Math.min((slotW - 16) / 2, (box.clientHeight - 48) / 2, cell * 0.85)));
  document.documentElement.style.setProperty('--mini', mini + 'px');
  run.shop.forEach((s, i) => {
    const slot = document.createElement('div');
    slot.className = 'slot';
    if (!s) {
      slot.classList.add('empty');
      slot.textContent = run.tutorial ? '' : 'verkauft';
      box.append(slot);
      return;
    }
    const def = G.DEFS[s.id];
    const holder = document.createElement('div');
    holder.className = 'holder';
    const it = itemEl(def, 0, mini);
    it.dataset.src = 'shop';
    it.dataset.slot = i;
    it.dataset.tut = 'laden-' + def.id;
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
  const rar = G.RAR[base.seltenheit] || {};

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
    const diff = def[key] - (base[key] || 0);
    const extra = Math.abs(diff) > 1e-9 ? ` <span class="${diff > 0 === (key !== 'abklingzeit') ? 'plus' : 'minus'}">(${diff > 0 ? '+' : '−'}${fmt(Math.round(Math.abs(diff) * 10) / 10)})</span>` : '';
    ul.insertAdjacentHTML('beforeend', `<li><span>${label}</span><b>${f(def[key])}${extra}</b></li>`);
  }
  if (ul.children.length) box.append(ul);

  const notes = [];
  if (!['siegel', 'rune', 'tasche'].includes(base.art) && !base.abklingzeit) notes.push('Passiv: wirkt den ganzen Kampf, solange es im Rucksack liegt.');
  if (base.abklingzeit && base.tempo) notes.push('Tempo: Dieses Item lädt schneller auf.');
  if (base.aura?.tempo) notes.push(`Wirkt außerdem auf den ganzen Rucksack: +${base.aura.tempo} % Tempo.`);
  if (base.aura?.glueck) notes.push(`Wirkt außerdem auf den ganzen Rucksack: +${base.aura.glueck} % Glück.`);
  for (const k of Object.keys(EXPLAIN)) if (def[k]) notes.push(EXPLAIN[k]);
  for (const n of notes) box.insertAdjacentHTML('beforeend', `<p class="muted">${n}</p>`);
  for (const b of ana?.boni || []) box.insertAdjacentHTML('beforeend', `<p class="gram ok">${b}</p>`);
  const cursed = selected.uid && placedOf(selected.uid)?.fluch;
  if (cursed) box.insertAdjacentHTML('beforeend', `<p class="gram bad">😈 Verflucht: Der Kobold hat den Namen falsch geschrieben („${cursed}“). Solange es im Rucksack liegt, kostet es dich zu Kampfbeginn 2 Leben.</p>`);

  if (base.art === 'tasche') {
    box.insertAdjacentHTML('beforeend', `<p class="gram">Wird außen an den Rucksack genäht: +${base.tasche.felder.length} Felder. Items aus dem Wortfeld <b>${G.WORTFELDER[base.wortfeld]}</b> darin wirken ${base.tasche.bonus} % stärker.</p>`);
  } else if (base.wortfeld) {
    box.insertAdjacentHTML('beforeend', `<p class="muted">📖 Wortfeld: ${G.WORTFELDER[base.wortfeld] || base.wortfeld}</p>`);
  }
  if (ana?.tasche && !ana.tasche.ok) {
    box.insertAdjacentHTML('beforeend', `<p class="gram bad">✗ Liegt in der ${ana.tasche.def.name}, gehört aber nicht zum Wortfeld ${G.WORTFELDER[ana.tasche.def.wortfeld]} – kein Bonus.</p>`);
  }
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
    btn(`Kaufen <span class="price">${base.preis} 🪙</span>`, () => buyAuto(slot), 'primary').disabled = G.run.gold < base.preis;
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
    verb: 'Verb', siegel: 'Artikel-Siegel', rune: 'Adjektiv-Rune', tasche: 'Tasche',
  }[d.art] || '';
}

const dativ = (d) => fullName(d).replace(/^der /, 'dem ').replace(/^die /, 'der ').replace(/^das /, 'dem ');

// Erklärungen zu Genus, Siegeln, Runen und Komposita für das Info-Feld.
function grammarNotes(base, ana, ref) {
  const out = [];
  const where = ref.src === 'bag' ? '' : ' (wirkt nur im Rucksack)';
  const bag = itemsIn('bag');

  if (isNoun(base)) {
    out.push({ html: `${genusChip(base.artikel)} <b>${base.name}</b> – Genus ${GENUS[base.artikel].name}` });
  }
  if (base.art === 'kompositum') {
    const k = G.DEFS[base.teile.kraft], t = G.DEFS[base.teile.traeger];
    out.push({ html: `${k.name} + ${t.name} = ${base.name}. Das letzte Wort bestimmt den Artikel: ${fullName(t)} → ${fullName(base)}.` });
  }
  if (base.art === 'kraft') {
    const fus = ref.src === 'bag' && findFusions(bag, G.DEFS, G.RECIPES).find((f) => f.kraft.uid === ref.uid);
    const wrong = ref.src === 'bag' && !fus && wrongOrderNeighbor(placedOf(ref.uid), bag, G.DEFS, G.RECIPES);
    if (fus) {
      out.push({ cls: 'ok', html: `✓ Verschmilzt zu Beginn des nächsten Tages: ${base.name} + ${G.DEFS[fus.traeger.id].name} = <b>${G.DEFS[fus.id].name}</b>` });
    } else if (wrong) {
      const t = G.DEFS[wrong.id];
      out.push({ cls: 'bad', html: `✗ Liegt rechts neben oder unter ${dativ(t)}. So entstünde „${t.name}${base.name.toLowerCase()}“. Das Bestimmungswort steht vorne: Lege ${fullName(base)} links neben oder über das Item.` });
    } else {
      out.push({ html: `Lege ${fullName(base)} direkt links neben oder über einen Träger (Schwert, Bogen, Schild …). Zu Beginn des nächsten Tages verschmelzen beide zum Kompositum.` });
    }
  }
  if (base.art === 'siegel') {
    const bonus = Math.round((playerCtx().siegelBonus ?? SIEGEL_BONUS) * 100);
    out.push({ html: `Gibt einem Nomen daneben +${bonus} % Wirkung – aber nur, wenn es „${base.genus}“ heißt${where}.` });
    for (const z of ana?.ziele || []) {
      out.push(z.ok
        ? { cls: 'ok', html: `✓ ${fullName(z.def)}: passt, +${bonus} %` }
        : { cls: 'bad', html: `✗ ${z.def.name}: Es heißt „${fullName(z.def)}“ (${GENUS[z.def.artikel].name}). Dazu passt nur das Siegel ${genusChip(z.def.artikel)}.` });
    }
    if (ana && !ana.ziele.length) out.push({ cls: 'bad', html: 'Kein Nomen direkt daneben.' });
  }
  if (isRune(base)) {
    const parts = Object.entries(base.adjektiv.bonus || {}).map(([k, v]) => {
      const label = STAT_ROWS.find((r) => r[0] === k)?.[1].split(' ').slice(1).join(' ') || k;
      return k === 'tempo' ? `+${fmt(v)} % ${label}` : `+${fmt(v)} ${label}`;
    });
    if (base.adjektiv.bonusProzent) parts.push(`alle Wirkungen +${base.adjektiv.bonusProzent} %`);
    out.push({ html: `Der Pfeil muss auf ein passendes Nomen zeigen: ${base.adjektiv.passtText}. Wirkung: ${parts.join(', ')}${where}.` });
    const b0 = G.DEFS[runeBase(base)];
    if (b0.steigerung) {
      const lv = base.stufe || 1;
      out.push({ html: `Steigerung: ${b0.name} → ${b0.steigerung.komparativ} → ${b0.steigerung.superlativ}. ${lv === 3 ? 'Das ist schon die höchste Stufe (Superlativ).' : `Drei gleiche Runen direkt nebeneinander werden zu Beginn des Tages gesteigert (+50 %).`}` });
    }
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
        ? { cls: 'ok', html: `✓ Siegel ${genusChip(sg.genus)} daneben: mehr Wirkung` }
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
  if (ref.src === 'shop') return !!G.run.shop[ref.slot];
  const p = placedOf(ref.uid);
  return !!p && p.area === ref.src;
}

function renderSummary(box) {
  const run = G.run;
  const ctx = playerCtx();
  const bag = itemsIn('bag').map((p) => bagInfo.get(p.uid).def);
  let leben = baseHp(run.day) + (ctx.leben || 0), startblock = 0, tempo = ctx.tempo || 0, glueck = 0;
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

  const reg = region();
  const boss = G.ENEMIES.find((e) => e.id === reg.boss);
  const fusions = findFusions(itemsIn('bag'), G.DEFS, G.RECIPES);
  const steig = findSteigerungen(itemsIn('bag'), G.DEFS);
  box.innerHTML = `
    <h2>Dein Rucksack</h2>
    ${ctx.hero ? `<p class="gram">${ctx.hero.emoji} <b>${ctx.hero.name}</b>: ${ctx.hero.staerke}</p>` : ''}
    ${ctx.unterklasse ? `<p class="gram">${ctx.unterklasse.emoji} <b>${ctx.unterklasse.name}</b>: ${ctx.unterklasse.text}</p>` : ''}
    ${ctx.fate ? `<p class="gram">${ctx.fate.emoji} <b>Schicksalsrune</b>: ${ctx.fate.text}</p>` : ''}
    <ul class="stats">${rows.map(([a, b]) => `<li><span>${a}</span><b>${b}</b></li>`).join('')}</ul>
    ${fusions.length ? `<p class="gram ok">✓ Morgen verschmelzen: ${fusions.map((f) => G.DEFS[f.id].name).join(', ')}</p>` : ''}
    ${steig.length ? `<p class="gram ok">✓ Morgen gesteigert: ${steig.map((s) => G.DEFS[s.id].name).join(', ')}</p>` : ''}
    ${run.day === reg.tage[1] ? `<p class="gram bad"><b>Heute Nacht wartet der Anführer: ${boss.emoji} ${boss.name}!</b></p>` : `<p class="muted">${boss.emoji} ${boss.name} wartet am ${reg.tage[1]}. Tag.</p>`}
    <h3>So geht's</h3>
    <p class="muted">Ziehe Items aus dem Laden in den Rucksack. Tippe ein Item an für Infos, tippe nochmal zum Drehen. Beim Ziehen dreht ein zweiter Finger das Item.</p>
    <p class="muted">🔥 Kraft links neben oder über einen Träger legen → verschmilzt morgen. ${genusChip('der')} ${genusChip('die')} ${genusChip('das')} Siegel neben ein passendes Nomen. ➤ Runen-Pfeil auf ein passendes Nomen richten.</p>
    <p class="muted">${run.day < CFG.lastDay ? `Morgen gibt es ${income(run.day + 1) + (run.goldBonus || 0)} 🪙. ` : 'Heute ist der letzte Tag deiner Reise! '}Mit 🔓 reservierst du ein Item im Laden.</p>`;
}

// ---------- Aktionen ----------

function onReroll() {
  if (!reroll(G.run, G.ITEMS, G.REGIONS)) { toast('Zu wenig Gold'); return; }
  if (selected?.src === 'shop') selected = null;
  bump('stat-gold');
  render();
}

function buyAuto(slot) {
  const def = G.DEFS[G.run.shop[slot].id];
  if (G.run.gold < def.preis) { toast('Zu wenig Gold'); return; }
  if (def.art === 'tasche') { buyTasche(slot); return; }
  for (const area of ['bag', 'store']) {
    const spot = findSpot(itemsIn(area), G.DEFS, def, gridOf(area));
    if (spot) {
      buy(slot, area, spot);
      if (area === 'store') toast('Rucksack voll – ins Lager gelegt');
      return;
    }
  }
  toast('Kein Platz mehr – verkaufe etwas');
}

function buy(slot, area, spot) {
  const run = G.run;
  const def = G.DEFS[run.shop[slot].id];
  run.gold -= def.preis;
  run.shop[slot] = null;
  const uid = run.nextUid++;
  run.items.push({ uid, id: def.id, area, ...spot });
  selected = run.tutorial ? null : { src: area, uid }; // im Tutorial soll das erste Antippen die Infos zeigen
  bump('stat-gold');
  render();
}

// Taschen liegen nicht im Raster: Sie werden außen an den Rucksack genäht.
function buyTasche(slot) {
  const run = G.run;
  const def = G.DEFS[run.shop[slot].id];
  if (run.gold < def.preis) { toast('Zu wenig Gold'); render(); return; }
  run.gold -= def.preis;
  run.shop[slot] = null;
  attachTasche(run, def);
  selected = null;
  bump('stat-gold');
  toast(`${def.name} angenäht: +${def.tasche.felder.length} Felder!`);
  render();
}

function sell(uid) {
  const p = placedOf(uid);
  const def = G.DEFS[p.id];
  G.run.items = G.run.items.filter((i) => i !== p);
  G.run.gold += sellValue(def);
  selected = null;
  toast(`${fullName(def)} verkauft: +${sellValue(def)} 🪙`);
  bump('stat-gold');
  render();
}

function moveAuto(uid, area) {
  const p = placedOf(uid);
  const spot = findSpot(itemsIn(area), G.DEFS, G.DEFS[p.id], gridOf(area));
  if (!spot) { toast(area === 'bag' ? 'Kein Platz im Rucksack' : 'Kein Platz im Lager'); return; }
  Object.assign(p, { area, ...spot });
  if (isRune(G.DEFS[p.id])) p.rot = 0;
  selected = { src: area, uid };
  render();
}

function rotateInPlace(uid) {
  const p = placedOf(uid);
  const def = G.DEFS[p.id];
  if (!canRotate(def)) return;
  const rot = nextRot(def, p.rot || 0);
  if (isRune(def)) { p.rot = rot; render(); emit('drehen', { id: p.id }); return; }
  const grid = gridOf(p.area);
  const others = itemsIn(p.area, uid);
  for (const [dx, dy] of [[0, 0], [-1, 0], [0, -1], [-1, -1], [1, 0], [0, 1]]) {
    if (canPlace(others, G.DEFS, def, p.x + dx, p.y + dy, rot, grid)) {
      Object.assign(p, { x: p.x + dx, y: p.y + dy, rot });
      render();
      emit('drehen', { id: p.id });
      return;
    }
  }
  toast('Kein Platz zum Drehen');
  document.querySelector(`.item[data-uid="${uid}"]`)?.classList.add('shake');
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
  selected = null;
  startNight(battleOver);
  emit('kampfStart');
}

function openMenu() {
  const run = G.run, l = run.lernen;
  modal(`
    <div class="big-emoji">🎒</div>
    <h2>Menü</h2>
    <p>${region().name} · Tag ${run.day} · ${run.wins} Siege · ${run.hearts} Herzen</p>
    ${l.richtig + l.falsch ? `<p>Grammatik-Aufgaben: ${l.richtig} richtig, ${l.falsch} daneben</p>` : ''}
    <div class="row">
      <button class="btn primary" data-act="close">Weiterspielen</button>
      <button class="btn danger" data-act="new">Neuer Lauf</button>
    </div>
    <div class="row">
      <button class="btn small" data-act="help">📖 So geht's</button>
      <button class="btn small" data-act="tutorial">🧙 Tutorial wiederholen</button>
      <button class="btn small" data-act="tips">💡 Erste-Mal-Tipps: ${tipsOn() ? 'an' : 'aus'}</button>
    </div>`, {
    new: () => confirmNew(),
    tutorial: startTutorial,
    help: () => showHelp(openMenu),
    tips: () => { setTips(!tipsOn()); toast(`Erste-Mal-Tipps sind jetzt ${tipsOn() ? 'an' : 'aus'}.`); openMenu(); },
  });
}

function confirmNew() {
  modal(`
    <h2>Wirklich neu anfangen?</h2>
    <p>Der laufende Lauf geht verloren.</p>
    <div class="row">
      <button class="btn" data-act="close">Abbrechen</button>
      <button class="btn danger" data-act="yes">Neuer Lauf</button>
    </div>`, { yes: showHeroes });
}

// ---------- Verschmelzen (zu Beginn des Tages) ----------

function runFusions(done) {
  showFusion(findFusions(itemsIn('bag'), G.DEFS, G.RECIPES), 0, () => runSteigerungen(done));
}

// Drei gleiche Runen nebeneinander: Grundform → Komparativ → Superlativ.
function runSteigerungen(done) {
  const list = findSteigerungen(itemsIn('bag'), G.DEFS);
  if (list.length) emit('tipp', { key: 'steigerung' });
  showSteigerung(list, 0, done);
}

function showSteigerung(list, i, done) {
  const run = G.run;
  if (i >= list.length) { render(); done(); return; }
  const s = list[i];
  if (s.runen.some((r) => placedOf(r.uid)?.area !== 'bag')) { showSteigerung(list, i + 1, done); return; }
  const from = G.DEFS[s.runen[0].id], to = G.DEFS[s.id];
  const base = G.DEFS[runeBase(from)];
  const st = base.steigerung;
  const toSup = to.stufe === 3;
  const options = shuffle([to.name, ...(toSup ? st.falschS : st.falschK)]);
  const stufeName = toSup ? 'Superlativ (höchste Stufe)' : 'Komparativ (Vergleichsstufe)';
  const regel = `${base.name} → ${st.komparativ} → ${st.superlativ}${st.unregelmaessig ? ' – eine unregelmäßige Steigerung!' : ''}`;
  let tries = 0, feedback = '';
  const wrong = new Set();

  const draw = () => {
    const paid = tries > 0 && !run.tutorial;
    const broke = paid && run.gold < 1;
    const card = openModal(`
      <div class="fusion-eq">${[0, 1, 2].map(() => `<span class="fi">${from.emoji}<small>${from.name}</small></span>`).join('<span class="op">+</span>')}</div>
      <p class="enc-progress">Drei gleiche Runen werden zur nächsten Stufe: ${stufeName}</p>
      <h2 class="enc-q">${from.name} → <span class="blank">___</span></h2>
      <div class="row wrap">${options.map((o, k) => `<button class="btn opt-btn" data-k="${k}" ${wrong.has(k) || broke ? 'disabled' : ''}>${o}</button>`).join('')}</div>
      <p class="cost">${paid ? `Jeder weitere Versuch kostet 1 🪙 · du hast ${run.gold} 🪙` : 'Erster Versuch kostenlos'}</p>
      ${feedback ? `<p class="feedback">${feedback}</p>` : ''}
      ${broke ? '<p class="feedback">Kein Gold für einen weiteren Versuch.</p>' : ''}
      <div class="row"><button class="btn small" data-later>Heute nicht steigern</button></div>`);
    card.querySelectorAll('[data-k]').forEach((b) => { b.onclick = () => guess(options[+b.dataset.k], +b.dataset.k); });
    card.querySelector('[data-later]').onclick = () => { closeModal(); showSteigerung(list, i + 1, done); };
  };

  const guess = (o, k) => {
    if (tries > 0) {
      if (run.gold < 1) return;
      run.gold -= 1;
      bump('stat-gold');
    }
    tries++;
    if (o === to.name) {
      run.lernen.richtig++;
      const keep = placedOf(s.mitte.uid);
      const others = new Set(s.runen.filter((r) => r.uid !== keep.uid).map((r) => r.uid));
      run.items = run.items.filter((p) => !others.has(p.uid));
      keep.id = to.id;
      selected = { src: 'bag', uid: keep.uid };
      render();
      const card = openModal(`
        <div class="big-emoji">${to.emoji}<sup class="lvl">${to.abzeichen}</sup></div>
        <h2>${to.name}</h2>
        <p>Richtig! ${regel}</p>
        <p class="muted">Die Rune wirkt jetzt 50 % stärker.</p>
        <div class="row"><button class="btn primary big" data-next>Weiter</button></div>`);
      card.querySelector('[data-next]').onclick = () => { closeModal(); showSteigerung(list, i + 1, done); };
      return;
    }
    run.lernen.falsch++;
    wrong.add(k);
    feedback = `✗ ${regel}`;
    save();
    draw();
  };

  draw();
}

function showFusion(list, i, done) {
  const run = G.run;
  if (i >= list.length) { render(); done(); return; }
  const f = list[i];
  const k = placedOf(f.kraft.uid), t = placedOf(f.traeger.uid);
  if (!k || !t || k.area !== 'bag' || t.area !== 'bag') { showFusion(list, i + 1, done); return; }
  const kd = G.DEFS[k.id], td = G.DEFS[t.id], cd = G.DEFS[f.id];
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
      <p class="cost">${run.tutorial ? (tries ? 'Probier es noch einmal!' : '') : paid ? `Jeder weitere Versuch kostet 1 🪙 · du hast ${run.gold} 🪙` : 'Erster Versuch kostenlos'}</p>
      ${feedback ? `<p class="feedback">${feedback}</p>` : ''}
      ${broke ? '<p class="feedback">Kein Gold für einen weiteren Versuch.</p>' : ''}
      ${run.tutorial ? '' : '<div class="row"><button class="btn small" data-later>Heute nicht verschmelzen</button></div>'}`);
    card.querySelectorAll('[data-g]').forEach((b) => { b.onclick = () => guess(b.dataset.g); });
    const later = card.querySelector('[data-later]');
    if (later) later.onclick = () => { closeModal(); showFusion(list, i + 1, done); };
  };

  const guess = (g) => {
    if (tries > 0 && !run.tutorial) {
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
      card.querySelector('[data-next]').onclick = () => { closeModal(); showFusion(list, i + 1, done); };
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
    const grid = gridOf(area);
    const x = Math.max(0, Math.min(grid.cols - s.w, Math.round((left - 3 - ox) / cell)));
    const y = Math.max(0, Math.min(grid.rows - s.h, Math.round((top - 3 - oy) / cell)));
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
  if (drag.ref.src === 'shop' && G.run.gold < drag.def.preis) return { status: 'bad', reason: 'gold' };
  if (drag.def.art === 'tasche') return area === 'bag' ? { status: 'ok' } : { status: 'bad' };
  const grid = gridOf(area);
  const list = itemsIn(area, selfUid);
  if (canPlace(list, G.DEFS, drag.def, x, y, drag.rot, grid)) return { status: 'ok' };
  if (area !== 'bag') return { status: 'bad' };
  // Felder müssen trotzdem zum Rucksack gehören.
  if (!canPlace([], G.DEFS, drag.def, x, y, drag.rot, grid)) return { status: 'bad' };

  const hit = overlapping(list, G.DEFS, x, y, s.w, s.h);
  const store = itemsIn('store', selfUid);
  const moves = [];
  for (const o of hit) {
    const spot = findSpot(store, G.DEFS, G.DEFS[o.id], gridOf('store'));
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
  if (d.def.art === 'tasche') { buyTasche(d.ref.slot); return; }
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
  else {
    selected = ref;
    render();
    if (ref.src !== 'shop') emit('auswahl', { id: placedOf(ref.uid).id, area: ref.src });
  }
}

// ---------- Nach dem Kampf ----------

function battleOver(won, enemyName) {
  const run = G.run;
  finishBattle(run, G.ITEMS, G.REGIONS, won, enemyName);
  save();
  const heartsLeft = Math.max(0, run.hearts);
  modal(won ? `
      <div class="big-emoji">🏆</div>
      <h2>Sieg!</h2>
      <p>Du hast gegen ${enemyName} gewonnen.</p>
      <p>Siege: <b>${run.wins}</b> · Herzen: <b>${'❤️'.repeat(heartsLeft)}${'🤍'.repeat(CFG.hearts - heartsLeft)}</b></p>
      <div class="row"><button class="btn primary big" data-act="next">Weiter</button></div>` : `
      <div class="big-emoji">💔</div>
      <h2>Niederlage</h2>
      <p>${enemyName} war heute stärker. Du verlierst ein Herz.</p>
      <p>Herzen: <b>${'❤️'.repeat(heartsLeft)}${'🤍'.repeat(CFG.hearts - heartsLeft)}</b></p>
      <div class="row"><button class="btn primary big" data-act="next">Weiter</button></div>`,
  { next: afterBattle });
  emit('kampfEnde', { won });
}

function afterBattle() {
  if (G.run.tutorial) { showGame(); render(); emit('nachKampf'); return; } // das Tutorial führt weiter
  if (G.run.over) { showRunEnd(); return; }
  showGame();
  toast(`Neuer Tag: +${income(G.run.day)} 🪙`);
  continueFlow();
}

function showRunEnd() {
  const run = G.run;
  const won = run.over === 'won';
  const stars = run.wins >= 10 ? '🌟🌟🌟' : run.wins >= 8 ? '⭐⭐⭐' : run.wins >= 6 ? '⭐⭐' : '⭐';
  modal(won ? `
      <div class="big-emoji">👑</div>
      <h2>Reise geschafft!</h2>
      <p>Du hast Kleinwurzel und Hrossmark durchquert: <b>${run.wins} von ${CFG.lastDay}</b> Kämpfen gewonnen.</p>
      <p class="stars">${stars}</p>
      <p>${run.wins >= 10 ? 'Kein einziger Kampf verloren – unglaublich!' : 'Die Wörter der Wanderlande sind ein Stück sicherer.'}</p>
      <div class="row"><button class="btn primary big" data-act="new">Neuer Lauf</button><button class="btn" data-act="home">Zum Start</button></div>` : `
      <div class="big-emoji">🪦</div>
      <h2>Lauf verloren</h2>
      <p>Alle Herzen sind weg – an Tag ${run.day} in ${region().name}. Du hast <b>${run.wins}</b> Kämpfe gewonnen.</p>
      <p>Probier es gleich nochmal – jeder Lauf ist anders.</p>
      <div class="row"><button class="btn primary big" data-act="new">Neuer Lauf</button><button class="btn" data-act="home">Zum Start</button></div>`,
  {
    new: showHeroes,
    home: () => {
      G.run = null;
      showStart();
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
