// Auswahl: 3–4 Antworten (bei der/die/das genau drei), ein Tipp genügt.
import { antwortKnoepfe } from './basis.js';

export default {
  id: 'auswahl',
  gross: () => false,
  erzeuge: (inhalt) => ({ ...inhalt }),
  darstelle(el, a, melde, vorher) {
    if (a.text) el.insertAdjacentHTML('beforeend', `<div class="af-text">${a.text}</div>`);
    antwortKnoepfe(el, a.optionen, melde, { genus: a.genus, gesperrt: vorher?.falsch || [] });
  },
  pruefe: (a, antwort) => ({ richtig: antwort === a.richtig, falsch: antwort === a.richtig ? [] : [antwort] }),
  loesung: (a) => a.richtig,
  antworten: (a) => a.optionen,
};
