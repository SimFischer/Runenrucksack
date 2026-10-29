// Nacht: Kampfanzeige mit Lebensbalken, Abklingzeiten und Schadenszahlen.
import { CFG, makeEnemy, pickEnemy, rectGrid, pickOne, shuffle, ARMOR_BONUS, enemyPool, seededRng, laufRng, bestandFaktor } from './logic.js';
import { Battle, makeFighter, runToEnd } from './battle.js';
import { analyze } from './grammar.js';
import { G, itemsIn, gridOf, region, hero, playerCtx, emit, figurBild, gegnerBild } from './state.js';
import { evaluateBag } from './mods.js';
import { merkeAntwort, laufStand } from './fortschritt.js';
import { frageImSpiel } from './aufgaben/spiel.js';
import { $, fmt, buildGrid, drawItems, openModal, closeModal } from './ui.js';
import { sym, bild, symbolPfad } from './symbole.js';

let battle = null, enemy = null, speed = 1, rafId = 0, lastFrame = 0, itemEls = {}, onDone = null;
let bcell = 100, selfHit = 0, armor = null, paused = false;

// Für das Tutorial: Kampf von außen starten und kurz anhalten.
export const battleControl = {
  start: () => { if (!$('btn-start-battle').hidden) beginBattle(); },
  pause: () => { paused = true; },
  resume: () => { paused = false; },
  // Zum Hauptmenü im Kampf: Kampf abbrechen, ohne ihn zu werten – der Lauf geht vor diesem Kampf weiter
  abbrechen: () => { cancelAnimationFrame(rafId); battle = null; paused = false; },
};

// Feste Bereiche der Kampfszene (siehe gestaltung.css): Mitte 150 px für VS und „Los!“, je Seite eine Spalte
// für die Figur und eine für den Rucksack. Der Rucksack passt immer in seinen Bereich: Bei mehr Feldern
// (bis 5×4 und Taschen) werden die Felder kleiner, statt dass der Rucksack wächst.
export const KAMPF_MITTE = 150, KAMPF_OBEN = 150, LEDER = 26;
export const figurBreite = (w) => Math.round(Math.min(260, Math.max(140, w * 0.16)));
export function kampfZelle(w, h, cols, rows) {
  const seite = (w - KAMPF_MITTE - 2 * 10 - 28) / 2;
  const breit = seite - figurBreite(w) - 2 * LEDER - 12;
  const hoch = h - 64 - KAMPF_OBEN - 2 * LEDER - 24;
  return Math.max(22, Math.min(100, Math.floor(Math.min(breit / cols, hoch / rows))));
}
function cellSize(cols, rows) {
  return kampfZelle(window.innerWidth, window.innerHeight, cols, rows);
}

