// Gemeinsame Bausteine der Oberfläche: Fenster, Hinweise, Item-Kacheln und Raster.
import { sizeOf } from './logic.js';
import { GENUS, findFusions, isRune, isVerb, isNoun, verbTargetCell, phraseFor, runeFits } from './grammar.js';
import { sockelPlaetze, sockelVon } from './sockel.js';
import { G, bildFuer, getPref } from './state.js';
import { sym, symbolPfad } from './symbole.js';

// Kraft eines Kompositums als kleines Zustands-Symbol (statt des großen Kristalls)
const KRAFT_SYMBOL = { feuer: 'brand', gift: 'gift', eis: 'kaelte', blitz: 'betaeubung', stein: 'block', mond: 'heilung', gold: 'glueck', sturm: 'tempo' };

// Namensband: ganze Nominalgruppe, der Artikel in seiner Genusfarbe. Die Größe passt baenderEinpassen() an.
function namensBand(l, text, artikel) {
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const mitArtikel = artikel && text.startsWith(artikel + ' ');
  l.innerHTML = mitArtikel ? `<span class="band-art" style="color:${GENUS[artikel].farbe}">${artikel}</span> ${esc(text.slice(artikel.length + 1))}` : esc(text);
}

// Nach dem Zeichnen, für jede Karte: Namensband so groß wie möglich, höchstens zwei (bei schmalen Karten drei)
// Zeilen, nie abgeschnitten (kleiner statt gekürzt); Sterne, Sockel und Bild rücken in ihre festen Bereiche.
export function baenderEinpassen(root, versuch = 0) {
  const box = (e) => e?.getBoundingClientRect();
  // Noch nicht sichtbar (z. B. Kampf wird erst eingeblendet): kurz danach noch einmal
  const erste = root.querySelector('.item');
  if (erste && !box(erste).width) { if (versuch < 80) setTimeout(() => baenderEinpassen(root, versuch + 1), 50); return; }
  const ueber = (a, b) => a && b && a.right > b.left && b.right > a.left && a.bottom > b.top && b.bottom > a.top;
  for (const it of root.querySelectorAll('.item')) {
    const l = it.querySelector('.label');
    if (l) {
      // schmale, hohe Karten (z. B. ein Bogen) dürfen drei Zeilen haben
      const r = box(it), zeilen = r.height > r.width * 1.5 ? 3 : 2;
      let px = 13;
      l.style.fontSize = px + 'px';
      while (px > 7 && (l.scrollWidth > l.clientWidth + 1 || box(l).height > px * 1.05 * zeilen + 4)) {
        px -= 0.5;
        l.style.fontSize = px + 'px';
      }
    }
    // Sterne und Kraft-Abzeichen teilen sich die obere Reihe: notfalls werden die Sterne kleiner
    const st = it.querySelector('.stars'), abz = it.querySelector('.badge');
    let sp = parseFloat(st?.style.fontSize) || 0;
    while (st && abz && sp > 6 && ueber(box(st), box(abz))) { sp -= 1; st.style.fontSize = sp + 'px'; }
    const band = l ? box(l).top : box(it).bottom - 3;
    const leiste = it.querySelector('.sockel-leiste');
    if (leiste) {
      // Sockel beginnen unter den Sternen
      const r0 = box(it);
      leiste.style.top = Math.max(st ? box(st).bottom - r0.top + 2 : 0, 4) - (it.clientTop || 0) + 'px';
      // Fassungsgröße aus dem freien Platz zwischen Sternen und Band (bei kleinen Karten enger zusammen)
      const n = leiste.children.length;
      const frei = band - box(leiste).top - 2;
      const klein = frei < n * 14;
      leiste.classList.toggle('eng', klein);
      const extra = klein ? 2 + (n - 1) * 1 : 6 + (n - 1) * 3;
      const m = Math.max(5, Math.min(parseFloat(leiste.style.getPropertyValue('--mulde')) || 12, Math.floor((frei - extra) / n)));
      leiste.style.setProperty('--mulde', m + 'px');
    }
    bildInDieMitte(it, band);
  }
}

