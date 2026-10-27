// Ende eines Laufs: Ergebnis, Lernbericht (nur für das Kind), Erfahrung und Rang (mit Feier beim Aufstieg).
import { CFG } from './logic.js';
import { G, region } from './state.js';
import { laufStand, lernbericht } from './fortschritt.js';
import { modal, iconHtml } from './ui.js';
import { figurBild } from './state.js';
import { codeKasten, kopierenAn, aktuellerHeldencode } from './code-ui.js';
import { themenBericht } from './aufgaben/wahl.js';
import { sym } from './symbole.js';

const rangBalken = (r) => {
  const pct = r.naechster ? Math.round(((G.PROFIL.xp - r.ab) / (r.naechster.ab - r.ab)) * 100) : 100;
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
      <div class="big-emoji">${sym('pokal', 'gross')}</div>
      <h2>Reise geschafft!</h2>
      <p>Du hast Kleinwurzel und Hrossmark durchquert: <b>${run.wins} von ${CFG.lastDay}</b> Kämpfen gewonnen. <span class="stars-inline">${stars}</span></p>` : `
      <div class="big-emoji">${sym('herzZerbrochen', 'gross')}</div>
      <h2>Lauf verloren</h2>
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
  ].join('') : '';
  document.getElementById('tip-bubble')?.remove(); // offene Erste-Mal-Tipps gehören zum Lauf
  const code = a ? aktuellerHeldencode() : null;
  const card = modal(`${kopf}
      <div class="ende-spalten">
        <div>${berichtHtml(run, a)}</div>
        <div>${xp}${frei ? `<div class="frei-liste">${frei}</div>` : ''}
          ${code ? `<div class="ende-code"><b>${sym('schloss')} Dein Heldencode</b><small>Schreib ihn ab oder fotografiere ihn – damit holst du deinen Fortschritt zurück.</small>${codeKasten(code, true)}</div>` : ''}</div>
      </div>
      <div class="row"><button class="btn primary big" data-act="neu">Neuer Lauf</button><button class="btn" data-act="home">Zum Start</button></div>`,
  { neu: aktionen.neu, home: aktionen.home }, 'wide ende');
  if (code) kopierenAn(card, code);
  if (a?.aufgestiegen) setTimeout(() => rangFeier(a.nachher), 700);
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
export function rangFeier(r) {
  const box = document.createElement('div');
  box.className = 'rang-feier';
  box.innerHTML = `<div class="rang-feier-card">
      <div class="rang-feier-emoji">${sym('stern', 'gross')}</div>
      <small>Neuer Rang!</small>
      <h2>${r.name}</h2>
      <p>Du bist aufgestiegen – die Wanderlande staunen.</p>
      <button class="btn primary big">Juhu!</button>
    </div>`;
  for (let i = 0; i < 24; i++) {
    const s = document.createElement('span');
    s.className = 'rang-funke';
    s.textContent = '★';
    s.style.setProperty('--w', `${(i / 24) * 360}deg`);
    s.style.animationDelay = `${(i % 6) * 60}ms`;
    box.append(s);
  }
  document.body.append(box);
  box.querySelector('button').onclick = () => box.remove();
}
