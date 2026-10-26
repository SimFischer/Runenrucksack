// Ende eines Laufs: Ergebnis, Erfahrung und Rang (mit Feier beim Aufstieg).
import { CFG } from './logic.js';
import { G, region } from './state.js';
import { laufStand } from './fortschritt.js';
import { modal, klang } from './ui.js';
import { figurBild } from './state.js';

const rangBalken = (r) => {
  const pct = r.naechster ? Math.round(((G.PROFIL.xp - r.ab) / (r.naechster.ab - r.ab)) * 100) : 100;
  return `<div class="rang-zeile"><span class="rang-emoji">${r.emoji}</span><span><b>${r.name}</b>
    <span class="rang-bar"><i style="width:${pct}%"></i></span>
    <small>${r.naechster ? `noch ${r.bisNaechster} Erfahrung bis ${r.naechster.name}` : 'Höchster Rang erreicht!'}</small></span></div>`;
};

// abschluss: Ergebnis von laufAbschluss(). aktionen: { neu, home }
export function zeigeLaufende(run, abschluss, aktionen) {
  const won = run.over === 'won';
  const stars = run.wins >= 10 ? '🌟🌟🌟' : run.wins >= 8 ? '⭐⭐⭐' : run.wins >= 6 ? '⭐⭐' : '⭐';
  const a = abschluss;
  const p = laufStand(run);
  const kopf = won ? `
      <div class="big-emoji">👑</div>
      <h2>Reise geschafft!</h2>
      <p>Du hast Kleinwurzel und Hrossmark durchquert: <b>${run.wins} von ${CFG.lastDay}</b> Kämpfen gewonnen. <span class="stars-inline">${stars}</span></p>` : `
      <div class="big-emoji">🪦</div>
      <h2>Lauf verloren</h2>
      <p>Alle Herzen sind weg – an Tag ${run.day} in ${region().name}. Du hast <b>${run.wins}</b> Kämpfe gewonnen.</p>`;
  const xp = a ? `
      <div class="xp-box">
        <div class="xp-zeile"><span>⚔️ ${run.wins} ${run.wins === 1 ? 'Sieg' : 'Siege'}</span><b>+${a.xp.siege}</b></div>
        <div class="xp-zeile"><span>📚 ${a.neu.length} ${a.neu.length === 1 ? 'neuer Eintrag' : 'neue Einträge'} im Buch</span><b>+${a.xp.entdeckungen}</b></div>
        <div class="xp-zeile"><span>✅ ${p.erster} ${p.erster === 1 ? 'Frage' : 'Fragen'} gleich beim ersten Versuch richtig</span><b>+${a.xp.ersterVersuch}</b></div>
        <div class="xp-zeile xp-summe"><span>Erfahrung</span><b>+${a.xp.gesamt}</b></div>
        ${rangBalken(a.nachher)}
      </div>` : '';
  const frei = a?.frei ? [
    ...a.frei.figuren.map((id) => { const h = G.HEROES.find((x) => x.id === id); return `<div class="frei-neu">${figurBild(id) ? `<img src="${figurBild(id)}" alt="">` : h.emoji}<span><small>Neue Figur frei!</small><b>${h.name}</b></span></div>`; }),
    ...(a.erfolge || []).map((id) => { const e = G.ACH.erfolge.find((x) => x.id === id); return `<div class="frei-neu"><span class="frei-emoji">${e.emoji}</span><span><small>Neuer Erfolg!</small><b>${e.name}</b></span></div>`; }),
    ...a.frei.designs.map((id) => { const d = G.ACH.designs.find((x) => x.id === id); return `<div class="frei-neu"><span class="frei-emoji">${d.emoji}</span><span><small>Neues Rucksack-Design!</small><b>${d.name}</b></span></div>`; }),
  ].join('') : '';
  modal(`${kopf}${xp}${frei ? `<div class="frei-liste">${frei}</div>` : ''}
      <div class="row"><button class="btn primary big" data-act="neu">Neuer Lauf</button><button class="btn" data-act="home">Zum Start</button></div>`,
  { neu: aktionen.neu, home: aktionen.home }, 'wide ende');
  if (a?.aufgestiegen) setTimeout(() => rangFeier(a.nachher), 700);
}

// Feier-Einblendung beim Aufstieg in einen neuen Rang.
export function rangFeier(r) {
  const box = document.createElement('div');
  box.className = 'rang-feier';
  box.innerHTML = `<div class="rang-feier-card">
      <div class="rang-feier-emoji">${r.emoji}</div>
      <small>Neuer Rang!</small>
      <h2>${r.name}</h2>
      <p>Du bist aufgestiegen – die Wanderlande staunen.</p>
      <button class="btn primary big">Juhu!</button>
    </div>`;
  for (let i = 0; i < 24; i++) {
    const s = document.createElement('span');
    s.className = 'rang-funke';
    s.textContent = i % 3 ? '★' : '✨';
    s.style.setProperty('--w', `${(i / 24) * 360}deg`);
    s.style.animationDelay = `${(i % 6) * 60}ms`;
    box.append(s);
  }
  document.body.append(box);
  klang(4);
  box.querySelector('button').onclick = () => box.remove();
}
