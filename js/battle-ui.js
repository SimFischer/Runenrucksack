// Nacht: Kampfanzeige mit Lebensbalken, Abklingzeiten und Schadenszahlen.
import { CFG, makeEnemy, pickEnemy, rectGrid, pickOne, shuffle, ARMOR_BONUS, enemyPool, seededRng } from './logic.js';
import { Battle, makeFighter, runToEnd } from './battle.js';
import { analyze } from './grammar.js';
import { G, itemsIn, gridOf, region, hero, playerCtx, emit, figurBild, gegnerBild } from './state.js';
import { evaluateBag } from './mods.js';
import { merkeAntwort, laufStand } from './fortschritt.js';
import { $, fmt, buildGrid, drawItems, openModal, closeModal } from './ui.js';

let battle = null, enemy = null, speed = 1, rafId = 0, lastFrame = 0, itemEls = {}, onDone = null;
let bcell = 100, selfHit = 0, armor = null, paused = false;

// Für das Tutorial: Kampf von außen starten und kurz anhalten.
export const battleControl = {
  start: () => { if (!$('btn-start-battle').hidden) beginBattle(); },
  pause: () => { paused = true; },
  resume: () => { paused = false; },
};

function cellSize(cols, rows) {
  const w = window.innerWidth, h = window.innerHeight;
  const perSide = (w - 200) / 2 - 40;
  return Math.max(44, Math.min(130, Math.floor(Math.min(perSide / cols, (h - 300) / rows))));
}

// Startet die Nacht. done(won, enemyName) wird nach dem Ergebnisfenster aufgerufen.
export function startNight(done) {
  onDone = done;
  paused = false;
  const run = G.run;
  const reg = region();
  // Im Tutorial: schwacher Übungsgegner mit festen Gegenständen und festem Zufall.
  const tut = run.tutorial && G.ENEMIES.find((e) => e.id === G.TUTORIAL.uebungsgegner);
  const rng = tut ? seededRng(G.TUTORIAL.start.zufall) : Math.random;
  const foeDef = tut || pickEnemy(run.day, G.REGIONS, G.ENEMIES);
  enemy = tut
    ? { ...tut, items: tut.ausruestung.map((a, i) => ({ uid: i + 1, rot: 0, ...a })) }
    : makeEnemy(run.day, foeDef, enemyPool(G.ITEMS, G.COMPOUNDS, run.day), G.DEFS);
  armor = foeDef.fehler?.length ? { ...pickOne(foeDef.fehler), status: 'offen' } : null;

  const ctx = playerCtx();
  const bag = itemsIn('bag');
  const player = makeFighter(hero()?.name || 'Dein Rucksack', bag, G.DEFS, run.day, {
    info: evaluateBag(bag, G.DEFS, ctx), leben: ctx.leben, tempo: ctx.tempo, selbstschaden: ctx.selbstschaden, rng,
  });
  selfHit = ctx.selbstschaden;
  const foe = makeFighter(enemy.name, enemy.items, G.DEFS, run.day, { rng });
  battle = new Battle(player, foe);
  itemEls = { player: {}, enemy: {} };

  const playerGrid = gridOf('bag');
  const enemyGrid = rectGrid(CFG.bagCols, CFG.bagRows);
  bcell = cellSize(Math.max(playerGrid.cols, 4), Math.max(playerGrid.rows, 3));

  $('battle-title').textContent = `🌙 ${reg.name} · Nacht ${run.day}${enemy.boss ? ' · Anführer!' : ''}`;
  const h = hero();
  const hb = h && figurBild(h.id), gb = gegnerBild(enemy.id);
  buildFighter('player', hb ? `<img class="f-img" src="${hb}" alt="">` : `${h?.emoji || ''}<span class="f-bag">🎒</span>`, h?.name || 'Dein Rucksack', h ? `mit dem Runenrucksack · ${h.volk}` : `Tag ${run.day}`, bag, playerGrid, evaluateBag(bag, G.DEFS, ctx));
  buildFighter('enemy', gb ? `<img class="f-img" src="${gb}" alt="">` : enemy.emoji, enemy.name, armorHtml(), enemy.items, enemyGrid, analyze(enemy.items, G.DEFS));
  bindArmor();
  updateBattleUi();
  setSpeed(speed);
  $('btn-start-battle').hidden = false;
  $('btn-start-battle').onclick = beginBattle;
  $('btn-skip').onclick = skipBattle;
  $('btn-skip').disabled = false;
  $('speed').onclick = (e) => { const b = e.target.closest('[data-speed]'); if (b) setSpeed(+b.dataset.speed); };
  for (const id of ['start', 'heroes', 'game', 'battle']) $(id).hidden = id !== 'battle';
  if (enemy.boss) emit('tipp', { key: 'boss' });
  else if (armor) emit('tipp', { key: 'ruestung' });
}

function buildFighter(side, emoji, name, sub, placed, grid, info) {
  const box = $('fighter-' + side);
  box.innerHTML = `
    <div class="f-head">
      <div class="f-portrait">${emoji}</div>
      <div class="f-text">
        <div class="f-name">${name}</div>
        <div class="f-armor">${sub}</div>
      </div>
    </div>
    <div class="hpbar"><div class="fill"></div><div class="text"></div></div>
    <div class="f-status"></div>
    <div class="grid"></div>`;
  const gridEl = box.querySelector('.grid');
  buildGrid(gridEl, grid, bcell);
  itemEls[side] = drawItems(gridEl, grid, placed, bcell, info, 'battle');
  for (const el of Object.values(itemEls[side])) el.style.cursor = 'default';
}

