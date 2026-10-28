// Rune der Woche: Knopf auf dem Startbildschirm (mit bestem Versuch der Woche), Vorstellung des Wochenlaufs,
// Ergebnis mit Punkten und Ergebnis-Siegel, Prüfung der Siegel für die Lehrkraft (mit einfacher Beamer-Liste).
// Der beste Versuch liegt nur auf diesem Gerät; Namen werden nirgends gespeichert.
import { G } from './state.js';
import { seededRng } from './logic.js';
import { isoWoche, wochenSeed, punkteVon, ergebnisSiegel, leseSiegel, PUNKTE } from './wochenrune.js';
import { fullName } from './ui.js';
import { sym } from './symbole.js';

const BILD = 'assets/ui/satzschmiede/wochenrune.webp';
const KEY = 'runenrucksack.wochenrune';
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Bester Versuch dieser Woche (oder null)
export function besterVersuch() {
  const w = isoWoche();
  try {
    const b = JSON.parse(localStorage.getItem(KEY));
    return b && b.jahr === w.jahr && b.woche === w.woche ? b : null;
  } catch { return null; }
}
function merkeVersuch(eintrag) {
  const alt = besterVersuch();
  if (alt && alt.punkte >= eintrag.punkte) return false;
  try { localStorage.setItem(KEY, JSON.stringify(eintrag)); } catch { /* privater Modus */ }
  return true;
}

// Inhalt des Knopfs auf dem Startbildschirm
export function wochenKnopfHtml() {
  const w = isoWoche(), b = besterVersuch();
  return `<img src="${BILD}" alt=""><span><b>Rune der Woche</b><small>KW ${w.woche} · ${b ? `dein Bestwert: ${b.punkte} Punkte` : 'noch nicht gespielt'}</small></span>`;
}

// Figur und Begleiter dieser Woche – fest aus dem Startwert (gesperrte sind hier ausnahmsweise spielbar)
export function wochenLauf(klasse = G.PROFIL?.klasse) {
  const w = isoWoche();
  const seed = wochenSeed(w, klasse);
  const r = seededRng(seed);
  const held = G.HEROES[Math.floor(r() * G.HEROES.length)];
  const begleiter = G.BEGLEITER[Math.floor(r() * G.BEGLEITER.length)];
  return { ...w, seed, held, begleiter };
}

export function zeigeWochenStart(los) {
  const l = wochenLauf();
  document.getElementById('woche-layer')?.remove();
  const box = document.createElement('div');
  box.id = 'woche-layer';
  box.className = 'code-ebene';
  box.innerHTML = `<div class="code-card woche-card">
    <img class="woche-rune" src="${BILD}" alt="">
    <h2>Rune der Woche · KW ${l.woche}</h2>
    <p>Diese Woche spielen alle denselben Lauf: dieselbe Figur, derselbe Begleiter, dieselben Läden, Gegner, Begegnungen und Briefe.
      Wer schafft die meisten Punkte?</p>
    <div class="woche-team">
      <span><img src="${G.BILDER.figuren?.[l.held.id] ? 'assets/' + G.BILDER.figuren[l.held.id] : ''}" alt=""><b>${esc(l.held.name)}</b></span>
      <span><img src="assets/ui/begleiter/${l.begleiter.id}.webp" alt=""><b>${esc(fullName(l.begleiter))}</b></span>
    </div>
    <p class="muted">Punkte: Sieg ${PUNKTE.sieg}, übriges Herz ${PUNKTE.herz}, erreichter Tag ${PUNKTE.tag}, Aufgabe gleich richtig ${PUNKTE.ersterVersuch}.
      Gesperrte Figuren und Begleiter darfst du hier ausprobieren.</p>
    <div class="row"><button class="btn primary big" data-los>Los geht's</button><button class="btn" data-zu>Zurück</button></div>
  </div>`;
  document.body.append(box);
  box.querySelector('[data-zu]').onclick = () => box.remove();
  box.querySelector('[data-los]').onclick = () => { box.remove(); los(l); };
}

