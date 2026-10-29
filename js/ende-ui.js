// Ende eines Laufs: Ergebnis, Lernbericht (nur für das Kind), Erfahrung und Rang (mit Feier beim Aufstieg).
import { CFG } from './logic.js';
import { G, region } from './state.js';
import { laufStand, lernbericht } from './fortschritt.js';
import { modal, iconHtml } from './ui.js';
import { figurBild } from './state.js';
import { codeKasten, kopierenAn, aktuellerHeldencode } from './code-ui.js';
import { themenBericht } from './aufgaben/wahl.js';
import { sym, bild } from './symbole.js';

const rangBalken = (r) => {
  const von = r.stufeAb ?? r.ab;
  const pct = r.naechster ? Math.round(((G.PROFIL.xp - von) / (r.naechster.ab - von)) * 100) : 100;
  return `<div class="rang-zeile"><span class="rang-emoji">${sym('stern')}</span><span><b>${r.name}</b>
    <span class="rang-bar"><i style="width:${pct}%"></i></span>
    <small>${r.naechster ? `noch ${r.bisNaechster} Erfahrung bis ${r.naechster.name}` : 'Höchster Rang erreicht!'}</small></span></div>`;
};

// abschluss: Ergebnis von laufAbschluss(). aktionen: { neu, home }
export function zeigeLaufende(run, abschluss, aktionen) {
  const won = run.over === 'won';
  const stars = sym('stern').repeat(run.wins >= 8 ? 3 : run.wins >= 6 ? 2 : 1);
  const a = abschluss;
  const p = laufStand(run);
  const kopf = won ? `
      <div class="ende-banner"><img src="${bild('banner', 'sieg')}" alt=""><span>Reise geschafft!</span></div>
      <p>Du hast Kleinwurzel und Hrossmark durchquert: <b>${run.wins} von ${CFG.lastDay}</b> Kämpfen gewonnen. <span class="stars-inline">${stars}</span></p>` : `
      <div class="ende-banner niederlage"><img src="${bild('banner', 'niederlage')}" alt=""><span>Lauf zu Ende</span></div>
      <p>Alle Herzen sind weg – an Tag ${run.day} in ${region().name}. Du hast <b>${run.wins}</b> Kämpfe gewonnen.</p>`;
  const xp = a ? `
      <div class="xp-box">
        <div class="xp-zeile"><span>${sym('kampf')} ${run.wins} ${run.wins === 1 ? 'Sieg' : 'Siege'}</span><b>+${a.xp.siege}</b></div>
        <div class="xp-zeile"><span>${sym('buch')} ${a.neu.length} ${a.neu.length === 1 ? 'neuer Eintrag' : 'neue Einträge'} im Buch</span><b>+${a.xp.entdeckungen}</b></div>
        <div class="xp-zeile"><span>${sym('stern')} ${p.erster} ${p.erster === 1 ? 'Frage' : 'Fragen'} gleich beim ersten Versuch richtig</span><b>+${a.xp.ersterVersuch}</b></div>
        <div class="xp-zeile xp-summe"><span>Erfahrung</span><b>+${a.xp.gesamt}</b></div>
        ${rangBalken(a.nachher)}
      </div>` : '';
  const frei = a?.frei ? [
    ...a.frei.figuren.map((id) => { const h = G.HEROES.find((x) => x.id === id); return `<div class="frei-neu">${figurBild(id) ? `<img src="${figurBild(id)}" alt="">` : ''}<span><small>Neue Figur frei!</small><b>${h.name}</b></span></div>`; }),
    ...(a.erfolge || []).map((id) => { const e = G.ACH.erfolge.find((x) => x.id === id); return `<div class="frei-neu"><span class="frei-emoji">${sym('pokal')}</span><span><small>Neuer Erfolg!</small><b>${e.name}</b></span></div>`; }),
    ...a.frei.designs.map((id) => { const d = G.ACH.designs.find((x) => x.id === id); return `<div class="frei-neu"><span class="frei-emoji">${sym('truhe')}</span><span><small>Neues Rucksack-Design!</small><b>${d.name}</b></span></div>`; }),
    ...(a.frei.begleiter || []).map((id) => { const b = G.BEGLEITER.find((x) => x.id === id); return `<div class="frei-neu"><img src="assets/ui/begleiter/${id}.webp" alt=""><span><small>Neuer Begleiter!</small><b>${b.name}</b></span></div>`; }),
    ...paketeVon(a.frei.items || []).map(({ paket, ids }) => `<div class="frei-neu"><span><small>Neu im Laden!</small><b>${paket ? paket.name : G.DEFS[ids[0]].name}</b></span></div>`),
  ].join('') : '';
  document.getElementById('tip-bubble')?.remove(); // offene Erste-Mal-Tipps gehören zum Lauf
  const code = a ? aktuellerHeldencode() : null;
  const card = modal(`${kopf}
      <div class="ende-spalten">
        <div>${berichtHtml(run, a)}</div>
        <div>${xp}${frei ? `<div class="frei-liste">${frei}</div>` : ''}
          ${code ? `<div class="ende-code"><b>${sym('schloss')} Dein Heldencode</b><small>Damit holst du deinen Rang, deine Figuren und Designs zurück.</small>${codeKasten(code, true)}</div>` : ''}</div>
      </div>
      <div class="row"><button class="btn primary big" data-act="neu">Neuer Lauf</button><button class="btn" data-act="home">Zum Start</button></div>`,
  { neu: aktionen.neu, home: aktionen.home }, 'wide ende');
  if (code) kopierenAn(card, code);
  // Feiern nacheinander: neuer Rang, dann jede Freischaltung einzeln
  const feiern = [...(a?.aufgestiegen ? [() => rangFeier(a.nachher, weiterFeiern)] : []), ...freischaltFeiern(a?.frei)];
  const weiterFeiern = () => feiern.shift()?.();
  if (feiern.length) setTimeout(weiterFeiern, 700);
}

