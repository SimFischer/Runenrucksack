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

test('Gegner-Stufen: ★★ ab Tag 3, ★★★ ab Tag 6, der Boss an Tag 10 immer mit ★★★★', async () => {
  const { makeEnemy, enemyPool, seededRng } = await import('../js/logic.js');
  const E = json('enemies.json').gegner;
  const ork = E.find((e) => e.id === 'spaeher');
  const boss = E.find((e) => e.id === 'haeuptling');
  const pool = (day) => enemyPool(data.items, data.compounds, day);
  const maxStern = (day, foe) => {
    let m = 1;
    for (let s = 1; s <= 40; s++) for (const p of makeEnemy(day, foe, pool(day), data.defs, seededRng(s)).items) m = Math.max(m, p.stern || 1);
    return m;
  };
  assert.equal(maxStern(2, ork), 1, 'Tag 2: nur ★');
  assert.equal(maxStern(3, ork), 2, 'Tag 3: auch ★★');
  assert.equal(maxStern(6, ork), 3, 'Tag 6: auch ★★★');
  for (let s = 1; s <= 20; s++) {
    const items = makeEnemy(10, boss, pool(10), data.defs, seededRng(s)).items;
    assert.ok(items.some((p) => p.stern === 4), `Boss Tag 10 (Seed ${s}) hat ein ★★★★-Item`);
  }
});

test('Ränge: Rang 2 nach etwa 2 Läufen, Rang 5 (Hüter der Sprache) nach etwa 25–30 Läufen', async (t) => {
  const { simulateCareer } = await import('../js/sim.js');
  const d = { ...data, achievements: json('achievements.json') };
  for (const seed of [100, 300]) {
    const c = simulateCareer(d, 32, seed);
    const ab = (r) => c.raenge.indexOf(r) + 1;
    t.diagnostic(`Karriere ${seed}: Rang 2 nach ${ab(2)}, Rang 3 nach ${ab(3)}, Rang 4 nach ${ab(4)}, Rang 5 nach ${ab(5)} Läufen`);
    assert.ok(ab(2) >= 1 && ab(2) <= 3, `Rang 2 nach ${ab(2)} Läufen`);
    assert.ok(ab(5) >= 22 && ab(5) <= 31, `Rang 5 nach ${ab(5)} Läufen`);
  }
});
