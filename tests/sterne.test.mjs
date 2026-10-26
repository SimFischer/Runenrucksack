// Sternstufen: Mehrzahl- und Verbformen vollständig, drei gleiche über Rucksack und Lager, Verschmelzen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newRun, STERN_FAKTOR } from '../js/logic.js';
import { buildCompounds, buildRuneLevels, starDef } from '../js/grammar.js';
import { pluralOf, findTriples, mergeQuestion, applyMerge } from '../js/sterne.js';

const json = (f) => JSON.parse(readFileSync(new URL('../' + f, import.meta.url)));
const ITEMS = json('items.json').items;
const DEFS = Object.fromEntries(ITEMS.map((d) => [d.id, d]));
for (const d of buildCompounds(DEFS, json('recipes.json'))) DEFS[d.id] = d;
for (const d of buildRuneLevels(DEFS)) DEFS[d.id] = d;

test('Jedes Nomen hat eine Mehrzahl mit genau einer richtigen Form, jedes Verb seine Formen', () => {
  for (const d of Object.values(DEFS)) {
    if (d.art === 'verb') {
      const f = d.formen;
      for (const [r, falsch] of [[f.er, f.falschEr], [f.sie, f.falschSie], [f.praeteritum, f.falschPraeteritum]]) {
        assert.equal(new Set([r, ...falsch]).size, 3, d.id);
      }
      continue;
    }
    if (!d.artikel || ['siegel', 'rune', 'tasche'].includes(d.art)) continue;
    const p = pluralOf(d, DEFS);
    assert.ok(p, `${d.id} braucht eine Mehrzahl`);
    assert.equal(new Set([p.richtig, ...p.falsch]).size, 3, d.id);
  }
  assert.equal(pluralOf(DEFS.axt, DEFS).richtig, 'Äxte');
  assert.equal(pluralOf(DEFS['feuer+axt'], DEFS).richtig, 'Feueräxte');
  assert.equal(pluralOf(DEFS.schwert, DEFS).richtig, 'Schwerter');
  assert.equal(pluralOf(DEFS.bogen, DEFS).richtig, 'Bögen');
  assert.equal(pluralOf(DEFS.feuer, DEFS).richtig, 'Feuer');
  assert.equal(DEFS.schlagen.formen.praeteritum, 'schlug');
});

test('Drei gleiche über Rucksack und Lager verschmelzen zu ★★ an der Stelle des neuesten', () => {
  const run = newRun(ITEMS, json('regions.json').gebiete);
  run.items = [
    { uid: 1, id: 'speer', area: 'bag', x: 0, y: 0, rot: 0 },
    { uid: 2, id: 'speer', area: 'store', x: 0, y: 0, rot: 0 },
    { uid: 3, id: 'speer', area: 'bag', x: 2, y: 0, rot: 1 },
    { uid: 4, id: 'siegel-das', area: 'bag', x: 3, y: 2, rot: 0 },
  ];
  run.nextUid = 5;
  const [g] = findTriples(run.items, DEFS);
  assert.equal(g.typ, 'nomen');
  assert.equal(g.ziel.uid, 3);
  const q = mergeQuestion(g, DEFS);
  assert.equal(q.correct, 'Speere');
  assert.ok(q.options.includes('Speere') && q.options.length === 3);
  const p = applyMerge(run, g, DEFS);
  assert.deepEqual([p.id, p.stern, p.area, p.x, p.y, p.rot], ['speer', 2, 'bag', 2, 0, 1]);
  assert.equal(run.items.length, 2);
  assert.equal(findTriples(run.items, DEFS).length, 0, 'Siegel verschmelzen nicht');
  assert.equal(starDef(DEFS.speer, 2).schaden, Math.ceil(DEFS.speer.schaden * STERN_FAKTOR[2]));
});

test('Runen: drei gleiche irgendwo steigen eine Stufe; Verben fragen das Präteritum', () => {
  const items = [
    { uid: 1, id: 'rune-scharf', area: 'bag', x: 0, y: 0, rot: 0 },
    { uid: 2, id: 'rune-scharf', area: 'store', x: 3, y: 2, rot: 0 },
    { uid: 3, id: 'rune-scharf', area: 'bag', x: 3, y: 1, rot: 2 },
    { uid: 4, id: 'schlagen', area: 'store', x: 0, y: 0, rot: 0 },
    { uid: 5, id: 'schlagen', area: 'store', x: 1, y: 0, rot: 0 },
    { uid: 6, id: 'schlagen', area: 'bag', x: 1, y: 1, rot: 0 },
  ];
  const groups = findTriples(items, DEFS);
  const rune = groups.find((g) => g.typ === 'rune');
  assert.equal(rune.neu.id, 'rune-scharf@2');
  assert.equal(mergeQuestion(rune, DEFS).correct, 'schärfer');
  const verb = groups.find((g) => g.typ === 'verb');
  assert.equal(mergeQuestion(verb, DEFS).correct, 'schlug');
});