// Startet die Nacht. done(won, enemyName) wird nach dem Ergebnisfenster aufgerufen.
export function startNight(done) {
  onDone = done;
  paused = false;
  const run = G.run;
  const reg = region();
  // Im Tutorial: schwacher Übungsgegner mit festen Gegenständen und festem Zufall.
  const tut = run.tutorial && G.ENEMIES.find((e) => e.id === G.TUTORIAL.uebungsgegner);
  // Rune der Woche: fester Zufall für Gegner und Kampf (laufRng), sonst Math.random
  const rng = tut ? seededRng(G.TUTORIAL.start.zufall) : laufRng(run, 'kampf');
  const foeDef = tut || pickEnemy(run.day, G.REGIONS, G.ENEMIES, laufRng(run, 'gegner'));
  enemy = tut
    ? { ...tut, items: tut.ausruestung.map((a, i) => ({ uid: i + 1, rot: 0, ...a })) }
    : makeEnemy(run.day, { ...foeDef, ...bestandVon(run) }, enemyPool(G.ITEMS, G.COMPOUNDS, run.day, run.freieItems || []), G.DEFS, laufRng(run, 'gegner-rucksack'), enemyPool(G.ITEMS, G.COMPOUNDS, run.day));
  // Rüstung mit Fehler: im Tutorial ein festes Wort, sonst ein Satz mit einem Fehler (Aufgabenformat „Fehler finden“)
  armor = !foeDef.fehler?.length ? null : tut ? { ...pickOne(foeDef.fehler), status: 'offen' } : { satz: true, status: 'offen' };

  const ctx = playerCtx();
  const bag = itemsIn('bag');
  const player = makeFighter(hero()?.name || 'Dein Rucksack', bag, G.DEFS, run.day, {
    info: evaluateBag(bag, G.DEFS, ctx), leben: ctx.leben, tempo: ctx.tempo, selbstschaden: ctx.selbstschaden, rng,
    ersterAngriffDoppelt: ctx.ersterAngriffDoppelt,
  });
  selfHit = ctx.selbstschaden;
  const foe = makeFighter(enemy.name, enemy.items, G.DEFS, run.day, { rng, klug: enemy.klug, faehigkeit: bossFaehigkeit(enemy, run.day) });
  battle = new Battle(player, foe);
  itemEls = { player: {}, enemy: {} };

  const playerGrid = gridOf('bag');
  const enemyGrid = rectGrid(CFG.bagCols, CFG.bagRows);
  // beide Rucksäcke gleich groß: nach dem größeren
  bcell = cellSize(Math.max(playerGrid.cols, enemyGrid.cols, 4), Math.max(playerGrid.rows, enemyGrid.rows, 3));

  $('battle-title').innerHTML = `${sym('nacht')} ${reg.name} · Nacht ${run.day}${enemy.boss ? ' · Anführer!' : ''}`;
  $('battle-gold').innerHTML = `${sym('gold')}${run.gold}`;
  const h = hero();
  const hb = h && figurBild(h.id), gb = gegnerBild(enemy.id);
  buildFighter('player', hb ? `<img class="f-img" src="${hb}" alt="">` : '', h?.kurz || 'Dein Rucksack', '', bag, playerGrid, evaluateBag(bag, G.DEFS, ctx));
  buildFighter('enemy', gb ? `<img class="f-img" src="${gb}" alt="">` : '', enemy.name, armorHtml(), enemy.items, enemyGrid, analyze(enemy.items, G.DEFS));
  bindArmor();
  updateBattleUi();
  setSpeed(speed);
  $('btn-start-battle').hidden = false;
  $('btn-start-battle').innerHTML = `${sym('kampf')} Los!`;
  document.documentElement.style.setProperty('--figur-b', figurBreite(window.innerWidth) + 'px');
  $('btn-start-battle').onclick = beginBattle;
  $('btn-skip').onclick = skipBattle;
  $('btn-skip').disabled = false;
  $('speed').onclick = (e) => { const b = e.target.closest('[data-speed]'); if (b) setSpeed(+b.dataset.speed); };
  for (const id of ['start', 'heroes', 'game', 'battle']) $(id).hidden = id !== 'battle';
  if (enemy.boss) emit('tipp', { key: 'boss' });
  else if (armor) emit('tipp', { key: 'ruestung' });
}