// Das Bild bekommt genau die freie Mitte: unter Sternen und Abzeichen, über dem Namensband, rechts der Sockel
function bildInDieMitte(it, band) {
  const img = it.querySelector('.item-img');
  if (!img) return;
  const r = it.getBoundingClientRect(), rand = it.clientLeft || 0;
  const unten = (sel) => { const e = it.querySelector(sel); return e ? e.getBoundingClientRect().bottom - r.top : 0; };
  const leiste = it.querySelector('.sockel-leiste');
  const oben = Math.max(unten('.stars'), unten('.badge'), 4) + 1;
  const links = (leiste ? leiste.getBoundingClientRect().right - r.left : rand + 3) + 1;
  const rechts = r.width - rand - 3;
  const tief = band - r.top - 1;
  const w = Math.max(10, rechts - links), h = Math.max(10, tief - oben);
  const quer = img.style.transform.includes('rotate');
  img.style.left = links - rand + w / 2 + 'px';
  img.style.top = oben - rand + h / 2 + 'px';
  img.style.width = (quer ? h : w) + 'px';
  img.style.height = (quer ? w : h) + 'px';
}

export const $ = (id) => document.getElementById(id);
export const fmt = (n) => n.toLocaleString('de-DE', { maximumFractionDigits: 1 });
export const fullName = (d) => (d.artikel ? `${d.artikel} ${d.name}` : d.name);
// Name im Akkusativ, z. B. „den Speer“, „die Schriftrolle „stürmen““.
export function nameAkk(d) {
  if (d.art === 'verb') return `die Schriftrolle „${d.name}“`;
  if (d.art === 'siegel') return `das Siegel „${d.name}“`;
  if (d.art === 'rune') return `die Rune „${d.name}“`;
  if (d.art === 'tasche') return `die ${d.name}`;
  return d.artikel ? `${d.artikel === 'der' ? 'den' : d.artikel} ${d.name}` : d.name;
}
// Kleines Bild für Fenster und Listen; ohne Bild das Emoji (als Ersatz markiert).
export function iconHtml(def, cls = 'ic') {
  const src = bildFuer(def);
  return src ? `<img class="${cls}" src="${src}" alt="" draggable="false">` : (def.emoji ? `<span class="emoji-ersatz">${def.emoji}</span>` : '');
}

// Abzeichen eines Items: bei Komposita das Bild des Kristalls, bei der Krone ein Zeichen.
export function abzeichenHtml(def) {
  if (!def?.abzeichen) return '';
  const kraft = def.teile?.kraft;
  if (kraft) return KRAFT_SYMBOL[kraft] ? `<img class="abz-img" src="${symbolPfad(KRAFT_SYMBOL[kraft])}" alt="">` : iconHtml(G.DEFS[kraft], 'abz-img');
  return /\p{Extended_Pictographic}/u.test(def.abzeichen) ? '' : def.abzeichen; // Emoji-Abzeichen aus items.json entfallen
}
export const genusChip = (g) => `<span class="genus" style="--genus:${GENUS[g].farbe}">${g}</span>`;

export function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2200);
}

// ---------- Gold: Zahl zählt hoch/runter, Münzen fliegen ----------

let shownGold = null, goldRun = null, tween = 0;

export function syncGold() {
  const run = G.run;
  const num = $('gold-num'), shop = $('shop-gold-num');
  if (!run || !num) return;
  const show = (v) => { num.textContent = v; if (shop) shop.textContent = v; };
  if (goldRun !== run || shownGold === null || $('game').hidden) {
    goldRun = run;
    shownGold = run.gold;
    show(run.gold);
    return;
  }
  if (run.gold === shownGold) return;
  const from = shownGold, to = run.gold;
  shownGold = to;
  flyCoins(to - from);
  const chip = $('stat-gold');
  chip.classList.remove('gain', 'spend');
  void chip.offsetWidth;
  chip.classList.add(to > from ? 'gain' : 'spend');
  cancelAnimationFrame(tween);
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / 600);
    show(Math.round(from + (to - from) * k));
    if (k < 1) tween = requestAnimationFrame(step);
  };
  tween = requestAnimationFrame(step);
}

