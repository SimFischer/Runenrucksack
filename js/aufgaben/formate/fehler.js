// Fehler finden: im Satz das falsch geschriebene Wort antippen und dann verbessern (modus „verbessern“),
// oder alle gesuchten Wörter antippen und „Fertig“ (modus „markieren“: Nomen, großzuschreibende Wörter,
// mehrere Fehler auf der Speisekarte).
import { knopf, antwortKnoepfe } from './basis.js';

export default {
  id: 'fehler',
  gross: () => true,
  erzeuge: (inhalt) => ({ ...inhalt }),
  darstelle(el, a, melde) {
    const satz = document.createElement('div');
    satz.className = 'af-satz af-tippsatz';
    const markiert = new Set();
    const zeichne = () => {
      satz.innerHTML = '';
      a.woerter.forEach((w, i) => {
        const b = document.createElement('button');
        b.className = 'af-tippwort' + (markiert.has(i) ? ' markiert' : '') + (a.zielMarkiert && a.ziele.includes(i) && !markiert.has(i) ? ' rabe' : '');
        b.textContent = w + (i === a.woerter.length - 1 && a.satzEnde ? a.satzEnde : '');
        b.onclick = () => {
          if (a.modus === 'verbessern') { waehle(i); return; }
          if (markiert.has(i)) markiert.delete(i); else markiert.add(i);
          zeichne();
        };
        satz.append(b);
      });
    };
    const waehle = (i) => {
      if (!a.ziele.includes(i)) { melde({ idx: i }); return; }
      markiert.clear(); markiert.add(i);
      zeichne();
      const box = el.querySelector('.af-verbessern') || document.createElement('div');
      box.className = 'af-verbessern';
      box.innerHTML = '<p class="af-hinweis">Gut gefunden! Wie schreibt man es richtig?</p>';
      el.append(box);
      antwortKnoepfe(box, a.optionen, (w) => melde({ idx: i, wort: w }));
    };
    zeichne();
    el.append(satz);
    if (a.zielMarkiert) el.insertAdjacentHTML('beforeend', '<p class="af-hinweis af-rabe"><img src="assets/ui/begleiter/rabe.webp" alt=""> Der Rabe zeigt dir das falsche Wort. Verbessern musst du es selbst.</p>');
    if (a.modus !== 'verbessern') {
      const fertig = knopf('✓ Fertig', 'primary af-fertig-knopf');
      fertig.onclick = () => melde([...markiert].sort((x, y) => x - y));
      el.append(fertig);
    }
  },
  pruefe(a, antwort) {
    if (a.modus === 'verbessern') return { richtig: a.ziele.includes(antwort.idx) && antwort.wort === a.korrektur[antwort.idx] };
    const soll = [...a.ziele].sort((x, y) => x - y);
    return { richtig: JSON.stringify(antwort) === JSON.stringify(soll) };
  },
  loesung: (a) => (a.modus === 'verbessern' ? { idx: a.ziele[0], wort: a.korrektur[a.ziele[0]] } : [...a.ziele].sort((x, y) => x - y)),
};
