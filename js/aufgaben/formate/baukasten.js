// Baukasten: ein Wort aus Bausteinen zusammensetzen (Bestimmungswort + Grundwort) oder die passende Fuge wählen.
import { knopf, gleich } from './basis.js';

export default {
  id: 'baukasten',
  gross: (a) => a.modus === 'reihe',
  erzeuge: (inhalt) => ({ ...inhalt }),
  darstelle(el, a, melde, vorher) {
    if (a.modus === 'fuge') {
      const zeile = document.createElement('div');
      zeile.className = 'af-bau';
      zeile.innerHTML = `<span class="af-baustein fest">${a.links}</span><span class="af-fuge-slot">?</span><span class="af-baustein fest">${a.rechts}</span>`;
      el.append(zeile);
      const box = document.createElement('div');
      box.className = 'af-opts';
      for (const f of a.fugen) {
        const b = knopf(f === '–' ? '– (nichts)' : `-${f}-`, 'af-opt');
        if (vorher?.falsch?.includes(f)) b.disabled = true;
        b.onclick = () => melde(f);
        box.append(b);
      }
      el.append(box);
      return;
    }
    const gebaut = [];
    const ergebnis = document.createElement('div');
    ergebnis.className = 'af-bau';
    const steine = document.createElement('div');
    steine.className = 'af-opts';
    const zeichne = () => {
      ergebnis.innerHTML = gebaut.length ? gebaut.map((t) => `<span class="af-baustein">${t}</span>`).join('<b>+</b>') + `<span class="af-bauwort">= ${gebaut.join('')}</span>` : '<span class="muted">Tippe die Bausteine in der richtigen Reihenfolge an.</span>';
      steine.innerHTML = '';
      for (const t of a.teile) {
        const b = knopf(t, 'af-opt af-baustein-knopf');
        b.disabled = gebaut.includes(t);
        b.onclick = () => {
          gebaut.push(t);
          zeichne();
          if (gebaut.length === a.loesung.length) setTimeout(() => melde([...gebaut]), 200);
        };
        steine.append(b);
      }
      const zurueck = knopf('↩︎ zurück', 'small');
      zurueck.onclick = () => { gebaut.pop(); zeichne(); };
      if (gebaut.length) steine.append(zurueck);
    };
    zeichne();
    el.append(ergebnis, steine);
  },
  pruefe: (a, antwort) => (a.modus === 'fuge' ? { richtig: antwort === a.richtig, falsch: [antwort] } : { richtig: gleich(antwort, a.loesung) }),
  loesung: (a) => (a.modus === 'fuge' ? a.richtig : a.loesung),
  antworten: (a) => (a.modus === 'fuge' ? a.fugen : null),
};
