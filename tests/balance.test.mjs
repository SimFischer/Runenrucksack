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
  encounters: json('encounters.json'), exercises: json('exercises.json'), begleiter: json('begleiter.json').begleiter, botschaften: json('botschaften.json').briefe,
  satzschmiede: json('satzschmiede.json'), wortschatz: json('wortschatz.json'),
});

// Zwei Strategien (js/sim.js): „zufall“ kauft irgendetwas Bezahlbares, „gut“ sammelt gleiche Gegenstände, baut
// Komposita, nutzt die Sockel und den Händler. Ziele: Zufall 4–5 Siege und höchstens 15 % schaffen die Reise (Endboss
// besiegt), gut 7–8 Siege und 40–50 %; Tag 1 für beide mindestens 80 %. Satzschmiede: Zufall Stufe 1, gut Stufe 3.
test('600 Läufe je Strategie: Siege, Reise geschafft, Tag 1 und Spielzeit', (t) => {
  const zeile = (o) => Object.values(o).map((v) => String(v).padStart(4)).join('');
  const r = {};
  for (const strategie of ['zufall', 'gut']) {
    r[strategie] = summarize(simulateMany(data, 600, 5, { strategie, satzschmiede: strategie === 'gut' ? 3 : 1 }));
    const x = r[strategie];
    t.diagnostic(`${strategie.padEnd(7)} Siegquote %:  ${zeile(x.siegquoteProTag)}`);
    t.diagnostic(`${strategie.padEnd(7)} Siege ${x.siegeDurchschnitt.toFixed(2)} · Reise geschafft ${x.reiseGeschafft} % · ${x.minutenDurchschnitt.toFixed(1)} min · Kampf ${x.kampfSekunden.toFixed(1)} s`);
  }
  const z = r.zufall, g = r.gut;
  assert.ok(z.siegeDurchschnitt >= 4 && z.siegeDurchschnitt <= 5, `Zufall: ${z.siegeDurchschnitt} Siege`);
  assert.ok(z.reiseGeschafft <= 15, `Zufall: ${z.reiseGeschafft} % schaffen die Reise`);
  assert.ok(g.siegeDurchschnitt >= 7 && g.siegeDurchschnitt <= 8, `gut: ${g.siegeDurchschnitt} Siege`);
  assert.ok(g.reiseGeschafft >= 40 && g.reiseGeschafft <= 50, `gut: ${g.reiseGeschafft} % schaffen die Reise`);
  for (const x of [z, g]) {
    assert.ok(x.siegquoteProTag[1] >= 80, `Tag 1: ${x.siegquoteProTag[1]} %`);
    assert.ok(x.minutenDurchschnitt >= 10 && x.minutenDurchschnitt <= 15, `Minuten: ${x.minutenDurchschnitt}`);
    assert.ok(x.kampfSekunden < 60, 'Kämpfe unter einer Minute');
  }
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