function flyCoins(delta) {
  const chip = $('stat-gold')?.getBoundingClientRect();
  const shop = $('shop')?.getBoundingClientRect();
  if (!chip || !shop || !document.body.animate) return;
  const n = Math.min(6, Math.abs(delta));
  const a = { x: chip.left + 24, y: chip.top + chip.height / 2 };
  const b = { x: shop.left + shop.width / 2, y: shop.top + 40 };
  const [from, to] = delta > 0 ? [b, a] : [a, b];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div');
    c.className = 'coin-fly';
    c.innerHTML = sym('gold');
    document.body.append(c);
    const off = (i - n / 2) * 14;
    c.animate([
      { transform: `translate(${from.x + off}px, ${from.y}px) scale(.8)`, opacity: 0 },
      { transform: `translate(${from.x + off}px, ${from.y - 20}px) scale(1)`, opacity: 1, offset: 0.15 },
      { transform: `translate(${to.x}px, ${to.y}px) scale(.7)`, opacity: 1, offset: 0.9 },
      { transform: `translate(${to.x}px, ${to.y}px) scale(.3)`, opacity: 0 },
    ], { duration: 700 + i * 70, easing: 'ease-in-out' });
    setTimeout(() => c.remove(), 800 + i * 70);
  }
}

export function bump(id) {
  const el = $(id);
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

// ---------- Fenster ----------

export function openModal(html, cls = '') {
  const card = $('modal-card');
  card.className = 'modal-card ' + cls;
  card.innerHTML = html;
  $('modal').hidden = false;
  return card;
}

export const closeModal = () => { $('modal').hidden = true; };

// Einfaches Fenster: Knöpfe mit data-act schließen es und rufen handlers[act] auf.
export function modal(html, handlers = {}, cls = '') {
  const card = openModal(html, cls);
  card.querySelectorAll('[data-act]').forEach((b) => {
    b.onclick = () => {
      closeModal();
      const fn = handlers[b.dataset.act];
      if (fn) fn();
    };
  });
  return card;
}

// Kleines Frage-Fenster direkt über einem Item (nicht bildschirmfüllend). Eine durchsichtige Fläche
// dahinter hält das Spiel an, bis die Frage beantwortet ist. Gibt das Fenster zurück.
// beteiligt: Items, um die es in der Frage geht (leuchten, Linie zum Fenster); ohne Angabe das Anker-Item.
export function openQuick(html, anchor, beteiligt = null) {
  let layer = $('quick');
  const rect = anchor?.getBoundingClientRect?.() || layer?.anchorRect || null;
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'quick';
    layer.innerHTML = '<div class="quick-card" data-tut="fenster"></div>';
    document.body.append(layer);
  }
  layer.anchorRect = rect;
  const card = layer.querySelector('.quick-card');
  card.innerHTML = html;
  if (nebenRucksack(layer, card, beteiligt || [anchor])) card.classList.add('no-tip');
  else placeQuick(card, rect);
  return card;
}

export const closeQuick = () => $('quick')?.remove();

