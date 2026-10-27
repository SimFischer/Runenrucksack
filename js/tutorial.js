// Tutorial „Der erste Tag“: Meister Fenwick führt mit Spotlight, Sprechblase und Hand durch einen
// festgelegten, echten Lauf. Die Schritte stehen in tutorial.json, die Prüf-Logik in tutorial-logic.js.
import { G, onEvent, getPref, setPref, loadRun, emit, saveProfil } from './state.js';
import { sym } from './symbole.js';
import {
  activeSteps, makeTutorialRun, applyShop, sichereLaden, prepareStep, tutorialErlaubt, schrittNachAbbruch, checkStep, resetWrong, targetCell, spotFor,
} from './tutorial-logic.js';
import { closeModal } from './ui.js';
import { battleControl } from './battle-ui.js';
import { runEncounter } from './encounters.js';

const IDLE_MS = 8000;
let api = null;            // Einstiegspunkte aus main.js
let steps = [], idx = -1, active = false, shown = false;
let idleTimer = 0, layoutTimer = 0, weiterTimer = 0, extraTip = '', warnText = '';
// Meister Fenwick in drei Posen: erklärt (Erklärungen), Tipp (Hinweise), jubelt (Erfolge)
const pose = (p) => G.TUTORIAL.begleiter.posen?.[p] || G.TUTORIAL.begleiter.bild;
const fenwickHtml = (p, cls = '') => `<img${cls ? ` class="${cls}"` : ''} src="${pose(p)}" alt="${G.TUTORIAL.begleiter.name}">`;
const el = {};

export const tutorialDone = () => getPref('tutorial') === 'fertig' || !!G.PROFIL?.tutorial;
export const tutorialActive = () => active;

// Darf das Spiel diese Verbindung oder Frage jetzt auslösen? Wenn nicht, gibt Fenwick einen freundlichen Hinweis.
export function tutorialDarf(art, info) {
  if (!active || !step()) return true;
  if (tutorialErlaubt(steps, idx, art, info, G.DEFS)) return true;
  const text = step().fastHinweis || 'Fast! Das gehört gerade nicht zu diesem Schritt.';
  if (warnText !== text) { warnText = text; draw(); }
  return false;
}

// Eine Aufgabe im Tutorial wurde abgebrochen: zurück zum Schritt, in dem man handelt – ohne Geschenke
// oder Vorbereitung noch einmal auszuführen –, mit einem freundlichen Hinweis. Ein schon geplanter
// Schrittwechsel entfällt.
export function tutorialAbgebrochen(text = 'Kein Problem – probier es gleich noch einmal.') {
  if (!active || !step()) return;
  clearTimeout(weiterTimer);
  el['tut-bubble'].classList.remove('done');
  idx = schrittNachAbbruch(steps, idx);
  shown = true;
  warnText = text;
  extraTip = '';
  draw();
}

// ---------- Aufbau ----------

export function initTutorial(mainApi) {
  api = mainApi;
  const layer = document.createElement('div');
  layer.id = 'tut-layer';
  layer.hidden = true;
  layer.innerHTML = `
    <svg id="tut-shade" width="100%" height="100%"><defs><mask id="tut-mask"><rect width="100%" height="100%" fill="white"/><g id="tut-holes"></g></mask></defs>
      <rect width="100%" height="100%" fill="rgba(8,5,2,.66)" mask="url(#tut-mask)"/><g id="tut-rings"></g></svg>
    <div id="tut-hand"><span class="tut-finger"></span></div>
    <div id="tut-bubble" role="dialog" aria-live="polite">
      <div class="tut-fenwick" id="tut-fenwick"></div>
      <div class="tut-body">
        <div class="tut-name">${G.TUTORIAL.begleiter.name}</div>
        <p class="tut-text" id="tut-text"></p>
        <p class="tut-tip" id="tut-tip" hidden></p>
        <div class="tut-foot">
          <span class="tut-dots" id="tut-dots"></span>
          <button class="btn primary" id="tut-next" hidden>Weiter</button>
        </div>
      </div>
    </div>
    <button class="btn small" id="tut-skip">Tutorial überspringen ✕</button>`;
  document.body.append(layer);
  for (const id of ['tut-layer', 'tut-shade', 'tut-holes', 'tut-rings', 'tut-hand', 'tut-bubble', 'tut-fenwick', 'tut-text', 'tut-tip', 'tut-dots', 'tut-next', 'tut-skip']) {
    el[id] = document.getElementById(id);
  }
  el['tut-next'].onclick = () => complete();
  el['tut-skip'].onclick = confirmSkip;

  // Nur das Ziel ist bedienbar: alles andere wird abgefangen, bevor das Spiel es sieht.
  for (const type of ['pointerdown', 'click']) document.addEventListener(type, blocker, true);
  document.addEventListener('pointerdown', resetIdle, true);
  window.addEventListener('resize', () => active && layout());
  onEvent(handleEvent);

}

