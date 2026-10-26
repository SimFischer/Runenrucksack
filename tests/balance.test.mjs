// Balance: 200 Zufallsläufe mit einfacher Kaufstrategie (js/sim.js).
// Ziele: Tag 1 gut schaffbar (~80 %), Lauf dauert 10–15 Minuten und endet bei etwa 6–9 Siegen.
// Ausführen: node --test tests/balance.test.mjs (die Tabelle steht in der Ausgabe)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareData, simulateMany, summarize } from '../js/sim.js';

const json = (f) => JSON.parse(readFileSync(new URL('../' + f, import.meta.url)));
const H = json('heroes.json');
const data = prepareData({
  items: json('items.json').items, recipes: json('recipes.json'), regions: json('regions.json').gebiete,
  enemies: json('enemies.json').gegner, heroes: H.helden, fates: H.schicksalsrunen,
  encounters: json('encounters.json'), exercises: json('exercises.json'),
});

test('200 Zufallsläufe: Siegquote pro Tag, Siege und Spielzeit', (t) => {
  const r = summarize(simulateMany(data, 200, 1));
  t.diagnostic('Tag:            ' + Object.keys(r.siegquoteProTag).map((d) => d.padStart(4)).join(''));
  t.diagnostic('Siegquote %:    ' + Object.values(r.siegquoteProTag).map((v) => String(v).padStart(4)).join(''));
  t.diagnostic('Tag erreicht %: ' + Object.values(r.erreichtProTag).map((v) => String(v).padStart(4)).join(''));
  t.diagnostic(`Siege im Schnitt: ${r.siegeDurchschnitt.toFixed(1)} · Reise geschafft: ${r.reiseGeschafft} % · ` +
    `Spielzeit: ${r.minutenDurchschnitt.toFixed(1)} min · Kampf: ${r.kampfSekunden.toFixed(1)} s`);

  assert.ok(r.siegquoteProTag[1] >= 70 && r.siegquoteProTag[1] <= 92, `Tag 1: ${r.siegquoteProTag[1]} %`);
  assert.ok(r.siegeDurchschnitt >= 6 && r.siegeDurchschnitt <= 9, `Siege: ${r.siegeDurchschnitt}`);
  assert.ok(r.minutenDurchschnitt >= 10 && r.minutenDurchschnitt <= 15, `Minuten: ${r.minutenDurchschnitt}`);
  assert.ok(r.kampfSekunden < 60, 'Kämpfe unter einer Minute');
  for (const [d, q] of Object.entries(r.siegquoteProTag)) assert.ok(q >= 35, `Tag ${d} zu schwer: ${q} %`);
});
