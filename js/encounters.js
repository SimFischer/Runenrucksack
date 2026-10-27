// Morgen: Begegnungen am Wegesrand. Jede Begegnung hat ihr eigenes Aufgabenformat (encounters.json):
// Eule sortiert, Zwerg baut Wörter, Wirtin verbessert die Speisekarte, Hirtin ordnet Sätze, Händler fragt
// „Was passt nicht?“ (Belohnung: Rabatt), Kobold verdreht einen Namen (Buchstaben ergänzen).
// Regeln wie überall: erster Versuch kostenlos, jeder weitere 1 Gold, nach jeder Antwort eine Merkhilfe.
import {
  pickEncounters, growBag, shopPool, pickOne, RABATT,
} from './logic.js';
import { sym } from './symbole.js';
import { GENUS } from './grammar.js';
import { placeNew } from './sterne.js';
import { G, save, region, emit } from './state.js';
import { merkeAntwort } from './fortschritt.js';
import { openModal, closeModal, toast, bump, fullName, nameAkk, iconHtml } from './ui.js';
import { frageImSpiel, wortschatz } from './aufgaben/spiel.js';
import { speisekarteInhalt, satzOrdnenInhalt, koboldInhalt } from './aufgaben/themen.js';

let done = null, rerender = null;
// Bild der Begegnungsfigur (assets/ui/begegnung/), sonst ein Symbol als Ersatz
const figur = (id, cls) => {
  const pfad = G.BILDER.ui?.begegnung?.[id];
  return pfad ? `<img class="${cls}" src="assets/${pfad}" alt="">` : sym('karte', 'gross');
};
const findEnc = (id) => G.ENCOUNTERS.begegnungen.find((b) => b.id === id);

// Zeigt die Auswahl der Begegnungen. fertig() wird danach aufgerufen, neuZeichnen() nach Änderungen am Rucksack.
// erzwungen (Tutorial): { id, fragen: [{ wort, artikel }], belohnung } – ohne Auswahl, mit eigenen Fragen.
export function runEncounter(fertig, neuZeichnen, erzwungen = null) {
  done = fertig;
  rerender = neuZeichnen;
  const run = G.run;
  if (erzwungen) {
    const enc = { ...findEnc(erzwungen.id), belohnung: erzwungen.belohnung };
    const tasks = erzwungen.fragen.map((q) => ({
      prompt: `<span class="blank">___</span> <b>${q.wort}</b>`,
      options: ['der', 'die', 'das'], correct: q.artikel, explain: `Es heißt ${q.artikel} ${q.wort}.`, genus: true,
    }));
    intro(enc, () => runTasks(enc, tasks, () => reward(enc)));
    return;
  }
  if (!run.begegnung || run.begegnung.tag !== run.day) {
    run.begegnung = { tag: run.day, ids: pickEncounters(run, G.ENCOUNTERS, G.REGIONS) };
    save();
  }
  const list = run.begegnung.ids.map(findEnc).filter(Boolean);
  const card = openModal(`
    <div class="enc-top">${sym('tag')} Morgen in ${region().name}</div>
    <h2>Wen triffst du am Wegesrand?</h2>
    <div class="enc-choices">${list.map((b) => `
      <button class="enc-choice" data-id="${b.id}">
        <span class="enc-emoji">${figur(b.id, 'enc-figur')}</span>
        <b>${b.name}</b>
        <span class="enc-reward">${sym('truhe')} ${b.belohnung.text}</span>
      </button>`).join('')}
    </div>
    <div class="row"><button class="btn small" data-skip>Weiterziehen</button></div>`, 'wide');
  card.querySelectorAll('[data-id]').forEach((b) => { b.onclick = () => intro(findEnc(b.dataset.id)); });
  card.querySelector('[data-skip]').onclick = () => finish(null);
}

function finish(id) {
  const last = G.run.history.at(-1);
  if (last) last.begegnung = id;
  closeModal();
  save();
  rerender();
  done();
}

function intro(enc, los = null) {
  const card = openModal(`
    <div class="big-emoji">${figur(enc.id, 'enc-figur gross')}</div>
    <h2>${enc.name}</h2>
    <p class="enc-text">${enc.text}</p>
    <p class="enc-reward-line">${sym('truhe')} Belohnung: <b>${enc.belohnung.text}</b></p>
    <div class="row">
      <button class="btn" data-back>Zurück</button>
      <button class="btn primary big" data-go>Los geht’s</button>
    </div>`);
  const back = card.querySelector('[data-back]');
  if (los) back.remove();
  else back.onclick = () => runEncounter(done, rerender);
  card.querySelector('[data-go]').onclick = () => (los ? los() : startTask(enc));
}

