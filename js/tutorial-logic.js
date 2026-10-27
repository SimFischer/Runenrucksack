// Tutorial „Der erste Tag“ ohne Darstellung: welche Schritte gelten, ob ein Schritt geschafft ist,
// freundliches Zurücksetzen bei falschen Aktionen. Wird von js/tutorial.js und den Tests benutzt.
import { newRun, findSpot, canPlace, bagGrid, sizeOf, STORE_GRID } from './logic.js';
import { analyze, findFusions, verbTargetCell } from './grammar.js';

// Funktionen, die es im Spiel gibt. Schritte mit einer fehlenden voraussetzung werden übersprungen.
export const FEATURES = new Set(['begegnungen', 'verschmelzen', 'siegel', 'runen', 'steigerung', 'unterklasse', 'taschen', 'buch', 'heldencode', 'haendler']);

export function activeSteps(data, features = FEATURES) {
  return data.schritte.filter((s) => !s.voraussetzung || features.has(s.voraussetzung));
}

// Ein echter Lauf, aber festgelegt: leerer Rucksack, fester Laden, kein Speichern.
export function makeTutorialRun(items, regions, data) {
  const run = newRun(items, regions, {});
  run.tutorial = true;
  run.gold = data.start.gold;
  run.items = [];
  run.queue = [];
  run.shop = [];
  return run;
}

// Fester Laden-Inhalt für einen Schritt: die genannten Items, die übrigen Plätze leer.
export function applyShop(run, step, slots = 5) {
  if (!step.laden) return;
  run.shop = Array.from({ length: slots }, (_, i) => (step.laden[i] ? { id: step.laden[i], locked: false } : null));
}

// Welches Item muss für diesen Schritt im Laden liegen? (Kaufen, Kristall, Siegel, Rune, Sammeln)
export function ladenZiel(step) {
  const a = step.aktion || {};
  if (a.typ === 'kaufen' || a.typ === 'anzahl') return a.item;
  if (a.typ === 'neben') return a.kraft;
  if (a.typ === 'siegel') return a.siegel;
  if (a.typ === 'rune') return a.rune;
  return null;
}

// Sorgt dafür, dass das Ziel-Item eines Schritts im Laden liegt – egal, was vorher mit dem Laden passiert ist
// (Neustart, gespeicherter Lauf, Neu würfeln). Liegt es schon im Rucksack oder Lager (bei „anzahl“: genug), nichts tun.
// Gibt true zurück, wenn der Laden geändert wurde.
export function sichereLaden(run, step, slots = 5) {
  const id = ladenZiel(step);
  if (!id) return false;
  const besitz = run.items.filter((p) => p.id === id && p.area !== 'neu').length;
  if (step.aktion.typ === 'anzahl' ? besitz >= (step.aktion.min || 1) : besitz > 0) return false;
  if (run.shop.some((s) => s?.id === id)) return false;
  while (run.shop.length < slots) run.shop.push(null);
  const frei = run.shop.findIndex((s) => !s);
  run.shop[frei >= 0 ? frei : 0] = { id, locked: false };
  return true;
}

const baseId = (id, defs) => defs[id]?.teile?.traeger || id;
const bagItems = (run) => run.items.filter((p) => p.area === 'bag');
const find = (run, id, area) => run.items.find((p) => p.id === id && (!area || p.area === area));

// Vorbereitung eines Schritts, z. B. Platz links neben dem Schwert schaffen.
export function prepareStep(run, step, defs) {
  const v = step.vorbereitung || {};
  // Geschenke von Fenwick in einen bestimmten Bereich legen
  for (const g of v.geschenk || []) {
    const area = g.bereich || 'bag';
    const grid = area === 'bag' ? bagGrid(run) : STORE_GRID;
    const spot = findSpot(run.items.filter((p) => p.area === area), defs, defs[g.id], grid);
    if (spot) run.items.push({ uid: run.nextUid++, id: g.id, area, ...spot });
  }
  if (v.rolleFuer) placeRole(run, v.rolleFuer, defs);
  const id = v.platzLinksVon;
  if (!id) return false;
  const t = run.items.find((p) => baseId(p.id, defs) === id && p.area === 'bag');
  if (!t) return false;
  const grid = bagGrid(run);
  const others = bagItems(run).filter((p) => p !== t);
  const leftFree = (x, y, rot) => {
    const s = sizeOf(defs[t.id], rot);
    for (let dy = 0; dy < s.h; dy++) if (canPlace(others, defs, defs.feuer || { w: 1, h: 1 }, x - 1, y + dy, 0, grid)) return true;
    return false;
  };
  if (leftFree(t.x, t.y, t.rot)) return false;
  // Schwert so verschieben, dass links ein Feld frei ist.
  for (let y = 0; y < grid.rows; y++)
    for (let x = 1; x < grid.cols; x++)
      if (canPlace(others, defs, defs[t.id], x, y, t.rot, grid) && leftFree(x, y, t.rot)) {
        Object.assign(t, { x, y });
        return true;
      }
  return false;
}

