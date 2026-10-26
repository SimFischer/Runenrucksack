// Prüft die Steigerung der Adjektiv-Runen: Formen, Erkennung, Wirkung.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyze, buildRuneLevels, adjectiveForm, phraseFor } from '../js/grammar.js';
import { findTriples } from '../js/sterne.js';

const json = (f) => JSON.parse(readFileSync(new URL('../' + f, import.meta.url)));
const ITEMS = json('items.json').items;
const DEFS = Object.fromEntries(ITEMS.map((d) => [d.id, d]));
for (const d of buildRuneLevels(DEFS)) DEFS[d.id] = d;
let uid = 1;
const P = (id, x, y, rot = 0) => ({ uid: uid++, id, x, y, rot });

test('Alle Runen haben Komparativ und Superlativ mit zwei falschen Formen', () => {
  const runen = ITEMS.filter((d) => d.art === 'rune');
  assert.ok(runen.length >= 8);
  for (const id of ['rune-gut', 'rune-gross', 'rune-stark', 'rune-hell']) assert.ok(DEFS[id], id);
  for (const r of runen) {
    const s = r.steigerung;
    assert.ok(s.superlativ.startsWith('am '), r.id);
    assert.equal(new Set([s.komparativ, ...s.falschK]).size, 3, r.id);
    assert.equal(new Set([s.superlativ, ...s.falschS]).size, 3, r.id);
    assert.equal(DEFS[`${r.id}@2`].name, s.komparativ);
    assert.equal(DEFS[`${r.id}@3`].name, s.superlativ);
  }
  assert.equal(DEFS['rune-gut@2'].name, 'besser');
  assert.equal(DEFS['rune-gut@3'].name, 'am besten');
  assert.equal(DEFS['rune-gut'].seltenheit, 'episch', 'gut ist die seltene Rune');
});

test('Formen vor dem Nomen: scharfes, schärferes, das schärfste Schwert', () => {
  const S = DEFS.schwert, B = DEFS.bogen, A = DEFS.axt;
  assert.equal(phraseFor([DEFS['rune-scharf']], S), 'scharfes Schwert');
  assert.equal(phraseFor([DEFS['rune-scharf@2']], S), 'schärferes Schwert');
  assert.equal(phraseFor([DEFS['rune-scharf@3']], S), 'das schärfste Schwert');
  assert.equal(phraseFor([DEFS['rune-scharf@2']], B), 'schärferer Bogen');
  assert.equal(phraseFor([DEFS['rune-scharf@3']], A), 'die schärfste Axt');
  assert.equal(phraseFor([DEFS['rune-gut@3']], DEFS.brot), 'das beste Brot');
  assert.equal(phraseFor([DEFS['rune-gut@2']], DEFS.apfel), 'besserer Apfel');
  assert.equal(phraseFor([DEFS['rune-gross']], DEFS.apfel), 'großer Apfel');
  assert.equal(adjectiveForm(DEFS['rune-edel@2'], 'das'), 'edleres');
});

test('Drei gleiche Runen irgendwo in Rucksack oder Lager werden erkannt', () => {
  const runes = (list) => findTriples(list, DEFS).filter((g) => g.typ === 'rune');
  const row = runes([P('rune-scharf', 0, 0), P('rune-scharf', 1, 0), P('rune-scharf', 2, 0)]);
  assert.equal(row.length, 1);
  assert.equal(row[0].neu.id, 'rune-scharf@2');
  assert.equal(runes([P('rune-gut@2', 1, 0), P('rune-gut@2', 3, 2), { ...P('rune-gut@2', 0, 0), area: 'store' }])[0].neu.id, 'rune-gut@3', 'verstreut und im Lager');
  assert.equal(runes([P('rune-scharf', 0, 0), P('rune-scharf@2', 1, 0), P('rune-scharf', 2, 0)]).length, 0, 'gleiche Stufe nötig');
  assert.equal(runes([P('rune-scharf', 0, 0), P('rune-schwer', 1, 0), P('rune-scharf', 2, 0)]).length, 0);
  assert.equal(runes([P('rune-scharf@3', 0, 0), P('rune-scharf@3', 1, 0), P('rune-scharf@3', 2, 0)]).length, 0, 'Superlativ ist das Ende');
});

test('Jede Stufe wirkt 50 % stärker, falsch gerichtet wirkt keine', () => {
  const dmg = (runeId, rot = 0) => {
    const t = P('schwert', 1, 0);
    return analyze([t, P(runeId, 0, 0, rot)], DEFS).get(t.uid).def.schaden;
  };
  const base = DEFS.schwert.schaden;
  assert.equal(dmg('rune-scharf') - base, 3);
  assert.ok(dmg('rune-scharf@2') - base >= 4.5);
  assert.ok(dmg('rune-scharf@3') - base >= 6.75);
  assert.equal(dmg('rune-scharf@3', 2), base);
  const pct = (runeId) => {
    const t = P('schwert', 1, 0);
    return analyze([t, P(runeId, 0, 0)], DEFS).get(t.uid).def.schaden;
  };
  assert.ok(pct('rune-gut@3') > pct('rune-gut@2') && pct('rune-gut@2') > pct('rune-gut') && pct('rune-gut') > base);
});
