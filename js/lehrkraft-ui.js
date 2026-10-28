// „Für Lehrkräfte“ im Startmenü: geschützt mit dem Code aus lehrkraft.json. Themen an/aus und die höchste
// Stufe je Thema wählen; daraus entsteht ein Klassen-Code (THEMEN-…), den die Kinder bei „Heldencode eingeben“
// eintippen. Die Einstellung steht danach im Profil auf diesem Gerät (nicht im Heldencode).
import { G, saveProfil } from './state.js';
import { klassenCode, registryAus, saeubern } from './code.js';
import { STANDARD_MAX } from './aufgaben/wahl.js';
import { toast } from './ui.js';
import { sym } from './symbole.js';
import { zeigeSiegelPruefung } from './wochenrune-ui.js';

const reg = () => registryAus(G.REGISTRY);

function ebene(html) {
  document.getElementById('lk-layer')?.remove();
  const box = document.createElement('div');
  box.id = 'lk-layer';
  box.className = 'code-ebene';
  box.innerHTML = `<div class="code-card lk-card">${html}</div>`;
  document.body.append(box);
  return box;
}

export function zeigeLehrkraft() {
  const box = ebene(`
    <h2>${sym('eule')} Für Lehrkräfte</h2>
    <p>Bitte den Lehrkraft-Code eingeben.</p>
    <input class="code-input" type="text" autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false">
    <p class="code-meldung" hidden>Der Code stimmt nicht.</p>
    <div class="row"><button class="btn primary big" data-ok>Weiter</button><button class="btn" data-zurueck>Zurück</button></div>`);
  const input = box.querySelector('.code-input');
  const pruefe = () => {
    if (G.LEHRKRAFT?.code && saeubern(input.value) === saeubern(G.LEHRKRAFT.code)) einstellungen();
    else box.querySelector('.code-meldung').hidden = false;
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') pruefe(); });
  box.querySelector('[data-ok]').onclick = pruefe;
  box.querySelector('[data-zurueck]').onclick = () => box.remove();
  setTimeout(() => input.focus(), 50);
}

const standard = () => Object.fromEntries(G.THEMEN.themen.map((t) => [t.id, STANDARD_MAX]));
const STUFEN = [['Aus', 0], ['★', 1], ['★★', 2], ['★★★', 3]];

function einstellungen() {
  const themen = { ...standard(), ...(G.PROFIL.klasse?.themen || {}) };
  const box = ebene(`
    <h2>${sym('eule')} Themen für die Klasse</h2>
    <p class="lk-text">Schalten Sie Themen aus oder begrenzen Sie die höchste Stufe. Ohne Klassen-Code gelten alle Themen mit Stufe 1–2.</p>
    <div class="lk-liste"></div>
    <div class="lk-code"></div>
    <div class="row">
      <button class="btn primary" data-uebernehmen>Auf diesem iPad übernehmen</button>
      <button class="btn" data-standard>Standard</button>
      <button class="btn" data-ohne>Ohne Klasse</button>
      <button class="btn" data-woche>Rune der Woche prüfen</button>
      <button class="btn" data-zu>Schließen</button>
    </div>`);
  const liste = box.querySelector('.lk-liste');
  const zeichne = () => {
    liste.innerHTML = G.THEMEN.themen.map((t) => {
      const max = themen[t.id];
      return `<div class="lk-zeile${max ? '' : ' aus'}">
        <span class="lk-name"><span><b>${t.name}</b></span><small>${max ? `bis Stufe ${max}: ${t.stufen[max - 1].text}` : 'ausgeschaltet'}</small></span>
        <span class="lk-wahl">${STUFEN.map(([text, s]) => `<button class="btn small${s === max ? ' primary' : ''}" data-thema="${t.id}" data-stufe="${s}">${text}</button>`).join('')}</span>
      </div>`;
    }).join('');
    const code = klassenCode({ themen }, reg());
    const an = Object.values(themen).filter(Boolean).length;
    box.querySelector('.lk-code').innerHTML = `<p>Klassen-Code (${an} von ${G.THEMEN.themen.length} Themen an):</p>
      <div class="code-text lk-code-text">${code.split('-').map((g) => `<span>${g}</span>`).join('')}</div>
      <p class="muted">Die Kinder tippen ihn im Startmenü bei „Heldencode“ ein. Er wird auf ihrem iPad gespeichert.</p>`;
    liste.querySelectorAll('[data-thema]').forEach((b) => {
      b.onclick = () => { themen[b.dataset.thema] = +b.dataset.stufe; zeichne(); };
    });
  };
  zeichne();
  box.querySelector('[data-standard]').onclick = () => { Object.assign(themen, standard()); zeichne(); };
  box.querySelector('[data-woche]').onclick = () => zeigeSiegelPruefung(einstellungen);
  box.querySelector('[data-uebernehmen]').onclick = () => {
    G.PROFIL.klasse = { themen: { ...themen } };
    saveProfil();
    toast('Die Themen gelten jetzt auf diesem iPad.');
    box.remove();
  };
  box.querySelector('[data-ohne]').onclick = () => {
    G.PROFIL.klasse = null;
    saveProfil();
    toast('Ohne Klasse: alle Themen, Stufe 1–2.');
    box.remove();
  };
  box.querySelector('[data-zu]').onclick = () => box.remove();
}