function setSpeed(s) {
  speed = s;
  document.querySelectorAll('#speed [data-speed]').forEach((b) => b.classList.toggle('active', +b.dataset.speed === s));
}

function beginBattle() {
  $('btn-start-battle').hidden = true;
  if (armor?.status === 'offen') { armor.status = 'vorbei'; refreshArmor(); }
  if (selfHit) floater($('fighter-player'), `😈 -${selfHit} Fluch`, 'gift');
  lastFrame = performance.now();
  rafId = requestAnimationFrame(frame);
}

function frame(now) {
  const dt = paused ? 0 : Math.min(0.1, (now - lastFrame) / 1000) * speed;
  lastFrame = now;
  const events = battle.advance(dt);
  for (const ev of events) showEvent(ev);
  updateBattleUi();
  if (battle.result) {
    $('btn-skip').disabled = true;
    setTimeout(finish, 700);
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
  finish();
}

function finish() {
  onDone(battle.result === 'win', enemy.name);
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

export function floater(box, text, cls) {
  if (box.querySelectorAll('.floater').length > 8) return; // bei hohem Tempo nicht zu viele
  const f = document.createElement('div');
  f.className = 'floater ' + cls;
  f.textContent = text;
  f.style.left = 30 + Math.random() * 50 + '%';
  f.style.top = 150 + Math.random() * 120 + 'px';
  box.append(f);
  setTimeout(() => f.remove(), 1000);
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
  if (text) floater(box, text, cls);
}

// ---------- Fehler auf der Ork-Rüstung ----------

function armorHtml() {
  const who = enemy.boss ? 'Anführer der Orks' : 'Wirrwarr-Ork';
  if (!armor) return who;
  if (armor.status === 'richtig') return `Rüstung: <s>${armor.falsch}</s> → <b class="ok">${armor.richtig}</b> · geschwächt!`;
  if (armor.status === 'falsch' || armor.status === 'vorbei') return `Auf der Rüstung steht: <b>${armor.falsch}</b>`;
  return `Auf der Rüstung steht: <button class="armor-word" id="armor-word" data-tut="ruestung">${armor.falsch} 🔍</button>`;
}

function refreshArmor() {
  const el = $('fighter-enemy').querySelector('.f-armor');
  if (el) el.innerHTML = armorHtml();
  bindArmor();
}

function bindArmor() {
  const btn = $('armor-word');
  if (btn) btn.onclick = openArmor;
}

// Ein Versuch pro Kampf: richtig → Gegner startet mit 15 % weniger Leben.
function openArmor() {
  const run = G.run;
  const options = shuffle(armor.optionen);
  const card = openModal(`
    <div class="big-emoji">${enemy.emoji}</div>
    <p class="enc-hint">Auf der Rüstung steht ein falsches Wort: <b class="bad-word">${armor.falsch}</b></p>
    <h2>Wie schreibt man es richtig?</h2>
    <div class="row wrap">${options.map((o, k) => `<button class="btn opt-btn" data-k="${k}">${o}</button>`).join('')}</div>
    <p class="cost">Nur ein Versuch! Richtig verbessert: Der Ork startet mit 15 % weniger Leben.</p>
    <div class="row"><button class="btn small" data-no>Lieber nicht</button></div>`);
  card.querySelectorAll('[data-k]').forEach((b) => {
    b.onclick = () => {
      const ok = options[+b.dataset.k] === armor.richtig;
      armor.status = ok ? 'richtig' : 'falsch';
      run.lernen[ok ? 'richtig' : 'falsch']++;
      merkeAntwort(run, 'rechtschreibung', ok, true);
      if (ok) laufStand(run).orkFehler++;
      if (ok) {
        const f = battle.sides.enemy;
        f.hp = Math.round(f.maxHp * (1 - ARMOR_BONUS));
        updateBattleUi();
        floater($('fighter-enemy'), `-${Math.round(f.maxHp * ARMOR_BONUS)} Rüstung kaputt!`, 'schaden');
      }
      const res = openModal(ok ? `
        <div class="big-emoji">💥</div>
        <h2>Richtig: ${armor.richtig}</h2>
        <p>Die Rüstung bekommt einen Riss! ${enemy.name} startet mit 15 % weniger Leben.</p>
        <div class="row"><button class="btn primary big" data-ok>Weiter</button></div>` : `
        <div class="big-emoji">🛡️</div>
        <h2>Leider nicht</h2>
        <p class="feedback">Richtig wäre: <b>${armor.richtig}</b>. ${armor.erklaerung}</p>
        <p class="muted">Der Ork bleibt so stark wie vorher.</p>
        <div class="row"><button class="btn primary" data-ok>Weiter</button></div>`);
      res.querySelector('[data-ok]').onclick = () => { closeModal(); refreshArmor(); emit('ruestungFertig', { ok }); };
    };
  });
  card.querySelector('[data-no]').onclick = closeModal;
}
