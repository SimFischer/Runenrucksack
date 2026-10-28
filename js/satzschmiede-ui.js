// Satzschmiede: eine Wahl bei den Begegnungen (höchstens alle drei Tage, dreimal im Lauf, 3 Gold). Jeder Besuch
// hat eine Bestellung, die den Satz vorgibt; die Karten werden jedes Mal neu gezogen. Satzglied-Karten
// (farbig, mit Form-Zeichen) werden angetippt oder in die Satzleiste gezogen. Ist der Satz richtig, entsteht eine
// Spruchrolle (2×1) mit Werten aus den Satzgliedern. Auf Stufe 3 folgt die Umstellprobe: Wer den Satz gültig
// umstellt, macht die Rolle eine Stufe stärker. Logik und Prüfung: js/satzschmiede.js.
import { G, save, region, emit, saveProfil, hero } from './state.js';
import { laufRng } from './logic.js';
import { placeNew } from './sterne.js';
import { merkeAntwort } from './fortschritt.js';
import { aufgabenStand, lernstandVon, maxStufe } from './aufgaben/wahl.js';
import { einstellungen } from './aufgaben/spiel.js';
import {
  karten, pruefeSatz, spruchWerte, istUmstellung, verbucheSatz, schmiedeVerben, schmiedeStern, THEMA_SATZ, GLIED_NAME, GLIED_FRAGE,
  waehleBestellung, erfuellt, zieheKarten,
} from './satzschmiede.js';
import { applyMod } from './mods.js';
import { toast, bump } from './ui.js';
import { sym } from './symbole.js';

const BILD = 'assets/ui/satzschmiede/';
const GLIEDER = ['subjekt', 'praedikat', 'objekt', 'zeit', 'art', 'ort'];
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const mische = (liste) => liste.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);
const fmt = (n) => String(Math.round(n * 10) / 10).replace('.', ',');

const karteHtml = (k, extra = '') => `<button class="satz-karte g-${k.glied}${extra}" data-k="${k.id}"><i class="glied-zeichen"></i>${esc(k.text)}</button>`;

// Werte der Spruchrolle in einer Zeile: Schaden 14 · alle 4,1 s
function werteText(w) {
  const teile = [];
  if (w.schaden) teile.push(`Schaden ${fmt(w.schaden)}`);
  if (w.block) teile.push(`Block ${fmt(w.block)}`);
  if (w.heilung) teile.push(`Heilung ${fmt(w.heilung)}`);
  if (w.abklingzeit) teile.push(`alle ${fmt(w.abklingzeit)} s`);
  if (w.startblock) teile.push(`+${w.startblock} Startblock`);
  if (w.glueck) teile.push(`+${w.glueck} % Glück`);
  return teile.join(' · ');
}

// fertig: weiter im Ablauf am Morgen; render: Spielfeld neu zeichnen (Spruchrolle sichtbar); zurueck: zur Auswahl
export function zeigeSatzschmiede(fertig, render = () => {}, zurueck = fertig) {
  const daten = G.SATZSCHMIEDE;
  const preis = daten.besuch.preis;
  const erstesMal = !G.PROFIL.satzschmiedeGesehen;
  emit('tipp', { key: 'satzschmiede' });
  const box = document.createElement('div');
  box.id = 'satz-layer';
  box.innerHTML = `
    <div class="satz-tuer tafel" data-tut="satzschmiede">
      <p class="enc-top">${sym('tag')} Morgen in ${region().name}</p>
      <img class="satz-tuer-bild" src="${BILD}amboss.webp" alt="">
      <h2>Die Satzschmiede</h2>
      ${erstesMal
        ? `<p class="satz-erklaer">Hier baust du aus Satzglied-Karten einen Satz. Ist er richtig, schmiedet die Schmiedin daraus eine
           <b>Spruchrolle</b> für deinen Rucksack. Jedes Satzglied gibt ihr eine eigene Kraft.</p>`
        : '<p class="satz-erklaer">Die Schmiedin hat eine neue Bestellung. Ein richtiger Satz, der dazu passt, wird zur Spruchrolle.</p>'}
      <div class="row">
        <button class="btn primary big" data-rein ${G.run.gold < preis ? 'disabled' : ''}>Hineingehen · ${preis} ${sym('gold', 'klein')}</button>
        <button class="btn" data-nein>Zurück</button>
      </div>
      ${G.run.gold < preis ? `<p class="satz-erklaer">Dir fehlen noch ${preis - G.run.gold} Gold.</p>` : ''}
    </div>`;
  document.body.append(box);
  box.querySelector('[data-nein]').onclick = () => { box.remove(); zurueck(); };
  box.querySelector('[data-rein]').onclick = () => {
    const run = G.run;
    if (run.gold < preis) return;
    run.gold -= preis;
    bump('stat-gold');
    run.satzschmiedeTag = run.day;
    run.satzschmiedeBesuche = (run.satzschmiedeBesuche || 0) + 1;
    save();
    if (erstesMal) { G.PROFIL.satzschmiedeGesehen = true; saveProfil(); }
    schmiede(box, daten, fertig, render);
  };
}

