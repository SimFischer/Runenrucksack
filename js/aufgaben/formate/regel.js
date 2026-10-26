// Regel entdecken: drei Beispiele zeigen ein Muster, das Kind wählt die passende Regel.
import { antwortKnoepfe } from './basis.js';

export default {
  id: 'regel',
  gross: () => true,
  erzeuge: (inhalt) => ({ ...inhalt }),
  darstelle(el, a, melde, vorher) {
    el.insertAdjacentHTML('beforeend', `<ul class="af-beispiele">${a.beispiele.map((b) => `<li>${b}</li>`).join('')}</ul>`);
    antwortKnoepfe(el, a.optionen, melde, { gesperrt: vorher?.falsch || [] }).classList.add('af-regeln');
  },
  pruefe: (a, antwort) => ({ richtig: antwort === a.richtig, falsch: antwort === a.richtig ? [] : [antwort] }),
  loesung: (a) => a.richtig,
  antworten: (a) => a.optionen,
};
