// Buch der Wörter: Bildschirm mit Seiten, Fortschrittsbalken und Karten; Einblendung bei neuen Entdeckungen.
import { G, emit } from './state.js';
import { seitenStand } from './buch.js';
import { iconHtml, genusChip } from './ui.js';

let seiteAktiv = 'komposita';

// Seite „Regeln“: Regelkarten aus den Aufgaben (themen.json), gesammelt in G.PROFIL.regeln – zählt nicht zu den Buch-Einträgen.
const regelSeite = () => ({
  id: 'regeln', emoji: '📜', titel: 'Regeln', text: 'Regelkarten: Jede Regel, die du beim Lösen einer Aufgabe richtig angewendet hast, landet hier.',
  eintraege: G.THEMEN.themen.flatMap((t) => t.regeln.map((r) => ({ id: `regel:${r.id}`, regel: r, thema: t }))),
});

export function zeigeBuch(zurueck = null) {
  document.getElementById('buch-layer')?.remove();
  const box = document.createElement('div');
  box.id = 'buch-layer';
  document.body.append(box);
  const zeichne = () => {
    const entdeckt = new Set([...G.PROFIL.buch, ...(G.PROFIL.regeln || []).map((id) => `regel:${id}`)]);
    const gesamt = G.BUCH.eintraege.length;
    const seiten = [...G.BUCH.seiten, regelSeite()];
    const seite = { ...seiten.find((s) => s.id === seiteAktiv) };
    const lohn = G.ACH.designs.find((d) => d.freischaltung?.seite === seite.id);
    if (lohn) seite.belohnung = `Rucksack-Design „${lohn.name}“ ${lohn.emoji}`;
    const stand = seitenStand(seite, entdeckt);
    box.innerHTML = `
      <div class="buch-card" data-tut="buch-fenster">
        <header class="buch-head">
          <h2>📚 Buch der Wörter</h2>
          <span class="buch-total">${G.PROFIL.buch.length} von ${gesamt} entdeckt · 📜 ${(G.PROFIL.regeln || []).length} Regeln</span>
          <button class="btn primary" data-close>Schließen</button>
        </header>
        <nav class="buch-tabs">${seiten.map((s) => {
          const st = seitenStand(s, entdeckt);
          return `<button class="buch-tab${s.id === seiteAktiv ? ' on' : ''}${st.voll ? ' voll' : ''}" data-seite="${s.id}">
            <span>${s.emoji} ${s.titel}</span>
            <span class="buch-bar"><i style="width:${Math.round((st.gefunden / st.gesamt) * 100)}%"></i></span>
            <small>${st.gefunden}/${st.gesamt}</small></button>`;
        }).join('')}</nav>
        <p class="buch-intro">${seite.text}${seite.belohnung ? ` <b class="buch-lohn${stand.voll ? ' da' : ''}">${stand.voll ? '✓' : '🎁'} Volle Seite: ${seite.belohnung}</b>` : ''}</p>
        <div class="buch-grid">${seite.eintraege.map((e) => karte(e, entdeckt.has(e.id))).join('')}</div>
      </div>`;
    box.querySelector('[data-close]').onclick = () => { box.remove(); emit('buchZu'); zurueck?.(); };
    box.querySelectorAll('[data-seite]').forEach((b) => { b.onclick = () => { seiteAktiv = b.dataset.seite; zeichne(); }; });
  };
  zeichne();
  emit('buchAuf');
}

function karte(e, da) {
  if (e.regel) {
    return da ? `<div class="buch-eintrag regel-karte"><span class="regel-emoji">${e.thema.emoji}</span><b>${e.thema.name}</b><small>${e.regel.text}</small></div>`
      : `<div class="buch-eintrag regel-karte dunkel"><span class="regel-emoji">📜</span><b>???</b><small>${e.thema.name}</small></div>`;
  }
  const sterne = e.stern && e.seite === 'stufen' ? `<em class="buch-sterne">${'★'.repeat(e.stern)}</em>` : '';
  const bild = e.seite === 'saetze'
    ? `<span class="buch-pair">${iconHtml(e.subjekt, 'buch-img')}<b>+</b>${iconHtml(e.def, 'buch-img')}</span>`
    : `<span class="buch-pic${e.stern === 4 ? ' legendaer' : ''}"${e.def.leuchten ? ` style="--glow:${e.def.leuchten}"` : ''}>${iconHtml(e.def, 'buch-img')}${sterne}${e.def.abzeichen && e.seite === 'komposita' ? `<em class="buch-kraft">${e.def.abzeichen}</em>` : ''}</span>`;
  if (!da) return `<div class="buch-eintrag dunkel">${bild}<b>???</b></div>`;
  return `<div class="buch-eintrag">${bild}
    <b>${e.artikel ? genusChip(e.artikel) + ' ' : ''}${e.name}</b>
    ${e.wirkung ? `<small class="buch-wirkung">${e.wirkung}</small>` : ''}
    ${e.hinweis ? `<small class="buch-hinweis">${e.hinweis}</small>` : ''}</div>`;
}

// Neuer Erfolg während des Laufs: dieselbe Einblendung, nur golden beschriftet.
export function meldeRegel(thema, regel) {
  warteschlange.push({ regel: { thema, regel } });
  if (!zeigt) naechste();
}

export function meldeErfolg(e) {
  if (!e) return;
  warteschlange.push({ erfolg: e });
  if (!zeigt) naechste();
}

// Kurze Einblendung „Neu im Buch der Wörter!“ mit Glanz – hält das Spiel nicht an.
const warteschlange = [];
let zeigt = false;
export function meldeNeu(ids) {
  for (const id of ids) {
    const e = G.BUCH.byId.get(id);
    if (e) warteschlange.push(e);
  }
  if (!zeigt) naechste();
}

function naechste() {
  const e = warteschlange.shift();
  if (!e) { zeigt = false; return; }
  zeigt = true;
  const n = document.createElement('div');
  n.className = 'buch-neu';
  if (e.regel) n.innerHTML = `<span class="buch-neu-pic">📜</span><span><small>Neue Regelkarte im Buch!</small><b>${e.regel.thema.emoji} ${e.regel.thema.name}</b></span>`;
  else if (e.erfolg) n.innerHTML = `<span class="buch-neu-pic">${e.erfolg.emoji}</span><span><small>🏆 Neuer Erfolg!</small><b>${e.erfolg.name}</b></span>`;
  else n.innerHTML = `<span class="buch-neu-pic">${iconHtml(e.def, 'buch-img')}</span>
    <span><small>📚 Neu im Buch der Wörter!</small><b>${e.seite === 'stufen' ? '★'.repeat(e.stern) + ' ' : ''}${e.artikel ? e.artikel + ' ' : ''}${e.name}</b></span>`;
  document.body.append(n);
  setTimeout(() => n.remove(), 2400);
  setTimeout(naechste, warteschlange.length ? 900 : 2400);
}
