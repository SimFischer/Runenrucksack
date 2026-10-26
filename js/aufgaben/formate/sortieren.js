// Sortieren: 4–6 Wörter in 2–3 Kisten ziehen (der/die/das, Nomen/Verb/Adjektiv, d/t …).
// Ziehen mit dem Finger oder: Karte antippen, dann Kiste antippen. Ist alles einsortiert, wird geprüft.
import { ziehbar, GENUS_FARBE } from './basis.js';

export default {
  id: 'sortieren',
  gross: () => true,
  erzeuge: (inhalt) => ({ ...inhalt, karten: inhalt.karten.map((k, i) => ({ ...k, nr: i })) }),
  darstelle(el, a, melde, vorher) {
    // Richtig einsortierte Karten bleiben nach einem Fehlversuch liegen.
    const lage = {};
    if (vorher?.antwort) for (const k of a.karten) if (!vorher.falsch.includes(k.nr)) lage[k.nr] = vorher.antwort[k.nr];
    let gewaehlt = null;
    const ablage = document.createElement('div');
    ablage.className = 'af-ablage';
    const kistenEl = document.createElement('div');
    kistenEl.className = 'af-kisten';
    const kisten = a.kisten.map((k) => {
      const box = document.createElement('div');
      box.className = 'af-kiste';
      box.dataset.kiste = k.id;
      if (k.genus) box.style.setProperty('--genus', GENUS_FARBE[k.genus]);
      box.innerHTML = `<div class="af-kiste-name${k.genus ? ' genus' : ''}">${k.name}</div><div class="af-kiste-inhalt"></div>`;
      box.onclick = () => { if (gewaehlt !== null) lege(gewaehlt, k.id); };
      kistenEl.append(box);
      return box;
    });
    const lege = (nr, kiste) => {
      if (kiste) lage[nr] = kiste; else delete lage[nr];
      gewaehlt = null;
      zeichne();
      if (Object.keys(lage).length === a.karten.length) setTimeout(() => melde({ ...lage }), 250);
    };
    const zeichne = () => {
      ablage.innerHTML = '';
      for (const box of kisten) box.querySelector('.af-kiste-inhalt').innerHTML = '';
      for (const k of a.karten) {
        const karte = document.createElement('div');
        karte.className = 'af-karte' + (gewaehlt === k.nr ? ' gewaehlt' : '');
        karte.innerHTML = k.text;
        const ort = lage[k.nr] ? kisten.find((b) => b.dataset.kiste === lage[k.nr]).querySelector('.af-kiste-inhalt') : ablage;
        ort.append(karte);
        ziehbar(karte, {
          ziele: () => kisten,
          onDrop: (ziel) => lege(k.nr, ziel ? ziel.dataset.kiste : null),
          onTap: () => { gewaehlt = gewaehlt === k.nr ? null : k.nr; zeichne(); },
        });
      }
      if (!ablage.children.length) ablage.innerHTML = '<span class="muted">Alles einsortiert!</span>';
    };
    zeichne();
    el.append(ablage, kistenEl);
  },
  pruefe(a, antwort) {
    const falsch = a.karten.filter((k) => antwort[k.nr] !== k.kiste).map((k) => k.nr);
    return { richtig: falsch.length === 0, falsch };
  },
  loesung: (a) => Object.fromEntries(a.karten.map((k) => [k.nr, k.kiste])),
};