// ---------- Aufgaben-Fenster neben dem Rucksack ----------
// Fenster mit einer Frage zu Items liegen rechts neben dem Rucksack (über Lager und Infobereich), nie über
// den Rucksack-Feldern. Die beteiligten Items bekommen einen leuchtenden Rahmen und eine dünne Linie zum
// Fenster. Ohne sichtbares Spielfeld oder bei zu wenig Platz: false (das Fenster bleibt, wo es war).
export function nebenRucksack(layer, card, beteiligt = []) {
  const bag = document.querySelector('#game:not([hidden]) .bag-panel');
  const els = beteiligt.filter((e) => e?.isConnected);
  layer.querySelector('.af-linien')?.remove();
  layer.zielRects = [];
  if (!bag || !els.length) return false;
  const b = bag.getBoundingClientRect();
  const m = 8, oben = (document.querySelector('#game .topbar')?.getBoundingClientRect().bottom || 0) + m;
  const links = b.right + 12, breite = innerWidth - links - m, hoehe = innerHeight - oben - m;
  if (breite < 300) return false;
  card.classList.add('neben');
  card.style.maxWidth = breite + 'px';
  card.style.maxHeight = hoehe + 'px';
  card.style.left = links + 'px';
  card.style.top = oben + 'px';
  const cw = card.offsetWidth, ch = Math.min(card.offsetHeight, hoehe);
  const ziele = els.map((e) => e.getBoundingClientRect());
  const left = links + (breite - cw) / 2;
  // Höhe: auf Höhe der Items – oder oben/unten, wenn das Fenster sonst ein Item im Lager verdeckt
  const mitte = ziele.reduce((s, r) => s + r.top + r.height / 2, 0) / ziele.length;
  const klemme = (t) => Math.max(oben, Math.min(innerHeight - m - ch, t));
  const deckt = (t) => ziele.reduce((s, r) => s + Math.max(0, Math.min(left + cw, r.right) - Math.max(left, r.left)) * Math.max(0, Math.min(t + ch, r.bottom) - Math.max(t, r.top)), 0);
  const top = [mitte - ch / 2, oben, innerHeight - m - ch].map(klemme).reduce((best, t) => (deckt(t) < deckt(best) ? t : best));
  card.style.left = left + 'px';
  card.style.top = top + 'px';
  layer.zielRects = ziele;
  verbinde(layer, { left, top, right: left + cw, bottom: top + ch }, ziele);
  return true;
}

// Leuchtrahmen um die Items und je eine Linie vom Item-Rand zum nächsten Punkt am Fensterrand.
function verbinde(layer, c, ziele) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', 'af-linien');
  const klemme = (v, a, z) => Math.max(a, Math.min(z, v));
  svg.innerHTML = ziele.map((r) => {
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const x2 = klemme(cx, c.left, c.right), y2 = klemme(cy, c.top, c.bottom);
    const x1 = klemme(x2, r.left, r.right), y1 = klemme(y2, r.top, r.bottom);
    return `<rect class="af-ring" x="${r.left - 5}" y="${r.top - 5}" width="${r.width + 10}" height="${r.height + 10}" rx="12"/>`
      + `<line class="af-linie" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><circle class="af-punkt" cx="${x1}" cy="${y1}" r="4"/>`;
  }).join('');
  layer.prepend(svg);
}

// Über dem Item, sonst darunter; immer ganz im Bild.
function placeQuick(card, r) {
  const m = 8, cw = card.offsetWidth, ch = card.offsetHeight;
  let left = r ? r.left + r.width / 2 - cw / 2 : (innerWidth - cw) / 2;
  let top = r ? r.top - ch - 14 : (innerHeight - ch) / 2;
  let below = false;
  if (r && top < m) { top = r.bottom + 14; below = true; }
  left = Math.max(m, Math.min(innerWidth - cw - m, left));
  top = Math.max(m, Math.min(innerHeight - ch - m, top));
  card.style.left = left + 'px';
  card.style.top = top + 'px';
  card.classList.toggle('below', below);
  card.style.setProperty('--tip', r ? `${Math.max(16, Math.min(cw - 16, r.left + r.width / 2 - left))}px` : '50%');
  card.classList.toggle('no-tip', !r);
}

// ---------- Items ----------

// Sternstufe eines Items im Rucksack; Runen zeigen ihre Steigerungsstufe als Sterne.
export const sternVon = (p) => p?.stern || G.DEFS[p?.id]?.stufe || 1;