// Lernbericht: Siege, neue Entdeckungen, „Das sitzt schon“ und „Das üben wir noch“ – freundlich, ohne Noten.
function berichtHtml(run, a) {
  const themen = themenBericht(run, G.PROFIL, G.THEMEN);
  const b = themen.length ? { sitzt: [], ueben: [] } : lernbericht(run); // ohne neue Aufgaben (Tutorial): Regeln wie bisher
  const neu = (a?.neu || []).map((id) => G.BUCH.byId.get(id)).filter(Boolean);
  const zeige = neu.slice(0, 6);
  return `<div class="bericht">
    <h3>${sym('buch')} Dein Lernbericht</h3>
    <p class="bericht-zeile">${sym('kampf')} Du hast <b>${run.wins}</b> ${run.wins === 1 ? 'Kampf' : 'Kämpfe'} gewonnen.</p>
    ${neu.length ? `<p class="bericht-zeile">${sym('buch')} Neu im Buch der Wörter: <b>${neu.length}</b></p>
      <div class="bericht-neu">${zeige.map((e) => `<span title="${e.name}">${iconHtml(e.def, 'bericht-img')}<small>${e.seite === 'stufen' ? '★'.repeat(e.stern) + ' ' : ''}${e.name}</small></span>`).join('')}${neu.length > zeige.length ? `<span class="bericht-mehr">+${neu.length - zeige.length}</span>` : ''}</div>` : ''}
    ${b.sitzt.length ? `<h4>Das sitzt schon</h4><ul class="bericht-liste gut">${b.sitzt.map((r) => `<li>✓ ${r.name}</li>`).join('')}</ul>` : ''}
    ${b.ueben.length ? `<h4>Das üben wir noch</h4><ul class="bericht-liste ueben">${b.ueben.map((r) => `<li><b>${r.name}</b><small>${r.tipp}</small></li>`).join('')}</ul>` : ''}
    ${themen.length ? `<h4>${sym('stern')} Deine Themen</h4><ul class="bericht-liste themen">${themen.map((t) => `<li class="${t.fehler ? 'ueben' : 'gut'}"><span><b>${t.name}</b></span><span class="bericht-sterne" title="Stufe ${t.stufe} von 3">${'★'.repeat(t.stufe)}<i>${'☆'.repeat(3 - t.stufe)}</i></span>${t.fehler ? `<small>${t.tipp}</small>` : ''}</li>`).join('')}</ul>` : ''}
    ${!themen.length && !b.sitzt.length && !b.ueben.length ? '<p class="muted">In diesem Lauf gab es keine Grammatik-Fragen.</p>' : ''}
    ${(themen.length ? themen.every((t) => !t.fehler) : b.ueben.length === 0 && b.sitzt.length) ? '<p class="bericht-lob">Kein einziger Fehler – stark!</p>' : ''}
  </div>`;
}

