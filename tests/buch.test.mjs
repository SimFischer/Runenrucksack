// Buch der Wörter: Einträge kommen aus items.json und recipes.json, Entdeckungen aus dem Lauf.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCompounds, buildRuneLevels } from '../js/grammar.js';
import { baueBuch, entdeckungenIn, seitenStand } from '../js/buch.js';
import { neuesProfil, entdecke } from '../js/fortschritt.js';

const json = (f) => JSON.parse(readFileSync(new URL('../' + f, import.meta.url)));
const ITEMS = json('items.json').items;
const RECIPES = json('recipes.json');
const DEFS = Object.fromEntries(ITEMS.map((d) => [d.id, d]));
for (const d of buildCompounds(DEFS, RECIPES)) DEFS[d.id] = d;
for (const d of buildRuneLevels(DEFS)) DEFS[d.id] = d;
const BUCH = baueBuch(DEFS, ITEMS, RECIPES);

test('Jede mögliche Kombination steht im Buch, jede id genau einmal', () => {
  const k = RECIPES.komposita;
  const seite = (id) => BUCH.seiten.find((s) => s.id === id).eintraege;
  assert.equal(seite('komposita').length, Object.keys(k.kraefte).length * k.traeger.length);
  assert.equal(seite('steigerungen').length, ITEMS.filter((d) => d.art === 'rune').length * 3, 'Komparativ, Superlativ, Krone');
  assert.equal(seite('saetze').length, ITEMS.filter((d) => d.art === 'verb').length * k.traeger.length);
  assert.ok(seite('stufen').some((e) => e.id === 'stufe:axt:4'));
  assert.ok(!seite('stufen').some((e) => e.id.startsWith('stufe:siegel')), 'Siegel haben keine Stufen');
  assert.ok(seite('besondere').some((e) => e.id === 'schatz:drachenfeuerschwert'));
  assert.equal(new Set(BUCH.eintraege.map((e) => e.id)).size, BUCH.eintraege.length);
  const fa = BUCH.byId.get('komp:feuer+axt');
  assert.equal(fa.artikel, 'die');
  assert.match(fa.hinweis, /Grundwort Axt bestimmt den Artikel → die Feueraxt/);
  // Natürliche Sätze: Eine Person handelt, der Gegenstand ist das Werkzeug
  assert.match(BUCH.byId.get('satz:schlagen:axt').name, /^Eadrun schlägt mit der Axt /);
  assert.match(BUCH.byId.get('satz:schlagen:axt').wirkung, /Wir schlagen mit den Äxten /);
  const mitWs = baueBuch(DEFS, ITEMS, RECIPES, json('wortschatz.json'));
  assert.equal(mitWs.byId.get('satz:schlagen:axt').name, 'Eadrun schlägt mit der Axt kräftig zu.');
});

test('Entdeckungen aus dem Lauf: Komposita, Stufen (auch die darunter), Steigerungen, Sätze, Schätze', () => {
  const run = {
    items: [
      { uid: 1, id: 'feuer+axt', area: 'bag', x: 0, y: 0, rot: 0, stern: 3 },
      { uid: 2, id: 'rune-scharf@4', area: 'store', x: 0, y: 0, rot: 0 },
      { uid: 3, id: 'schlagen', area: 'bag', x: 1, y: 0, rot: 0, satz: { uid: 1, id: 'feuer+axt', stern: 3, ok: true } },
      { uid: 4, id: 'heilen', area: 'bag', x: 2, y: 0, rot: 0, satz: { uid: 1, id: 'feuer+axt', stern: 3, ok: false } },
      { uid: 5, id: 'horn', area: 'store', x: 1, y: 0, rot: 0 },
      { uid: 6, id: 'apfel', area: 'neu', x: 0, y: 0, rot: 0, stern: 2 },
    ],
  };
  const ids = new Set(entdeckungenIn(run, DEFS, BUCH));
  for (const id of ['komp:feuer+axt', 'stufe:axt:2', 'stufe:axt:3', 'steig:rune-scharf@2', 'steig:rune-scharf@3', 'steig:rune-scharf@4',
    'satz:schlagen:axt', 'schatz:horn']) assert.ok(ids.has(id), id);
  assert.ok(!ids.has('stufe:axt:4'));
  assert.ok(!ids.has('satz:heilen:axt'), 'falsche Personalform zählt nicht');
  assert.ok(!ids.has('stufe:apfel:2'), 'wartende Items zählen noch nicht');

  const p = neuesProfil();
  assert.deepEqual(entdecke(p, ['komp:feuer+axt', 'schatz:horn']), ['komp:feuer+axt', 'schatz:horn']);
  assert.deepEqual(entdecke(p, ['komp:feuer+axt', 'stufe:axt:2']), ['stufe:axt:2'], 'nur Neues');
  const komp = BUCH.seiten.find((s) => s.id === 'komposita');
  assert.deepEqual(seitenStand(komp, new Set(p.buch)), { gefunden: 1, gesamt: komp.eintraege.length, voll: false });
  assert.equal(seitenStand(komp, new Set(komp.eintraege.map((e) => e.id))).voll, true);
});
