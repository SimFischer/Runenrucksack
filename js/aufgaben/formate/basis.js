// Gemeinsame Bausteine der Aufgabenformate: Knöpfe, Ziehen mit dem Finger, Bildschirmtastatur.
// Alles funktioniert per Tippen und per Ziehen (Touch zuerst).

export const html = (s) => String(s ?? '');
export const GENUS_FARBE = { der: '#3f7fd9', die: '#d9473f', das: '#3fa65a', Der: '#3f7fd9', Die: '#d9473f', Das: '#3fa65a' };

export function knopf(text, cls = '', attrs = {}) {
  const b = document.createElement('button');
  b.className = 'btn ' + cls;
  b.innerHTML = text;
  for (const [k, v] of Object.entries(attrs)) b.setAttribute(k, v);
  return b;
}

// Antwort-Knöpfe (groß, ein Tipp genügt)
export function antwortKnoepfe(el, optionen, melde, { genus = false, gesperrt = [] } = {}) {
  const box = document.createElement('div');
  box.className = 'af-opts';
  for (const o of optionen) {
    const b = knopf(o, 'af-opt' + (genus ? ' genus-btn' : ''));
    if (genus && GENUS_FARBE[o]) b.style.setProperty('--genus', GENUS_FARBE[o]);
    if (gesperrt.includes(o)) b.disabled = true;
    b.onclick = () => melde(o);
    box.append(b);
  }
  el.append(box);
  return box;
}

// Ziehen mit dem Finger (oder Maus): onDrop(ziel-Element oder null). Kurzes Tippen ruft onTap.
export function ziehbar(karte, { ziele, onDrop, onTap }) {
  karte.style.touchAction = 'none';
  karte.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY };
    const r = karte.getBoundingClientRect();
    let geist = null, ueber = null;
    const bewege = (ev) => {
      if (!geist && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 8) {
        geist = karte.cloneNode(true);
        geist.classList.add('af-geist');
        geist.style.width = r.width + 'px';
        document.body.append(geist);
        karte.classList.add('af-weg');
      }
      if (!geist) return;
      geist.style.left = ev.clientX - r.width / 2 + 'px';
      geist.style.top = ev.clientY - r.height / 2 + 'px';
      const t = ziele().find((z) => { const b = z.getBoundingClientRect(); return ev.clientX >= b.left && ev.clientX <= b.right && ev.clientY >= b.top && ev.clientY <= b.bottom; }) || null;
      if (t !== ueber) { ueber?.classList.remove('af-ueber'); t?.classList.add('af-ueber'); ueber = t; }
    };
    const ende = () => {
      window.removeEventListener('pointermove', bewege);
      window.removeEventListener('pointerup', ende);
      window.removeEventListener('pointercancel', ende);
      ueber?.classList.remove('af-ueber');
      karte.classList.remove('af-weg');
      if (geist) { geist.remove(); onDrop(ueber); } else onTap?.();
    };
    window.addEventListener('pointermove', bewege);
    window.addEventListener('pointerup', ende);
    window.addEventListener('pointercancel', ende);
  });
}

// Große Bildschirmtastatur. tasten: Liste von Buchstaben (nur die nötigen) oder 'voll' für alle.
const VOLL = ['qwertzuiopü', 'asdfghjklöä', 'yxcvbnmß'];
export function tastatur(el, tasten, { taste, loeschen, fertig }) {
  const box = document.createElement('div');
  box.className = 'af-tastatur' + (tasten === 'voll' ? ' voll' : '');
  const reihen = tasten === 'voll' ? VOLL.map((r) => [...r]) : [tasten];
  for (const r of reihen) {
    const reihe = document.createElement('div');
    reihe.className = 'af-tastenreihe';
    for (const ch of r) {
      const b = knopf(ch, 'af-taste');
      b.onclick = () => taste(ch);
      reihe.append(b);
    }
    box.append(reihe);
  }
  const unten = document.createElement('div');
  unten.className = 'af-tastenreihe';
  const lo = knopf('⌫', 'af-taste af-loeschen', { 'aria-label': 'Löschen' });
  lo.onclick = loeschen;
  unten.append(lo);
  if (fertig) {
    const ok = knopf('✓ Fertig', 'af-taste af-fertig primary');
    ok.onclick = fertig;
    unten.append(ok);
  }
  box.append(unten);
  el.append(box);
  return box;
}

export const gleich = (a, b) => JSON.stringify(a) === JSON.stringify(b);