export function itemEl(def, rot, size, stern = 1) {
  const s = sizeOf(def, rot);
  const el = document.createElement('div');
  const passive = !def.abklingzeit && def.art !== 'siegel' && def.art !== 'rune' && def.art !== 'begleiter' && def.art !== 'spruch';
  el.className = `item r-${def.seltenheit}` + (passive ? ' passive' : '');
  el.style.setProperty('--rar', G.RAR[def.seltenheit]?.farbe || '#9a8f7a');
  el.style.width = s.w * size - 6 + 'px';
  el.style.height = s.h * size - 6 + 'px';

  const cd = document.createElement('div');
  cd.className = 'cd';
  el.append(cd);

  if (stern > 1) {
    // Sternstufe gut sichtbar oben in der Mitte
    el.classList.add('s' + stern);
    const st = document.createElement('span');
    st.className = 'stars';
    st.textContent = '★'.repeat(stern);
    st.style.fontSize = Math.max(8, Math.round(size * 0.15)) + 'px';
    el.append(st);
  }

  const src = bildFuer(def);
  // Bild in der Form des Items (bei quer liegenden Items gedreht); ohne Bild bleibt das Emoji
  const bild = () => {
    const img = document.createElement('img');
    img.className = 'item-img';
    img.src = src;
    img.alt = '';
    img.draggable = false;
    const rand = size >= 56 ? Math.round(size * 0.22) : 6;
    img.style.width = def.w * size - 12 - rand + 'px';
    img.style.height = def.h * size - 12 - rand * 1.4 + 'px';
    if ((rot || 0) % 2 && def.w !== def.h) img.style.transform = 'translate(-50%, -50%) rotate(90deg)';
    img.onerror = () => { el.classList.remove('has-img'); img.remove(); };
    el.classList.add('has-img');
    return img;
  };

  if (def.art === 'siegel') {
    // Artikel-Siegel: Wort auf Genusfarbe (über dem Siegel-Bild)
    el.classList.add('siegel');
    el.style.setProperty('--genus', GENUS[def.genus].farbe);
    if (src) el.append(bild());
    const w = document.createElement('span');
    w.className = 'word';
    w.textContent = def.name;
    w.style.fontSize = Math.round(size * 0.34) + 'px';
    el.append(w);
    return el;
  }

  const em = document.createElement('span');
  em.className = 'emoji emoji-ersatz';
  em.textContent = def.emoji; // emoji-ersatz: Item ohne Bild
  em.style.fontSize = Math.round(Math.min(s.w, s.h) * size * (s.w * s.h === 1 ? 0.5 : 0.58)) + 'px';
  if (rot && def.w !== def.h) em.style.transform = 'rotate(90deg)';
  el.append(em);

  if (src) el.append(bild());
  if (def.leuchten) {
    // Kraft-Effekt über dem Bild (Feuer, Gift, Eis …)
    el.classList.add('glow');
    el.style.setProperty('--glow', def.leuchten);
    const fx = document.createElement('span');
    fx.className = 'kraft-fx';
    el.append(fx);
  }
  if (isRune(def)) {
    el.classList.add('rune');
    em.style.fontSize = Math.round(size * 0.34) + 'px';
  }
  if (isVerb(def) && def.formen) {
    // Verb-Rolle: Pfeil zeigt auf das Subjekt (0 ↑, 1 →, 2 ↓, 3 ←)
    el.classList.add('verb');
    const a = document.createElement('span');
    a.className = `arrow v${(rot || 0) % 4}`;
    a.textContent = '➤';
    a.style.fontSize = Math.round(size * 0.26) + 'px';
    el.append(a);
    if ((rot || 0) % 2) em.style.transform = 'rotate(90deg)';
  }
  if (abzeichenHtml(def)) {
    const b = document.createElement('span');
    b.className = 'badge';
    b.innerHTML = abzeichenHtml(def);
    b.style.setProperty('--abz', Math.max(11, Math.round(size * 0.24)) + 'px');
    el.append(b);
  }
  if (size >= 56) {
    const l = document.createElement('span');
    l.className = 'label';
    namensBand(l, def.name, null);
    el.append(l);
  }
  return el;
}

// ---------- Raster ----------

// grid: { cols, rows, mask }. Felder außerhalb der mask bleiben unsichtbar.
export function buildGrid(el, grid, size) {
  el.innerHTML = '';
  el.style.setProperty('--cols', grid.cols);
  el.style.setProperty('--rows', grid.rows);
  el.style.setProperty('--cell', size + 'px');
  el.classList.toggle('masked', !!grid.mask);
  for (let y = 0; y < grid.rows; y++)
    for (let x = 0; x < grid.cols; x++) {
      const c = document.createElement('div');
      const key = `${x},${y}`;
      c.className = 'cell';
      if (grid.mask && !grid.mask.has(key)) c.classList.add('off');
      const t = grid.taschen?.[key];
      if (t) {
        c.classList.add('tasche');
        // Taschen-Symbol im ersten Feld der Tasche
        if (G.DEFS[t] && Object.entries(grid.taschen).find(([, v]) => v === t)[0] === key) {
          const bild = bildFuer(G.DEFS[t]);
          if (bild) { c.dataset.symbol = '1'; c.style.setProperty('--tasche-bild', `url("${bild}")`); }
        }
      }
      el.append(c);
    }
}

