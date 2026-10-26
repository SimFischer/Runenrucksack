// Gemeinsame Bausteine der Oberfläche: Fenster, Hinweise, Item-Kacheln und Raster.
import { sizeOf } from './logic.js';
import { GENUS, findFusions, isRune, isVerb, runeTargetCell, verbTargetCell } from './grammar.js';
import { G } from './state.js';

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
export const genusChip = (g) => `<span class="genus" style="--genus:${GENUS[g].farbe}">${g}</span>`;

export function toast(text) {
  const t = $('toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => { t.hidden = true; }, 2200);
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

// ---------- Items ----------

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
    const it = itemEl(def, p.rot, size, p.stern || 1);
    it.dataset.tut = 'item-' + p.id;
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

// Verschmelz-Animation: die drei Teile fliegen zusammen, Glanz, Sterne erscheinen.
export function mergeAnimation(fromRects, toEl, emoji) {
  if (!toEl) return;
  const to = toEl.getBoundingClientRect();
  const cx = to.left + to.width / 2, cy = to.top + to.height / 2;
  for (const r of fromRects) {
    const f = document.createElement('div');
    f.className = 'merge-fly';
    f.textContent = emoji;
    document.body.append(f);
    const sx = r.left + r.width / 2, sy = r.top + r.height / 2;
    f.animate?.([
      { transform: `translate(${sx - 24}px, ${sy - 24}px) scale(1)`, opacity: 1 },
      { transform: `translate(${cx - 24}px, ${cy - 24}px) scale(.6)`, opacity: 1, offset: 0.8 },
      { transform: `translate(${cx - 24}px, ${cy - 24}px) scale(.2)`, opacity: 0 },
    ], { duration: 700, easing: 'ease-in' });
    setTimeout(() => f.remove(), 720);
  }
  setTimeout(() => {
    toEl.classList.add('merged');
    for (let i = 0; i < 10; i++) {
      const s = document.createElement('div');
      s.className = 'merge-star';
      s.textContent = i % 2 ? '★' : '✨';
      document.body.append(s);
      const a = (i / 10) * Math.PI * 2;
      s.animate?.([
        { transform: `translate(${cx - 12}px, ${cy - 12}px) scale(.4)`, opacity: 1 },
        { transform: `translate(${cx - 12 + Math.cos(a) * 90}px, ${cy - 12 + Math.sin(a) * 90}px) scale(1.2)`, opacity: 0 },
      ], { duration: 900, easing: 'ease-out' });
      setTimeout(() => s.remove(), 920);
    }
  }, 650);
}