// Eine Seite der Szene: Namensband, Lebensbalken, Zustände; darunter die Figur groß und der Rucksack aus Leder.
function buildFighter(side, bildHtml, name, sub, placed, grid, info) {
  const box = $('fighter-' + side);
  box.innerHTML = `
    <div class="f-oben">
      <div class="f-band"><span class="f-name">${name}</span></div>
      <div class="hpbar"><div class="fill"></div><div class="text"></div></div>
      <div class="f-zeile"><div class="f-status"></div><div class="f-armor">${sub}</div></div>
    </div>
    <div class="f-figur">${bildHtml}</div>
    <div class="f-rucksack"><div class="grid"></div></div>`;
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
  if (selfHit) floater($('fighter-player'), `-${selfHit} Fluch`, 'gift');
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
  $('battle-time').innerHTML = `${sym('sanduhr')} ${fmt(Math.floor(battle.time * 10) / 10)} s`;
  for (const side of ['player', 'enemy']) {
    const f = battle.sides[side];
    const box = $('fighter-' + side);
    const hp = Math.max(0, Math.ceil(f.hp));
    box.querySelector('.fill').style.width = (100 * Math.max(0, f.hp)) / f.maxHp + '%';
    box.querySelector('.hpbar .text').textContent = `${hp} / ${f.maxHp}`;
    const chips = [];
    if (f.block > 0) chips.push(`<span class="chip block">${sym('block')}${Math.round(f.block)}</span>`);
    if (f.gift > 0) chips.push(`<span class="chip gift">${sym('gift')}${f.gift}</span>`);
    if (f.brand > 0) chips.push(`<span class="chip brand">${sym('brand')}${f.brand}</span>`);
    if (f.kaelte > 0) chips.push(`<span class="chip kaelte">${sym('kaelte')}${fmt(Math.ceil(f.kaelte * 10) / 10)} s</span>`);
    if (f.betaeubt > 0) chips.push(`<span class="chip betaeubung">${sym('betaeubung')}${fmt(Math.ceil(f.betaeubt * 10) / 10)} s</span>`);
    if (f.regeneration > 0) chips.push(`<span class="chip regeneration">${sym('heilung')}${f.regeneration}</span>`);
    if (f.tempo > 0) chips.push(`<span class="chip">${sym('tempo')}+${Math.round(f.tempo * 100)} %</span>`);
    if (f.glueck > 0) chips.push(`<span class="chip">${sym('glueck')}${Math.round(f.glueck * 100)} %</span>`);
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
  const fig = box.querySelector('.f-figur');
  const b = box.getBoundingClientRect(), r = fig?.getBoundingClientRect() || b;
  f.style.left = Math.max(10, Math.min(b.width - 170, r.left - b.left + r.width * (0.15 + Math.random() * 0.4))) + 'px';
  f.style.top = r.top - b.top + r.height * (0.15 + Math.random() * 0.25) + 'px';
  box.append(f);
  setTimeout(() => f.remove(), 1000);
}

// Welcher Effekt fliegt? Nach der stärksten Wirkung des Gegenstands (Bögen schießen Pfeile).
function effektFuer(def) {
  if (!def) return null;
  const basis = def.teile?.traeger || def.id;
  if (def.heilung || def.regeneration) return { bild: 'heilung', ziel: 'selbst' };
  if (def.block && !def.schaden) return { bild: 'schildblitz', ziel: 'selbst' };
  if (def.brand) return { bild: 'feuer', ziel: 'gegner' };
  if (def.gift) return { bild: 'giftwolke', ziel: 'gegner' };
  if (def.kaelte) return { bild: 'eis', ziel: 'gegner' };
  if (def.betaeubung) return { bild: 'blitz', ziel: 'gegner' };
  if (/bogen|schiessen/.test(basis)) return { bild: 'pfeil', ziel: 'gegner' };
  if (def.schaden) return { bild: 'treffer', ziel: 'gegner' };
  return null;
}

function effektFliegt(side, el, def) {
  const e = effektFuer(def);
  if (!e || !el || !document.body.animate || document.querySelectorAll('.effekt').length > 6) return;
  const zielSeite = e.ziel === 'selbst' ? side : side === 'player' ? 'enemy' : 'player';
  const ziel = $('fighter-' + zielSeite).querySelector('.f-figur')?.getBoundingClientRect();
  const von = el.getBoundingClientRect();
  if (!ziel) return;
  const f = document.createElement('img');
  f.className = 'effekt';
  f.src = bild('effekte', e.bild);
  document.body.append(f);
  const ax = von.left + von.width / 2, ay = von.top + von.height / 2, bx = ziel.left + ziel.width / 2, by = ziel.top + ziel.height * 0.45;
  const winkel = Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
  const dreh = e.bild === 'pfeil' || e.bild === 'feuer' ? ` rotate(${winkel}deg)` : '';
  const dauer = Math.max(260, 520 / speed);
  f.animate([
    { transform: `translate(${ax}px, ${ay}px) translate(-50%, -50%)${dreh} scale(.6)`, opacity: 0 },
    { opacity: 1, offset: .2 },
    { transform: `translate(${bx}px, ${by}px) translate(-50%, -50%)${dreh} scale(1.15)`, opacity: 1, offset: .85 },
    { transform: `translate(${bx}px, ${by}px) translate(-50%, -50%)${dreh} scale(1.4)`, opacity: 0 },
  ], { duration: dauer, easing: 'ease-in' }).onfinish = () => f.remove();
}

function wackeln(side) {
  const p = $('fighter-' + side).querySelector('.f-figur');
  if (!p) return;
  p.classList.remove('hit'); void p.offsetWidth; p.classList.add('hit');
}

// Bestand des Laufs für die Gegnerstärke: Anteil der freigeschalteten Gegenstände
function bestandVon(run) {
  const anteil = Math.min(1, (run.freieItems || []).length / Math.max(1, G.ITEMS.filter((d) => d.freischaltung).length));
  return { anteil, budgetFaktor: bestandFaktor(anteil) };
}

// Boss-Fähigkeit für den Kampf (eigene Kopie, damit „erledigt“ nicht im Gegner hängen bleibt)
export function bossFaehigkeit(enemy, day) {
  const f = enemy.faehigkeit;
  if (!f) return null;
  return f.typ === 'wolf' ? { ...f, schaden: Math.round(f.schaden + (f.schadenProTag || 0) * day) } : { ...f };
}

function showEvent(ev) {
  const box = $('fighter-' + ev.side);
  let text = '', cls = '';
  if (ev.type === 'trigger') {
    const el = itemEls[ev.side][ev.uid];
    if (el) { el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }
    effektFliegt(ev.side, el, battle.sides[ev.side].items.find((x) => x.uid === ev.uid)?.def);
    if (!ev.crit) return;
    text = 'Glück! ×2';
    cls = 'glueck';
  } else if (ev.type === 'damage') {
    if (ev.amount > 0) {
      text = `-${ev.amount}`;
      cls = ev.kind;
      wackeln(ev.side);
    } else if (ev.blocked > 0) { text = 'geblockt'; cls = 'block'; }
  } else if (ev.type === 'block') { text = `+${ev.amount} Block`; cls = 'block'; }
  else if (ev.type === 'heal') { text = `+${ev.amount}`; cls = 'heal'; }
  else if (ev.type === 'falke') { text = 'Falke: doppelter Treffer!'; cls = 'glueck'; }
  else if (ev.type === 'stehlen') {
    floater($('fighter-player'), 'Gestohlen!', 'schaden');
    text = 'Der Plünderer stiehlt die Wirkung!'; cls = 'glueck';
  } else if (ev.type === 'wolf') { text = 'Ein Wolf greift mit an!'; cls = 'schaden'; }
  else if (ev.type === 'status') {
    const secs = ev.kind === 'kaelte' || ev.kind === 'betaeubung';
    text = `+${secs ? fmt(ev.amount) + ' s' : ev.amount}`;
    cls = ev.kind;
  }
  if (text) floater(box, text, cls);
}

// ---------- Fehler auf der Ork-Rüstung ----------

function armorHtml() {
  if (!armor) return '';
  if (armor.status === 'richtig') return '<span class="f-siegel" title="Rüstungsfehler verbessert"><b>✓</b>geschwächt</span>';
  if (armor.satz) {
    if (armor.status === 'richtig') return `Rüstung: <b class="ok">${armor.richtig || 'Fehler'} ✓</b> · geschwächt!`;
    if (armor.status === 'falsch' || armor.status === 'vorbei') return '';
    return '<button class="armor-word btn small" id="armor-word" data-tut="ruestung">Fehler auf der Rüstung</button>';
  }
  if (armor.status === 'falsch' || armor.status === 'vorbei') return `Auf der Rüstung steht: <b>${armor.falsch}</b>`;
  return `Auf der Rüstung steht: <button class="armor-word" id="armor-word" data-tut="ruestung">${armor.falsch}</button>`;
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
function armorErgebnis(ok) {
  if (ok) {
    laufStand(G.run).orkFehler++;
    const f = battle.sides.enemy;
    f.hp = Math.round(f.maxHp * (1 - ARMOR_BONUS));
    updateBattleUi();
    floater($('fighter-enemy'), `-${Math.round(f.maxHp * ARMOR_BONUS)} Rüstung kaputt!`, 'schaden');
  }
}

function openArmor() {
  const run = G.run;
  if (armor.satz) {
    // Begleiter Rabe im Rucksack: Er zeigt das falsche Wort – verbessern muss das Kind es selbst.
    frageImSpiel({ art: 'ork', format: 'fehler', einVersuch: true, nein: 'Lieber nicht', zielMarkieren: !!playerCtx().ruestungMarkieren,
      kopf: `<span class="af-wer">Rüstung · nur ein Versuch!</span>` }).then((r) => {
      if (r.abgebrochen) return;
      const a = r.aufgabe;
      armor.richtig = Object.values(a.korrektur || {})[0] || '';
      armor.status = r.richtig ? 'richtig' : 'falsch';
      armorErgebnis(!!r.richtig);
      refreshArmor();
      emit('ruestungFertig', { ok: !!r.richtig });
    });
    return;
  }
  const options = shuffle(armor.optionen);
  const card = openModal(`
    <div class="big-emoji">${sym('kampf', 'gross')}</div>
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
      armorErgebnis(ok);
      const res = openModal(ok ? `
        <div class="big-emoji">${sym('stern', 'gross')}</div>
        <h2 class="lern">Richtig: ${armor.richtig}</h2>
        <p>Die Rüstung bekommt einen Riss! ${enemy.name} startet mit 15 % weniger Leben.</p>
        <div class="row"><button class="btn primary big" data-ok>Weiter</button></div>` : `
        <div class="big-emoji">${sym('block', 'gross')}</div>
        <h2>Leider nicht</h2>
        <p class="feedback">Richtig wäre: <b>${armor.richtig}</b>. ${armor.erklaerung}</p>
        <p class="muted">Der Ork bleibt so stark wie vorher.</p>
        <div class="row"><button class="btn primary" data-ok>Weiter</button></div>`);
      res.querySelector('[data-ok]').onclick = () => { closeModal(); refreshArmor(); emit('ruestungFertig', { ok }); };
    };
  });
  card.querySelector('[data-no]').onclick = closeModal;
}

// ---------- Sieg und Niederlage als Inszenierung ----------
// Sieg: Der Ork kippt um und liegt besiegt da, das Siegesbanner rollt über die Szene, Münzen fliegen zur Goldanzeige.
// Niederlage: Niederlagenbanner, ein Herz zerbricht, ein ermutigender Satz. opts: { won, wins, hearts, maxHearts, gold, weiter }
export function zeigeKampfErgebnis(opts) {
  document.getElementById('kampf-ergebnis')?.remove();
  document.getElementById('tip-bubble')?.remove(); // offene Tipps verdecken sonst „Weiter“
  const box = document.createElement('div');
  box.id = 'kampf-ergebnis';
  box.className = opts.won ? 'sieg' : 'niederlage';
  box.dataset.tut = 'fenster';
  const herzen = Array.from({ length: opts.maxHearts }, (_, i) => `<img class="sym erg-herz${i < opts.hearts ? '' : ' leer'}${!opts.won && i === opts.hearts ? ' bricht' : ''}" src="${symbolPfad(i < opts.hearts ? 'herz' : 'herzZerbrochen')}" alt="">`).join('');
  box.innerHTML = `
    <div class="erg-banner">
      <img src="${bild('banner', opts.won ? 'sieg' : 'niederlage')}" alt="">
      <span class="erg-titel">${opts.won ? 'Sieg!' : 'Niederlage'}</span>
    </div>
    <p class="erg-satz">${opts.won ? `${enemy.name} liegt am Boden.` : 'Kopf hoch – morgen packst du deinen Rucksack noch klüger!'}</p>
    <div class="erg-werte">
      <span class="erg-wert">${sym('pokal')}<b>${opts.wins}</b></span>
      <span class="erg-wert erg-herzen">${herzen}</span>
    </div>
    <button class="btn big primary" data-weiter>Weiter</button>`;
  $('battle').append(box);
  box.querySelector('[data-weiter]').onclick = () => { box.remove(); opts.weiter(); };
  if (opts.won) orkFaellt();
  else {
    // das zuletzt verlorene Herz zerbricht
    const h = box.querySelector('.erg-herz.bricht');
    if (h) setTimeout(() => h.classList.add('zerbrochen'), 900);
  }
  if (opts.won) setTimeout(() => muenzenFliegen(box), 900);
}

function orkFaellt() {
  const fig = $('fighter-enemy').querySelector('.f-figur');
  const img = fig?.querySelector('img');
  if (!img) return;
  fig.classList.add('faellt');
  const besiegt = G.BILDER.ui?.besiegt?.[enemy.id];
  setTimeout(() => {
    fig.classList.remove('faellt');
    if (besiegt) { img.src = 'assets/' + besiegt; fig.classList.add('besiegt'); } else fig.classList.add('liegt');
  }, 600);
}

// Münzen fliegen zur Goldanzeige oben
function muenzenFliegen(box) {
  const ziel = $('battle-gold');
  if (!ziel || !document.body.animate) return;
  const z = ziel.getBoundingClientRect(), a = box.querySelector('.erg-banner').getBoundingClientRect();
  for (let i = 0; i < 7; i++) {
    const c = document.createElement('img');
    c.className = 'erg-muenze';
    c.src = symbolPfad('gold');
    document.body.append(c);
    const x0 = a.left + a.width * (0.3 + Math.random() * 0.4), y0 = a.top + a.height * 0.5;
    c.animate([
      { transform: `translate(${x0}px, ${y0}px) scale(.4)`, opacity: 0 },
      { transform: `translate(${x0 + (Math.random() - 0.5) * 120}px, ${y0 - 80}px) scale(1)`, opacity: 1, offset: .35 },
      { transform: `translate(${z.left + z.width / 2}px, ${z.top + z.height / 2}px) scale(.6)`, opacity: .9 },
    ], { duration: 900, delay: i * 90, easing: 'ease-in', fill: 'forwards' }).onfinish = () => { c.remove(); ziel.classList.remove('bump'); void ziel.offsetWidth; ziel.classList.add('bump'); };
  }
}