// Zeichnet Items in ein Raster; info (aus analyze) liefert Markierungen und Leuchtlinien.
export function drawItems(gridEl, grid, placed, size, info, area) {
  const els = {};
  const fusing = new Set();


  for (const p of placed) {
    const def = G.DEFS[p.id];
    const it = itemEl(def, p.rot, size, sternVon(p));
    it.dataset.tut = 'item-' + p.id;
    if (p.glanz) it.classList.add('glanz');
    it.style.left = p.x * size + 'px';
    it.style.top = p.y * size + 'px';
    const i = info?.get(p.uid);
    if (i?.verb && i.verb.status !== 'ok') it.classList.add('idle');
    if (isNoun(def)) sockelZeichnen(it, p, def, size);
    if (fusing.has(p.uid)) it.classList.add('fuses');
    if (p.fluch) {
      it.classList.add('cursed');
      const l = it.querySelector('.label');
      if (l) l.textContent = p.fluch;
      const m = document.createElement('span');
      m.className = 'mark-fluch';
      m.textContent = '!';
      it.append(m);
    }
    gridEl.append(it);
    els[p.uid] = it;
  }

  if (info) drawRuneLines(gridEl, grid, placed, size, info);
  baenderEinpassen(gridEl);
  return els;
}

// Sockel eines Nomens: kleine Mulden unten am Gegenstand (Artikel rund, Adjektive eckig); die Nominalgruppe
// („das scharfe Feuerschwert“) steht als Beschriftung darauf.
export function sockelZeichnen(it, p, def, size, extraRunen = 0) {
  const s = sockelVon(p), pl = sockelPlaetze(def, p.stern || 1, extraRunen);
  const leiste = document.createElement('span');
  leiste.className = 'sockel-leiste';
  leiste.style.setProperty('--mulde', Math.max(10, Math.round(size * (def.w * def.h === 1 ? 0.15 : 0.18))) + 'px');
  const a = document.createElement('span');
  a.className = 'mulde artikel' + (s.siegel ? ' voll' : '');
  if (s.siegel) { a.style.setProperty('--genus', GENUS[G.DEFS[s.siegel].genus].farbe); a.textContent = G.DEFS[s.siegel].genus; }
  leiste.append(a);
  for (let k = 0; k < Math.max(pl.runen, s.runen.length); k++) {
    const r = document.createElement('span');
    r.className = 'mulde adjektiv' + (s.runen[k] ? ' voll' : '');
    // belegt: das Bild der eingesetzten Rune
    const src = s.runen[k] && bildFuer(G.DEFS[s.runen[k]]);
    if (src) r.innerHTML = `<img src="${src}" alt="">`;
    else if (s.runen[k]) r.textContent = G.DEFS[s.runen[k]].name.charAt(0);
    leiste.append(r);
  }
  it.append(leiste);
  const adjs = s.runen.map((id) => G.DEFS[id]).filter((r) => runeFits(r, def));
  const phrase = phraseFor(adjs, def, !!s.siegel);
  const l = it.querySelector('.label');
  if (phrase && l) { namensBand(l, phrase, s.siegel ? def.artikel : null); l.classList.add('phrase'); }
  if (phrase) it.title = phrase;
}

