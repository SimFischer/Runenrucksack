// Natürliche Sätze für Verb-Rollen: Eine Person handelt, der Gegenstand ist das Werkzeug („mit dem Eisspeer“).
// Alle Vorlagen mit allen passenden Gegenständen: Artikel und Dativ nach „mit“ stimmen, keine Gegenstände als Subjekt.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCompounds, buildRuneLevels, isNoun, pluralOf } from '../js/grammar.js';
import { mitRegeln } from '../js/aufgaben/themen.js';
import { FORMATE } from '../js/aufgaben/formate/index.js';
import {
  verbSatz, verbSatzInhalt, mitDativ, dativPlural, subjektFuer, vorlagenFuer, PERSONEN_FOLGE, kurzName,
} from '../js/aufgaben/verbsatz.js';
import { seededRng } from '../js/logic.js';

const json = (f) => JSON.parse(readFileSync(new URL('../' + f, import.meta.url)));
const ITEMS = json('items.json').items;
const DEFS = Object.fromEntries(ITEMS.map((d) => [d.id, d]));
for (const d of buildCompounds(DEFS, json('recipes.json'))) DEFS[d.id] = d;
for (const d of buildRuneLevels(DEFS)) DEFS[d.id] = d;
const WS = mitRegeln(json('wortschatz.json'), json('themen.json'));
const VERBEN = Object.values(DEFS).filter((d) => d.art === 'verb' && d.formen);
const NOMEN = Object.values(DEFS).filter((d) => isNoun(d));

test('Jede Verb-Rolle hat mehrere Satzvorlagen im Wortschatz, alle mit Person, Lücke und „mit“-Gegenstand', () => {
  assert.ok(VERBEN.length >= 8);
  for (const v of VERBEN) {
    const eintrag = WS.verben.find((x) => x.infinitiv === v.name);
    assert.ok(eintrag, `${v.name} fehlt in wortschatz.json`);
    assert.ok(eintrag.vorlagen?.length >= 2, `${v.name}: mindestens zwei Vorlagen`);
    for (const t of eintrag.vorlagen) {
      assert.match(t, /^\{S\} ___ /, `${v.name}: „${t}“ beginnt mit Subjekt und Verb`);
      assert.match(t, /mit \{D\}/, `${v.name}: „${t}“ enthält „mit {D}“`);
      assert.match(t, /\.$/);
      assert.ok(!/\bsich\b/.test(t), `${v.name}: „sich“ passt nicht zu ich/du`);
    }
  }
});

test('Dativ nach „mit“: Artikel und Mehrzahl-Endung stimmen', () => {
  assert.equal(mitDativ(DEFS.speer, 1, DEFS), 'dem Speer');
  assert.equal(mitDativ(DEFS.axt, 1, DEFS), 'der Axt');
  assert.equal(mitDativ(DEFS.schwert, 1, DEFS), 'dem Schwert');
  assert.equal(mitDativ(DEFS['eis+speer'], 1, DEFS), 'dem Eisspeer');
  assert.equal(mitDativ(DEFS.speer, 2, DEFS), 'den Speeren');
  assert.equal(mitDativ(DEFS.axt, 3, DEFS), 'den Äxten');
  assert.equal(mitDativ(DEFS['feuer+schwert'], 2, DEFS), 'den Feuerschwertern');
  assert.equal(dativPlural('Bögen'), 'Bögen');
  assert.equal(dativPlural('Helme'), 'Helmen');
  for (const n of NOMEN) {
    assert.match(mitDativ(n, 1, DEFS), /^(dem|der) /, n.id);
    const pl = pluralOf(n, DEFS);
    if (pl) assert.match(mitDativ(n, 2, DEFS), /^den .*[ns]$/, `${n.id}: Dativ Plural endet auf -n oder -s`);
  }
});

test('Alle Vorlagen mit allen Gegenständen und allen Personen ergeben vollständige Sätze', () => {
  let n = 0;
  for (const v of VERBEN) {
    const anzahl = vorlagenFuer(WS, v).length;
    for (const sd of NOMEN) for (const stern of [1, 2]) for (const person of PERSONEN_FOLGE) for (let k = 0; k < anzahl; k++) {
      const s = verbSatz({ verbDef: v, subjDef: sd, stern, defs: DEFS, ws: WS, person, figur: 'Eadrun', vorlage: k });
      assert.ok(!s.satz.includes('{') && !s.satz.includes('___') && !s.satz.includes('undefined'), s.satz);
      assert.ok(s.satz.startsWith(subjektFuer(person, 'Eadrun') + ' ' + s.form + ' '), s.satz);
      assert.ok(s.satz.includes(' mit ' + mitDativ(sd, stern, DEFS)), s.satz);
      // Der Gegenstand ist nie das Subjekt
      assert.ok(!s.satz.startsWith('Der ') && !s.satz.startsWith('Die ') && !s.satz.startsWith('Das '), s.satz);
      n++;
    }
  }
  assert.ok(n > 1000, `${n} Sätze geprüft`);
});

test('Beispiele aus dem Testlauf', () => {
  const stuermen = DEFS.stuermen;
  assert.equal(verbSatz({ verbDef: stuermen, subjDef: DEFS['eis+speer'], stern: 1, defs: DEFS, ws: WS, person: 'er', figur: 'Eadrun', vorlage: 0 }).satz,
    'Eadrun stürmt mit dem Eisspeer auf die Orks zu.');
  assert.equal(verbSatz({ verbDef: stuermen, subjDef: DEFS.speer, stern: 2, defs: DEFS, ws: WS, person: 'wir', vorlage: 1 }).satz,
    'Wir stürmen mit den Speeren los.');
  assert.equal(subjektFuer('sie', 'Borga'), 'Borga und Eadrun');
  assert.equal(subjektFuer('sie', 'Faelith'), 'Faelith und Borga');
  assert.equal(kurzName('Borga Eisenfaust'), 'Borga');
});

test('Aufgabe aus dem Aufgabensystem: Thema Personalformen, genau eine richtige Antwort, Stufe 3 zum Eintippen', () => {
  const rng = seededRng(4);
  for (const v of VERBEN) for (const person of PERSONEN_FOLGE) for (const stufe of [1, 2, 3]) {
    const inhalt = verbSatzInhalt({ verbDef: v, subjDef: DEFS.speer, stern: 1, defs: DEFS, ws: WS, person, figur: 'Borga', vorlage: 0, stufe, rng });
    assert.equal(inhalt.thema, 'personalformen');
    const a = FORMATE[inhalt.format].erzeuge(inhalt, rng);
    assert.equal(a.format, stufe === 3 ? 'eintippen' : 'luecke');
    assert.ok(FORMATE[a.format].pruefe(a, FORMATE[a.format].loesung(a)).richtig);
    if (a.format === 'luecke') {
      assert.equal(new Set(a.optionen).size, a.optionen.length, 'keine doppelten Antworten');
      assert.equal(a.optionen.filter((o) => FORMATE.luecke.pruefe(a, o).richtig).length, 1, `${v.name}/${person}: genau eine richtig`);
      assert.ok(a.optionen.length >= 3);
    }
    assert.ok(WS.themaRegeln('personalformen').some((r) => r.id === a.regel), a.regel);
  }
});
