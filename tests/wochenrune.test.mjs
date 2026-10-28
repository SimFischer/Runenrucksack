// Rune der Woche: gleiche Woche und gleicher Klassen-Code → dieselben Läden (auch beim Neu würfeln), Gegner und
// Begegnungen; andere Woche → andere. Das Ergebnis-Siegel enthält Woche und Punkte und erkennt Tippfehler.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  newRun, reroll, finishBattle, pickEnemy, makeEnemy, enemyPool, pickEncounters, laufRng, seededRng, hashText,
} from '../js/logic.js';
import { buildCompounds, buildRuneLevels } from '../js/grammar.js';
import { isoWoche, wochenSeed, ergebnisSiegel, leseSiegel, punkteVon, MAX_PUNKTE } from '../js/wochenrune.js';
import { ALPHABET } from '../js/code.js';

const json = (f) => JSON.parse(readFileSync(new URL('../' + f, import.meta.url)));
const ITEMS = json('items.json').items, REGIONS = json('regions.json').gebiete, ENEMIES = json('enemies.json').gegner;
const H = json('heroes.json'), ENC = json('encounters.json');
const DEFS = Object.fromEntries(ITEMS.map((d) => [d.id, d]));
const COMPOUNDS = buildCompounds(DEFS, json('recipes.json'));
for (const d of COMPOUNDS) DEFS[d.id] = d;
for (const d of buildRuneLevels(DEFS)) DEFS[d.id] = d;

// So startet main.js einen Wochenlauf
function wochenlauf(woche, klasse = null) {
  const seed = wochenSeed(woche, klasse);
  const r = seededRng(seed);
  const hero = H.helden[Math.floor(r() * H.helden.length)];
  const run = newRun(ITEMS, REGIONS, { hero, fates: H.schicksalsrunen, freieItems: ITEMS.filter((d) => d.freischaltung).map((d) => d.id), rng: seededRng(hashText(`${seed}|start`)) });
  run.woche = { ...woche, seed };
  return run;
}
// Ablauf von drei Tagen: Laden, zweimal neu würfeln, Gegner, Begegnungen
function verlauf(run) {
  const out = [];
  for (let tag = 0; tag < 3; tag++) {
    run.gold = 99;
    const laeden = [run.shop.map((s) => s?.id).join()];
    reroll(run, ITEMS, REGIONS); laeden.push(run.shop.map((s) => s?.id).join());
    reroll(run, ITEMS, REGIONS); laeden.push(run.shop.map((s) => s?.id).join());
    const foe = pickEnemy(run.day, REGIONS, ENEMIES, laufRng(run, 'gegner'));
    const enemy = makeEnemy(run.day, foe, enemyPool(ITEMS, COMPOUNDS, run.day), DEFS, laufRng(run, 'gegner-rucksack'));
    const begegnungen = pickEncounters(run, ENC, REGIONS, laufRng(run, 'begegnung'));
    out.push({ fate: run.fate, laeden, gegner: foe.id, rucksack: enemy.items.map((p) => `${p.id}@${p.x},${p.y}`).join(), begegnungen, queue: [...run.queue] });
    finishBattle(run, ITEMS, REGIONS, true, foe.name);
  }
  return out;
}

test('ISO-Kalenderwoche', () => {
  assert.deepEqual(isoWoche(new Date(2021, 0, 3)), { jahr: 2020, woche: 53 });
  assert.deepEqual(isoWoche(new Date(2021, 0, 4)), { jahr: 2021, woche: 1 });
  assert.deepEqual(isoWoche(new Date(2024, 11, 30)), { jahr: 2025, woche: 1 });
  assert.deepEqual(isoWoche(new Date(2026, 9, 28)), { jahr: 2026, woche: 44 });
});

test('Gleiche Woche und Klasse: dieselben Läden (auch neu gewürfelt), Gegner und Begegnungen; andere Woche: andere', () => {
  const w = { jahr: 2026, woche: 44 };
  const klasse = { themen: { artikel: 3, mehrzahl: 2 } };
  const a = verlauf(wochenlauf(w, klasse)), b = verlauf(wochenlauf(w, klasse));
  assert.deepEqual(a, b);
  const c = verlauf(wochenlauf({ jahr: 2026, woche: 45 }, klasse));
  assert.notDeepEqual(a.map((t) => t.laeden), c.map((t) => t.laeden), 'andere Woche, andere Läden');
  const d = verlauf(wochenlauf(w, { themen: { artikel: 1 } }));
  assert.notDeepEqual(a.map((t) => t.laeden), d.map((t) => t.laeden), 'andere Klasse, andere Wochenrune');
  // Ein normaler Lauf nutzt weiter echten Zufall
  assert.equal(laufRng({ day: 1 }, 'laden'), Math.random);
});

test('Ergebnis-Siegel: 4 Zeichen mit Woche und Punkten, jeder Tippfehler und Dreher wird erkannt', () => {
  for (let woche = 1; woche <= 53; woche++) {
    for (const punkte of [0, 5, 335, 1240, MAX_PUNKTE]) {
      const s = ergebnisSiegel(woche, punkte);
      assert.match(s, new RegExp(`^[${ALPHABET}]{4}$`));
      assert.deepEqual(leseSiegel(s), { gueltig: true, woche, punkte });
      for (let i = 0; i < 4; i++) {
        for (const ch of ALPHABET) if (ch !== s[i]) assert.equal(leseSiegel(s.slice(0, i) + ch + s.slice(i + 1)).gueltig, false, `${s} Stelle ${i}`);
        if (i < 3 && s[i] !== s[i + 1]) assert.equal(leseSiegel(s.slice(0, i) + s[i + 1] + s[i] + s.slice(i + 2)).gueltig, false, `${s} Dreher ${i}`);
      }
    }
  }
  assert.equal(leseSiegel(ergebnisSiegel(44, 820).toLowerCase()).punkte, 820, 'Kleinbuchstaben erlaubt');
  assert.equal(leseSiegel('K7Q').gueltig, false);
  assert.match(leseSiegel('K0QM').grund, /kein O/);
});

test('Punkte: Siege, übrige Herzen, erreichter Tag, Aufgaben gleich richtig', () => {
  assert.equal(punkteVon({ wins: 7, hearts: 2, day: 10, prog: { erster: 20 } }), 7 * 100 + 2 * 40 + 10 * 20 + 20 * 5);
  assert.equal(punkteVon({ wins: 3, hearts: -1, day: 8 }), 300 + 0 + 160);
  assert.equal(punkteVon({ wins: 10, hearts: 5, day: 10, prog: { erster: 999 } }), MAX_PUNKTE);
});