function startTask(enc) {
  const a = enc.aufgabe;
  if (a.typ === 'kobold') { kobold(enc); return; }
  closeModal();
  const ctx = { ws: wortschatz(), rng: Math.random, felder: [], benutzt: new Set() };
  const n = a.anzahl || 1;
  (async () => {
    for (let i = 0; i < n; i++) {
      const kopf = `<span class="af-wer">${figur(enc.id, 'af-wer-bild')}${enc.name}${n > 1 ? ` · ${i + 1}/${n}` : ''}</span>`;
      const inhalt = a.typ === 'speisekarte' ? speisekarteInhalt(ctx) : a.typ === 'satzordnen' ? satzOrdnenInhalt(ctx) : null;
      const r = await frageImSpiel(inhalt ? { inhalt, kopf, nein: 'Aufgeben' } : { format: a.format, kopf, nein: 'Aufgeben' });
      if (inhalt) ctx.benutzt.add(inhalt.wort);
      if (!r.richtig) { giveUp(enc); return; }
    }
    reward(enc);
  })();
}

// ---------- Aufgaben ----------

// Feste Auswahl-Fragen (nur im Tutorial): nacheinander abarbeiten. end(true) wenn alle gelöst, end(false) beim Aufgeben.
function runTasks(enc, tasks, end) {
  const run = G.run;
  let qi = 0, tries = 0, feedback = '', solved = false;
  let wrong = new Set();

  const draw = () => {
    const q = tasks[qi];
    const paid = tries > 0 && !run.tutorial;
    const broke = paid && run.gold < 1 && !solved;
    const body = drawChoice(q, wrong, solved, broke);
    const card = openModal(`
      <div class="enc-mini">${enc.name}</div>
      ${tasks.length > 1 ? `<p class="enc-progress">Aufgabe ${qi + 1} von ${tasks.length}</p>` : ''}
      ${body}
      <p class="cost">${solved ? '' : paid ? `Jeder weitere Versuch kostet 1 ${sym('gold')} · du hast ${run.gold} ${sym('gold')}` : 'Erster Versuch kostenlos'}</p>
      ${feedback ? `<p class="feedback ${solved ? 'good' : ''}">${feedback}</p>` : ''}
      ${broke ? '<p class="feedback">Kein Gold für einen weiteren Versuch.</p>' : ''}
      <div class="row">${solved
        ? `<button class="btn primary big" data-next>${qi + 1 < tasks.length ? 'Nächste Aufgabe' : 'Weiter'}</button>`
        : `<button class="btn small" data-give>Aufgeben</button>`}</div>`);
    card.querySelectorAll('[data-i]').forEach((b) => { b.onclick = () => answer(+b.dataset.i); });
    card.querySelector('[data-give]')?.addEventListener('click', () => end(false));
    card.querySelector('[data-next]')?.addEventListener('click', () => {
      qi++;
      if (qi >= tasks.length) { end(true); return; }
      tries = 0; feedback = ''; solved = false; wrong = new Set();
      draw();
    });
  };

  const answer = (a) => {
    if (solved) return;
    const q = tasks[qi];
    if (tries > 0 && !run.tutorial) {
      if (run.gold < 1) return;
      run.gold -= 1;
      bump('stat-gold');
    }
    tries++;
    const right = q.options[a] === q.correct;
    merkeAntwort(run, 'artikel', right, tries === 1);
    if (right) {
      run.lernen.richtig++;
      solved = true;
      feedback = `✓ Richtig!${tries > 1 ? '' : ' Gleich beim ersten Versuch.'}`;
    } else {
      run.lernen.falsch++;
      wrong.add(a);
      feedback = `✗ ${q.explain}`;
    }
    save();
    draw();
  };

  draw();
}

function drawChoice(q, wrong, solved, broke) {
  return `
    <h2 class="enc-q">${q.prompt}</h2>
    <div class="row wrap">${q.options.map((o, i) => {
      const cls = q.genus ? 'genus-btn' : 'opt-btn';
      const style = q.genus ? `style="--genus:${GENUS[o].farbe}"` : '';
      const mark = solved && o === q.correct ? ' right' : '';
      return `<button class="btn ${cls}${mark}" data-i="${i}" ${style} ${wrong.has(i) || broke || solved ? 'disabled' : ''}>${o}</button>`;
    }).join('')}</div>`;
}

