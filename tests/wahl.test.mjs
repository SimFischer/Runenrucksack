// Aufgabenwahl und Lernstand: Item bestimmt das Thema, Stufen-Bereich, Aufstieg nach zwei richtigen,
// Wiederholung nach einem Fehler (anderes Format, anderes Wort), jedes Wort nur einmal pro Thema und Lauf.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seededRng } from '../js/logic.js';
import { mitRegeln } from '../js/aufgaben/themen.js';
import {
  ITEM_THEMEN, stufenBereich, waehleAufgabe, verbucheAufgabe, stufeFuer, maxStufe, STANDARD_MAX, themenBericht, GOLD_FUER_STUFE, schaetzeLernstand,
} from '../js/aufgaben/wahl.js';

const json = (f) => JSON.parse(readFileSync(new URL('../' + f, import.meta.url)));
const THEMEN = json('themen.json');
const WS = mitRegeln(json('wortschatz.json'), THEMEN);
const basis = (extra = {}) => ({ themen: THEMEN, ws: WS, profil: { lernstand: {} }, einst: null, run: {}, rng: seededRng(5), ...extra });

test('Das Item bestimmt das Thema, die Item-Stufe den Stufen-Bereich', () => {
  assert.deepEqual(stufenBereich(2), [1, 2]);
  assert.deepEqual(stufenBereich(3), [2, 3]);
  assert.deepEqual(stufenBereich(4), [3, 3]);
  const o = basis({ einst: { themen: Object.fromEntries(THEMEN.themen.map((t) => [t.id, 3])) } });
  for (const [art, themen] of Object.entries(ITEM_THEMEN)) {
    for (let k = 0; k < 15; k++) {
      const a = waehleAufgabe({ ...o, art, bereich: [1, 3] });
      assert.ok(themen.includes(a.thema), `${art} → ${a.thema}`);
    }
  }
  // Lernstand im Bereich: Anfänger bekommt bei ★★★ Stufe 2, Profi bei ★★ Stufe 2
  assert.equal(stufeFuer({ lernstand: {} }, o.einst, 'mehrzahl', stufenBereich(3)), 2);
  assert.equal(stufeFuer({ lernstand: { mehrzahl: { stufe: 3, sicher: 0 } } }, o.einst, 'mehrzahl', stufenBereich(2)), 2);
});

test('Standard ohne Klassen-Code: alle Themen, Stufe 1–2; die Lehrkraft kann begrenzen und abschalten', () => {
  assert.equal(STANDARD_MAX, 2);
  assert.equal(maxStufe(null, 'artikel'), 2);
  assert.equal(stufeFuer({ lernstand: {} }, null, 'artikel', stufenBereich(4)), 2, 'auch ★★★★ bleibt ohne Klasse bei Stufe 2');
  const einst = { themen: { mehrzahl: 0, artikel: 1 } };
  for (let k = 0; k < 30; k++) {
    const a = waehleAufgabe(basis({ einst, art: 'nomen', bereich: [1, 3], rng: seededRng(k) }));
    assert.equal(a.thema, 'artikel', 'Mehrzahl ist aus');
    assert.equal(a.stufe, 1, 'Artikel höchstens Stufe 1');
  }
});

test('Zwei richtige beim ersten Versuch → nächste Stufe; Fehler setzt die Sicherheit zurück', () => {
  const profil = { lernstand: {} }, run = {};
  const a = { thema: 'mehrzahl', stufe: 1, format: 'auswahl', wort: 'n:Hund' };
  assert.equal(verbucheAufgabe({ run, profil, aufgabe: a, ergebnis: { richtig: true, ersterVersuch: true } }).aufgestiegen, false);
  assert.equal(verbucheAufgabe({ run, profil, aufgabe: { ...a, wort: 'n:Katze' }, ergebnis: { richtig: true, ersterVersuch: true } }).aufgestiegen, true);
  assert.deepEqual(profil.lernstand.mehrzahl, { stufe: 2, sicher: 0 });
  verbucheAufgabe({ run, profil, aufgabe: { ...a, stufe: 2, wort: 'n:Maus' }, ergebnis: { richtig: true, ersterVersuch: true } });
  verbucheAufgabe({ run, profil, aufgabe: { ...a, stufe: 2, wort: 'n:Haus' }, ergebnis: { richtig: true, ersterVersuch: false } });
  assert.deepEqual(profil.lernstand.mehrzahl, { stufe: 2, sicher: 0 }, 'zweiter Versuch zählt nicht als sicher');
});

