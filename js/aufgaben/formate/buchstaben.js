// Buchstaben ergänzen: fehlende Buchstaben mit der großen Bildschirmtastatur eintippen („Ä _ _ e“ → Äxte).
import { tastatur } from './basis.js';

export default {
  id: 'buchstaben',
  gross: () => true,
  erzeuge: (inhalt) => ({ ...inhalt }),
  darstelle(el, a, melde) {
    const eingabe = [];
    const wortEl = document.createElement('div');
    wortEl.className = 'af-wort';
    const zeichne = () => {
      let k = 0;
      wortEl.innerHTML = (a.vorsatz ? `<span class="af-vorsatz">${a.vorsatz}</span> ` : '') + [...a.ziel].map((ch, i) => {
        if (!a.luecken.includes(i)) return `<span class="af-bst">${ch}</span>`;
        const e = eingabe[k];
        const aktiv = k === eingabe.length;
        k++;
        const zeig = e === undefined ? '' : i === 0 ? e.toUpperCase() : e;
        return `<span class="af-bst af-luecke${aktiv ? ' aktiv' : ''}${e !== undefined ? ' voll' : ''}">${zeig}</span>`;
      }).join('');
    };
    zeichne();
    el.append(wortEl);
    tastatur(el, a.tasten, {
      taste: (ch) => {
        if (eingabe.length >= a.luecken.length) return;
        eingabe.push(ch);
        zeichne();
        if (eingabe.length === a.luecken.length) setTimeout(() => melde([...eingabe]), 180);
      },
      loeschen: () => { eingabe.pop(); zeichne(); },
    });
  },
  pruefe(a, antwort) {
    const soll = a.luecken.map((i) => a.ziel[i].toLowerCase());
    return { richtig: antwort.map((c) => c.toLowerCase()).join('') === soll.join('') };
  },
  loesung: (a) => a.luecken.map((i) => a.ziel[i].toLowerCase()),
};