// Ergebnis am Ende eines Wochenlaufs: große Punktzahl und das Ergebnis-Siegel zum Vorzeigen
export function zeigeWochenErgebnis(run, weiter) {
  const punkte = punkteVon(run);
  const siegel = ergebnisSiegel(run.woche.woche, punkte);
  const neu = merkeVersuch({ jahr: run.woche.jahr, woche: run.woche.woche, punkte, siegel });
  const erster = run.prog?.erster || 0;
  const box = document.createElement('div');
  box.id = 'woche-layer';
  box.className = 'code-ebene';
  box.innerHTML = `<div class="code-card woche-card ergebnis">
    <img class="woche-rune" src="${BILD}" alt="">
    <h2>Rune der Woche · KW ${run.woche.woche}</h2>
    <div class="woche-punkte" data-tut="woche-punkte">${punkte}<small>Punkte</small></div>
    ${neu ? '<p class="woche-neu">Neuer Bestwert für diese Woche!</p>' : `<p class="muted">Dein Bestwert diese Woche: ${besterVersuch()?.punkte ?? punkte} Punkte</p>`}
    <ul class="woche-rechnung">
      <li>${sym('pokal')} ${run.wins} Siege × ${PUNKTE.sieg}</li>
      <li>${sym('herz')} ${Math.max(0, run.hearts)} Herzen × ${PUNKTE.herz}</li>
      <li>${sym('tag')} Tag ${run.day} × ${PUNKTE.tag}</li>
      <li>${sym('stern')} ${erster} Aufgaben gleich richtig × ${PUNKTE.ersterVersuch}</li>
    </ul>
    <p>Dein Ergebnis-Siegel – zeig es deiner Lehrkraft:</p>
    <div class="code-kasten"><div class="code-text woche-siegel" data-code>${siegel}</div></div>
    <div class="row"><button class="btn primary big" data-weiter>Weiter</button></div>
  </div>`;
  document.body.append(box);
  box.querySelector('[data-weiter]').onclick = () => { box.remove(); weiter(); };
}

// ---------- Für Lehrkräfte: Siegel prüfen, Liste für den Beamer (nur im Browser, ohne Namen) ----------
export function zeigeSiegelPruefung(zurueck) {
  document.getElementById('lk-layer')?.remove();
  const box = document.createElement('div');
  box.id = 'lk-layer';
  box.className = 'code-ebene';
  box.innerHTML = `<div class="code-card lk-card woche-lk">
    <h2><img class="sym" src="${BILD}" alt=""> Rune der Woche prüfen</h2>
    <p class="lk-text">Ergebnis-Siegel eingeben: Sie sehen Woche und Punktzahl. Die Liste bleibt nur in diesem Fenster – nichts wird gespeichert, Namen braucht es keine (Kürzel genügen).</p>
    <div class="woche-liste"></div>
    <div class="row"><button class="btn" data-zeile>Zeile hinzufügen</button><button class="btn primary" data-zu>Schließen</button></div>
  </div>`;
  document.body.append(box);
  const liste = box.querySelector('.woche-liste');
  const zeilen = [{ kuerzel: '', siegel: '' }, { kuerzel: '', siegel: '' }, { kuerzel: '', siegel: '' }];
  const ergebnis = (z) => (z.siegel ? leseSiegel(z.siegel) : null);
  const zeichne = () => {
    const sortiert = zeilen.map((z, i) => ({ z, i, e: ergebnis(z) }))
      .sort((a, b) => (b.e?.gueltig ? b.e.punkte : -1) - (a.e?.gueltig ? a.e.punkte : -1));
    liste.innerHTML = `<div class="woche-zeile kopf"><span>Kürzel</span><span>Siegel</span><span>Ergebnis</span></div>` + sortiert.map(({ z, i, e }) => `
      <div class="woche-zeile">
        <input class="woche-kuerzel" data-i="${i}" data-feld="kuerzel" value="${esc(z.kuerzel)}" maxlength="6" autocomplete="off" placeholder="z. B. AB">
        <input class="woche-siegel-ein" data-i="${i}" data-feld="siegel" value="${esc(z.siegel)}" maxlength="6" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="K7QM">
        <span class="woche-ergebnis${e && !e.gueltig ? ' ungueltig' : ''}">${!e ? '' : e.gueltig ? `<b>${e.punkte} Punkte</b> · KW ${e.woche} · gültig` : esc(e.grund)}</span>
      </div>`).join('');
    liste.querySelectorAll('input').forEach((inp) => {
      inp.onchange = () => { zeilen[+inp.dataset.i][inp.dataset.feld] = inp.dataset.feld === 'siegel' ? inp.value.toUpperCase() : inp.value; zeichne(); };
    });
  };
  zeichne();
  box.querySelector('[data-zeile]').onclick = () => { zeilen.push({ kuerzel: '', siegel: '' }); zeichne(); };
  box.querySelector('[data-zu]').onclick = () => { box.remove(); zurueck?.(); };
}
