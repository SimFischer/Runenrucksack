// Heldencode: anzeigen (groß, zum Abschreiben ins Heft), eingeben, neu beginnen. Klassen-Code der Lehrkraft eingeben.
// Der Heldencode hat 6 Zeichen (K7Q-M2X) und enthält nur Erfahrung und Tutorial. Alles andere – Buch der Wörter,
// Erfolge, Regelkarten, Statistik, Lernstand, Klassen-Einstellungen und ein unterbrochener Lauf – bleibt auf dem Gerät.
import { G, saveProfil, setPref, save, emit } from './state.js';
import { heldencode, leseCode, fehlerText, registryAus, istKlassenCode, leseKlassenCode } from './code.js';
import { neuesProfil, rangVon } from './fortschritt.js';
import { toast } from './ui.js';
import { sym } from './symbole.js';

let REG = null;
const reg = () => (REG ||= registryAus(G.REGISTRY));
const codeDaten = () => ({ defs: G.DEFS, heroes: G.HEROES, fates: G.FATES, encounters: G.ENCOUNTERS, exercises: G.EXERCISES });

export const aktuellerHeldencode = () => heldencode(G.PROFIL);

// Code-Kasten zum Einbetten (Ende des Laufs, Menü): groß, gut abzuschreiben
export function codeKasten(code, klein = false) {
  const [a, b] = code.split('-');
  return `<div class="code-kasten${klein ? ' klein' : ''}">
    <div class="code-text" data-code aria-label="Heldencode ${code}"><span>${a}</span><span class="code-strich">-</span><span>${b}</span></div>
    <p class="code-heft">${sym('buch')} Schreib ihn in dein Heft.</p>
    <button class="btn small" data-kopieren>Kopieren</button>
  </div>`;
}

export function kopierenAn(box, code) {
  box.querySelectorAll('[data-kopieren]').forEach((b) => {
    b.onclick = async () => {
      try { await navigator.clipboard.writeText(code); toast('Code kopiert!'); } catch {
        const r = document.createRange();
        r.selectNodeContents(box.querySelector('[data-code]'));
        getSelection().removeAllRanges();
        getSelection().addRange(r);
        toast('Markiert – jetzt kopieren.');
      }
    };
  });
}

function ebene(id, html) {
  document.getElementById(id)?.remove();
  const box = document.createElement('div');
  box.id = id;
  box.className = 'code-ebene';
  box.innerHTML = `<div class="code-card" data-tut="code-fenster">${html}</div>`;
  document.body.append(box);
  return box;
}

// Heldencode groß anzeigen.
export function zeigeCode({ zurueck = null } = {}) {
  const code = aktuellerHeldencode();
  const box = ebene('code-layer', `
    <h2>Dein Heldencode</h2>
    <p>Mit diesem Code holst du deinen Rang, deine Figuren und deine Rucksack-Designs zurück – auch auf einem anderen iPad.</p>
    ${codeKasten(code)}
    <p class="muted">Buch der Wörter, Erfolge und Statistik bleiben auf diesem iPad.</p>
    <div class="row"><button class="btn primary big" data-ok>Fertig</button></div>`);
  kopierenAn(box, code);
  box.querySelector('[data-ok]').onclick = () => { box.remove(); emit('codeZu'); zurueck?.(true); };
  emit('codeZeigen');
}

