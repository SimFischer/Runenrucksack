// Prüft Begegnungen und Aufgaben: Inhalte vollständig, genau eine richtige Lösung, Belohnungen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  newRun, growBag, bagGrid, pickEncounters, seededRng, addItem, preisVon, RABATT,
} from '../js/logic.js';
import { FORMATE } from '../js/aufgaben/formate/index.js';
import { mitRegeln, speisekarteInhalt, satzOrdnenInhalt, koboldInhalt } from '../js/aufgaben/themen.js';
import { waehleAufgabe } from '../js/aufgaben/wahl.js';
import { buildCompounds } from '../js/grammar.js';
import { playerContext } from '../js/mods.js';
import { makeFighter } from '../js/battle.js';

const json = (f) => JSON.parse(readFileSync(new URL('../' + f, import.meta.url)));
const ITEMS = json('items.json').items;
const REGIONS = json('regions.json').gebiete;
const ENC = json('encounters.json');
const EX = json('exercises.json');
const THEMEN = json('themen.json');
const WS = mitRegeln(json('wortschatz.json'), THEMEN);
const DEFS = Object.fromEntries(ITEMS.map((d) => [d.id, d]));
for (const c of buildCompounds(DEFS, json('recipes.json'))) DEFS[c.id] = c;

test('Mindestens sechs Begegnungen, jede mit eigenem Aufgabenformat und bekannter Belohnung', () => {
  const belohnungen = ['feld', 'item', 'gold', 'mod', 'rabatt', 'kobold'];
  assert.ok(ENC.begegnungen.length >= 6);
  for (const b of ENC.begegnungen) {
    assert.ok(['format', 'speisekarte', 'satzordnen', 'kobold'].includes(b.aufgabe.typ), b.id);
    if (b.aufgabe.typ === 'format') assert.ok(FORMATE[b.aufgabe.format], `${b.id}: Format ${b.aufgabe.format}`);
    assert.ok(belohnungen.includes(b.belohnung.typ), b.id);
    assert.ok(b.name && b.emoji && b.text && b.belohnung.text, b.id);
  }
  const format = (id) => ENC.begegnungen.find((b) => b.id === id).aufgabe.format;
  assert.equal(format('eule'), 'sortieren');
  assert.equal(format('zwerg'), 'baukasten');
  assert.equal(ENC.begegnungen.find((b) => b.id === 'hirtin').aufgabe.typ, 'satzordnen');
  assert.equal(format('haendler'), 'passtnicht');
  assert.equal(ENC.begegnungen.find((b) => b.id === 'haendler').belohnung.typ, 'rabatt');
  assert.equal(ENC.begegnungen.find((b) => b.id === 'wirtin').aufgabe.typ, 'speisekarte');
  assert.equal(ENC.begegnungen.find((b) => b.id === 'kobold').aufgabe.typ, 'kobold');
});

test('Begegnungs-Aufgaben lassen sich erzeugen und haben genau eine Lösung', () => {
  const rng = seededRng(7);
  for (const b of ENC.begegnungen.filter((x) => x.aufgabe.typ === 'format')) {
    for (let k = 0; k < 20; k++) {
      const run = {};
      const a = waehleAufgabe({ themen: THEMEN, ws: WS, profil: { lernstand: {} }, einst: null, run, rng, format: b.aufgabe.format });
      assert.equal(a.format, b.aufgabe.format, b.id);
      assert.ok(FORMATE[a.format].pruefe(a, FORMATE[a.format].loesung(a)).richtig, `${b.id}: Lösung muss richtig sein`);
    }
  }
  for (let k = 0; k < 30; k++) {
    const a = FORMATE.fehler.erzeuge(speisekarteInhalt({ ws: WS, rng, felder: [], benutzt: new Set() }), rng);
    assert.ok(a.ziele.length >= 2 && a.ziele.length <= 3, 'Speisekarte: 2–3 Fehler');
    assert.ok(FORMATE.fehler.pruefe(a, FORMATE.fehler.loesung(a)).richtig);
    assert.ok(['verlaengerung', 'doppel', 'ie', 'tzck', 'ableitung'].includes(a.thema), a.thema);
    const o = FORMATE.ordnen.erzeuge(satzOrdnenInhalt({ ws: WS, rng, felder: [], benutzt: new Set() }), rng);
    assert.equal(o.modus, 'reihenfolge');
    assert.ok(FORMATE.ordnen.pruefe(o, FORMATE.ordnen.loesung(o)).richtig);
  }
});

test('Händler-Rabatt: die nächsten Käufe billiger, mindestens 1 Gold, Taschen nicht', () => {
  const run = { rabatt: RABATT.kaeufe };
  assert.equal(preisVon(run, { preis: 5 }), 5 - RABATT.gold);
  assert.equal(preisVon(run, { preis: 2 }), 1);
  assert.equal(preisVon(run, { preis: 6, art: 'tasche' }), 6);
  assert.equal(preisVon({ rabatt: 0 }, { preis: 5 }), 5);
});

test('Pferdehirtin nur in Hrossmark, keine doppelten Begegnungen', () => {
  const rng = seededRng(3);
  for (let i = 0; i < 200; i++) {
    const day = 1 + (i % 10);
    const ids = pickEncounters({ day, history: [] }, ENC, REGIONS, rng);
    assert.equal(ids.length, 3);
    assert.equal(new Set(ids).size, 3);
    if (day <= 5) assert.ok(!ids.includes('hirtin'), `Tag ${day}`);
  }
});

test('Eulenbibliothekarin: Rucksack wächst Feld für Feld bis 5×4', () => {
  const run = newRun(ITEMS, REGIONS);
  assert.equal(run.bagCells.length, 12);
  let n = 0;
  while (growBag(run)) n++;
  assert.equal(n, 8);
  const g = bagGrid(run);
  assert.equal(g.cols, 5);
  assert.equal(g.rows, 4);
  assert.equal(g.mask.size, 20);
});

test('Kobold-Fluch: 2 Schaden pro verfluchtem Item im Rucksack', () => {
  const run = newRun(ITEMS, REGIONS);
  addItem(run, DEFS, 'horn', { fluch: 'Hoorn' });
  addItem(run, DEFS, 'brot');
  const ctx = playerContext(run);
  assert.equal(ctx.selbstschaden, 2);
  run.items[0].area = 'store';
  assert.equal(playerContext(run).selbstschaden, 0, 'im Lager wirkt der Fluch nicht');
  const f = makeFighter('x', [], DEFS, 1, { selbstschaden: 2 });
  assert.equal(f.hp, f.maxHp - 2);
});