// Verb-Rolle so neben ein Nomen legen, dass ihr Pfeil durch Drehen auf das Nomen zeigen kann –
// zu Beginn zeigt er genau in die Gegenrichtung. Auf dem Weg dorthin darf der Pfeil auf keinen anderen
// Gegenstand zeigen (sonst käme eine Frage zum falschen Gegenstand). Steht etwas im Weg, kommt es ins Lager.
function placeRole(run, { verb, ziel }, defs) {
  if (run.items.some((p) => p.id === verb)) return;
  const t = run.items.find((p) => p.id === ziel && p.area === 'bag');
  if (!t) return;
  const grid = bagGrid(run);
  const ts = sizeOf(defs[t.id], t.rot);
  const hits = (c) => c.x >= t.x && c.x < t.x + ts.w && c.y >= t.y && c.y < t.y + ts.h;
  const versuche = (erlaubeHindernis) => {
    const bag = run.items.filter((p) => p.area === 'bag');
    for (const rot of [0, 2, 1, 3])
      for (let y = 0; y < grid.rows; y++)
        for (let x = 0; x < grid.cols; x++) {
          if (!canPlace(bag, defs, defs[verb], x, y, rot, grid) || !hits(verbTargetCell({ x, y, rot }, defs[verb]))) continue;
          // Die drei anderen Richtungen: Wer liegt dort?
          const hindernisse = [1, 2, 3].map((d) => verbTargetCell({ x, y, rot: (rot + d) % 4 }, defs[verb]))
            .map((c) => bag.find((p) => p !== t && belegt(p, defs, c))).filter(Boolean);
          if (hindernisse.length && !erlaubeHindernis) continue;
          return { x, y, rot, hindernisse };
        }
    return null;
  };
  const platz = versuche(false) || versuche(true);
  if (!platz) return;
  for (const p of platz.hindernisse) insLager(run, p, defs);
  run.items.push({ uid: run.nextUid++, id: verb, area: 'bag', x: platz.x, y: platz.y, rot: (platz.rot + 2) % 4 });
}

const belegt = (p, defs, c) => { const s = sizeOf(defs[p.id], p.rot); return c.x >= p.x && c.x < p.x + s.w && c.y >= p.y && c.y < p.y + s.h; };
function insLager(run, p, defs) {
  const spot = findSpot(run.items.filter((q) => q.area === 'store'), defs, defs[p.id], STORE_GRID);
  if (spot) Object.assign(p, { area: 'store', ...spot });
}

// Was darf im Tutorial gerade ausgelöst werden? Verbindungen, Verschmelzungen und Verb-Fragen nur für den
// Ziel-Gegenstand des aktuellen Schritts (oder des Schritts direkt davor, z. B. „verb“ → „verb-frage“).
// art: 'kompositum' { kraft, traeger } | 'paar' { id } | 'verb' { verb, subjekt }
export function tutorialErlaubt(steps, idx, art, info, defs) {
  const fenster = [steps[idx - 1], steps[idx]].filter(Boolean).map((x) => x.aktion || {});
  const basis = (id) => baseId(id, defs);
  if (art === 'kompositum') return fenster.some((a) => (a.typ === 'neben' && a.kraft === info.kraft && a.traeger === basis(info.traeger))
    || (a.typ === 'verschmelzen' && a.ergebnis === `${info.kraft}+${basis(info.traeger)}`));
  if (art === 'paar') return fenster.some((a) => a.typ === 'anzahl' && a.item === basis(info.id));
  if (art === 'verb') return fenster.some((a) => a.typ === 'zeigt' && a.verb === info.verb && a.ziel === info.subjekt);
  return true;
}

// Nach einer abgebrochenen Aufgabe: zurück zum Schritt, in dem man handelt (kaufen, legen, drehen …).
// Wartet der aktuelle Schritt nur auf das Ergebnis der Aufgabe (z. B. „verb-frage“), ist das der Schritt davor.
const HANDELN = ['kaufen', 'neben', 'verschmelzen', 'siegel', 'rune', 'anzahl', 'zeigt', 'drehen', 'antippen'];
export function schrittNachAbbruch(steps, idx) {
  if (HANDELN.includes(steps[idx]?.aktion?.typ)) {
    // „verschmelzen“ wartet auf die Frage, gehandelt wird im Schritt davor (Kristall legen)
    if (steps[idx].aktion.typ === 'verschmelzen' && steps[idx - 1]?.aktion?.typ === 'neben') return idx - 1;
    return idx;
  }
  return HANDELN.includes(steps[idx - 1]?.aktion?.typ) ? idx - 1 : idx;
}