function giveUp(enc) {
  const card = openModal(`
    <div class="big-emoji">${figur(enc.id, 'enc-figur gross')}</div>
    <h2>Schade!</h2>
    <p>Diesmal gibt es keine Belohnung. Morgen triffst du wieder jemanden.</p>
    <div class="row"><button class="btn primary" data-ok>Weiter</button></div>`);
  card.querySelector('[data-ok]').onclick = () => finish(enc.id);
}

// ---------- Belohnungen ----------

// Neues Item in Rucksack oder Lager legen. Gibt es schon ein gleiches, verbindet es sich sofort
// (sobald das Fenster zu ist) – dann geht es auch, wenn kein Platz mehr frei ist.
function gewinn(id, extra = {}) {
  const p = placeNew(G.run, G.DEFS, id, null, extra);
  if (p) emit('neuesItem', { uid: p.uid });
  return p;
}

function reward(enc) {
  const run = G.run, b = enc.belohnung;
  let text = '';
  if (b.typ === 'feld') {
    const c = growBag(run);
    if (c) text = 'Dein Rucksack hat jetzt ein Feld mehr!';
    else { run.gold += 3; text = `Dein Rucksack ist schon riesig – dafür bekommst du 3 ${sym('gold')}.`; }
  } else if (b.typ === 'item') {
    const pool = shopPool(run, G.ITEMS, G.REGIONS).filter((d) => d.seltenheit === (b.seltenheit || 'selten'));
    const def = pickOne(pool);
    const p = def && gewinn(def.id);
    if (p) text = `Du bekommst ${nameAkk(def)}!${p.area === 'store' ? ' (im Lager)' : ''}`;
    else { run.gold += 3; text = `Kein Platz für ein Item – dafür bekommst du 3 ${sym('gold')}.`; }
  } else if (b.typ === 'gold') {
    run.gold += b.menge;
    text = `Du bekommst ${b.menge} ${sym('gold')}!`;
  } else if (b.typ === 'rabatt') {
    run.rabatt = (run.rabatt || 0) + RABATT.kaeufe;
    text = `Die nächsten ${RABATT.kaeufe} Käufe im Laden sind je ${RABATT.gold} ${sym('gold')} billiger!`;
  } else if (b.typ === 'mod') {
    run.mods.push(b.mod);
    text = `${b.mod.text}.`;
  }
  bump('stat-gold');
  showReward(enc, text);
}

function showReward(enc, text) {
  save();
  rerender();
  const card = openModal(`
    <div class="big-emoji">${sym('truhe', 'gross')}</div>
    <h2>Geschafft!</h2>
    <p>${text}</p>
    <p class="muted">${enc.name} winkt dir zum Abschied.</p>
    <div class="row"><button class="btn primary big" data-ok>Weiter</button></div>`);
  card.querySelector('[data-ok]').onclick = () => finish(enc.id);
}

// ---------- Zwielichtiger Kobold ----------

function kobold(enc) {
  const run = G.run;
  const entries = G.EXERCISES.kobold.filter((e) => G.DEFS[e.item]);
  if (!run.begegnung.kobold) { run.begegnung.kobold = pickOne(entries).item; save(); }
  const entry = entries.find((e) => e.item === run.begegnung.kobold) || entries[0];
  const def = G.DEFS[entry.item];
  const falscherName = entry.teile.join('');
  closeModal();
  const kopf = `<span class="af-wer">${figur(enc.id, 'af-wer-bild')}${enc.name}</span><span class="glowing" style="--glow:#a259d9">${iconHtml(def, 'ic small')}</span>`;
  frageImSpiel({ inhalt: koboldInhalt(entry, { rng: Math.random }), kopf, nein: 'Ich finde ihn nicht' }).then((r) => {
    const ok = !!r.richtig;
    const p = gewinn(def.id, ok ? {} : { fluch: falscherName });
    if (!p) { toast('Kein Platz im Rucksack – der Kobold zieht beleidigt ab.'); finish(enc.id); return; }
    if (ok) showReward(enc, `Name repariert! ${fullName(def)} ist jetzt ganz normal stark.`);
    else {
      save();
      rerender();
      const card = openModal(`
        <div class="big-emoji">${iconHtml(def, 'ic big')}</div>
        <h2>Hihi!</h2>
        <p>Du bekommst „${falscherName}“ – aber der Fehler im Namen macht es frech:
        Es kostet dich zu Beginn jedes Kampfes 2 Leben, solange es im Rucksack liegt.</p>
        <p class="feedback">Richtig wäre: ${entry.richtig}. ${entry.erklaerung}</p>
        <div class="row"><button class="btn primary" data-ok>Weiter</button></div>`);
      card.querySelector('[data-ok]').onclick = () => finish(enc.id);
    }
  });
}