function drawRuneLines(gridEl, grid, placed, size, info) {
  const lines = [];
  for (const p of placed) {
    const i = info.get(p.uid);
    const d = G.DEFS[p.id];
    if (isVerb(d) && i?.verb?.status === 'ok') {
      // Linie von der Spitze der Rolle zum Subjekt
      const t = verbTargetCell(p, d);
      const dir = (p.rot || 0) % 4;
      const s = dir % 2 ? { w: d.h, h: d.w } : { w: d.w, h: d.h };
      const from = [{ x: p.x + 0.5, y: p.y + 0.5 }, { x: p.x + s.w - 0.5, y: p.y + 0.5 }, { x: p.x + 0.5, y: p.y + s.h - 0.5 }, { x: p.x + 0.5, y: p.y + 0.5 }][dir];
      lines.push([from.x * size, from.y * size, (t.x + 0.5) * size, (t.y + 0.5) * size, 'verb']);
    }
  }
  if (!lines.length) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('rune-lines');
  svg.setAttribute('width', grid.cols * size);
  svg.setAttribute('height', grid.rows * size);
  for (const [x1, y1, x2, y2, cls] of lines) {
    const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    if (cls) l.classList.add(cls);
    Object.entries({ x1, y1, x2, y2 }).forEach(([k, v]) => l.setAttribute(k, v));
    svg.append(l);
  }
  gridEl.append(svg);
}

// Verbinden-Animation: Beide Teile fliegen zusammen, kurzer Lichtblitz, die Sterne erscheinen nacheinander,
// und der Gewinn („+120 % Schaden“) steigt auf. opts: { icon, sterne, gewinn, gross }
// gross (★★★★ oder Krone): Glanz über den ganzen Rucksack.
export function mergeAnimation(fromRects, toEl, opts = {}) {
  if (!toEl) return;
  const to = toEl.getBoundingClientRect();
  const cx = to.left + to.width / 2, cy = to.top + to.height / 2;
  const fly = (html, cls, x, y) => {
    const f = document.createElement('div');
    f.className = cls;
    f.innerHTML = html;
    f.style.left = x + 'px';
    f.style.top = y + 'px';
    document.body.append(f);
    return f;
  };
  // 1. Die Teile fliegen zusammen
  for (const r of fromRects) {
    const f = fly(opts.icon || '★', 'merge-fly', 0, 0);
    const sx = r.left + r.width / 2, sy = r.top + r.height / 2;
    f.animate?.([
      { transform: `translate(${sx - 28}px, ${sy - 28}px) scale(1)`, opacity: 1 },
      { transform: `translate(${cx - 28}px, ${cy - 28}px) scale(.75)`, opacity: 1, offset: 0.85 },
      { transform: `translate(${cx - 28}px, ${cy - 28}px) scale(.3)`, opacity: 0 },
    ], { duration: 520, easing: 'ease-in' });
    setTimeout(() => f.remove(), 540);
  }
  setTimeout(() => {
    // 2. Lichtblitz
    toEl.classList.add('merged');
    const flash = fly('', 'merge-flash' + (opts.gross ? ' gross' : ''), cx, cy);
    setTimeout(() => flash.remove(), 700);
    for (let i = 0; i < (opts.gross ? 18 : 8); i++) {
      const s = fly('★', 'merge-star', 0, 0);
      const w = (i / (opts.gross ? 18 : 8)) * Math.PI * 2, d = opts.gross ? 150 : 80;
      s.animate?.([
        { transform: `translate(${cx - 12}px, ${cy - 12}px) scale(.4)`, opacity: 1 },
        { transform: `translate(${cx - 12 + Math.cos(w) * d}px, ${cy - 12 + Math.sin(w) * d}px) scale(1.2)`, opacity: 0 },
      ], { duration: 800, easing: 'ease-out' });
      setTimeout(() => s.remove(), 820);
    }
    // 3. Die Sterne erscheinen nacheinander über dem Item
    const n = opts.sterne || 0;
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        const s = fly('★', 'merge-bigstar', cx + (i - (n - 1) / 2) * 30, to.top - 6);
        setTimeout(() => s.remove(), 1100 - i * 120);
      }, 60 + i * 160);
    }
    // 4. Gewinn steigt auf
    if (opts.gewinn) {
      const g = fly(opts.gewinn, 'merge-gain', cx, to.top + to.height * 0.35);
      setTimeout(() => g.remove(), 1500);
    }
    // ★★★★: Glanz über den ganzen Rucksack
    if (opts.gross) {
      const bag = document.getElementById('grid-bag');
      bag?.classList.remove('feier');
      void bag?.offsetWidth;
      bag?.classList.add('feier');
      setTimeout(() => bag?.classList.remove('feier'), 1900);
    }
  }, 480);
}

