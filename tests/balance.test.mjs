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
  encounters: json('encounters.json'), exercises: json('exercises.json'), begleiter: json('begleiter.json').begleiter,
});

test('200 Zufallsläufe: Siegquote pro Tag, Siege und Spielzeit', (t) => {
  const r = summarize(simulateMany(data, 200, 1));
  t.diagnostic('Tag:            ' + Object.keys(r.siegquoteProTag).map((d) => d.padStart(4)).join(''));
  t.diagnostic('Siegquote %:    ' + Object.values(r.siegquoteProTag).map((v) => String(v).padStart(4)).join(''));
  t.diagnostic('Tag erreicht %: ' + Object.values(r.erreichtProTag).map((v) => String(v).padStart(4)).join(''));
  const zeile = (o) => Object.values(o).map((v) => String(v).padStart(4)).join('');
  t.diagnostic('Gold am Ende:   ' + zeile(r.goldProTag));
  t.diagnostic('Händler-Stufe:  ' + zeile(r.haendlerProTag));
  t.diagnostic('Schmied % Läufe:' + zeile(Object.fromEntries(Object.entries(r.schmiedProTag).map(([d, v]) => [d, Math.round(100 * v)]))));
  t.diagnostic('Würfe:          ' + zeile(r.wuerfeProTag));
  t.diagnostic(`Siege im Schnitt: ${r.siegeDurchschnitt.toFixed(1)} · Reise geschafft: ${r.reiseGeschafft} % · ` +
    `Spielzeit: ${r.minutenDurchschnitt.toFixed(1)} min · Kampf: ${r.kampfSekunden.toFixed(1)} s`);

  assert.ok(r.siegquoteProTag[1] >= 70 && r.siegquoteProTag[1] <= 92, `Tag 1: ${r.siegquoteProTag[1]} %`);
  assert.ok(r.siegeDurchschnitt >= 6 && r.siegeDurchschnitt <= 9, `Siege: ${r.siegeDurchschnitt}`);
  assert.ok(r.minutenDurchschnitt >= 10 && r.minutenDurchschnitt <= 15, `Minuten: ${r.minutenDurchschnitt}`);
  assert.ok(r.kampfSekunden < 60, 'Kämpfe unter einer Minute');
  for (const [d, q] of Object.entries(r.siegquoteProTag)) assert.ok(q >= 35, `Tag ${d} zu schwer: ${q} %`);
});

// Händler-Vertrauen, Schmied und teureres Würfeln: Ein Kind, das vorsichtig kauft (einmal würfeln, nichts verkaufen),
// sammelt bisher viel Gold an. Mit den neuen Ausgaben bleibt ab Tag 4 deutlich weniger übrig – bei mindestens so vielen Siegen.
test('Gold bleibt knapp: vorsichtige Strategie bisher und neu', (t) => {
  const bisher = summarize(simulateMany(data, 120, 7, { strategie: 'vorsichtig', haendler: false, schmied: false, wuerfelAlt: true }));
  const neu = summarize(simulateMany(data, 120, 7, { strategie: 'vorsichtig' }));
  const zeile = (o) => Object.values(o).map((v) => String(v).padStart(5)).join('');
  t.diagnostic('Tag:              ' + Object.keys(neu.goldProTag).map((d) => d.padStart(5)).join(''));
  t.diagnostic('Gold bisher:      ' + zeile(bisher.goldProTag));
  t.diagnostic('Gold neu:         ' + zeile(neu.goldProTag));
  t.diagnostic('Händler-Stufe:    ' + zeile(neu.haendlerProTag));
  t.diagnostic('Schmied (Anteil): ' + zeile(neu.schmiedProTag));
  t.diagnostic('Würfe:            ' + zeile(neu.wuerfeProTag));
  t.diagnostic(`Siege bisher ${bisher.siegeDurchschnitt.toFixed(2)}, neu ${neu.siegeDurchschnitt.toFixed(2)}`);
  const ab4 = (r) => [4, 5, 6, 7, 8, 9, 10].reduce((sum, d) => sum + r.goldProTag[d], 0) / 7;
  assert.ok(ab4(neu) < 0.4 * ab4(bisher), `Gold ab Tag 4: neu ${ab4(neu).toFixed(1)}, bisher ${ab4(bisher).toFixed(1)}`);
  assert.ok(neu.siegeDurchschnitt >= 6 && neu.siegeDurchschnitt <= 9, `Siege: ${neu.siegeDurchschnitt}`);
  assert.ok(neu.haendlerProTag[8] > 2, 'Händler-Stufe wird genutzt');
  assert.ok(Object.values(neu.schmiedProTag).some((v) => v > 0.2), 'Schmied wird genutzt');
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
