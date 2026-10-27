// Lückensatz mit Auswahl: das Wort steht in einem kurzen Satz aus der Spielwelt.
import { antwortKnoepfe } from './basis.js';

// Lücke und das folgende Wort (oder Satzzeichen) bilden eine Einheit, die nie umbricht.
export const lueckeHtml = (satz) => satz.replace(/___(\S*(?: \S+)?)/, (_, danach) => `<span class="luecke-paar"><span class="blank">___</span>${danach}</span>`);

export default {
  id: 'luecke',
  gross: () => false,
  erzeuge: (inhalt) => ({ ...inhalt }),
  darstelle(el, a, melde, vorher) {
    el.insertAdjacentHTML('beforeend', `<div class="af-satz">${lueckeHtml(a.satz)}</div>`);
    antwortKnoepfe(el, a.optionen, melde, { genus: a.genus, gesperrt: vorher?.falsch || [] });
  },
  pruefe: (a, antwort) => ({ richtig: antwort === a.richtig, falsch: antwort === a.richtig ? [] : [antwort] }),
  loesung: (a) => a.richtig,
  antworten: (a) => a.optionen,
};
