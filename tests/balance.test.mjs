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
  satzschmiede: json('satzschmiede.json'), wortschatz: json('wortschatz.json'), pakete: json('gegenstandspakete.json'),
});

// Drei Strategien (js/sim.js): „zufall“ kauft irgendetwas Bezahlbares, „gut“ sammelt gleiche Gegenstände, baut
// Komposita, nutzt die Sockel und den Händler, „abwehr“ spielt ebenso, setzt aber auf Schutz und Heilung.
// Ziele: Zufall 3–4 Siege, höchstens 10 % schaffen die Reise (Endboss besiegt); gut 6–7 Siege, 25–35 %;
// Abwehr höchstens 10 Prozentpunkte unter gut; Tag 1 für alle mindestens 80 %. Satzschmiede: Zufall Stufe 1, sonst 3.
// Einmal mit dem Startpaket (Neuling, gesperrte Gegenstände fehlen auch den Gegnern) und einmal mit allem.
for (const bestand of ['start', 'alles']) test(`600 Läufe je Strategie (${bestand === 'start' ? 'Startpaket' : 'alle Gegenstände'}): Siege, Reise geschafft, Tag 1, Spielzeit`, (t) => {
  const zeile = (o) => Object.values(o).map((v) => String(v).padStart(4)).join('');
  const r = {};
  for (const strategie of ['zufall', 'gut', 'abwehr']) {
    r[strategie] = summarize(simulateMany(data, 600, 5, { strategie, bestand, satzschmiede: strategie === 'zufall' ? 1 : 3 }));
    const x = r[strategie];
    t.diagnostic(`${strategie.padEnd(7)} Siegquote %:  ${zeile(x.siegquoteProTag)}`);
    t.diagnostic(`${strategie.padEnd(7)} Siege ${x.siegeDurchschnitt.toFixed(2)} · Reise geschafft ${x.reiseGeschafft} % · ${x.minutenDurchschnitt.toFixed(1)} min · Kampf ${x.kampfSekunden.toFixed(1)} s`);
  }
  const z = r.zufall, g = r.gut, a = r.abwehr;
  assert.ok(z.siegeDurchschnitt >= 3 && z.siegeDurchschnitt <= 4, `Zufall: ${z.siegeDurchschnitt} Siege`);
  assert.ok(z.reiseGeschafft <= 10, `Zufall: ${z.reiseGeschafft} % schaffen die Reise`);
  assert.ok(g.siegeDurchschnitt >= 6 && g.siegeDurchschnitt <= 7, `gut: ${g.siegeDurchschnitt} Siege`);
  assert.ok(g.reiseGeschafft >= 25 && g.reiseGeschafft <= 35, `gut: ${g.reiseGeschafft} % schaffen die Reise`);
  assert.ok(a.reiseGeschafft >= g.reiseGeschafft - 10, `Abwehr: ${a.reiseGeschafft} % gegenüber ${g.reiseGeschafft} %`);
  for (const x of [z, g, a]) {
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