// Eine abgebrochene Aufgabe: Der neue Gegenstand geht zurück in den Laden (Gold zurück), der Schritt beginnt neu.
export function zurueckInLaden(run, p, defs) {
  run.items = run.items.filter((i) => i !== p);
  run.gold += defs[p.id].preis;
  const free = run.shop.findIndex((x) => !x);
  run.shop[free >= 0 ? free : 0] = { id: p.id, locked: false };
}

// Prüft einen Schritt. ev: letztes Ereignis { typ, id } (z. B. auswahl, drehen, kampfStart).
// Ergebnis: { ok: true } | { falsch: Regel } | null (noch nicht geschafft).
export function checkStep(step, run, defs, recipes, ev = null) {
  const a = step.aktion;
  let ok = false;
  switch (a.typ) {
    case 'kaufen':
      ok = !!find(run, a.item, a.bereich);
      break;
    case 'antippen':
      ok = ev?.typ === 'auswahl' && baseId(ev.id, defs) === a.item;
      break;
    case 'drehen':
      ok = ev?.typ === 'drehen' && baseId(ev.id, defs) === a.item;
      break;
    case 'neben':
      ok = findFusions(bagItems(run), defs, recipes).some((f) => f.kraft.id === a.kraft && f.traeger.id === a.traeger);
      break;
    case 'verschmelzen': // das Kompositum entsteht sofort, sobald der Kristall richtig liegt
      ok = !!find(run, a.ergebnis, 'bag');
      break;
    case 'siegel': {
      const z = find(run, a.ziel, 'bag');
      ok = !!z && analyze(bagItems(run), defs).get(z.uid).siegel.some((s) => s.ok && defs[find(run, a.siegel, 'bag')?.id]?.genus === s.genus);
      break;
    }
    case 'rune': {
      const z = find(run, a.ziel, 'bag');
      ok = !!z && analyze(bagItems(run), defs).get(z.uid).adjektive.some((r) => r.id === a.rune);
      break;
    }
    case 'ereignis':
      ok = ev?.typ === a.name && (a.ok === undefined || ev.ok === a.ok);
      break;
    case 'anzahl':
      ok = run.items.filter((p) => p.id === a.item && !p.stern).length >= a.min;
      break;
    case 'zeigt': {
      const r = run.items.find((p) => p.id === a.verb && p.area === 'bag');
      ok = !!r && analyze(bagItems(run), defs).get(r.uid).verb?.subjekt?.id === a.ziel;
      break;
    }
    default:
      ok = false;
  }
  if (ok) return { ok: true };
  for (const rule of step.falsch || []) {
    if (find(run, rule.wenn.item, rule.wenn.bereich)) return { falsch: rule };
  }
  return null;
}

// Falsch abgelegtes Item freundlich zurück in den Laden legen (Gold zurück).
export function resetWrong(run, rule, defs) {
  const p = find(run, rule.wenn.item, rule.wenn.bereich);
  if (!p) return;
  run.items = run.items.filter((i) => i !== p);
  run.gold += defs[p.id].preis;
  const free = run.shop.findIndex((s) => !s);
  run.shop[free >= 0 ? free : 0] = { id: p.id, locked: false };
}

// Feld für die Hand-Animation: links neben einem Item oder ein freies Nachbarfeld.
export function targetCell(run, defs, spec) {
  const [art, id] = spec.split(':');
  if (!id) return null;
  const t = run.items.find((p) => p.area === 'bag' && (p.id === id || baseId(p.id, defs) === id));
  if (!t) return null;
  const s = sizeOf(defs[t.id], t.rot);
  const grid = bagGrid(run);
  const occupied = new Set();
  for (const p of bagItems(run)) {
    const ps = sizeOf(defs[p.id], p.rot);
    for (let dy = 0; dy < ps.h; dy++) for (let dx = 0; dx < ps.w; dx++) occupied.add(`${p.x + dx},${p.y + dy}`);
  }
  const free = (x, y) => x >= 0 && y >= 0 && x < grid.cols && y < grid.rows && grid.mask.has(`${x},${y}`) && !occupied.has(`${x},${y}`);
  const cands = [];
  if (art === 'links-von') for (let dy = 0; dy < s.h; dy++) cands.push([t.x - 1, t.y + dy]);
  if (art === 'neben') {
    for (let dy = 0; dy < s.h; dy++) cands.push([t.x - 1, t.y + dy], [t.x + s.w, t.y + dy]);
    for (let dx = 0; dx < s.w; dx++) cands.push([t.x + dx, t.y - 1], [t.x + dx, t.y + s.h]);
  }
  const c = cands.find(([x, y]) => free(x, y));
  return c ? { x: c[0], y: c[1] } : null;
}

// Für Tests: freien Platz für ein Item finden, das ein Kind in den Rucksack zieht.
export const spotFor = (run, defs, id) => findSpot(bagItems(run), defs, defs[id], bagGrid(run));
