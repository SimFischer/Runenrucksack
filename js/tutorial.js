// Tutorial „Der erste Tag“: Meister Fenwick führt mit Spotlight, Sprechblase und Hand durch einen
// festgelegten, echten Lauf. Die Schritte stehen in tutorial.json, die Prüf-Logik in tutorial-logic.js.
import { G, onEvent, getPref, setPref, loadRun, emit } from './state.js';
import {
  activeSteps, makeTutorialRun, applyShop, prepareStep, checkStep, resetWrong, targetCell, spotFor,
} from './tutorial-logic.js';
import { closeModal } from './ui.js';
import { battleControl } from './battle-ui.js';
import { runEncounter } from './encounters.js';

const IDLE_MS = 8000;
let api = null;            // Einstiegspunkte aus main.js
let steps = [], idx = -1, active = false, shown = false;
let idleTimer = 0, layoutTimer = 0, extraTip = '', warnText = '';
let fenwickImg = null, voice = null;
const el = {};

export const tutorialDone = () => getPref('tutorial') === 'fertig';
export const tutorialActive = () => active;

// ---------- Aufbau ----------

export function initTutorial(mainApi) {
  api = mainApi;
  const layer = document.createElement('div');
  layer.id = 'tut-layer';
  layer.hidden = true;
  layer.innerHTML = `
    <svg id="tut-shade" width="100%" height="100%"><defs><mask id="tut-mask"><rect width="100%" height="100%" fill="white"/><g id="tut-holes"></g></mask></defs>
      <rect width="100%" height="100%" fill="rgba(8,5,2,.66)" mask="url(#tut-mask)"/><g id="tut-rings"></g></svg>
    <div id="tut-hand">👆</div>
    <div id="tut-bubble" role="dialog" aria-live="polite">
      <div class="tut-fenwick" id="tut-fenwick">🧙</div>
      <div class="tut-body">
        <div class="tut-name">${G.TUTORIAL.begleiter.name}</div>
        <p class="tut-text" id="tut-text"></p>
        <p class="tut-tip" id="tut-tip" hidden></p>
        <div class="tut-foot">
          <span class="tut-dots" id="tut-dots"></span>
          <button class="tut-speak" id="tut-speak" aria-label="Vorlesen" hidden>🔊</button>
          <button class="btn primary" id="tut-next" hidden>Weiter</button>
        </div>
      </div>
    </div>
    <button class="btn small" id="tut-skip">Tutorial überspringen ✕</button>`;
  document.body.append(layer);
  for (const id of ['tut-layer', 'tut-shade', 'tut-holes', 'tut-rings', 'tut-hand', 'tut-bubble', 'tut-fenwick', 'tut-text', 'tut-tip', 'tut-dots', 'tut-speak', 'tut-next', 'tut-skip']) {
    el[id] = document.getElementById(id);
  }
  el['tut-next'].onclick = () => complete();
  el['tut-skip'].onclick = confirmSkip;
  el['tut-speak'].onclick = speak;

  // Nur das Ziel ist bedienbar: alles andere wird abgefangen, bevor das Spiel es sieht.
  for (const type of ['pointerdown', 'click']) document.addEventListener(type, blocker, true);
  document.addEventListener('pointerdown', resetIdle, true);
  window.addEventListener('resize', () => active && layout());
  onEvent(handleEvent);

  // Bild von Fenwick, falls vorhanden – sonst bleibt das Emoji.
  const img = new Image();
  img.onload = () => { fenwickImg = img.src; if (active) drawFenwick(); };
  img.src = G.TUTORIAL.begleiter.bild;

  // Deutsche Stimme zum Vorlesen, falls verfügbar.
  const pickVoice = () => {
    try { voice = speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith('de')) || null; } catch { voice = null; }
  };
  if ('speechSynthesis' in window) { pickVoice(); speechSynthesis.addEventListener?.('voiceschanged', pickVoice); }
}

function drawFenwick() {
  el['tut-fenwick'].innerHTML = fenwickImg ? `<img src="${fenwickImg}" alt="${G.TUTORIAL.begleiter.name}">` : G.TUTORIAL.begleiter.emoji;
}

// ---------- Start, Ende, Überspringen ----------

