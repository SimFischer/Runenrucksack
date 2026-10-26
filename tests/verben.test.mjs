// Verben bekommen ein Subjekt: Pfeil, Personalform, Wirkung. Falsch ist nie stärker als richtig.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyze, buildCompounds, buildRuneLevels, satzFor, verbTargetCell, ROLLE_OHNE_SUBJEKT } from '../js/grammar.js';
import { Battle, makeFighter, runToEnd } from '../js/battle.js';
import { seededRng } from '../js/logic.js';

const json = (f) => JSON.parse(readFileSync(new URL('../' + f, import.meta.url)));
const ITEMS = json('items.json').items;
const DEFS = Object.fromEntries(ITEMS.map((d) => [d.id, d]));
for (const d of buildCompounds(DEFS, json('recipes.json'))) DEFS[d.id] = d;
for (const d of buildRuneLevels(DEFS)) DEFS[d.id] = d;
const VERBEN = ITEMS.filter((d) => d.art === 'verb');

// Rolle bei (0,1) zeigt nach oben auf das Subjekt bei (0,0).
const setup = (verbId, subjId, satz, stern) => [
  { uid: 1, id: subjId, x: 0, y: 0, rot: 0, ...(stern ? { stern } : {}) },
  { uid: 2, id: verbId, x: 0, y: 1, rot: 0, ...(satz === undefined ? {} : { satz: { uid: 1, id: subjId, stern: stern || 1, ok: satz } }) },
];

test('Pfeil der Rolle zeigt in vier Richtungen entlang ihrer langen Seite', () => {
  const d = DEFS.schlagen;
  assert.deepEqual(verbTargetCell({ x: 2, y: 1, rot: 0 }, d), { x: 2, y: 0 });
  assert.deepEqual(verbTargetCell({ x: 2, y: 1, rot: 1 }, d), { x: 4, y: 1 });
  assert.deepEqual(verbTargetCell({ x: 2, y: 1, rot: 2 }, d), { x: 2, y: 3 });
  assert.deepEqual(verbTargetCell({ x: 2, y: 1, rot: 3 }, d), { x: 1, y: 1 });
});

test('Personalform passend zum Subjekt, ★★ und ★★★ in der Mehrzahl', () => {
  assert.equal(satzFor(DEFS.schlagen, DEFS['feuer+schwert'], 1, DEFS).satz, 'Das Feuerschwert schlägt.');
  assert.equal(satzFor(DEFS.schlagen, DEFS.speer, 2, DEFS).satz, 'Die Speere schlagen.');
  assert.equal(satzFor(DEFS.stechen, DEFS.axt, 3, DEFS).satz, 'Die Äxte stechen.');
  assert.equal(satzFor(DEFS.leuchten, DEFS.laterne, 1, DEFS).satz, 'Die Laterne leuchtet.');
  for (const v of VERBEN) {
    for (const stern of [1, 2]) {
      const s = satzFor(v, DEFS.speer, stern, DEFS);
      assert.equal(new Set([s.richtig, ...s.falsch]).size, 3, `${v.id} ${stern}`);
    }
  }
  for (const id of ['stechen', 'schiessen', 'brennen', 'leuchten']) assert.ok(DEFS[id]?.formen, id);
});

test('Ohne Subjekt oder mit falscher Form wirkt die Rolle nur halb', () => {
  for (const v of VERBEN) {
    const val = (satz, subj = 'speer') => analyze(setup(v.id, subj, satz), DEFS).get(2);
    const ok = val(true), falsch = val(false), offen = val(undefined);
    const allein = analyze([{ uid: 2, id: v.id, x: 0, y: 1, rot: 0 }], DEFS).get(2);
    assert.equal(ok.verb.status, 'ok');
    assert.equal(ok.def.subjektUid, 1);
    for (const k of ['schaden', 'block', 'heilung', 'brand']) {
      if (!v[k]) continue;
      assert.ok(ok.def[k] >= v[k], `${v.id} ${k} mit Subjekt voll`);
      for (const w of [falsch, offen, allein]) {
        assert.ok(w.def[k] <= v[k] * ROLLE_OHNE_SUBJEKT, `${v.id} ${k} halb`);
        assert.ok(w.def[k] <= ok.def[k], 'falsch nie stärker als richtig');
        assert.equal(w.def.subjektUid, undefined);
      }
    }
  }
});

test('Antwort gilt nur, solange Rolle und Subjekt so liegen', () => {
  const items = setup('schlagen', 'speer', true);
  assert.equal(analyze(items, DEFS).get(2).verb.status, 'ok');
  items[0].stern = 2; // Subjekt ist jetzt ★★ → neue Frage (Mehrzahl)
  assert.equal(analyze(items, DEFS).get(2).verb.status, 'offen');
  items[0] = { uid: 3, id: 'axt', x: 0, y: 0, rot: 0 };
  assert.equal(analyze(items, DEFS).get(2).verb.status, 'offen');
});

test('Passendes Subjekt: brennen gibt Feuer-Komposita +Brand, stechen stärkt Speere', () => {
  const b = analyze(setup('brennen', 'feuer+schwert', true), DEFS);
  assert.equal(b.get(1).def.brand, DEFS['feuer+schwert'].brand + 2);
  const s = analyze(setup('stechen', 'speer', true), DEFS).get(2);
  assert.ok(s.def.schaden > DEFS.stechen.schaden);
  assert.ok(s.verb.bonus);
});

test('Kampf: Rolle mit richtigem Subjekt ist stärker als ohne', () => {
  const fight = (satz) => {
    const me = makeFighter('a', setup('schlagen', 'feuer+schwert', satz), DEFS, 5, { rng: seededRng(1) });
    const dummy = makeFighter('b', [], DEFS, 5, { rng: seededRng(1) });
    const b = new Battle(me, dummy);
    runToEnd(b);
    return b.time;
  };
  assert.ok(fight(true) < fight(false), 'mit Subjekt schneller besiegt');
});
