// Spielt das Tutorial „Der erste Tag“ auf Zustandsebene komplett durch (Aktionen werden simuliert)
// und prüft: jeder Schritt ist erreichbar, falsche Aktionen werden zurückgesetzt, fehlende Funktionen
// werden übersprungen, danach startet ein normaler Lauf ohne Tutorial-Reste.
// Den Durchlauf in der echten Oberfläche prüft tools/tutorial-browsertest.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FEATURES, activeSteps, makeTutorialRun, applyShop, prepareStep, checkStep, resetWrong, targetCell, spotFor, sichereLaden, ladenZiel,
} from '../js/tutorial-logic.js';
import { newRun, seededRng } from '../js/logic.js';
import { buildCompounds, buildRuneLevels, analyze, DIRS } from '../js/grammar.js';
import { makeFighter, Battle, runToEnd } from '../js/battle.js';
import { verbindeAlles } from '../js/sterne.js';

const json = (f) => JSON.parse(readFileSync(new URL('../' + f, import.meta.url)));
const TUT = json('tutorial.json');
const ITEMS = json('items.json').items;
const REGIONS = json('regions.json').gebiete;
const RECIPES = json('recipes.json');
const ENEMIES = json('enemies.json').gegner;
const DEFS = Object.fromEntries(ITEMS.map((d) => [d.id, d]));
for (const d of buildCompounds(DEFS, RECIPES)) DEFS[d.id] = d;
for (const d of buildRuneLevels(DEFS)) DEFS[d.id] = d;

const bag = (run) => run.items.filter((p) => p.area === 'bag');
const findItem = (run, id) => run.items.find((p) => p.id === id);

// Wie ein Kind: Item aus dem Laden kaufen und an eine Stelle legen.
function buyTo(run, id, area, spot) {
  const slot = run.shop.findIndex((s) => s?.id === id);
  assert.ok(slot >= 0, `${id} liegt im Laden`);
  assert.ok(run.gold >= DEFS[id].preis, `genug Gold für ${id}`);
  run.gold -= DEFS[id].preis;
  run.shop[slot] = null;
  const p = { uid: run.nextUid++, id, area, rot: 0, ...spot };
  run.items.push(p);
  return p;
}

// Rune drehen, bis der Pfeil auf das Ziel zeigt.
function pointRune(run, rune, zielId) {
  for (let r = 0; r < 4; r++) {
    rune.rot = r;
    const z = findItem(run, zielId);
    if (analyze(bag(run), DEFS).get(z.uid).adjektive.length) return true;
  }
  return false;
}

// Führt die Aktion eines Schritts aus und gibt das Ereignis zurück.
function act(step, run) {
  const a = step.aktion;
  switch (a.typ) {
    case 'kaufen': buyTo(run, a.item, a.bereich, spotFor(run, DEFS, a.item)); return null;
    case 'antippen': return { typ: 'auswahl', id: findItem(run, a.item).id };
    case 'drehen': findItem(run, a.item).rot = 1; return { typ: 'drehen', id: a.item };
    case 'neben': {
      const c = targetCell(run, DEFS, `links-von:${a.traeger}`);
      assert.ok(c, 'links neben dem Schwert ist Platz');
      buyTo(run, a.kraft, 'bag', c);
      return null;
    }
    case 'verschmelzen': {
      // Der Kristall liegt links neben dem Schwert: Das Spiel fragt sofort nach dem Artikel.
      const log = verbindeAlles(run, DEFS, RECIPES, [{ uid: findItem(run, 'feuer').uid }]);
      assert.deepEqual(log.map((l) => [l.typ, l.id]), [['kompositum', a.ergebnis]]);
      return null;
    }
    case 'siegel': buyTo(run, a.siegel, 'bag', targetCell(run, DEFS, `neben:${a.ziel}`)); return null;
    case 'rune': {
      const r = buyTo(run, a.rune, 'bag', targetCell(run, DEFS, `neben:${a.ziel}`));
      assert.ok(pointRune(run, r, a.ziel), 'Rune lässt sich auf das Feuerschwert drehen');
      return null;
    }
    case 'anzahl': buyTo(run, a.item, 'bag', spotFor(run, DEFS, a.item)); return null;
    case 'zeigt': {
      const r = run.items.find((p) => p.id === a.verb);
      for (let rot = 0; rot < 4; rot++) {
        r.rot = rot;
        if (analyze(bag(run), DEFS).get(r.uid).verb?.subjekt?.id === a.ziel) return null;
      }
      assert.fail('Rolle lässt sich auf das Ziel drehen');
      return null;
    }
    case 'ereignis':
      if (a.name === 'verschmolzen') {
        // Das Spiel stellt die Mehrzahl-Frage; richtig beantwortet verbinden sich beide Dolche.
        const neu = run.items.filter((p) => p.id === 'dolch').at(-1);
        assert.equal(verbindeAlles(run, DEFS, RECIPES, [{ uid: neu.uid, paar: true }]).length, 1);
        return { typ: a.name };
      }
      if (a.name === 'satz') {
        const r = run.items.find((p) => p.id === 'schlagen');
        const v = analyze(bag(run), DEFS).get(r.uid).verb;
        r.satz = { uid: v.subjekt.uid, id: v.subjekt.id, stern: v.subjekt.stern, ok: true };
        return { typ: 'satz', ok: true };
      }
      return { typ: a.name };
    default: return null;
  }
}

