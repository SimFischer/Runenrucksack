// Fortschritt zwischen den Läufen: Antworten merken, Erfahrung, Rang, Statistik am Ende eines Laufs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { neuesProfil, merkeAntwort, laufStand, erfahrungFuer, rangVon, laufAbschluss } from '../js/fortschritt.js';

const json = (f) => JSON.parse(readFileSync(new URL('../' + f, import.meta.url)));
const ACH = json('achievements.json');

test('Ränge: Lehrling → Wanderer → Runenkundige → Wortmeister → Hüter der Sprache', () => {
  assert.deepEqual(ACH.raenge.map((r) => r.name), ['Lehrling', 'Wanderer', 'Runenkundige', 'Wortmeister', 'Hüter der Sprache']);
  assert.equal(rangVon(0, ACH.raenge).name, 'Lehrling');
  assert.equal(rangVon(349, ACH.raenge).bisNaechster, 1);
  assert.equal(rangVon(350, ACH.raenge).nr, 2);
  assert.equal(rangVon(99999, ACH.raenge).naechster, null);
});

test('Erfahrung: pro Sieg, pro Entdeckung, pro Frage beim ersten Versuch richtig', () => {
  const run = { wins: 7, over: 'lost', hero: 'borga' };
  merkeAntwort(run, 'mehrzahl', true, true);
  merkeAntwort(run, 'artikel', false);
  merkeAntwort(run, 'artikel', true, false); // zweiter Versuch: richtig, aber ohne Erfahrung
  laufStand(run).neu.push('komp:feuer+axt', 'stufe:axt:2');
  assert.deepEqual(run.prog.regeln, { mehrzahl: [1, 0], artikel: [1, 1] });
  const xp = erfahrungFuer(run, ACH.erfahrung);
  assert.deepEqual(xp, { siege: 70, entdeckungen: 10, ersterVersuch: 2, gesamt: 82 });

  const p = neuesProfil();
  const a = laufAbschluss(p, run, { achievements: ACH });
  assert.equal(p.xp, 82);
  assert.deepEqual(p.stats, { laeufe: 1, siege: 7, richtig: 1 });
  assert.equal(a.aufgestiegen, false);
  assert.deepEqual(p.figurSiege, [], 'verloren: kein Figuren-Sieg');

  const sieg = { wins: 10, over: 'won', hero: 'eadrun' };
  laufStand(sieg).orkFehler = 3;
  const b = laufAbschluss(p, sieg, { achievements: ACH });
  assert.equal(p.stats.ohneFehler, 1, 'gewonnen ohne Fehlversuch');
  assert.equal(p.stats.orkFehler, 3);
  assert.deepEqual(p.figurSiege, ['eadrun']);
  assert.equal(b.nachher.nr, 1);
});