export function startTutorial() {
  G.run = makeTutorialRun(G.ITEMS, G.REGIONS, G.TUTORIAL);
  steps = activeSteps(G.TUTORIAL);
  idx = -1;
  active = true;
  closeModal();
  el['tut-layer'].hidden = false;
  drawFenwick();
  api.showGame();
  clearInterval(layoutTimer);
  layoutTimer = setInterval(layout, 300);
  next();
}

function stop() {
  active = false;
  clearTimeout(idleTimer);
  clearInterval(layoutTimer);
  battleControl.resume();
  try { speechSynthesis.cancel(); } catch { /* ohne Sprachausgabe */ }
  el['tut-layer'].hidden = true;
  el['tut-layer'].classList.remove('finale');
  document.getElementById('modal').classList.remove('tut-shift');
  closeModal();
  G.run = loadRun(); // der gespeicherte normale Lauf (oder keiner)
}

function confirmSkip() {
  const box = document.createElement('div');
  box.id = 'tut-confirm';
  box.innerHTML = `
    <div class="tut-confirm-card">
      <div class="big-emoji">${fenwickImg ? `<img class="confirm-fenwick" src="${fenwickImg}" alt="">` : '🧙'}</div>
      <h2>Tutorial überspringen?</h2>
      <p>Du kannst es im Menü jederzeit wiederholen.</p>
      <div class="row">
        <button class="btn primary" data-stay>Weiter lernen</button>
        <button class="btn" data-skip>Überspringen</button>
      </div>
    </div>`;
  el['tut-layer'].append(box);
  box.querySelector('[data-stay]').onclick = () => box.remove();
  box.querySelector('[data-skip]').onclick = () => { box.remove(); stop(); api.showStart(); };
}

// ---------- Schritte ----------

const step = () => steps[idx];

function next() {
  idx++;
  const s = step();
  if (!s) return;
  warnText = '';
  extraTip = '';
  applyShop(G.run, s);
  if (prepareStep(G.run, s, G.DEFS)) warnText = 'Ich habe dein Schwert ein Stück verschoben, damit links Platz ist.';
  shown = !s.zeigenBei && !s.kampfPause;
  if (!s.kampfPause && !s.zeigenBei && s.aktion.typ !== 'abschluss') api.render();

  if (s.aktion.typ === 'verschmelzen') {
    api.runFusions(() => complete());
  } else if (s.begegnung) {
    runEncounter(() => { api.render(); emit('begegnungFertig'); }, api.render, s.begegnung);
  } else if (s.kampfPause) {
    // Kampf starten, nach einem Moment anhalten und erklären.
    battleControl.start();
    setTimeout(() => {
      if (!active || step() !== s) return;
      battleControl.pause();
      shown = true;
      draw();
    }, 1600);
  } else if (s.aktion.typ === 'abschluss') {
    finale();
    return;
  }
  draw();
}

function complete() {
  const s = step();
  if (!s) return;
  if (s.kampfPause) battleControl.resume();
  if (s.kampfStarten) battleControl.start();
  el['tut-bubble'].classList.add('done');
  setTimeout(() => {
    el['tut-bubble'].classList.remove('done');
    if (active && step() === s) next();
  }, 350);
}

function handleEvent(ev) {
  if (!active || !step()) return;
  const s = step();
  if (s.zeigenBei && ev.typ === s.zeigenBei) { shown = true; draw(); }
  if (ev.typ === 'render' && shown) layout();
  if (['weiter', 'abschluss', 'verschmelzen'].includes(s.aktion.typ) || s.kampfPause) return;
  const r = checkStep(s, G.run, G.DEFS, G.RECIPES, ev);
  if (r?.ok) { complete(); return; }
  if (r?.falsch && ev.typ === 'render') {
    if (warnText === r.falsch.text && !r.falsch.zuruecksetzen) return;
    warnText = r.falsch.text;
    if (r.falsch.zuruecksetzen) { resetWrong(G.run, r.falsch, G.DEFS); api.render(); }
    draw();
  }
}

// ---------- Darstellung ----------

const targetsOf = (s) => (s?.ziel || []).flatMap((name) => [...document.querySelectorAll(`[data-tut="${name}"]`)])
  .filter((e) => e.offsetParent !== null || e.getClientRects().length);

