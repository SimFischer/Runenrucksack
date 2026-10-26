// Paare finden: links antippen, dann das passende rechts (Grundform – Präteritum, Einzahl – Mehrzahl …).
import { knopf, gleich } from './basis.js';

const FARBEN = ['#3f8fd2', '#e0a526', '#4f9a4a', '#a259d9', '#d9473f'];

export default {
  id: 'paare',
  gross: () => true,
  erzeuge: (inhalt, rng = Math.random) => {
    const n = inhalt.paare.length;
    let rechts = inhalt.paare.map((_, i) => i);
    for (let k = 0; k < 10 && rechts.every((x, i) => x === i); k++) rechts = rechts.map((v) => [rng(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
    if (rechts.every((x, i) => x === i)) rechts = rechts.reverse();
    return { ...inhalt, rechtsReihe: rechts, n };
  },
  darstelle(el, a, melde, vorher) {
    const verbunden = {}; // links-Index → rechts-Index
    if (vorher?.antwort) for (const [l, r] of Object.entries(vorher.antwort)) if (+l === +r) verbunden[l] = r;
    let links = null;
    const box = document.createElement('div');
    box.className = 'af-paare';
    const zeichne = () => {
      box.innerHTML = '';
      const L = document.createElement('div'), R = document.createElement('div');
      L.className = R.className = 'af-spalte';
      a.paare.forEach((p, i) => {
        const b = knopf(p[0], 'af-paar' + (links === i ? ' gewaehlt' : ''));
        if (verbunden[i] !== undefined) b.style.setProperty('--paar', FARBEN[i % FARBEN.length]), b.classList.add('verbunden');
        b.onclick = () => { links = i; zeichne(); };
        L.append(b);
      });
      for (const r of a.rechtsReihe) {
        const b = knopf(a.paare[r][1], 'af-paar');
        const l = Object.keys(verbunden).find((k) => +verbunden[k] === r);
        if (l !== undefined) b.style.setProperty('--paar', FARBEN[+l % FARBEN.length]), b.classList.add('verbunden');
        b.onclick = () => {
          if (links === null) return;
          for (const k of Object.keys(verbunden)) if (+verbunden[k] === r) delete verbunden[k];
          verbunden[links] = r;
          links = null;
          zeichne();
          if (Object.keys(verbunden).length === a.paare.length) setTimeout(() => melde({ ...verbunden }), 250);
        };
        R.append(b);
      }
      box.append(L, R);
    };
    zeichne();
    el.append(box);
  },
  pruefe(a, antwort) {
    const falsch = Object.entries(antwort).filter(([l, r]) => +l !== +r).map(([l]) => +l);
    return { richtig: falsch.length === 0 && Object.keys(antwort).length === a.paare.length, falsch };
  },
  loesung: (a) => Object.fromEntries(a.paare.map((_, i) => [i, i])),
  gleich,
};
