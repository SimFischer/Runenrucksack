// Sammlung: alle Figuren und Rucksack-Designs (später auch Erfolge); gesperrte mit Hinweis, wie man sie bekommt.
import { G, figurBild, saveProfil } from './state.js';
import { figurFrei, designFrei, bedingungText, rangVon } from './fortschritt.js';
import { begleiterFrei } from './begleiter.js';
import { toast } from './ui.js';
import { sym } from './symbole.js';

export const fortschrittCtx = () => ({ achievements: G.ACH, buch: G.BUCH, heroes: G.HEROES });

// Gewähltes Rucksack-Design anwenden (nur Optik).
export function wendeDesignAn() {
  document.body.dataset.design = G.PROFIL.design || 'leder';
}

let tab = 'figuren';

export function zeigeSammlung(zurueck = null) {
  document.getElementById('sammlung-layer')?.remove();
  const box = document.createElement('div');
  box.id = 'sammlung-layer';
  document.body.append(box);
  const ctx = fortschrittCtx();
  const rang = rangVon(G.PROFIL.xp, G.ACH.raenge).nr;
  const tabs = [['figuren', 'Figuren'], ['begleiter', 'Begleiter'], ['designs', 'Rucksack-Designs'], ...(G.ACH.erfolge ? [['erfolge', 'Erfolge']] : [])];
  const zeichne = () => {
    let inhalt = '';
    if (tab === 'figuren') {
      inhalt = G.HEROES.map((h) => {
        const frei = figurFrei(G.PROFIL, h);
        const bild = figurBild(h.id) ? `<img src="${figurBild(h.id)}" alt="">` : '';
        const sieg = G.PROFIL.figurSiege.includes(h.id) ? `<span class="sam-sieg" title="Mit dieser Figur schon einen Lauf gewonnen">${sym('pokal')}</span>` : '';
        return `<div class="sam-karte${frei ? '' : ' gesperrt'}" style="--hero:${h.farbe}">
          <div class="sam-bild">${bild}${frei ? '' : `<span class="sam-schloss">${sym('schloss')}</span>`}${sieg}</div>
          <b>${h.name}</b><small>${h.volk}</small>
          <p>${frei ? h.staerke : bedingungText(h.freischaltung, ctx)}</p></div>`;
      }).join('');
    } else if (tab === 'begleiter') {
      inhalt = G.BEGLEITER.map((b) => {
        const frei = begleiterFrei(b, rang);
        return `<div class="sam-karte${frei ? '' : ' gesperrt'}">
          <div class="sam-bild"><img src="assets/ui/begleiter/${b.id}.webp" alt="">${frei ? '' : `<span class="sam-schloss">${sym('schloss')}</span>`}</div>
          <b>${frei ? b.name : '???'}</b><small>${frei ? b.rolle : ''}</small>
          <p>${frei ? b.text : bedingungText(b.freischaltung, ctx)}</p></div>`;
      }).join('');
    } else if (tab === 'designs') {
      inhalt = G.ACH.designs.map((d) => {
        const frei = designFrei(G.PROFIL, d);
        const an = G.PROFIL.design === d.id;
        return `<div class="sam-karte${frei ? '' : ' gesperrt'}${an ? ' an' : ''}">
          <div class="sam-design" data-design-vorschau="${d.id}"><span>${sym('truhe')}</span></div>
          <b>${d.name}</b><p>${frei ? d.text : bedingungText(d.freischaltung, ctx)}</p>
          ${frei ? `<button class="btn ${an ? 'primary' : ''}" data-design="${d.id}" ${an ? 'disabled' : ''}>${an ? '✓ Gewählt' : 'Wählen'}</button>` : ''}</div>`;
      }).join('');
    } else {
      inhalt = G.ACH.erfolge.map((e) => {
        const da = G.PROFIL.erfolge.includes(e.id);
        return `<div class="sam-karte erfolg${da ? '' : ' gesperrt'}"><div class="sam-erfolg">${da ? sym('pokal') : sym('schloss')}</div>
          <b>${e.name}</b><p>${e.text}</p></div>`;
      }).join('');
    }
    const zahl = tab === 'figuren' ? `${G.HEROES.filter((h) => figurFrei(G.PROFIL, h)).length} von ${G.HEROES.length}`
      : tab === 'begleiter' ? `${G.BEGLEITER.filter((b) => begleiterFrei(b, rang)).length} von ${G.BEGLEITER.length}`
      : tab === 'designs' ? `${G.ACH.designs.filter((d) => designFrei(G.PROFIL, d)).length} von ${G.ACH.designs.length}`
        : `${G.PROFIL.erfolge.length} von ${G.ACH.erfolge.length}`;
    box.innerHTML = `<div class="buch-card sam-card">
      <header class="buch-head"><h2>${sym('pokal')} Sammlung</h2><span class="buch-total">${zahl}</span><button class="btn primary" data-close>Schließen</button></header>
      <nav class="buch-tabs">${tabs.map(([id, t]) => `<button class="buch-tab${id === tab ? ' on' : ''}" data-tab="${id}"><span>${t}</span></button>`).join('')}</nav>
      <div class="sam-grid">${inhalt}</div></div>`;
    box.querySelector('[data-close]').onclick = () => { box.remove(); zurueck?.(); };
    box.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { tab = b.dataset.tab; zeichne(); }; });
    box.querySelectorAll('[data-design]').forEach((b) => {
      b.onclick = () => {
        G.PROFIL.design = b.dataset.design;
        saveProfil();
        wendeDesignAn();
        toast(`Dein Rucksack trägt jetzt: ${G.ACH.designs.find((d) => d.id === b.dataset.design).name}`);
        zeichne();
      };
    });
  };
  zeichne();
}