// Startmenü: Code eingeben (Bindestrich optional, Großbuchstaben automatisch). Erkennt Helden- und Klassen-Code,
// auch alte, lange Heldencodes.
export function zeigeEingabe({ geladen, zurueck = null }) {
  const box = ebene('code-layer', `
    <h2>${sym('schloss')} Heldencode eingeben</h2>
    <p>Tippe deinen Heldencode aus dem Heft ein – oder den Klassen-Code von deiner Lehrkraft. Den Bindestrich kannst du weglassen.</p>
    <input class="code-input" type="text" inputmode="text" autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false" placeholder="K7Q-M2X" aria-label="Heldencode">
    <p class="code-meldung" hidden></p>
    <div class="row">
      <button class="btn primary big" data-lesen>Einlesen</button>
      <button class="btn" data-zurueck>Zurück</button>
    </div>`);
  const input = box.querySelector('.code-input');
  const meldung = box.querySelector('.code-meldung');
  const schliessen = () => box.remove();
  input.addEventListener('input', () => {
    const pos = input.selectionStart;
    input.value = input.value.toUpperCase();
    input.setSelectionRange(pos, pos);
    meldung.hidden = true;
  });
  const lesen = () => {
    try {
      if (istKlassenCode(input.value)) {
        const einst = leseKlassenCode(input.value, reg());
        klasseBestaetigen(einst, () => schliessen());
        return;
      }
      const r = leseCode(input.value, reg(), codeDaten());
      bestaetigen(r, () => { schliessen(); geladen(r); });
    } catch (e) {
      meldung.textContent = fehlerText(e);
      meldung.hidden = false;
    }
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') lesen(); });
  box.querySelector('[data-lesen]').onclick = lesen;
  box.querySelector('[data-zurueck]').onclick = () => { schliessen(); zurueck?.(); };
  setTimeout(() => input.focus(), 50);
}

// Klassen-Code: zeigen, welche Themen drin sind, dann auf diesem Gerät speichern (nicht im Heldencode).
function klasseBestaetigen(einst, ok) {
  const an = G.THEMEN.themen.filter((t) => einst.themen[t.id] > 0);
  const box = ebene('code-frage', `
    <h2>${sym('eule')} Klassen-Code erkannt</h2>
    <p>Deine Lehrkraft hat diese Themen ausgewählt:</p>
    <p class="code-info lk-themen">${an.map((t) => `<span>${t.name} <b>${'★'.repeat(einst.themen[t.id])}</b></span>`).join('')}</p>
    <div class="row"><button class="btn primary big" data-ja>Übernehmen</button><button class="btn" data-nein>Abbrechen</button></div>`);
  box.querySelector('[data-ja]').onclick = () => {
    G.PROFIL.klasse = einst;
    saveProfil();
    box.remove();
    toast('Klassen-Code gespeichert – er gilt jetzt auf diesem iPad.');
    ok();
  };
  box.querySelector('[data-nein]').onclick = () => box.remove();
}

// Vor dem Laden zeigen, was im Code steckt.
function bestaetigen(r, ok) {
  const rang = rangVon(r.xp, G.ACH.raenge);
  const box = ebene('code-frage', `
    <h2>Heldencode erkannt</h2>
    <p class="code-info">${sym('stern')} <b>${rang.name}</b> · ${r.xp} Erfahrung${r.tutorial ? ' · Tutorial geschafft' : ''}</p>
    ${r.alt ? '<p>Das ist ein alter, langer Code. Deine Erfahrung wird übernommen – ab jetzt reicht der kurze Code mit 6 Zeichen.</p>' : ''}
    <p>Rang, Figuren und Rucksack-Designs kommen aus dem Code. Buch der Wörter, Erfolge und Statistik sammelst du auf diesem iPad neu.</p>
    <div class="row"><button class="btn primary big" data-ja>Laden</button><button class="btn" data-nein>Abbrechen</button></div>`);
  box.querySelector('[data-ja]').onclick = () => { box.remove(); ok(); };
  box.querySelector('[data-nein]').onclick = () => box.remove();
}

// Übernimmt einen eingelesenen Heldencode: Erfahrung und Tutorial; Figuren und Designs folgen aus dem Rang
// (pruefeFreischaltungen). Hat dieses iPad genau denselben Stand, bleiben Buch, Erfolge und Statistik erhalten –
// sonst beginnt der Fortschritt, der nur auf dem Gerät liegt, neu. Klassen-Einstellungen bleiben immer.
export function uebernehmen(r) {
  const alt = G.PROFIL;
  const p = alt && alt.xp === r.xp ? alt : { ...neuesProfil(), klasse: alt?.klasse || null };
  p.xp = r.xp;
  p.tutorial = p.tutorial || r.tutorial;
  G.PROFIL = p;
  saveProfil();
  if (p.tutorial) setPref('tutorial', 'fertig');
}

// „Neu beginnen“: Fortschritt auf diesem iPad löschen (mit Sicherheitsabfrage).
export function neuBeginnen(fertig) {
  const box = ebene('code-frage', `
    <h2>Wirklich ganz neu beginnen?</h2>
    <p>Rang, Erfahrung, Buch der Wörter, Figuren und Erfolge auf diesem iPad werden gelöscht. Mit deinem Heldencode holst du Rang, Figuren und Designs später zurück.</p>
    <div class="row"><button class="btn" data-nein>Lieber nicht</button><button class="btn danger" data-ja>Ja, neu beginnen</button></div>`);
  box.querySelector('[data-nein]').onclick = () => box.remove();
  box.querySelector('[data-ja]').onclick = () => {
    box.remove();
    G.PROFIL = neuesProfil();
    setPref('tutorial', '');
    saveProfil();
    G.run = null;
    save();
    toast('Alles zurückgesetzt – viel Spaß beim neuen Abenteuer!');
    fertig?.();
  };
}