function drawFenwick() {
  // Pose nach Schritt: Hinweis oder Warnung → Tipp, sonst erklärt
  const s = step();
  el['tut-fenwick'].innerHTML = fenwickHtml(s?.hinweis || warnText ? 'tipp' : 'erklaert');
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
      <div class="big-emoji">${fenwickHtml('tipp', 'confirm-fenwick')}</div>
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
  sichereLaden(G.run, s);
  if (prepareStep(G.run, s, G.DEFS)) warnText = 'Ich habe dein Schwert ein Stück verschoben, damit links Platz ist.';
  shown = !s.zeigenBei && !s.kampfPause;
  if (!s.kampfPause && !s.zeigenBei && s.aktion.typ !== 'abschluss') api.render();

  if (s.begegnung) {
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
  clearTimeout(weiterTimer);
  weiterTimer = setTimeout(() => {
    el['tut-bubble'].classList.remove('done');
    if (active && step() === s) next();
  }, 350);
}

function handleEvent(ev) {
  if (!active || !step()) return;
  const s = step();
  if (s.zeigenBei && ev.typ === s.zeigenBei) { shown = true; draw(); }
  // Laden prüfen: Liegt das Ziel-Item nicht (mehr) im Laden, wieder hineinlegen
  if (ev.typ === 'render' && sichereLaden(G.run, s)) { api.render(); return; }
  if (ev.typ === 'render' && shown) layout();
  if (['weiter', 'abschluss'].includes(s.aktion.typ) || s.kampfPause) return;
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
  drawFenwick();
  el['tut-text'].textContent = s.text;
  const tip = [warnText, extraTip, s.hinweis].filter(Boolean)[0] || '';
  el['tut-tip'].textContent = tip;
  el['tut-tip'].hidden = !tip;
  el['tut-tip'].classList.toggle('warn', !!warnText && tip === warnText);
  el['tut-next'].hidden = s.aktion.typ !== 'weiter';
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
  if (shown) placeBubble(rects, hindernisse());
}

// Offenes Aufgaben-Fenster und die Items, um die es geht: Die Sprechblase darf sie nicht verdecken.
function hindernisse() {
  const ebene = document.querySelector('#quick, #aufgabe');
  if (!ebene) return [];
  const karte = ebene.querySelector('.quick-card, .af-fenster');
  return [...(karte ? [karte.getBoundingClientRect()] : []), ...(ebene.zielRects || [])];
}

function placeBubble(rects, hind = []) {
  const b = el['tut-bubble'];
  // Erst in normaler Größe versuchen, dann kompakt; reicht der Platz neben einem Fenster nicht,
  // rückt das Fenster zur Seite – die Sprechblase soll nie etwas Wichtiges verdecken.
  for (const compact of [false, true]) {
    b.classList.toggle('compact', compact);
    if (tryPlace(b, rects, false, hind)) return;
  }
  const modal = document.getElementById('modal');
  if (rects.length && !modal.hidden && !modal.classList.contains('tut-shift')) {
    modal.classList.add('tut-shift');
    requestAnimationFrame(layout);
    return;
  }
  tryPlace(b, rects, true, hind);
}

// Setzt die Sprechblase neben die Ziele, ohne Ziele und Hindernisse (Aufgaben-Fenster, beteiligte Items)
// zu verdecken. Ohne Platz: false (oder mit force dorthin, wo sie am wenigsten verdeckt).
function tryPlace(b, rects, force, hind = []) {
  const W = window.innerWidth, H = window.innerHeight, m = 12;
  b.style.left = '0px';
  b.style.top = '0px';
  const bw = b.offsetWidth, bh = b.offsetHeight;
  if (!rects.length && !hind.length) {
    b.style.left = `${(W - bw) / 2}px`;
    b.style.top = `${(H - bh) / 2}px`;
    return true;
  }
  const u = (rects.length ? rects : hind).reduce((a, r) => ({
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
  // Ecken als weitere Plätze; alles, was ein Ziel oder Hindernis verdeckt, scheidet aus
  options.push(...[[m, H - bh - m], [W - bw - m, H - bh - m], [m, 60], [W - bw - m, 60]].map(([x, y]) => ({ x, y, fits: true })));
  const alle = [...rects, ...hind];
  const overlap = ({ x, y }) => alle.reduce((sum, r) => sum + Math.max(0, Math.min(clampX(x) + bw, r.right) - Math.max(clampX(x), r.left)) * Math.max(0, Math.min(clampY(y) + bh, r.bottom) - Math.max(clampY(y), r.top)), 0);
  let best = options.find((o) => o.fits && overlap(o) === 0);
  if (!best && !force) return false;
  // Kein freier Platz: dorthin, wo die Sprechblase am wenigsten verdeckt
  if (!best) best = [...options].sort((a, c) => overlap(a) - overlap(c))[0];
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

// ---------- Nur das Ziel ist bedienbar ----------

function blocker(e) {
  if (!active) return;
  if (e.target.closest?.('#tut-bubble, #tut-skip, #tut-confirm, #tut-finale')) return;
  // Frage- und Aufgabenfenster sind immer bedienbar: antworten oder abbrechen darf man immer
  if (e.target.closest?.('#quick, #aufgabe')) return;
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
  G.PROFIL.tutorial = true; // gehört auch in den Heldencode
  saveProfil();
  shown = false;
  clearHand();
  layout();
  el['tut-bubble'].hidden = true;
  el['tut-skip'].hidden = true;
  el['tut-layer'].classList.add('finale');
  const box = document.createElement('div');
  box.id = 'tut-finale';
  const confetti = Array.from({ length: 36 }, (_, i) =>
    `<span style="left:${(i * 37) % 100}%;animation-delay:${(i % 9) * 0.18}s;animation-duration:${2.4 + (i % 5) * 0.35}s">★</span>`).join('');
  const saved = api.hasSavedRun();
  box.innerHTML = `
    <div class="confetti">${confetti}</div>
    <div class="tut-finale-card">
      <div class="tut-finale-fenwick">${fenwickHtml('jubelt')}</div>
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
// Symbol einer Hilfe-Karte: Bild aus assets/ui/symbole – oder „css:klasse“ für einen CSS-Ersatz (Laterne, Amboss)
const symbolOderCss = (s) => (s?.startsWith('css:') ? `<span class="${s.slice(4)} gross"></span>` : sym(s || 'stern', 'gross'));

export function helpCards() {
  const extra = G.TUTORIAL.zusatzHilfe || [];
  return activeSteps(G.TUTORIAL).filter((s) => s.hilfe).flatMap((s) => [s.hilfe, ...extra.filter((h) => h.nach === s.id)]);
}

export function showHelp(onClose = null) {
  const box = document.createElement('div');
  box.id = 'help-layer';
  box.innerHTML = `
    <div class="help-card">
      <div class="help-head">
        <span class="help-fenwick">${fenwickHtml('erklaert')}</span>
        <h2>So geht's</h2>
        <button class="btn icon" data-close aria-label="Schließen">✕</button>
      </div>
      <div class="help-grid">${helpCards().map((h) => `
        <div class="help-item">
          <span class="help-emoji anim-${h.animation || 'pulsieren'}">${symbolOderCss(h.symbol)}</span>
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
  b.innerHTML = `<span class="tip-fenwick">${fenwickHtml('tipp')}</span><p>${text}</p><button class="btn small" aria-label="Tipp schließen">OK</button>`;
  document.body.append(b);
  const close = () => b.remove();
  b.querySelector('button').onclick = close;
  setTimeout(close, 9000);
}

onEvent((ev) => { if (ev.typ === 'tipp') firstTip(ev.key); });
