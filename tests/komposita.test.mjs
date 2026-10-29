// Komposita entstehen sofort: beim Ablegen und beim Drehen, mit der Stufe des Trägers;
// danach verbinden sich gleiche Komposita wie alle Items (Feueraxt ★ + Feueraxt ★ → ★★).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newRun, STERN_FAKTOR } from '../js/logic.js';
import { buildCompounds, buildRuneLevels, analyze } from '../js/grammar.js';
import { placeNew, findeVerbindung, frageFuer, verbindeAlles } from '../js/sterne.js';

const json = (f) => JSON.parse(readFileSync(new URL('../' + f, import.meta.url)));
const ITEMS = json('items.json').items;
const RECIPES = json('recipes.json');
const DEFS = Object.fromEntries(ITEMS.map((d) => [d.id, d]));
for (const d of buildCompounds(DEFS, RECIPES)) DEFS[d.id] = d;
for (const d of buildRuneLevels(DEFS)) DEFS[d.id] = d;

function lauf(items) {
  const run = newRun(ITEMS, json('regions.json').gebiete);
  run.items = items;
  run.nextUid = 100;
  return run;
}
const ja = () => 'richtig';

test('Falsche Seite (rechts daneben) ergibt kein Kompositum, im Lager auch nicht', () => {
  const run = lauf([
    { uid: 1, id: 'axt', area: 'bag', x: 1, y: 0, rot: 0 },
    { uid: 2, id: 'feuer', area: 'bag', x: 2, y: 0, rot: 0 },
    { uid: 3, id: 'schwert', area: 'store', x: 1, y: 0, rot: 0 },
    { uid: 4, id: 'gift', area: 'store', x: 0, y: 0, rot: 0 },
  ]);
  for (const uid of [1, 2, 3, 4]) assert.equal(findeVerbindung(run, DEFS, RECIPES, { uid }), null);
});

