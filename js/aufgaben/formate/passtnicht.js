// Passt nicht dazu: aus 4 Wörtern das eine wählen, das nicht ins Wortfeld, in die Wortfamilie oder zur Wortart passt.
import { antwortKnoepfe } from './basis.js';

export default {
  id: 'passtnicht',
  gross: () => false,
  erzeuge: (inhalt) => ({ ...inhalt }),
  darstelle(el, a, melde, vorher) {
    antwortKnoepfe(el, a.woerter, melde, { gesperrt: vorher?.falsch || [] }).classList.add('af-vier');
  },
  pruefe: (a, antwort) => ({ richtig: antwort === a.richtig, falsch: antwort === a.richtig ? [] : [antwort] }),
  loesung: (a) => a.richtig,
  antworten: (a) => a.woerter,
};