test('tutorial.json: jeder Schritt hat id, kurzen Text und eine bekannte Aktion', () => {
  const typen = ['weiter', 'kaufen', 'antippen', 'drehen', 'neben', 'verschmelzen', 'siegel', 'runen', 'rune', 'ereignis', 'abschluss', 'anzahl', 'zeigt'];
  const ids = new Set();
  for (const s of TUT.schritte) {
    assert.ok(s.id && !ids.has(s.id), `doppelte oder fehlende id ${s.id}`);
    ids.add(s.id);
    assert.ok(typen.includes(s.aktion.typ), `${s.id}: ${s.aktion.typ}`);
    const saetze = s.text.split(/[.!?](?:\s|$)/).filter((x) => x.trim()).length;
    assert.ok(saetze <= 2, `${s.id}: höchstens zwei Sätze (${saetze})`);
    assert.ok(Array.isArray(s.ziel), s.id);
    for (const id of s.laden || []) assert.ok(DEFS[id], `${s.id}: Item ${id} fehlt`);
  }
  assert.equal(TUT.schritte.at(-1).aktion.typ, 'abschluss');
  assert.ok(ENEMIES.find((e) => e.id === TUT.uebungsgegner && e.uebung));
});

test('Tutorial komplett durchspielen: jeder Schritt ist erreichbar', () => {
  const steps = activeSteps(TUT);
  const run = makeTutorialRun(ITEMS, REGIONS, TUT);
  assert.equal(run.tutorial, true);
  assert.equal(run.items.length, 0);
  const geschafft = [];
  for (const step of steps) {
    applyShop(run, step);
    prepareStep(run, step, DEFS);
    if (['weiter', 'abschluss'].includes(step.aktion.typ)) { geschafft.push(step.id); continue; }
    assert.equal(checkStep(step, run, DEFS, RECIPES, null)?.ok, undefined, `${step.id} ist nicht schon vorher geschafft`);
    const ev = act(step, run);
    assert.equal(checkStep(step, run, DEFS, RECIPES, ev)?.ok, true, `${step.id} wird geschafft`);
    geschafft.push(step.id);

    if (step.id === 'kampf-starten' || step.id === 'kampf2-starten') {
      // Übungskampf gegen den Strohpuppen-Ork: sicherer Sieg
      const ork = ENEMIES.find((e) => e.id === TUT.uebungsgegner);
      const items = ork.ausruestung.map((a, i) => ({ uid: i + 1, rot: 0, ...a }));
      const b = new Battle(
        makeFighter('Du', bag(run), DEFS, 1, { rng: seededRng(TUT.start.zufall) }),
        makeFighter(ork.name, items, DEFS, 1, { rng: seededRng(TUT.start.zufall) }),
      );
      assert.equal(runToEnd(b), 'win', 'Übungskampf ist ein sicherer Sieg');
    }
  }
  assert.deepEqual(geschafft, steps.map((s) => s.id));
  // Zweiter Tag: ★★-Dolch, Satz mit Subjekt
  assert.ok(run.items.some((p) => p.id === 'dolch' && p.stern === 2), '★★-Dolch entstanden');
  const rolle = run.items.find((p) => p.id === 'schlagen');
  assert.equal(analyze(bag(run), DEFS).get(rolle.uid).verb.status, 'ok');
  // Am Ende: scharfes Feuerschwert mit Siegel
  const fs = findItem(run, 'feuer+schwert');
  const i = analyze(bag(run), DEFS).get(fs.uid);
  assert.equal(i.phrase, 'scharfes Feuerschwert');
  assert.ok(i.siegel.some((s) => s.ok));
});

test('Fester Laden: Bei jedem Schritt mit Laden-Ziel liegt das Item im Laden – auch nach Neu würfeln oder fremdem Laden', () => {
  const steps = activeSteps(TUT);
  const run = makeTutorialRun(ITEMS, REGIONS, TUT);
  let geprueft = 0;
  for (const step of steps) {
    // Störung: ein zufälliger Laden wie nach „Neu würfeln“ oder aus einem gespeicherten Lauf
    run.shop = [{ id: 'apfel', locked: false }, { id: 'helm', locked: false }, null, { id: 'bogen', locked: false }, { id: 'brot', locked: false }];
    applyShop(run, step);
    sichereLaden(run, step);
    prepareStep(run, step, DEFS);
    const ziel = ladenZiel(step);
    if (ziel && !run.items.some((p) => p.id === ziel)) {
      assert.ok(run.shop.some((s) => s?.id === ziel), `${step.id}: ${ziel} liegt im Laden`);
      geprueft++;
    }
    if (['weiter', 'abschluss'].includes(step.aktion.typ)) continue;
    const ev = act(step, run);
    assert.equal(checkStep(step, run, DEFS, RECIPES, ev)?.ok, true, `${step.id} wird geschafft`);
  }
  assert.ok(geprueft >= 4, `${geprueft} Schritte mit Laden-Ziel`);
});

