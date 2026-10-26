// Sternstufen: Mehrzahl- und Verbformen vollständig, zwei gleiche verbinden sich sofort
// (beim Kaufen, beim Ablegen auf ein gleiches Item, bei Belohnungen, als Kette).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newRun, STERN_FAKTOR, MAX_STERN } from '../js/logic.js';
import { buildCompounds, buildRuneLevels, starDef } from '../js/grammar.js';
import { pluralOf, partnerOf, placeNew, findeVerbindung, frageFuer, verbindeAlles, canMerge } from '../js/sterne.js';

const json = (f) => JSON.parse(readFileSync(new URL('../' + f, import.meta.url)));
const ITEMS = json('items.json').items;
const RECIPES = json('recipes.json');
const REGIONS = json('regions.json').gebiete;
const DEFS = Object.fromEntries(ITEMS.map((d) => [d.id, d]));
for (const d of buildCompounds(DEFS, RECIPES)) DEFS[d.id] = d;
for (const d of buildRuneLevels(DEFS)) DEFS[d.id] = d;

function leererLauf(items = []) {
  const run = newRun(ITEMS, REGIONS);
  run.items = items;
  run.nextUid = 100;
  return run;
}
const kaufe = (run, id, wunsch) => verbindeAlles(run, DEFS, RECIPES, [{ uid: placeNew(run, DEFS, id, wunsch).uid, paar: true }]);

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

test('Stufen: ★ → ★★ → ★★★ → ★★★★, jede deutlich stärker als zwei der Stufe darunter', () => {
  assert.equal(MAX_STERN, 4);
  assert.deepEqual([STERN_FAKTOR[2], STERN_FAKTOR[3], STERN_FAKTOR[4]], [2.2, 5, 11]);
  for (let s = 2; s <= 4; s++) assert.ok(STERN_FAKTOR[s] > 2 * STERN_FAKTOR[s - 1], `★${s}`);
  assert.equal(starDef(DEFS.speer, 2).schaden, Math.ceil(DEFS.speer.schaden * 2.2));
  assert.ok(canMerge(DEFS.speer, 3) && !canMerge(DEFS.speer, 4), '★★★★ ist das Ende');
  assert.ok(!canMerge(DEFS['siegel-das']) && !canMerge(DEFS.gartentasche), 'Siegel und Taschen verbinden sich nicht');
});

test('Kaufen: Gibt es schon ein gleiches (egal wo), wird es sofort ★★ – dort, wo das alte lag', () => {
  const run = leererLauf([
    { uid: 1, id: 'speer', area: 'store', x: 2, y: 1, rot: 1 },
    { uid: 2, id: 'siegel-das', area: 'bag', x: 3, y: 2, rot: 0 },
  ]);
  const log = kaufe(run, 'speer');
  assert.equal(log.length, 1);
  const p = run.items.find((i) => i.id === 'speer');
  assert.deepEqual([p.stern, p.area, p.x, p.y, p.rot], [2, 'store', 2, 1, 1]);
  assert.equal(run.items.length, 2);
  // Siegel verbinden sich nicht
  assert.equal(kaufe(run, 'siegel-das').length, 0);
  assert.equal(run.items.filter((i) => i.id === 'siegel-das').length, 2);
});

test('Kaufen ohne freien Platz: Mit einem gleichen klappt es trotzdem', () => {
  const voll = () => {
    const r = leererLauf([{ uid: 1, id: 'dolch', area: 'bag', x: 0, y: 0, rot: 0 }]);
    r.bagCells = ['0,0'];
    for (let x = 0; x < 4; x++) for (let y = 0; y < 3; y++) r.items.push({ uid: 10 + x * 3 + y, id: 'apfel', area: 'store', x, y, rot: 0 });
    return r;
  };
  assert.equal(placeNew(voll(), DEFS, 'axt'), null, 'ohne gleiches: kein Platz');
  const run = voll();
  const p = placeNew(run, DEFS, 'dolch');
  assert.equal(p.area, 'neu');
  verbindeAlles(run, DEFS, RECIPES, [{ uid: p.uid, paar: true }]);
  assert.equal(run.items.find((i) => i.id === 'dolch').stern, 2);
});

test('Ablegen direkt auf ein gleiches Item verbindet beide, verschiedene Stufen nicht', () => {
  const run = leererLauf([
    { uid: 1, id: 'axt', area: 'bag', x: 0, y: 0, rot: 0 },
    { uid: 2, id: 'axt', area: 'store', x: 0, y: 0, rot: 0 },
    { uid: 3, id: 'axt', area: 'bag', x: 2, y: 0, rot: 0, stern: 2 },
  ]);
  assert.equal(findeVerbindung(run, DEFS, RECIPES, { uid: 2, mit: 3 }), null, '★ auf ★★ passt nicht');
  const a = findeVerbindung(run, DEFS, RECIPES, { uid: 2, mit: 1 });
  assert.equal(a.alt.uid, 1);
  // Kette: ★ + ★ = ★★, das mit dem vorhandenen ★★ gleich zu ★★★ wird
  const log = verbindeAlles(run, DEFS, RECIPES, [{ uid: 2, mit: 1 }]);
  assert.deepEqual(log.map((l) => l.stern), [2, 3], 'zwei Schritte nacheinander');
  assert.equal(run.items.length, 1);
  const p = run.items[0];
  assert.deepEqual([p.stern, p.x, p.y], [3, 2, 0], 'liegt dort, wo das vorhandene ★★ lag');
});