function draw() {
  const s = step();
  if (!s) return;
  el['tut-layer'].classList.toggle('waiting', !shown);
  el['tut-bubble'].hidden = !shown;
  el['tut-skip'].hidden = false;
  if (!shown) { clearHand(); layout(); return; }
  el['tut-text'].textContent = s.text;
  const tip = [warnText, extraTip, s.hinweis].filter(Boolean)[0] || '';
  el['tut-tip'].textContent = tip;
  el['tut-tip'].hidden = !tip;
  el['tut-tip'].classList.toggle('warn', !!warnText && tip === warnText);
  el['tut-next'].hidden = s.aktion.typ !== 'weiter';
  el['tut-speak'].hidden = !voice;
  const nr = steps.indexOf(s);
  el['tut-dots'].innerHTML = `<span class="tut-bar"><i style="width:${Math.round(((nr + 1) / steps.length) * 100)}%"></i></span><small>${nr + 1}/${steps.length}</small>`;
  layout();
  playHand();
  resetIdle();
}

// Spotlight-Löcher, Leuchtrahmen und Sprechblase neben den Zielen.
function layout() {
  if (!active) return;
  const modal = document.getElementById('modal');
  if (modal.hidden) modal.classList.remove('tut-shift');
  const s = step();
  const rects = shown ? targetsOf(s).map((e) => e.getBoundingClientRect()) : [];
  const pad = 8;
  el['tut-holes'].innerHTML = rects.map((r) => `<rect x="${r.left - pad}" y="${r.top - pad}" width="${r.width + 2 * pad}" height="${r.height + 2 * pad}" rx="14" fill="black"/>`).join('');
  el['tut-rings'].innerHTML = rects.map((r) => `<rect class="tut-ring" x="${r.left - pad}" y="${r.top - pad}" width="${r.width + 2 * pad}" height="${r.height + 2 * pad}" rx="14"/>`).join('');
  if (shown) placeBubble(rects);
}

function placeBubble(rects) {
  const b = el['tut-bubble'];
  // Erst in normaler Größe versuchen, dann kompakt; reicht der Platz neben einem Fenster nicht,
  // rückt das Fenster zur Seite – die Sprechblase soll nie etwas Wichtiges verdecken.
  for (const compact of [false, true]) {
    b.classList.toggle('compact', compact);
    if (tryPlace(b, rects, false)) return;
  }
  const modal = document.getElementById('modal');
  if (rects.length && !modal.hidden && !modal.classList.contains('tut-shift')) {
    modal.classList.add('tut-shift');
    requestAnimationFrame(layout);
    return;
  }
  tryPlace(b, rects, true);
}

// Setzt die Sprechblase neben die Ziele. Ohne Platz: false (oder mit force in die beste Ecke).

function tryPlace(b, rects, force) {
  const W = window.innerWidth, H = window.innerHeight, m = 12;
  b.style.left = '0px';
  b.style.top = '0px';
  const bw = b.offsetWidth, bh = b.offsetHeight;
  if (!rects.length) {
    b.style.left = `${(W - bw) / 2}px`;
    b.style.top = `${(H - bh) / 2}px`;
    return true;
  }
  const u = rects.reduce((a, r) => ({
    left: Math.min(a.left, r.left), top: Math.min(a.top, r.top), right: Math.max(a.right, r.right), bottom: Math.max(a.bottom, r.bottom),
  }), { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity });
  const clampX = (x) => Math.max(m, Math.min(W - bw - m, x));
  const clampY = (y) => Math.max(m + 50, Math.min(H - bh - m, y));
  const cy = clampY((u.top + u.bottom) / 2 - bh / 2), cx = clampX((u.left + u.right) / 2 - bw / 2);
  const options = [
    { x: u.right + 20, y: cy, fits: W - u.right - 20 - m >= bw },
    { x: u.left - 20 - bw, y: cy, fits: u.left - 20 - m >= bw },
    { x: cx, y: u.bottom + 20, fits: H - u.bottom - 20 - m >= bh },
    { x: cx, y: u.top - 20 - bh, fits: u.top - 20 - m - 50 >= bh },
  ];
  let best = options.find((o) => o.fits);
  if (!best && !force) return false;
  if (!best) {
    // Kein Platz neben den Zielen: die Ecke wählen, die am wenigsten Ziele verdeckt.
    const corners = [[m, H - bh - m], [W - bw - m, H - bh - m], [m, 60], [W - bw - m, 60]];
    const overlap = ([x, y]) => rects.reduce((sum, r) => sum + Math.max(0, Math.min(x + bw, r.right) - Math.max(x, r.left)) * Math.max(0, Math.min(y + bh, r.bottom) - Math.max(y, r.top)), 0);
    const [x, y] = corners.sort((a, c) => overlap(a) - overlap(c))[0];
    best = { x, y };
  }
  b.style.left = `${clampX(best.x)}px`;
  b.style.top = `${clampY(best.y)}px`;
  return true;
}

