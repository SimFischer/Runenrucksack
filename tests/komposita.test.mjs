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

test('Kristall links neben den Träger gelegt: sofort Kompositum mit Artikel-Frage', () => {
  const run = lauf([{ uid: 1, id: 'axt', area: 'bag', x: 1, y: 0, rot: 0 }]);
  const k = placeNew(run, DEFS, 'feuer', { area: 'bag', x: 0, y: 1, rot: 0 });
  const a = findeVerbindung(run, DEFS, RECIPES, { uid: k.uid, paar: true });
  assert.equal(a.typ, 'kompositum');
  const q = frageFuer(a, DEFS);
  assert.deepEqual([q.art, q.correct, q.options], ['artikel', 'die', ['der', 'die', 'das']]);
  const log = verbindeAlles(run, DEFS, RECIPES, [{ uid: k.uid, paar: true }], ja);
  assert.deepEqual(log.map((l) => l.id), ['feuer+axt']);
  assert.deepEqual(run.items.map((p) => [p.id, p.x, p.y]), [['feuer+axt', 1, 0]], 'der Kristall ist aufgegangen, die Axt bleibt liegen');
});

test('Falsche Seite (rechts daneben) ergibt kein Kompositum, im Lager auch nicht', () => {
  const run = lauf([
    { uid: 1, id: 'axt', area: 'bag', x: 1, y: 0, rot: 0 },
    { uid: 2, id: 'feuer', area: 'bag', x: 2, y: 0, rot: 0 },
    { uid: 3, id: 'schwert', area: 'store', x: 1, y: 0, rot: 0 },
    { uid: 4, id: 'gift', area: 'store', x: 0, y: 0, rot: 0 },
  ]);
  for (const uid of [1, 2, 3, 4]) assert.equal(findeVerbindung(run, DEFS, RECIPES, { uid }), null);
});

test('Drehen: Liegt der Kristall danach über dem Träger, entsteht es sofort', () => {
  // Schwert quer bei (1,1)-(2,1), Kristall bei (1,0): erst nach dem Drehen liegt er darüber
  const run = lauf([
    { uid: 1, id: 'schwert', area: 'bag', x: 2, y: 0, rot: 0 },
    { uid: 2, id: 'eis', area: 'bag', x: 0, y: 1, rot: 0 },
  ]);
  assert.equal(findeVerbindung(run, DEFS, RECIPES, { uid: 1 }), null, 'vorher nicht');
  Object.assign(run.items[0], { x: 0, y: 2, rot: 1 }); // quer gedreht, jetzt direkt unter dem Kristall
  const log = verbindeAlles(run, DEFS, RECIPES, [{ uid: 1 }], ja);
  assert.deepEqual(log.map((l) => l.id), ['eis+schwert']);
});

test('Stufe des Kompositums = Stufe des Trägers; ★★-Kristall gibt mehr Kraft', () => {
  const run = lauf([
    { uid: 1, id: 'axt', area: 'bag', x: 1, y: 0, rot: 0, stern: 2 },
    { uid: 2, id: 'feuer', area: 'bag', x: 0, y: 0, rot: 0, stern: 2 },
    { uid: 3, id: 'axt', area: 'bag', x: 3, y: 0, rot: 0 },
    { uid: 4, id: 'feuer', area: 'bag', x: 2, y: 0, rot: 0 },
  ]);
  verbindeAlles(run, DEFS, RECIPES, [{ uid: 2 }, { uid: 4 }], ja);
  const [stark, normal] = [1, 3].map((uid) => run.items.find((p) => p.uid === uid));
  assert.deepEqual([stark.id, stark.stern, stark.kraftStern], ['feuer+axt', 2, 2]);
  assert.deepEqual([normal.id, normal.stern, normal.kraftStern], ['feuer+axt', undefined, undefined]);
  const brand = (p) => analyze([p], DEFS).get(p.uid).def.brand;
  const ohneKraftStern = { ...stark, kraftStern: undefined };
  assert.ok(brand(stark) > brand(ohneKraftStern), 'stärkerer Kristall → mehr Brand');
  assert.ok(brand(ohneKraftStern) >= Math.floor(brand(normal) * STERN_FAKTOR[2]), '★★-Träger → ★★-Kompositum');
});

test('Feueraxt ★ + Feueraxt ★ → Feueraxt ★★ (auch direkt nach dem Entstehen)', () => {
  const run = lauf([
    { uid: 1, id: 'feuer+axt', area: 'store', x: 0, y: 0, rot: 0 },
    { uid: 2, id: 'axt', area: 'bag', x: 1, y: 0, rot: 0 },
    { uid: 3, id: 'eis+axt', area: 'bag', x: 3, y: 0, rot: 0 },
  ]);
  const k = placeNew(run, DEFS, 'feuer', { area: 'bag', x: 0, y: 0, rot: 0 });
  const log = verbindeAlles(run, DEFS, RECIPES, [{ uid: k.uid, paar: true }], ja);
  assert.deepEqual(log.map((l) => [l.typ, l.id, l.stern]), [['kompositum', 'feuer+axt', 1], ['paar', 'feuer+axt', 2]]);
  const fa = run.items.find((p) => p.id === 'feuer+axt');
  assert.deepEqual([fa.area, fa.stern], ['store', 2], 'liegt dort, wo die vorhandene Feueraxt lag');
  assert.ok(run.items.find((p) => p.id === 'eis+axt' && !p.stern), 'die Eisaxt bleibt, wie sie ist');
});

test('Falsch nie stärker: ohne richtige Antwort bleiben Kristall und Träger getrennt und schwächer', () => {
  const items = () => [{ uid: 1, id: 'axt', area: 'bag', x: 1, y: 0, rot: 0 }, { uid: 2, id: 'feuer', area: 'bag', x: 0, y: 0, rot: 0 }];
  const wert = (run) => {
    const info = analyze(run.items, DEFS);
    return run.items.reduce((s, p) => { const d = info.get(p.uid).def; return s + ((d.schaden || 0) + 2 * (d.brand || 0)) / (d.abklingzeit || 1); }, 0);
  };
  const richtig = lauf(items()), nein = lauf(items());
  verbindeAlles(richtig, DEFS, RECIPES, [{ uid: 2 }], ja);
  verbindeAlles(nein, DEFS, RECIPES, [{ uid: 2 }], () => 'nein');
  assert.equal(nein.items.length, 2);
  assert.ok(wert(richtig) > wert(nein), `${wert(richtig)} > ${wert(nein)}`);
});
