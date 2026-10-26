// Lückensatz mit Auswahl: das Wort steht in einem kurzen Satz aus der Spielwelt.
import { antwortKnoepfe } from './basis.js';

export default {
  id: 'luecke',
  gross: () => false,
  erzeuge: (inhalt) => ({ ...inhalt }),
  darstelle(el, a, melde, vorher) {
    el.insertAdjacentHTML('beforeend', `<div class="af-satz">${a.satz.replace('___', '<span class="blank">___</span>')}</div>`);
    antwortKnoepfe(el, a.optionen, melde, { genus: a.genus, gesperrt: vorher?.falsch || [] });
  },
  pruefe: (a, antwort) => ({ richtig: antwort === a.richtig, falsch: antwort === a.richtig ? [] : [antwort] }),
  loesung: (a) => a.richtig,
  antworten: (a) => a.optionen,
};
