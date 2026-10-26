// Morgen: Begegnungen am Wegesrand mit kurzen Grammatik-Aufgaben (Inhalte aus encounters.json und exercises.json).
// Regeln für alle Aufgaben: erster Versuch kostenlos, jeder weitere 1 Gold, bei Fehlern eine kurze Erklärzeile.
import {
  pickEncounters, makeTask, koboldTask, growBag, shopPool, rarityWeights, pickWeighted, pickOne,
  canPlace, bagGrid, STORE_GRID,
} from './logic.js';
import { GENUS } from './grammar.js';
import { placeNew } from './sterne.js';
import { G, save, region, emit } from './state.js';
import { merkeAntwort } from './fortschritt.js';
import { openModal, closeModal, toast, bump, fullName, nameAkk, iconHtml } from './ui.js';

let done = null, rerender = null;
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
    <div class="enc-top">🌅 Morgen in ${region().name}</div>
    <h2>Wen triffst du am Wegesrand?</h2>
    <div class="enc-choices">${list.map((b) => `
      <button class="enc-choice" data-id="${b.id}">
        <span class="enc-emoji">${b.emoji}</span>
        <b>${b.name}</b>
        <span class="enc-reward">🎁 ${b.belohnung.text}</span>
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
    <div class="big-emoji">${enc.emoji}</div>
    <h2>${enc.name}</h2>
    <p class="enc-text">${enc.text}</p>
    <p class="enc-reward-line">🎁 Belohnung: <b>${enc.belohnung.text}</b></p>
    <div class="row">
      <button class="btn" data-back>Zurück</button>
      <button class="btn primary big" data-go>${enc.aufgabe.typ === 'tausch' ? 'Angebote ansehen' : 'Los geht’s'}</button>
    </div>`);
  const back = card.querySelector('[data-back]');
  if (los) back.remove();
  else back.onclick = () => runEncounter(done, rerender);
  card.querySelector('[data-go]').onclick = () => (los ? los() : startTask(enc));
}

function startTask(enc) {
  const typ = enc.aufgabe.typ;
  if (typ === 'tausch') { trade(enc); return; }
  if (typ === 'kobold') { kobold(enc); return; }
  const tasks = makeTask(enc.aufgabe, G.EXERCISES);
  runTasks(enc, tasks, (ok) => (ok ? reward(enc) : giveUp(enc)));
}

// ---------- Aufgaben ----------