// ---------- Hand ----------

function center(name) {
  const e = document.querySelector(`[data-tut="${name}"]`);
  if (!e) return null;
  const r = e.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function cellCenter(cell) {
  const g = document.getElementById('grid-bag');
  if (!g || !cell) return null;
  const r = g.getBoundingClientRect();
  const size = parseFloat(g.style.getPropertyValue('--cell')) || 90;
  return { x: r.left + 3 + (cell.x + 0.5) * size, y: r.top + 3 + (cell.y + 0.5) * size };
}

function handTarget(spec) {
  if (spec === 'rucksack') {
    const id = step().aktion.item;
    return cellCenter(id ? spotFor(G.run, G.DEFS, id) : { x: 1, y: 1 }) || center('rucksack');
  }
  if (spec.includes(':')) return cellCenter(targetCell(G.run, G.DEFS, spec));
  return center(spec);
}

function clearHand() {
  el['tut-hand'].getAnimations?.().forEach((a) => a.cancel());
  el['tut-hand'].style.opacity = 0;
}

function playHand() {
  clearHand();
  const h = step()?.hand;
  if (!h || !shown) return;
  const hand = el['tut-hand'];
  const from = handTarget(h.von || h.auf);
  const to = h.typ === 'ziehen' ? handTarget(h.nach) : from;
  if (!from || !to || !hand.animate) return;
  const at = (p, s = 1) => `translate(${p.x - 14}px, ${p.y - 6}px) scale(${s})`;
  const frames = h.typ === 'ziehen'
    ? [
      { transform: at(from), opacity: 0 }, { transform: at(from), opacity: 1, offset: 0.1 },
      { transform: at(from, 0.85), opacity: 1, offset: 0.2 }, { transform: at(to, 0.85), opacity: 1, offset: 0.75 },
      { transform: at(to), opacity: 1, offset: 0.85 }, { transform: at(to), opacity: 0 },
    ]
    : [
      { transform: at(from), opacity: 0 }, { transform: at(from), opacity: 1, offset: 0.2 },
      { transform: at(from, 0.8), opacity: 1, offset: 0.4 }, { transform: at(from), opacity: 1, offset: 0.6 },
      { transform: at(from, 0.8), opacity: 1, offset: 0.8 }, { transform: at(from), opacity: 0 },
    ];
  hand.animate(frames, { duration: h.typ === 'ziehen' ? 2200 : 1600, iterations: 2, easing: 'ease-in-out' });
}

// Nach 8 Sekunden ohne Aktion: Hand wiederholen und Zusatz-Tipp zeigen.
function resetIdle() {
  clearTimeout(idleTimer);
  if (!active) return;
  idleTimer = setTimeout(() => {
    const s = step();
    if (!active || !shown || !s) return;
    if (s.tipp && !extraTip) { extraTip = s.tipp; warnText = ''; draw(); return; }
    playHand();
    resetIdle();
  }, IDLE_MS);
}

// ---------- Vorlesen ----------

function speak() {
  try {
    speechSynthesis.cancel();
    const s = step();
    const text = [s.text, el['tut-tip'].hidden ? '' : el['tut-tip'].textContent].filter(Boolean).join(' ');
    const u = new SpeechSynthesisUtterance(text.replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, ''));
    u.voice = voice;
    u.lang = voice?.lang || 'de-DE';
    u.rate = 0.9;
    speechSynthesis.speak(u);
  } catch { /* ohne Sprachausgabe */ }
}

// ---------- Nur das Ziel ist bedienbar ----------

function blocker(e) {
  if (!active) return;
  if (e.target.closest?.('#tut-bubble, #tut-skip, #tut-confirm, #tut-finale')) return;
  if (!shown) return; // während Fenwick wartet (z. B. im Kampf), ist alles bedienbar
  if (targetsOf(step()).some((t) => t.contains(e.target))) return;
  e.preventDefault();
  e.stopPropagation();
  if (e.type === 'pointerdown') {
    el['tut-bubble'].classList.remove('nudge');
    void el['tut-bubble'].offsetWidth;
    el['tut-bubble'].classList.add('nudge');
  }
}