function schmiede(box, daten, fertig, render) {
  const run = G.run;
  const stufe = Math.max(1, Math.min(lernstandVon(G.PROFIL, THEMA_SATZ).stufe, maxStufe(einstellungen(), THEMA_SATZ)));
  const h = hero();
  const bDef = G.BEGLEITER?.find((b) => b.id === run.begleiter) || null;
  const rng = laufRng(run, 'satzschmiede');
  const bestellung = waehleBestellung(daten, stufe, run, rng);
  run.bestellungen = [...(run.bestellungen || []), bestellung.id];
  // Verben: die Rollen aus dem Rucksack, dazu wechselnde andere – die Bestellung muss erfüllbar sein
  const alle = Object.keys(daten.verben);
  const schutz = ['schützen', 'heilen'];
  let verben = [...new Set([...schmiedeVerben(run, G.DEFS, daten), ...mische(alle)])].slice(0, 3);
  const b = bestellung.bedingung;
  if (b.wirkung === 'schutz' || b.objektText === 'uns') verben = [mische(schutz)[0], ...verben.filter((v) => !schutz.includes(v))].slice(0, 3);
  if (b.wirkung === 'schaden' || b.objektPlural) verben = [mische(alle.filter((v) => !schutz.includes(v)))[0], ...verben].filter((v, i, l) => l.indexOf(v) === i).slice(0, 3);
  const pool = zieheKarten(karten({ daten, ws: G.WORTSCHATZ, figur: { kurz: h?.kurz || h?.name || 'Ich' }, begleiter: bDef, verben, stufe, weitere: true }), bestellung, rng);
  const reihe = Object.fromEntries(GLIEDER.map((g) => [g, mische(pool.filter((k) => k.glied === g))]));
  const ctx = { daten, ws: G.WORTSCHATZ };
  let leiste = [];
  let versuche = 0;
  let meldung = '';
  let ergebnis = null; // nach dem Schmieden: { r, leiste }
  let umstellen = false;

  const zeichne = () => {
    const inLeiste = new Set(leiste.map((k) => k.id));
    const gruppen = GLIEDER.filter((g) => reihe[g].length).map((g) => `
      <div class="satz-gruppe g-${g}">
        <span class="satz-gruppe-name"><i class="glied-zeichen"></i>${GLIED_NAME[g]} <small>${GLIED_FRAGE[g]}</small></span>
        <div class="satz-gruppe-karten">${reihe[g].map((k) => karteHtml(k, inLeiste.has(k.id) ? ' benutzt' : '')).join('')}</div>
      </div>`).join('');
    const satzKarten = leiste.length
      ? leiste.map((k) => karteHtml(k)).join('') + '<span class="satz-punkt">.</span>'
      : `<span class="satz-leer">${umstellen ? '' : 'Tippe Karten an oder zieh sie hierher.'}</span>`;
    box.innerHTML = `
      <div class="satz-card tafel">
        <header class="satz-kopf">
          <img src="${BILD}amboss.webp" alt="">
          <div><h2>Die Satzschmiede</h2>
            <p class="satz-stufe">Stufe ${'★'.repeat(stufe)}${'☆'.repeat(3 - stufe)}: ${daten.stufen[stufe].text}</p></div>
          ${ergebnis ? '' : `<button class="btn" data-leeren ${leiste.length ? '' : 'disabled'}>Leeren</button>
          <button class="btn primary big" data-schmieden ${leiste.length >= 2 ? '' : 'disabled'}>Schmieden</button>
          <button class="btn" data-nein>Gehen</button>`}
        </header>
        <p class="satz-bestellung"><b>Bestellung:</b> ${esc(bestellung.text)} <small>Lohn: +${bestellung.belohnung.gold} ${sym('gold', 'klein')}</small></p>
        ${umstellen ? `<p class="satz-hinweis"><b>Umstellprobe:</b> Satzglieder kann man umstellen – das Prädikat bleibt an zweiter Stelle.
          Tippe eine Karte an, dann rückt sie eine Stelle nach vorn. Oder zieh sie an ihren neuen Platz.</p>` : ''}
        <div class="satz-leiste${ergebnis && !umstellen ? ' fertig' : ''}" data-leiste data-tut="satz-leiste">${satzKarten}</div>
        ${meldung}
        ${ergebnis ? ergebnisHtml() : `<div class="satz-pool" data-tut="satz-karten">${gruppen}</div>`}
      </div>`;
    box.querySelector('[data-nein]')?.addEventListener('click', () => { box.remove(); fertig(); });
    box.querySelector('[data-leeren]')?.addEventListener('click', () => { leiste = []; meldung = ''; zeichne(); });
    box.querySelector('[data-schmieden]')?.addEventListener('click', schmieden);
    box.querySelector('[data-umstellen]')?.addEventListener('click', () => { umstellen = true; meldung = ''; zeichne(); });
    box.querySelector('[data-pruefen]')?.addEventListener('click', pruefeUmstellung);
    box.querySelector('[data-nehmen]')?.addEventListener('click', nehmen);
    box.querySelectorAll('.satz-karte').forEach((el) => ziehbar(el));
  };

  const ergebnisHtml = () => {
    const w = werteVon(ergebnis);
    const kannUmstellen = stufe >= 3 && !ergebnis.umgestellt;
    const mussUmstellen = bestellung.bedingung.umstellung && !ergebnis.umgestellt;
    return `
      <div class="satz-ergebnis">
        <img class="satz-rolle" src="${BILD}spruchrolle.webp" alt="">
        <div>
          <p class="satz-werte"><b>Spruchrolle ${'★'.repeat(w.stufe)}</b> · ${werteText(w.werte)}</p>
          <ul class="satz-zeilen">${w.zeilen.map((z) => `<li>${esc(z)}</li>`).join('')}</ul>
        </div>
      </div>
      <div class="row satz-knoepfe">
        ${umstellen
          ? `${mussUmstellen ? '' : '<button class="btn" data-nehmen>Ohne Umstellprobe nehmen</button>'}<button class="btn primary big" data-pruefen>Umstellung prüfen</button>`
          : `${kannUmstellen ? `<button class="btn${mussUmstellen ? ' primary big' : ''}" data-umstellen>Umstellprobe wagen</button>` : ''}${mussUmstellen ? '' : '<button class="btn primary big" data-nehmen>Spruchrolle nehmen</button>'}`}
      </div>`;
  };

  // Werte der Spruchrolle: Sternstufe der Verb-Rolle im Rucksack, Umstellprobe +1 Stern
  const werteVon = (e) => spruchWerte(e.r, {
    daten, verbDef: G.DEFS[daten.verben[e.r.verb].item], stern: schmiedeStern(run, G.DEFS, e.r.verb, daten), applyMod, umgestellt: e.umgestellt,
    bestellung: e.bestellt ? bestellung : null,
  });

  // Antippen: aus dem Vorrat ans Ende der Leiste, aus der Leiste zurück (Umstellprobe: eine Stelle nach vorn)
  const tippe = (id) => {
    const k = pool.find((x) => x.id === id);
    const i = leiste.findIndex((x) => x.id === id);
    if (umstellen) { if (i > 0) leiste = [...leiste.slice(0, i - 1), leiste[i], leiste[i - 1], ...leiste.slice(i + 1)]; }
    else if (ergebnis) return;
    else if (i >= 0) leiste = leiste.filter((x) => x.id !== id);
    else leiste = [...leiste, k];
    meldung = '';
    zeichne();
  };
  // Ziehen: in die Leiste an eine bestimmte Stelle (oder in der Leiste umsortieren); kleiner Weg = Antippen
  const ziehbar = (el) => {
    el.onpointerdown = (e) => {
      if (ergebnis && !umstellen) return;
      const id = el.dataset.k;
      const start = { x: e.clientX, y: e.clientY };
      let geist = null;
      const bewege = (ev) => {
        if (!geist && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 10) return;
        if (!geist) {
          geist = el.cloneNode(true);
          geist.classList.add('satz-geist');
          document.body.append(geist);
          el.classList.add('benutzt');
        }
        geist.style.left = `${ev.clientX}px`;
        geist.style.top = `${ev.clientY}px`;
      };
      const los = (ev) => {
        window.removeEventListener('pointermove', bewege);
        window.removeEventListener('pointerup', los);
        window.removeEventListener('pointercancel', los);
        if (!geist) { tippe(id); return; }
        geist.remove();
        const lz = box.querySelector('[data-leiste]').getBoundingClientRect();
        const drin = ev.clientX >= lz.left && ev.clientX <= lz.right && ev.clientY >= lz.top - 20 && ev.clientY <= lz.bottom + 20;
        const k = pool.find((x) => x.id === id);
        const ohne = leiste.filter((x) => x.id !== id);
        if (drin) {
          const mitten = [...box.querySelectorAll('[data-leiste] .satz-karte')].filter((x) => x.dataset.k !== id)
            .map((x) => { const r = x.getBoundingClientRect(); return r.left + r.width / 2; });
          const pos = mitten.filter((m) => m < ev.clientX).length;
          leiste = [...ohne.slice(0, pos), k, ...ohne.slice(pos)];
        } else if (!umstellen) leiste = ohne;
        meldung = '';
        zeichne();
      };
      window.addEventListener('pointermove', bewege);
      window.addEventListener('pointerup', los);
      window.addEventListener('pointercancel', los);
    };
  };

  const schmieden = () => {
    const r = pruefeSatz(leiste, ctx);
    versuche++;
    if (!r.gueltig) {
      meldung = `<p class="af-rueck falsch satz-meldung">${esc(r.fehler)}</p>`;
      zeichne();
      return;
    }
    // Derselbe Satz zweimal im Lauf: abgelehnt
    if ((run.sprueche || []).includes(r.satz)) {
      meldung = '<p class="af-rueck falsch satz-meldung">Diesen Spruch kennt die Schmiede schon. Bau einen anderen Satz.</p>';
      zeichne();
      return;
    }
    // Die Umstellprobe-Bestellung prüft erst nach dem Umstellen, alle anderen gleich
    if (!bestellung.bedingung.umstellung && !erfuellt(bestellung, r, leiste)) {
      meldung = `<p class="af-rueck falsch satz-meldung">Der Satz stimmt – aber er passt noch nicht zur Bestellung. ${esc(bestellung.text)}</p>`;
      zeichne();
      return;
    }
    // Lernstand: nur der erste Versuch zählt als „gleich richtig“
    const gleich = versuche === 1;
    merkeAntwort(run, THEMA_SATZ, true, gleich);
    const e = (aufgabenStand(run).ergebnis[THEMA_SATZ] ||= [0, 0]);
    e[gleich ? 0 : 1]++;
    const v = verbucheSatz(G.PROFIL, gleich);
    saveProfil();
    if (v.aufgestiegen) toast(`Satzglieder: Jetzt kommen Karten der Stufe ${'★'.repeat(v.stufe)}!`);
    ergebnis = { r, leiste: [...leiste], umgestellt: false, bestellt: !bestellung.bedingung.umstellung };
    meldung = `<p class="af-rueck richtig satz-meldung">✓ Ein richtiger Satz! Die Schmiedin macht daraus eine Spruchrolle.</p>`;
    zeichne();
  };

  const pruefeUmstellung = () => {
    if (istUmstellung(ergebnis.leiste, leiste, ctx)) {
      ergebnis = { r: pruefeSatz(leiste, ctx), leiste: [...leiste], umgestellt: true, bestellt: true };
      umstellen = false;
      meldung = `<p class="af-rueck richtig satz-meldung">✓ Umstellprobe bestanden! Das Prädikat steht noch an zweiter Stelle – die Spruchrolle bekommt einen Stern mehr.</p>`;
    } else {
      const r = pruefeSatz(leiste, ctx);
      meldung = `<p class="af-rueck falsch satz-meldung">${leiste[0] === ergebnis.leiste[0]
        ? 'Stell ein anderes Satzglied an den Anfang.'
        : esc(r.fehler || 'Das ist noch kein richtiger Satz.')}</p>`;
    }
    zeichne();
  };

  // Spruchrolle in Rucksack oder Lager; Satz ins Buch der Wörter (Seite „Sprüche“, nur auf dem Gerät)
  const nehmen = () => {
    const r = ergebnis.r;
    const w = werteVon(ergebnis);
    const spruch = { satz: r.satz, verb: r.verb, werte: w.werte, zeilen: w.zeilen, stufe: w.stufe };
    const p = placeNew(run, G.DEFS, 'spruchrolle', null, w.stufe > 1 ? { spruch, stern: w.stufe } : { spruch });
    if (p) emit('neuesItem', { uid: p.uid });
    else { run.gold += 2; bump('stat-gold'); }
    run.sprueche = [...(run.sprueche || []), r.satz];
    const lohn = ergebnis.bestellt ? bestellung.belohnung.gold : 0;
    if (lohn) { run.gold += lohn; bump('stat-gold'); }
    G.PROFIL.sprueche = [...(G.PROFIL.sprueche || []), { satz: r.satz, verb: r.verb, umgestellt: ergebnis.umgestellt, werte: werteText(w.werte) }];
    saveProfil();
    save();
    box.remove();
    toast(p ? `Neue Spruchrolle: „${r.satz}“${lohn ? ` – und ${lohn} Gold für die Bestellung` : ''}` : `Kein Platz für die Spruchrolle – dafür 2 Gold.`);
    emit('spruchFertig', { satz: r.satz });
    render();
    fertig();
  };

  zeichne();
}
