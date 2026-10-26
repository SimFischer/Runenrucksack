// Ganzes Wort eintippen (nur auf Stufe 3, kurze Wörter) – mit der großen Bildschirmtastatur.
// Groß- und Kleinschreibung zählt hier nicht: Es geht um die Buchstaben.
import { tastatur } from './basis.js';

export const normal = (s) => String(s).trim().toLowerCase();

export default {
  id: 'eintippen',
  gross: () => true,
  erzeuge: (inhalt) => ({ ...inhalt }),
  darstelle(el, a, melde) {
    let text = '';
    const feld = document.createElement('div');
    feld.className = 'af-eingabe';
    const zeichne = () => { feld.textContent = text; feld.insertAdjacentHTML('beforeend', '<span class="af-cursor"></span>'); };
    zeichne();
    el.append(feld);
    tastatur(el, 'voll', {
      taste: (ch) => { if (text.length < 20) { text += ch; zeichne(); } },
      loeschen: () => { text = text.slice(0, -1); zeichne(); },
      fertig: () => { if (text) melde(text); },
    });
  },
  pruefe: (a, antwort) => ({ richtig: normal(antwort) === normal(a.loesung) }),
  loesung: (a) => a.loesung,
};
