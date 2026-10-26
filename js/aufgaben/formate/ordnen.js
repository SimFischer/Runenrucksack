// Satz ordnen: Satzglieder als Kärtchen in die richtige Reihenfolge bringen (ziehen oder antippen),
// oder ein Satzglied antippen (modus „antippen“: Subjekt, Prädikat).
import { knopf, ziehbar, gleich } from './basis.js';

export default {
  id: 'ordnen',
  gross: (a) => a.modus !== 'antippen',
  erzeuge: (inhalt, rng = Math.random) => {
    if (inhalt.modus === 'antippen') return { ...inhalt };
    // Feste Karten vorne, der Rest gemischt (nie schon in der richtigen Reihenfolge)
    const fest = inhalt.fest || 0;
    let rest = inhalt.karten.slice(fest);
    for (let k = 0; k < 10 && gleich(rest, inhalt.loesung.slice(fest)); k++) rest = [...rest].sort(() => rng() - 0.5);
    if (gleich(rest, inhalt.loesung.slice(fest)) && rest.length > 1) rest = [...rest].reverse();
    return { ...inhalt, karten: [...inhalt.karten.slice(0, fest), ...rest] };
  },
  darstelle(el, a, melde) {
    if (a.modus === 'antippen') {
      const box = document.createElement('div');
      box.className = 'af-satz af-glieder';
      a.karten.forEach((t, i) => {
        const b = knopf(t, 'af-glied');
        b.onclick = () => melde(i);
        box.append(b);
      });
      el.append(box);
      return;
    }
    const fest = a.fest || 0;
    const reihe = a.karten.slice(0, fest);
    const vorrat = a.karten.slice(fest);
    const slotsEl = document.createElement('div');
    slotsEl.className = 'af-satz af-reihe';
    const vorratEl = document.createElement('div');
    vorratEl.className = 'af-opts af-vorrat';
    const zeichne = () => {
      slotsEl.innerHTML = '';
      a.karten.forEach((_, i) => {
        const slot = document.createElement('div');
        slot.className = 'af-slot' + (i < fest ? ' fest' : '');
        slot.dataset.i = i;
        if (reihe[i] !== undefined) {
          slot.textContent = reihe[i];
          if (i >= fest) slot.onclick = () => { vorrat.push(reihe[i]); reihe.splice(i, 1); zeichne(); };
        }
        slotsEl.append(slot);
      });
      vorratEl.innerHTML = '';
      for (const t of vorrat) {
        const k = document.createElement('div');
        k.className = 'af-karte';
        k.textContent = t;
        const lege = () => {
          vorrat.splice(vorrat.indexOf(t), 1);
          reihe.push(t);
          zeichne();
          if (reihe.length === a.karten.length) setTimeout(() => melde([...reihe]), 250);
        };
        ziehbar(k, { ziele: () => [slotsEl], onDrop: (z) => { if (z) lege(); }, onTap: lege });
        vorratEl.append(k);
      }
    };
    zeichne();
    el.append(slotsEl, vorratEl);
  },
  pruefe: (a, antwort) => (a.modus === 'antippen' ? { richtig: antwort === a.richtig } : { richtig: gleich(antwort, a.loesung) }),
  loesung: (a) => (a.modus === 'antippen' ? a.richtig : a.loesung),
};