test('Falsche Aktion: Schwert im Lager wird freundlich zurückgesetzt', () => {
  const run = makeTutorialRun(ITEMS, REGIONS, TUT);
  const step = TUT.schritte.find((s) => s.id === 'kaufen');
  applyShop(run, TUT.schritte.find((s) => s.id === 'gold-laden'));
  const gold = run.gold;
  buyTo(run, 'schwert', 'store', { x: 0, y: 0 });
  const r = checkStep(step, run, DEFS, RECIPES);
  assert.match(r.falsch.text, /nicht ins Lager/);
  assert.equal(r.falsch.zuruecksetzen, true);
  resetWrong(run, r.falsch, DEFS);
  assert.equal(run.items.length, 0);
  assert.equal(run.gold, gold, 'Gold zurück');
  assert.equal(run.shop.filter(Boolean)[0].id, 'schwert', 'Schwert wieder im Laden');

  // Feuer rechts statt links: Hinweis ohne Strafe
  const k = TUT.schritte.find((s) => s.id === 'kristall');
  run.items = [{ uid: 1, id: 'schwert', area: 'bag', x: 1, y: 0, rot: 0 }, { uid: 2, id: 'feuer', area: 'bag', x: 2, y: 0, rot: 0 }];
  assert.match(checkStep(k, run, DEFS, RECIPES).falsch.text, /links neben/);
});

test('Kein Platz links vom Schwert: Vorbereitung schiebt es zur Seite', () => {
  const run = makeTutorialRun(ITEMS, REGIONS, TUT);
  run.items = [{ uid: 1, id: 'schwert', area: 'bag', x: 0, y: 0, rot: 1 }];
  const k = TUT.schritte.find((s) => s.id === 'kristall');
  assert.equal(prepareStep(run, k, DEFS), true);
  assert.ok(targetCell(run, DEFS, 'links-von:schwert'));
});

test('Schritte für fehlende Funktionen werden übersprungen', () => {
  const ohne = activeSteps(TUT, new Set());
  assert.ok(!ohne.some((s) => s.voraussetzung), 'ohne Funktionen nur Schritte ohne Voraussetzung');
  const jetzt = activeSteps(TUT).map((s) => s.id);
  assert.ok(jetzt.includes('begegnung'), 'Begegnungen gibt es schon');
  assert.ok(jetzt.includes('buch') && jetzt.includes('heldencode'), 'Buch der Wörter und Heldencode sind jetzt dabei');
  assert.equal(jetzt.length, TUT.schritte.length, 'alle vorbereiteten Schritte sind aktiv');
  const ohneBuch = activeSteps(TUT, new Set([...FEATURES].filter((f) => f !== 'buch'))).map((s) => s.id);
  assert.ok(!ohneBuch.includes('buch') && !ohneBuch.includes('buch-seite'));
});

test('Nach dem Tutorial startet ein normaler Lauf ohne Tutorial-Reste', () => {
  const run = newRun(ITEMS, REGIONS, { hero: json('heroes.json').helden[0], fates: json('heroes.json').schicksalsrunen });
  assert.equal(run.tutorial, undefined);
  assert.equal(run.gold, 12);
  assert.ok(run.shop.filter(Boolean).length >= 5, 'voller Laden (6 Plätze mit der Rune des Marktes)');
  assert.ok(run.queue.includes('gebiet'));
});

test('So geht\'s und Erste-Mal-Tipps: Inhalte aus tutorial.json', () => {
  const karten = activeSteps(TUT).filter((s) => s.hilfe).map((s) => s.hilfe.titel);
  for (const t of ['Kaufen', 'Drehen', 'Lager', 'Verschmelzen', 'Artikel-Siegel', 'Adjektiv-Runen', 'Kampf', 'Herzen und Siege', 'Begegnungen', 'Buch der Wörter', 'Heldencode']) {
    assert.ok(karten.includes(t), `Hilfe-Karte ${t}`);
  }
  for (const s of TUT.schritte.filter((x) => x.hilfe)) assert.ok(s.hilfe.emoji && s.hilfe.text, s.id);
  for (const k of ['boss', 'gebiet', 'steigerung', 'unterklasse']) assert.ok(TUT.tipps[k], `Tipp ${k}`);
});
