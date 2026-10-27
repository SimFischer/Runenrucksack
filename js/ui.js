// Gemeinsame Bausteine der Oberfläche: Fenster, Hinweise, Item-Kacheln und Raster.
import { sizeOf } from './logic.js';
import { GENUS, findFusions, isRune, isVerb, runeTargetCell, verbTargetCell } from './grammar.js';
import { G, bildFuer, getPref } from './state.js';

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
// Kleines Bild für Fenster und Listen; ohne Bild das Emoji.
export function iconHtml(def, cls = 'ic') {
  const src = bildFuer(def);
  return src ? `<img class="${cls}" src="${src}" alt="" draggable="false">` : (def.emoji || '');
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
    c.textContent = '🪙';
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
export function openQuick(html, anchor) {
  let layer = $('quick');
  const rect = anchor?.getBoundingClientRect?.() || layer?.anchorRect || null;
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'quick';
    layer.innerHTML = '<div class="quick-card" data-tut="fenster"></div>';
    document.body.append(layer);
  }
  layer.anchorRect = rect;
  const card = layer.firstChild;
  card.innerHTML = html;
  placeQuick(card, rect);
  return card;
}

export const closeQuick = () => $('quick')?.remove();

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
  const passive = !def.abklingzeit && def.art !== 'siegel' && def.art !== 'rune';
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
    st.style.fontSize = Math.max(12, Math.round(size * 0.2)) + 'px';
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
    img.style.width = def.w * size - 12 + 'px';
    img.style.height = def.h * size - 12 + 'px';
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
  em.className = 'emoji';
  em.textContent = def.emoji;
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
    const a = document.createElement('span');
    a.className = `arrow d${(rot || 0) % 4}`;
    a.textContent = '➤';
    a.style.fontSize = Math.round(size * 0.24) + 'px';
    el.append(a);
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
          c.dataset.symbol = G.DEFS[t].emoji;
        }
      }
      el.append(c);
    }
}

// Zeichnet Items in ein Raster; info (aus analyze) liefert Markierungen und Leuchtlinien.
export function drawItems(gridEl, grid, placed, size, info, area) {
  const els = {};
  const fusing = new Set();
  if (area === 'bag') {
    for (const f of findFusions(placed, G.DEFS, G.RECIPES)) fusing.add(f.kraft.uid).add(f.traeger.uid);
  }

  for (const p of placed) {
    const def = G.DEFS[p.id];
    const it = itemEl(def, p.rot, size, sternVon(p));
    it.dataset.tut = 'item-' + p.id;
    if (p.glanz) it.classList.add('glanz');
    it.style.left = p.x * size + 'px';
    it.style.top = p.y * size + 'px';
    const i = info?.get(p.uid);
    if (i) {
      const seal = i.siegel.find((s) => s.ok);
      if (seal) {
        const m = document.createElement('span');
        m.className = 'mark-siegel';
        m.style.setProperty('--genus', GENUS[seal.genus].farbe);
        it.append(m);
      }
      if (i.adjektive.length) {
        const m = document.createElement('span');
        m.className = 'mark-rune';
        m.textContent = '✦';
        it.append(m);
      }
      const idle = (def.art === 'siegel' && !i.ziele.some((z) => z.ok)) || (isRune(def) && !i.ziel?.ok) || (i.verb && i.verb.status !== 'ok');
      if (idle) it.classList.add('idle');
    }
    if (fusing.has(p.uid)) it.classList.add('fuses');
    if (p.fluch) {
      it.classList.add('cursed');
      const l = it.querySelector('.label');
      if (l) l.textContent = p.fluch;
      const m = document.createElement('span');
      m.className = 'mark-fluch';
      m.textContent = '😈';
      it.append(m);
    }
    gridEl.append(it);
    els[p.uid] = it;
  }

  if (info) drawRuneLines(gridEl, grid, placed, size, info);
  return els;
}

function drawRuneLines(gridEl, grid, placed, size, info) {
  const lines = [];
  for (const p of placed) {
    const i = info.get(p.uid);
    const d = G.DEFS[p.id];
    if (isRune(d) && i?.ziel?.ok) {
      const t = runeTargetCell(p);
      lines.push([(p.x + 0.5) * size, (p.y + 0.5) * size, (t.x + 0.5) * size, (t.y + 0.5) * size]);
    } else if (isVerb(d) && i?.verb?.status === 'ok') {
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
    const f = fly(opts.icon || '✨', 'merge-fly', 0, 0);
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
      const s = fly(i % 2 ? '★' : '✨', 'merge-star', 0, 0);
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