// Feier-Einblendung beim Aufstieg in einen neuen Rang.
// Eine Feier je Freischaltung: Figur, Begleiter, Rucksack-Design (mit Vorschau) oder neuer Gegenstand im Laden
function freischaltFeiern(frei) {
  if (!frei) return [];
  const eintrag = (titel, name, bildHtml, text) => (weiter) => feier({ titel, name, bildHtml, text }, weiter);
  return [
    ...frei.figuren.map((id) => { const h = G.HEROES.find((x) => x.id === id); return eintrag('Neue Figur frei!', h.name, figurBild(id) ? `<img class="feier-bild" src="${figurBild(id)}" alt="">` : sym('stern', 'gross'), h.faehigkeit || h.staerke); }),
    ...(frei.begleiter || []).map((id) => { const b = G.BEGLEITER.find((x) => x.id === id); return eintrag('Neuer Begleiter frei!', `${b.artikel} ${b.name}`, `<img class="feier-bild" src="assets/ui/begleiter/${id}.webp" alt="">`, b.text); }),
    ...frei.designs.map((id) => { const d = G.ACH.designs.find((x) => x.id === id); return eintrag('Neues Rucksack-Design!', d.name, `<div class="sam-design feier-design" data-design-vorschau="${id}"></div>`, `${d.text} Du kannst es vor dem nächsten Lauf wählen.`); }),
    ...paketeVon(frei.items || []).map(({ paket, ids }) => eintrag('Neu im Laden!', paket ? paket.name : `${G.DEFS[ids[0]].artikel} ${G.DEFS[ids[0]].name}`,
      `<span class="feier-pakete">${ids.map((id) => `<span>${iconHtml(G.DEFS[id], 'feier-item')}<small>${G.DEFS[id].name}</small></span>`).join('')}</span>`,
      `${paket ? paket.text + ' ' : ''}Im nächsten Lauf findest du ${ids.length > 1 ? 'mindestens einen davon' : 'ihn'} im Laden.`)),
  ];
}

// Neue Gegenstände nach Paket gruppieren (Gegenstände ohne Paket einzeln)
function paketeVon(ids) {
  const gruppen = [];
  for (const id of ids) {
    const pid = G.DEFS[id]?.freischaltung?.paket;
    const g = pid && gruppen.find((x) => x.paket?.id === pid);
    if (g) g.ids.push(id);
    else gruppen.push({ paket: pid ? G.PAKETE.pakete.find((p) => p.id === pid) : null, ids: [id] });
  }
  return gruppen;
}

function feier({ titel, name, bildHtml, text }, weiter) {
  const box = document.createElement('div');
  box.className = 'rang-feier';
  box.innerHTML = `<div class="rang-feier-card">
      <div class="rang-feier-emoji">${bildHtml}</div>
      <small>${titel}</small>
      <h2>${name}</h2>
      <p>${text}</p>
      <button class="btn primary big">Weiter</button>
    </div>`;
  funken(box);
  document.body.append(box);
  box.querySelector('button').onclick = () => { box.remove(); weiter?.(); };
}

function funken(box) {
  for (let i = 0; i < 24; i++) {
    const s = document.createElement('span');
    s.className = 'rang-funke';
    s.textContent = '★';
    s.style.setProperty('--w', `${(i / 24) * 360}deg`);
    s.style.animationDelay = `${(i % 6) * 60}ms`;
    box.append(s);
  }
}

export function rangFeier(r, weiter = null) {
  const box = document.createElement('div');
  box.className = 'rang-feier';
  box.innerHTML = `<div class="rang-feier-card">
      <div class="rang-feier-emoji">${sym('stern', 'gross')}</div>
      <small>Neuer Rang!</small>
      <h2>${r.name}</h2>
      <p>Du bist aufgestiegen – die Wanderlande staunen.</p>
      <button class="btn primary big">Juhu!</button>
    </div>`;
  funken(box);
  document.body.append(box);
  box.querySelector('button').onclick = () => { box.remove(); weiter?.(); };
}
