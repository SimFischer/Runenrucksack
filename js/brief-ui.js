// Botschaften lesen: Ein Brief mit Siegel kommt am Morgen; beim Antippen öffnet er sich auf einer Pergamenttafel.
// Der Text bleibt sichtbar, daneben kommen nacheinander 1–2 Fragen. Richtig: passende Belohnung. Falsch: kleiner
// Trost, und die Stelle im Text wird markiert („Hier steht es: …“).
import { G, save, region, emit, saveProfil } from './state.js';
import { placeNew } from './sterne.js';
import { merkeAntwort } from './fortschritt.js';
import { aufgabenStand, lernstandVon, maxStufe } from './aufgaben/wahl.js';
import { einstellungen } from './aufgaben/spiel.js';
import { waehleBriefMerk, werteAus, verbucheBrief, THEMA_LESEN } from './botschaften.js';
import { toast, bump, fullName } from './ui.js';
import { sym } from './symbole.js';

const BRIEF_BILD = 'assets/ui/satzschmiede/brief.webp';
const mische = (liste, rng = Math.random) => liste.map((x) => [rng(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// Brief für heute (bleibt beim Neuladen derselbe)
function briefHeute(rng) {
  const run = G.run;
  if (run.brief?.tag === run.day) return G.BOTSCHAFTEN.find((b) => b.id === run.brief.id) || null;
  const stufe = Math.max(1, Math.min(lernstandVon(G.PROFIL, THEMA_LESEN).stufe, maxStufe(einstellungen(), THEMA_LESEN)));
  const w = waehleBriefMerk(G.BOTSCHAFTEN, { gebiet: region().id, stufe, merkliste: G.PROFIL.briefeGelesen || [], gelesen: run.gelesen || [], rng });
  const b = w.brief;
  if (b) { run.brief = { tag: run.day, id: b.id }; G.PROFIL.briefeGelesen = w.merkliste; saveProfil(); save(); }
  return b;
}

// Belohnung geben: Gegenstand in Rucksack oder Lager (kein Platz: stattdessen 2 Gold), oder Gold
function gib(b) {
  const run = G.run;
  if (b.typ === 'gold') { run.gold += b.menge; bump('stat-gold'); return `${b.menge} ${sym('gold', 'klein')}`; }
  const d = G.DEFS[b.id];
  const p = placeNew(run, G.DEFS, b.id);
  if (p) { emit('neuesItem', { uid: p.uid }); return fullName(d); }
  run.gold += 2;
  bump('stat-gold');
  return `2 ${sym('gold', 'klein')} (kein Platz für ${fullName(d)})`;
}

// rng: Zufall für die Briefwahl (Rune der Woche: fester Zufall)
export function zeigeBrief(fertig, rng = Math.random) {
  const brief = briefHeute(rng);
  if (!brief) { fertig(); return; }
  emit('tipp', { key: 'brief' });
  const box = document.createElement('div');
  box.id = 'brief-layer';
  box.innerHTML = `
    <div class="brief-zu tafel" data-tut="brief">
      <p class="enc-top">${sym('tag')} Morgen in ${region().name}</p>
      <h2>Ein Brief für dich!</h2>
      <button class="brief-umschlag" data-oeffnen aria-label="Brief öffnen"><img src="${BRIEF_BILD}" alt=""></button>
      <p class="brief-von">von ${esc(brief.absender)}</p>
      <button class="btn primary big" data-oeffnen>Brief öffnen</button>
    </div>`;
  document.body.append(box);
  box.querySelectorAll('[data-oeffnen]').forEach((b) => { b.onclick = () => lesen(box, brief, fertig, rng); });
}

function lesen(box, brief, fertig, rng) {
  const fragen = brief.fragen.map((f) => ({ ...f, reihe: mische(f.antworten, rng) }));
  const antworten = [];
  let k = 0, markiert = [];
  const textHtml = () => {
    let t = esc(brief.text);
    for (const s of markiert) t = t.replace(esc(s), `<mark>${esc(s)}</mark>`);
    return t;
  };
  const zeichne = (rueck = '') => {
    const f = fragen[k];
    box.innerHTML = `
      <div class="brief-offen">
        <article class="brief-text pergament" data-tut="brief-text"><p class="brief-von">Von ${esc(brief.absender)}</p><p>${textHtml()}</p></article>
        <section class="brief-fragen tafel" data-tut="fenster">
          <p class="brief-zahl">Frage ${k + 1} von ${fragen.length}</p>
          ${f ? `<h3 class="brief-frage">${esc(f.frage)}</h3>
          <div class="brief-antworten">${f.reihe.map((a, i) => `<button class="btn opt-btn${rueck && a === f.richtig ? ' right' : ''}" data-a="${i}" ${rueck ? 'disabled' : ''}>${esc(a)}</button>`).join('')}</div>` : ''}
          ${rueck}
        </section>
      </div>`;
    box.querySelectorAll('[data-a]').forEach((b) => { b.onclick = () => antworte(f.reihe[+b.dataset.a]); });
    box.querySelector('[data-weiter]')?.addEventListener('click', weiter);
  };
  const antworte = (a) => {
    const f = fragen[k];
    antworten.push(a);
    const ok = a === f.richtig;
    merkeAntwort(G.run, THEMA_LESEN, ok, true);
    const e = (aufgabenStand(G.run).ergebnis[THEMA_LESEN] ||= [0, 0]);
    e[ok ? 0 : 1]++;
    if (!ok) markiert.push(f.textstelle);
    const lohn = f.belohnung.typ === 'item' ? fullName(G.DEFS[f.belohnung.id]) : `${f.belohnung.menge} Gold`;
    zeichne(ok
      ? `<p class="af-rueck richtig">✓ Richtig! Dafür bekommst du: ${lohn}.</p><div class="row"><button class="btn primary" data-weiter>Weiter</button></div>`
      : `<p class="af-rueck falsch">Leider nicht. Hier steht es: „${esc(f.textstelle)}“ – richtig ist: ${esc(f.richtig.replace(/[.!?]$/, ''))}.</p><div class="row"><button class="btn primary" data-weiter>Weiter</button></div>`);
  };
  const weiter = () => {
    k++;
    if (k < fragen.length) { zeichne(); return; }
    abschluss();
  };
  const abschluss = () => {
    const run = G.run;
    const r = werteAus(brief, antworten);
    const erhalten = r.belohnungen.map(gib);
    run.gelesen = [...(run.gelesen || []), brief.id];
    const v = verbucheBrief(G.PROFIL, r.alleRichtig);
    saveProfil();
    save();
    if (v.aufgestiegen) toast(`Leseverständnis: Du liest schon sicher – jetzt kommen Briefe der Stufe ${'★'.repeat(v.stufe)}!`);
    box.remove();
    toast(`Aus dem Brief: ${erhalten.join(', ')}`);
    emit('briefFertig', { id: brief.id, alleRichtig: r.alleRichtig });
    fertig();
  };
  zeichne();
}