// ---------- Abschluss ----------

function finale() {
  setPref('tutorial', 'fertig');
  shown = false;
  clearHand();
  layout();
  el['tut-bubble'].hidden = true;
  el['tut-skip'].hidden = true;
  el['tut-layer'].classList.add('finale');
  const box = document.createElement('div');
  box.id = 'tut-finale';
  const confetti = Array.from({ length: 36 }, (_, i) =>
    `<span style="left:${(i * 37) % 100}%;animation-delay:${(i % 9) * 0.18}s;animation-duration:${2.4 + (i % 5) * 0.35}s">${['✨', '⭐', '🎉', '🔥', '📜', '💎'][i % 6]}</span>`).join('');
  const saved = api.hasSavedRun();
  box.innerHTML = `
    <div class="confetti">${confetti}</div>
    <div class="tut-finale-card">
      <div class="tut-finale-fenwick">${fenwickImg ? `<img src="${fenwickImg}" alt="">` : G.TUTORIAL.begleiter.emoji}</div>
      <h2>Geschafft!</h2>
      <p>${step().text}</p>
      <div class="row">
        <button class="btn primary big" data-go>Meinen ersten Lauf starten</button>
        ${saved ? '<button class="btn" data-back>Zurück zu meinem Lauf</button>' : ''}
      </div>
    </div>`;
  el['tut-layer'].append(box);
  box.querySelector('[data-go]').onclick = () => { box.remove(); stop(); api.showHeroes(); };
  box.querySelector('[data-back]')?.addEventListener('click', () => { box.remove(); stop(); api.continueSaved(); });
}

// ---------- „So geht's“: kurze Übersicht zum Nachschlagen ----------

// Karten aus tutorial.json (Feld „hilfe“), nur für Funktionen, die es gibt.
export function helpCards() {
  return activeSteps(G.TUTORIAL).filter((s) => s.hilfe).map((s) => s.hilfe);
}

export function showHelp(onClose = null) {
  const box = document.createElement('div');
  box.id = 'help-layer';
  box.innerHTML = `
    <div class="help-card">
      <div class="help-head">
        <span class="help-fenwick">${fenwickImg ? `<img src="${fenwickImg}" alt="">` : G.TUTORIAL.begleiter.emoji}</span>
        <h2>So geht's</h2>
        <button class="btn icon" data-close aria-label="Schließen">✕</button>
      </div>
      <div class="help-grid">${helpCards().map((h) => `
        <div class="help-item">
          <span class="help-emoji anim-${h.animation || 'pulsieren'}">${h.emoji}</span>
          <div><b>${h.titel}</b><p>${h.text}</p></div>
        </div>`).join('')}
      </div>
    </div>`;
  document.body.append(box);
  const close = () => { box.remove(); if (onClose) onClose(); };
  box.querySelector('[data-close]').onclick = close;
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
}

// ---------- Erste-Mal-Tipps im normalen Spiel ----------

export const tipsOn = () => getPref('tipps') !== 'aus';
export const setTips = (on) => setPref('tipps', on ? 'an' : 'aus');

// Einmal pro Lauf eine kleine Fenwick-Sprechblase, wenn etwas Neues passiert.
function firstTip(key) {
  const run = G.run;
  const text = G.TUTORIAL.tipps?.[key];
  if (!run || run.tutorial || !text || !tipsOn()) return;
  run.tippsGezeigt ||= [];
  if (run.tippsGezeigt.includes(key)) return;
  run.tippsGezeigt.push(key);
  document.getElementById('tip-bubble')?.remove();
  const b = document.createElement('div');
  b.id = 'tip-bubble';
  b.innerHTML = `<span class="tip-fenwick">${fenwickImg ? `<img src="${fenwickImg}" alt="">` : G.TUTORIAL.begleiter.emoji}</span><p>${text}</p><button class="btn small" aria-label="Tipp schließen">OK</button>`;
  document.body.append(b);
  const close = () => b.remove();
  b.querySelector('button').onclick = close;
  setTimeout(close, 9000);
}

onEvent((ev) => { if (ev.typ === 'tipp') firstTip(ev.key); });