test('Ein Fehler kommt 2–4 Aufgaben später zurück – in anderer Form und mit anderem Wort', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const rng = seededRng(seed);
    const o = { ...basis({ rng }), run: {}, profil: { lernstand: {} } };
    const erste = waehleAufgabe({ ...o, art: 'nomen', bereich: [1, 2] });
    verbucheAufgabe({ run: o.run, profil: o.profil, aufgabe: erste, ergebnis: { richtig: false }, rng });
    const faellig = o.run.aufgaben.wiederholen[0].faellig;
    assert.ok(faellig - o.run.aufgaben.zaehler >= 1 && faellig - o.run.aufgaben.zaehler <= 3);
    let wieder = null;
    for (let k = 0; k < 6 && !wieder; k++) {
      const a = waehleAufgabe({ ...o, art: 'verb', bereich: [1, 2] });
      if (a.thema === erste.thema) wieder = { a, k };
      verbucheAufgabe({ run: o.run, profil: o.profil, aufgabe: a, ergebnis: { richtig: true, ersterVersuch: true }, rng });
    }
    assert.ok(wieder, `Seed ${seed}: Wiederholung kam nicht`);
    assert.ok(wieder.k >= 1 && wieder.k <= 3, `Seed ${seed}: nach ${wieder.k + 1} Aufgaben`);
    assert.notEqual(wieder.a.wort, erste.wort, 'anderes Wort');
    const formate = THEMEN.themen.find((t) => t.id === erste.thema).stufen[wieder.a.stufe - 1].formate;
    if (formate.length > 1) assert.notEqual(wieder.a.format, erste.format, `Seed ${seed}: andere Form`);
  }
});

test('Simulation: 30 Aufgaben enthalten mindestens sechs Formate und kein Wort doppelt im selben Thema', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const rng = seededRng(seed);
    const o = { ...basis({ rng }), run: {}, profil: { lernstand: {} } };
    const arten = Object.keys(ITEM_THEMEN), formate = new Set(), gesehen = new Set();
    for (let k = 0; k < 30; k++) {
      const begegnung = k % 5 === 4 ? ['sortieren', 'baukasten', 'passtnicht', 'fehler'][k % 4] : null;
      const a = waehleAufgabe({ ...o, art: arten[k % arten.length], bereich: stufenBereich(2 + (k % 3)), format: begegnung });
      formate.add(a.format);
      const key = `${a.thema}|${a.wort}`;
      assert.ok(!gesehen.has(key), `Seed ${seed}: ${key} doppelt`);
      gesehen.add(key);
      verbucheAufgabe({ run: o.run, profil: o.profil, aufgabe: a, ergebnis: { richtig: rng() < 0.8, ersterVersuch: true }, rng });
    }
    assert.ok(formate.size >= 6, `Seed ${seed}: nur ${[...formate].join(', ')}`);
  }
});

test('Lernbericht: Sterne je geübtem Thema, keine Prozente, Themen mit Fehlern zuerst', () => {
  const run = {}, profil = { lernstand: {} };
  verbucheAufgabe({ run, profil, aufgabe: { thema: 'artikel', stufe: 1, format: 'auswahl', wort: 'n:A' }, ergebnis: { richtig: true, ersterVersuch: true } });
  verbucheAufgabe({ run, profil, aufgabe: { thema: 'artikel', stufe: 1, format: 'auswahl', wort: 'n:B' }, ergebnis: { richtig: true, ersterVersuch: true } });
  verbucheAufgabe({ run, profil, aufgabe: { thema: 'ie', stufe: 1, format: 'auswahl', wort: 'n:C' }, ergebnis: { richtig: false } });
  const b = themenBericht(run, profil, THEMEN);
  assert.deepEqual(b.map((t) => [t.id, t.stufe, t.fehler]), [['ie', 1, 1], ['artikel', 2, 0]]);
  assert.ok(b[0].tipp.length > 10);
  assert.ok(!JSON.stringify(b).includes('%'));
});

test('Belohnung: Stufe 1 nichts, Stufe 2 ein Gold, Stufe 3 zwei Gold', () => {
  assert.deepEqual([1, 2, 3].map((s) => GOLD_FUER_STUFE[s] || 0), [0, 1, 2]);
});

test('Lernstand beim Laufstart neu einschätzen: Startstufe nach Rang, Fehler senkt sie sofort, Treffer bestätigt', () => {
  const themen = ['artikel', 'mehrzahl'];
  const neu = { lernstand: {} };
  schaetzeLernstand(neu, 1, themen);
  assert.deepEqual(neu.lernstand, {}, 'Lehrling: nichts zu schätzen');
  const p = { lernstand: { artikel: { stufe: 1, sicher: 1 } } };
  schaetzeLernstand(p, 4, themen);
  assert.deepEqual(p.lernstand.artikel, { stufe: 1, sicher: 1 }, 'vorhandener Lernstand bleibt');
  assert.deepEqual(p.lernstand.mehrzahl, { stufe: 3, sicher: 0, geschaetzt: true });
  const run = {};
  const aufgabe = { thema: 'mehrzahl', stufe: 3, format: 'luecke', wort: 'n:Apfel' };
  verbucheAufgabe({ run, profil: p, aufgabe, ergebnis: { richtig: false }, rng: () => 0 });
  assert.equal(p.lernstand.mehrzahl.stufe, 2, 'Fehler auf geschätzter Stufe: gleich eine Stufe tiefer');
  verbucheAufgabe({ run, profil: p, aufgabe: { ...aufgabe, stufe: 2 }, ergebnis: { richtig: true, ersterVersuch: true }, rng: () => 0 });
  assert.equal(p.lernstand.mehrzahl.geschaetzt, undefined, 'Treffer bestätigt die Stufe');
  assert.equal(p.lernstand.mehrzahl.stufe, 2);
});
