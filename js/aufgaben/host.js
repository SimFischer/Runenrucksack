// Aufgaben-Fenster: zeigt eine Aufgabe (klein direkt am Item oder groß in der Mitte), nimmt die Antwort an,
// zeigt nach jeder Antwort eine kurze Erklärung mit Merkhilfe. Falsch: neuer Versuch – ab dem zweiten
// kostet jeder 1 Gold (im Tutorial nicht). Ergebnis als Promise: { richtig, ersterVersuch, versuche, abgebrochen, trotzdem }.
import { FORMATE } from './formate/index.js';

const sterne = (s) => '★'.repeat(s) + '☆'.repeat(3 - s);

// opts: { anker, kopf, titel, stufe, zahle() → bool, gold() → Zahl, tutorial, nein (Text) , trotzdem (bool), onRegel(id) }
export function stelleAufgabe(a, opts = {}) {
  const format = FORMATE[a.format];
  return new Promise((fertig) => {
    let versuche = 0, vorher = null, pleite = false;
    const gross = format.gross(a);
    document.getElementById('aufgabe')?.remove();
    const ebene = document.createElement('div');
    ebene.id = 'aufgabe';
    ebene.className = gross ? 'af-gross' : 'af-klein';
    const karte = document.createElement('div');
    karte.className = 'af-fenster';
    karte.dataset.tut = 'fenster';
    ebene.append(karte);
    document.body.append(ebene);
    const ankerRect = opts.anker?.getBoundingClientRect?.() || null;

    const schliessen = (ergebnis) => { ebene.remove(); fertig(ergebnis); };

    const zeichne = () => {
      const extra = versuche > 0 && !opts.tutorial;
      const kosten = opts.tutorial ? (versuche ? 'Probier es noch einmal!' : '') : extra ? `Nächster Versuch: 1 🪙 (du hast ${opts.gold?.() ?? 0})` : 'Erster Versuch frei';
      karte.innerHTML = `
        <div class="af-kopf">${opts.kopf || ''}<span class="af-titel">${opts.titel || ''}${a.stufe ? ` <span class="af-stufe" title="Stufe ${a.stufe}">${sterne(a.stufe)}</span>` : ''}</span></div>
        <div class="af-frage">${a.frage}</div>
        <div class="af-inhalt"></div>
        ${vorher ? `<p class="af-rueck falsch">✗ ${a.merke}</p>` : ''}
        ${pleite ? '<p class="af-rueck falsch">Kein Gold mehr für einen weiteren Versuch.</p>' : ''}
        <div class="af-fuss"><span class="cost">${kosten}</span>
          ${pleite && opts.trotzdem ? '<button class="btn small primary" data-trotzdem>Trotzdem verbinden</button>' : ''}
          ${opts.nein ? `<button class="btn small quick-no" data-nein>${opts.nein}</button>` : ''}</div>`;
      if (!pleite) format.darstelle(karte.querySelector('.af-inhalt'), a, melde, vorher);
      karte.querySelector('[data-nein]')?.addEventListener('click', () => schliessen({ abgebrochen: true, versuche }));
      karte.querySelector('[data-trotzdem]')?.addEventListener('click', () => schliessen({ richtig: false, trotzdem: true, versuche }));
      platziere();
    };

    const platziere = () => {
      if (gross || !ankerRect) { karte.style.left = ''; karte.style.top = ''; karte.classList.remove('unten'); return; }
      const m = 8, cw = karte.offsetWidth, ch = karte.offsetHeight;
      let left = ankerRect.left + ankerRect.width / 2 - cw / 2, top = ankerRect.top - ch - 14, unten = false;
      if (top < m) { top = ankerRect.bottom + 14; unten = true; }
      left = Math.max(m, Math.min(innerWidth - cw - m, left));
      top = Math.max(m, Math.min(innerHeight - ch - m, top));
      karte.style.left = left + 'px';
      karte.style.top = top + 'px';
      karte.classList.toggle('unten', unten);
    };

    const melde = (antwort) => {
      if (versuche > 0 && !opts.tutorial && !opts.zahle?.()) { pleite = true; zeichne(); return; }
      versuche++;
      const r = format.pruefe(a, antwort);
      opts.onRegel?.(a.regel);
      if (r.richtig) { geschafft(); return; }
      vorher = { antwort, falsch: [...(vorher?.falsch || []), ...(r.falsch || [])] };
      if (a.format === 'sortieren' || a.format === 'paare') vorher.falsch = r.falsch || [];
      opts.onFalsch?.();
      zeichne();
    };

    const geschafft = () => {
      karte.innerHTML = `
        <div class="af-kopf">${opts.kopf || ''}<span class="af-titel">${opts.titel || ''}</span></div>
        <p class="af-rueck richtig">✓ ${versuche === 1 ? 'Richtig – gleich beim ersten Versuch!' : 'Richtig!'}</p>
        <p class="af-merke">💡 ${a.merke}</p>
        <div class="af-fuss"><button class="btn primary" data-weiter>Weiter</button></div>`;
      platziere();
      const zu = setTimeout(weiter, 4500);
      function weiter() { clearTimeout(zu); schliessen({ richtig: true, ersterVersuch: versuche === 1, versuche }); }
      karte.querySelector('[data-weiter]').onclick = weiter;
    };

    zeichne();
  });
}
