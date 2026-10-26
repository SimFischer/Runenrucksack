// Aufgabenformate: Für jedes Format liefert die Erzeugung genau eine richtige Lösung, falsche Antworten sind
// nie zufällig richtig, und alle Formate sind auf allen Stufen erzeugbar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { erzeugeInhalt, mitRegeln } from '../js/aufgaben/themen.js';
import { FORMATE } from '../js/aufgaben/formate/index.js';
import { seededRng } from '../js/logic.js';

const json = (f) => JSON.parse(readFileSync(new URL('../' + f, import.meta.url)));
const THEMEN = json('themen.json');
const WS = mitRegeln(json('wortschatz.json'), THEMEN);

function alleAufgaben(n = 25, seed = 11) {
  const rng = seededRng(seed);
  const out = [];
  for (const t of THEMEN.themen) for (let s = 1; s <= 3; s++) for (const f of t.stufen[s - 1].formate) {
    for (let k = 0; k < n; k++) {
      const inhalt = erzeugeInhalt(THEMEN, t.id, s, { ws: WS, rng, felder: ['wald'], benutzt: new Set() }, f);
      out.push(FORMATE[inhalt.format].erzeuge(inhalt, rng));
    }
  }
  return out;
}

test('Mindestens zehn Formate, jedes mit Erzeugung, Darstellung und Prüfung', () => {
  assert.ok(Object.keys(FORMATE).length >= 10);
  for (const [id, f] of Object.entries(FORMATE)) {
    for (const fn of ['erzeuge', 'darstelle', 'pruefe', 'loesung', 'gross']) assert.equal(typeof f[fn], 'function', `${id}.${fn}`);
  }
});

test('Jede Aufgabe: Die Lösung ist richtig, und genau eine Antwort ist richtig', () => {
  const genutzt = new Set();
  for (const a of alleAufgaben()) {
    const f = FORMATE[a.format];
    genutzt.add(a.format);
    assert.equal(f.pruefe(a, f.loesung(a)).richtig, true, `${a.thema}/${a.stufe}/${a.format}: Lösung ist richtig`);
    const antworten = f.antworten?.(a);
    if (antworten) {
      const richtige = antworten.filter((x) => f.pruefe(a, x).richtig);
      assert.equal(richtige.length, 1, `${a.thema}/${a.stufe}/${a.format}: genau eine richtige Antwort (${antworten})`);
    }
    if (a.format === 'sortieren') {
      // jede Karte passt in genau eine Kiste
      for (const k of a.karten) {
        const passt = a.kisten.filter((kiste) => f.pruefe(a, { ...f.loesung(a), [k.nr]: kiste.id }).richtig);
        assert.equal(passt.length, 1, `${a.thema}: Karte ${k.text}`);
      }
    }
    if (a.format === 'ordnen' && a.modus !== 'antippen') {
      assert.notDeepEqual(a.karten.slice(a.fest || 0), a.loesung.slice(a.fest || 0), 'Karten sind gemischt');
      assert.equal(f.pruefe(a, [...a.loesung].reverse()).richtig, false);
    }
    if (a.format === 'paare') assert.ok(!a.rechtsReihe.every((x, i) => x === i), 'Paare sind gemischt');
    if (a.format === 'fehler' && a.modus === 'verbessern') {
      const falschesWort = a.optionen.find((o) => o !== a.korrektur[a.ziele[0]]);
      assert.equal(f.pruefe(a, { idx: a.ziele[0], wort: falschesWort }).richtig, false, 'falsch verbessert ist falsch');
      const anderes = a.woerter.findIndex((_, i) => !a.ziele.includes(i));
      assert.equal(f.pruefe(a, { idx: anderes }).richtig, false, 'falsches Wort angetippt');
    }
    if (a.format === 'buchstaben') assert.equal(f.pruefe(a, f.loesung(a).map(() => 'q')).richtig, false);
    if (a.format === 'eintippen') assert.equal(f.pruefe(a, a.loesung + 'x').richtig, false);
  }
  for (const id of Object.keys(FORMATE)) assert.ok(genutzt.has(id), `Format ${id} kommt in den Themen vor`);
});