// Arbeitet die Aufgaben nacheinander ab. end(true) wenn alle gelöst, end(false) beim Aufgeben.
function runTasks(enc, tasks, end, opts = {}) {
  const run = G.run;
  let qi = 0, tries = 0, feedback = '', solved = false;
  let wrong = new Set();

  const draw = () => {
    const q = tasks[qi];
    const paid = tries > 0 && !run.tutorial;
    const broke = paid && run.gold < 1 && !solved;
    const body = q.tap ? drawTap(q, wrong, solved) : drawChoice(q, wrong, solved, broke);
    const card = openModal(`
      <div class="enc-mini">${enc.emoji} ${enc.name}</div>
      ${tasks.length > 1 ? `<p class="enc-progress">Aufgabe ${qi + 1} von ${tasks.length}</p>` : ''}
      ${opts.vorher || ''}
      ${q.tap ? `<p class="enc-hint">${opts.tapHint || 'Tippe auf das falsch geschriebene Wort.'}</p>` : ''}
      ${body}
      <p class="cost">${solved ? '' : paid ? `Jeder weitere Versuch kostet 1 🪙 · du hast ${run.gold} 🪙` : 'Erster Versuch kostenlos'}</p>
      ${feedback ? `<p class="feedback ${solved ? 'good' : ''}">${feedback}</p>` : ''}
      ${broke ? '<p class="feedback">Kein Gold für einen weiteren Versuch.</p>' : ''}
      <div class="row">${solved
        ? `<button class="btn primary big" data-next>${qi + 1 < tasks.length ? 'Nächste Aufgabe' : 'Weiter'}</button>`
        : `<button class="btn small" data-give>${opts.giveText || 'Aufgeben'}</button>`}</div>`);
    card.querySelectorAll('[data-i]').forEach((b) => { b.onclick = () => answer(+b.dataset.i); });
    card.querySelectorAll('[data-tok]').forEach((b) => { b.onclick = () => answer(b.dataset.tok); });
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
    const right = q.tap ? a === `${q.ziel.zeile}:${q.ziel.wort}` : q.options[a] === q.correct;
    merkeAntwort(run, q.regel || 'rechtschreibung', right, tries === 1);
    if (right) {
      run.lernen.richtig++;
      solved = true;
      feedback = q.tap
        ? `✓ Richtig! „${q.ziel.falsch}“ schreibt man „${q.ziel.richtig}“. ${q.explain}`
        : `✓ Richtig!${tries > 1 ? '' : ' Gleich beim ersten Versuch.'}`;
    } else {
      run.lernen.falsch++;
      wrong.add(a);
      if (q.tap) {
        const [li, ti] = String(a).split(':').map(Number);
        feedback = `✗ „${q.zeilen[li][ti]}“ ist richtig geschrieben. Such weiter!`;
      } else {
        feedback = `✗ ${q.explain}`;
      }
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

function drawTap(q, wrong, solved) {
  return `<div class="tap-card ${q.zeilen.length === 1 ? 'one-word' : ''}">${q.zeilen.map((tokens, li) => `
    <div class="tap-line">${tokens.map((t, ti) => {
      const key = `${li}:${ti}`;
      const isZiel = solved && li === q.ziel.zeile && ti === q.ziel.wort;
      return `<button class="tap-word${wrong.has(key) ? ' wrong' : ''}${isZiel ? ' right' : ''}" data-tok="${key}" ${solved ? 'disabled' : ''}>${isZiel ? q.ziel.richtig : t}</button>`;
    }).join(q.zeilen.length === 1 ? '<span class="tap-join">·</span>' : ' ')}</div>`).join('')}
  </div>`;
}

function giveUp(enc) {
  const card = openModal(`
    <div class="big-emoji">${enc.emoji}</div>
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
    if (c) text = 'Dein Rucksack hat jetzt ein Feld mehr! 🧵';
    else { run.gold += 3; text = 'Dein Rucksack ist schon riesig – dafür bekommst du 3 🪙.'; }
  } else if (b.typ === 'item') {
    const pool = shopPool(run, G.ITEMS, G.REGIONS).filter((d) => d.seltenheit === (b.seltenheit || 'selten'));
    const def = pickOne(pool);
    const p = def && gewinn(def.id);
    if (p) text = `Du bekommst ${nameAkk(def)} ${def.emoji}!${p.area === 'store' ? ' (im Lager)' : ''}`;
    else { run.gold += 3; text = 'Kein Platz für ein Item – dafür bekommst du 3 🪙.'; }
  } else if (b.typ === 'gold') {
    run.gold += b.menge;
    text = `Du bekommst ${b.menge} 🪙!`;
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
    <div class="big-emoji">🎁</div>
    <h2>Geschafft!</h2>
    <p>${text}</p>
    <p class="muted">${enc.name} winkt dir zum Abschied.</p>
    <div class="row"><button class="btn primary big" data-ok>Weiter</button></div>`);
  card.querySelector('[data-ok]').onclick = () => finish(enc.id);
}

// ---------- Fahrender Händler ----------

function trade(enc) {
  const run = G.run;
  if (!run.begegnung.angebote) {
    const pool = shopPool(run, G.ITEMS, G.REGIONS).filter((d) => d.art !== 'tasche');
    const w = rarityWeights(run.day + 2);
    run.begegnung.angebote = [];
    while (run.begegnung.angebote.length < (enc.aufgabe.angebote || 3)) {
      const rar = pickWeighted(Object.entries(w).filter(([r]) => pool.some((d) => d.seltenheit === r)));
      const def = pickOne(pool.filter((d) => d.seltenheit === rar && !run.begegnung.angebote.includes(d.id)));
      if (def) run.begegnung.angebote.push(def.id);
    }
    save();
  }
  const offers = run.begegnung.angebote.map((id) => G.DEFS[id]);
  const card = openModal(`
    <div class="enc-mini">${enc.emoji} ${enc.name}</div>
    <h2>Welches Angebot möchtest du?</h2>
    <div class="enc-choices">${offers.map((d) => `
      <button class="enc-choice" data-id="${d.id}">
        <span class="enc-emoji">${iconHtml(d)}</span><b>${fullName(d)}</b>
        <span class="enc-reward" style="color:${G.RAR[d.seltenheit]?.farbe}">${G.RAR[d.seltenheit]?.name} · ${d.w}×${d.h}</span>
      </button>`).join('')}
    </div>
    <div class="row"><button class="btn small" data-no>Doch nicht tauschen</button></div>`, 'wide');
  card.querySelectorAll('[data-id]').forEach((b) => { b.onclick = () => chooseOwn(enc, G.DEFS[b.dataset.id]); });
  card.querySelector('[data-no]').onclick = () => finish(enc.id);
}

function chooseOwn(enc, newDef) {
  const own = G.run.items;
  const card = openModal(`
    <div class="enc-mini">${enc.emoji} ${enc.name}</div>
    <h2>Was gibst du dafür?</h2>
    <p>Du bekommst ${nameAkk(newDef)} ${newDef.emoji}.</p>
    <div class="own-items">${own.length ? own.map((p) => {
      const d = G.DEFS[p.id];
      return `<button class="own-item" data-uid="${p.uid}">${iconHtml(d, 'ic small') || '🔷'} ${d.art === 'siegel' ? `Siegel „${d.name}“` : d.name}<small>${p.area === 'bag' ? 'Rucksack' : 'Lager'}</small></button>`;
    }).join('') : '<p class="muted">Du hast noch keine Items zum Tauschen.</p>'}</div>
    <div class="row"><button class="btn small" data-back>Zurück</button></div>`, 'wide');
  card.querySelectorAll('[data-uid]').forEach((b) => { b.onclick = () => swap(enc, +b.dataset.uid, newDef); });
  card.querySelector('[data-back]').onclick = () => trade(enc);
}

function swap(enc, uid, newDef) {
  const run = G.run;
  const old = run.items.find((p) => p.uid === uid);
  const oldDef = G.DEFS[old.id];
  run.items = run.items.filter((p) => p !== old);
  const grid = old.area === 'bag' ? bagGrid(run) : STORE_GRID;
  const same = run.items.filter((p) => p.area === old.area);
  let placed = null;
  for (const rot of [old.rot || 0, 0, 1]) {
    if (canPlace(same, G.DEFS, newDef, old.x, old.y, rot, grid)) {
      placed = { uid: run.nextUid++, id: newDef.id, area: old.area, x: old.x, y: old.y, rot };
      run.items.push(placed);
      emit('neuesItem', { uid: placed.uid });
      break;
    }
  }
  if (!placed) placed = gewinn(newDef.id);
  if (!placed) {
    run.items.push(old);
    toast('Dafür ist kein Platz – wähle ein größeres Item zum Tauschen.');
    return;
  }
  showReward(enc, `Du hast ${nameAkk(oldDef)} gegen ${nameAkk(newDef)} ${newDef.emoji} getauscht.`);
}

// ---------- Zwielichtiger Kobold ----------

function kobold(enc) {
  const run = G.run;
  const entries = G.EXERCISES.kobold.filter((e) => G.DEFS[e.item]);
  if (!run.begegnung.kobold) { run.begegnung.kobold = pickOne(entries).item; save(); }
  const entry = entries.find((e) => e.item === run.begegnung.kobold) || entries[0];
  const def = G.DEFS[entry.item];
  const task = koboldTask(entry);
  const vorher = `<div class="kobold-gift"><span class="big-emoji glowing" style="--glow:#a259d9">${iconHtml(def, 'ic big')}${def.abzeichen ? `<em>${def.abzeichen}</em>` : ''}</span></div>`;
  runTasks(enc, [task], (ok) => {
    const p = gewinn(def.id, ok ? {} : { fluch: task.falscherName });
    if (!p) { toast('Kein Platz im Rucksack – der Kobold zieht beleidigt ab.'); finish(enc.id); return; }
    if (ok) showReward(enc, `Fehler gefunden! ${fullName(def)} ${def.emoji} ist jetzt ganz normal stark.`);
    else {
      save();
      rerender();
      const card = openModal(`
        <div class="big-emoji">😈</div>
        <h2>Hihi!</h2>
        <p>Du bekommst „${task.falscherName}“ ${def.emoji} – aber der Fehler im Namen macht es frech:
        Es kostet dich zu Beginn jedes Kampfes 2 Leben, solange es im Rucksack liegt.</p>
        <p class="feedback">Richtig wäre: ${task.richtig}. ${task.explain}</p>
        <div class="row"><button class="btn primary" data-ok>Weiter</button></div>`);
      card.querySelector('[data-ok]').onclick = () => finish(enc.id);
    }
  }, { vorher, tapHint: 'In welchem Wortteil steckt der Fehler? Tippe ihn an.', giveText: 'Ich finde ihn nicht' });
}
