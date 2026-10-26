// Prüft Begegnungen und Aufgaben: Inhalte vollständig, genau eine richtige Lösung, Belohnungen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  newRun, growBag, bagGrid, pickEncounters, makeTask, tapTask, koboldTask, seededRng, addItem,
} from '../js/logic.js';
import { buildCompounds } from '../js/grammar.js';
import { playerContext } from '../js/mods.js';
import { makeFighter } from '../js/battle.js';

const json = (f) => JSON.parse(readFileSync(new URL('../' + f, import.meta.url)));
const ITEMS = json('items.json').items;
const REGIONS = json('regions.json').gebiete;
const ENC = json('encounters.json');
const EX = json('exercises.json');
const DEFS = Object.fromEntries(ITEMS.map((d) => [d.id, d]));
for (const c of buildCompounds(DEFS, json('recipes.json'))) DEFS[c.id] = c;

test('Mindestens sechs Begegnungen mit bekannten Aufgaben und Belohnungen', () => {
  const typen = ['plural', 'artikel', 'speisekarte', 'personalform', 'kobold', 'tausch'];
  assert.ok(ENC.begegnungen.length >= 6);
  for (const b of ENC.begegnungen) {
    assert.ok(typen.includes(b.aufgabe.typ), b.id);
    assert.ok(b.name && b.emoji && b.text && b.belohnung.text, b.id);
  }
  for (const id of ['eule', 'zwerg', 'wirtin', 'haendler', 'hirtin', 'kobold']) assert.ok(ENC.begegnungen.find((b) => b.id === id), id);
});

test('Aufgaben in exercises.json haben genau eine richtige Lösung', () => {
  for (const q of [...EX.plural, ...EX.personalformen]) {
    const opts = [q.richtig, ...q.falsch];
    assert.equal(new Set(opts).size, opts.length, JSON.stringify(q));
    assert.ok(q.regel);
  }
  for (const q of EX.artikel) assert.ok(['der', 'die', 'das'].includes(q.artikel), q.wort);
  for (const k of EX.speisekarten) {
    const errors = k.zeilen.join(' ').split(' ').filter((t) => t.includes('|'));
    assert.equal(errors.length, 1, k.zeilen.join(' / '));
    assert.ok(k.erklaerung);
  }
  for (const k of EX.kobold) {
    const d = DEFS[k.item];
    assert.ok(d, `Kobold-Item ${k.item} fehlt`);
    assert.equal(d.seltenheit, 'episch', `${k.item} soll episch sein`);
    assert.ok(k.fehler >= 0 && k.fehler < k.teile.length);
    assert.notEqual(k.teile.join(''), k.richtig);
    assert.equal(k.richtig, d.name, `${k.item}: richtig muss der Item-Name sein`);
  }
});

test('Aufgaben bauen: drei verschiedene Fragen, Lösung unter den Antworten', () => {
  const rng = seededRng(7);
  for (const typ of ['plural', 'artikel', 'personalform']) {
    const qs = makeTask({ typ, anzahl: 3 }, EX, rng);
    assert.equal(qs.length, 3);
    assert.equal(new Set(qs.map((q) => q.prompt)).size, 3);
    for (const q of qs) assert.ok(q.options.includes(q.correct));
  }
  const [karte] = makeTask({ typ: 'speisekarte' }, EX, rng);
  assert.ok(karte.tap && karte.ziel);
  assert.equal(karte.zeilen[karte.ziel.zeile][karte.ziel.wort], karte.ziel.falsch);
  const t = tapTask([['Gemüse', 'aus', 'dem', 'Gahrten|Garten']], 'x');
  assert.deepEqual(t.ziel, { zeile: 0, wort: 3, falsch: 'Gahrten', richtig: 'Garten' });
  const k = koboldTask(EX.kobold[0]);
  assert.equal(k.zeilen[0][k.ziel.wort], EX.kobold[0].teile[EX.kobold[0].fehler]);
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