test('Belohnungen verbinden sich wie gekaufte Items; Fluch bleibt erhalten', () => {
  const run = leererLauf([{ uid: 1, id: 'laterne', area: 'bag', x: 1, y: 1, rot: 0 }]);
  const p = placeNew(run, DEFS, 'laterne', null, { fluch: 'Latärne' });
  verbindeAlles(run, DEFS, RECIPES, [{ uid: p.uid, paar: true }]);
  const l = run.items.find((i) => i.id === 'laterne');
  assert.deepEqual([l.stern, l.x, l.y, l.fluch], [2, 1, 1, 'Latärne']);
});

test('Komposita: gleiche verbinden sich, verschiedene (Feueraxt + Eisaxt) nicht', () => {
  const run = leererLauf([
    { uid: 1, id: 'feuer+axt', area: 'bag', x: 0, y: 0, rot: 0 },
    { uid: 2, id: 'eis+axt', area: 'bag', x: 2, y: 0, rot: 0 },
  ]);
  assert.equal(partnerOf(run.items, DEFS, run.items[1]), null);
  assert.equal(kaufe(run, 'eis+axt').length, 1);
  assert.equal(run.items.find((i) => i.id === 'eis+axt').stern, 2);
  assert.equal(run.items.find((i) => i.id === 'feuer+axt').stern, undefined);
});

test('Fragen: Nomen → Mehrzahl „zwei ___“, Verben → Präteritum, Runen → Steigerung, Krone ohne Frage', () => {
  const run = leererLauf([
    { uid: 1, id: 'axt', area: 'bag', x: 0, y: 0, rot: 0 },
    { uid: 2, id: 'axt', area: 'store', x: 0, y: 0, rot: 0 },
    { uid: 3, id: 'schlagen', area: 'store', x: 2, y: 0, rot: 0 },
    { uid: 4, id: 'schlagen', area: 'store', x: 3, y: 0, rot: 0 },
    { uid: 5, id: 'rune-scharf', area: 'store', x: 0, y: 2, rot: 0 },
    { uid: 6, id: 'rune-scharf', area: 'store', x: 1, y: 2, rot: 0 },
    { uid: 7, id: 'rune-scharf@3', area: 'bag', x: 3, y: 2, rot: 0 },
    { uid: 8, id: 'rune-scharf@3', area: 'bag', x: 3, y: 1, rot: 0 },
  ]);
  const q = (uid) => frageFuer(findeVerbindung(run, DEFS, RECIPES, { uid, paar: true }), DEFS);
  const axt = q(2);
  assert.equal(axt.correct, 'Äxte');
  assert.match(axt.prompt, /zwei/);
  assert.equal(axt.options.length, 3);
  assert.equal(q(4).correct, 'schlug');
  assert.equal(q(6).correct, 'schärfer');
  assert.equal(q(8), null, 'Superlativ + Superlativ = Krone ohne neue Frage');
  verbindeAlles(run, DEFS, RECIPES, [{ uid: 8, paar: true }]);
  const krone = run.items.find((i) => i.id === 'rune-scharf@4');
  assert.ok(krone && DEFS[krone.id].krone && DEFS[krone.id].name === 'am schärfsten');
});

test('Laden: Items, die man schon besitzt, kommen häufiger; Ketten-Symbol findet Komposita', async () => {
  const { randomShopItem, seededRng, SAMMEL_GEWICHT, ownedCount } = await import('../js/logic.js');
  const { compoundPartner } = await import('../js/sterne.js');
  const pool = ITEMS.filter((d) => d.seltenheit === 'gewoehnlich' && d.art !== 'tasche');
  const w = { gewoehnlich: 1 };
  const count = (run) => {
    const rng = seededRng(5);
    let n = 0;
    for (let i = 0; i < 4000; i++) if (randomShopItem(pool, w, rng, run).id === 'dolch') n++;
    return n;
  };
  const ohne = count({ items: [] });
  const mit = count({ items: [{ uid: 1, id: 'dolch', area: 'store' }] });
  assert.ok(mit > ohne * (SAMMEL_GEWICHT * 0.75), `mit ${mit}, ohne ${ohne}`);
  assert.equal(ownedCount({ items: [{ id: 'dolch' }, { id: 'dolch', stern: 2 }] }, 'dolch'), 1, '★★ zählt nicht für das nächste ★★');
  assert.equal(compoundPartner(DEFS.feuer, [{ id: 'schwert' }], DEFS, RECIPES).id, 'feuer+schwert');
  assert.equal(compoundPartner(DEFS.axt, [{ id: 'gift' }], DEFS, RECIPES).id, 'gift+axt');
  assert.equal(compoundPartner(DEFS.apfel, [{ id: 'feuer' }], DEFS, RECIPES), null);
});
