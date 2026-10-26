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

test('Freischaltungen: Faelith ab Wanderer, Theron nach 3 gewonnenen Läufen, Ysolde ab 25 Einträgen', async () => {
  const { pruefeFreischaltungen, figurFrei, freieItems, bedingungText } = await import('../js/fortschritt.js');
  const { baueBuch } = await import('../js/buch.js');
  const { buildCompounds, buildRuneLevels } = await import('../js/grammar.js');
  const H = json('heroes.json').helden;
  const items = json('items.json').items;
  const defs = Object.fromEntries(items.map((d) => [d.id, d]));
  for (const d of buildCompounds(defs, json('recipes.json'))) defs[d.id] = d;
  for (const d of buildRuneLevels(defs)) defs[d.id] = d;
  const ctx = { achievements: ACH, buch: baueBuch(defs, items, json('recipes.json')), heroes: H };
  const p = neuesProfil();
  const frei = () => H.filter((h) => figurFrei(p, h)).map((h) => h.id);
  assert.deepEqual(frei(), ['borga', 'eadrun']);
  assert.match(bedingungText(H.find((h) => h.id === 'faelith').freischaltung, ctx), /Wanderer/);
  p.xp = 400;
  assert.deepEqual(pruefeFreischaltungen(p, ctx).figuren, ['faelith']);
  p.stats.gewonnen = 3;
  p.buch = ctx.buch.eintraege.slice(0, 25).map((e) => e.id);
  assert.deepEqual(pruefeFreischaltungen(p, ctx).figuren.sort(), ['theron', 'ysolde']);
  p.xp = 0;
  assert.equal(frei().length, 5, 'einmal frei bleibt frei');
  // Bilder der neuen Figuren
  const z = json('assets/zuordnung.json');
  for (const id of ['faelith', 'theron', 'ysolde']) assert.ok(z.figuren[id], id);
  // Items erst nach Freischaltung im Laden
  assert.deepEqual(freieItems(p, items, ctx), ['runenstein'].filter(() => p.buch.length >= 60));
  p.xp = 1200;
  assert.deepEqual(freieItems(p, items, ctx), ['drachenfeuerschwert']);
  const { newRun, shopPool } = await import('../js/logic.js');
  const R = json('regions.json').gebiete;
  const run = newRun(items, R);
  run.day = 6;
  assert.ok(!shopPool(run, items, R).some((d) => d.id === 'drachenfeuerschwert'), 'gesperrt');
  run.freieItems = ['drachenfeuerschwert'];
  assert.ok(shopPool(run, items, R).some((d) => d.id === 'drachenfeuerschwert'), 'frei');
  // Designs: volle Buchseite
  const d = ACH.designs.find((x) => x.id === 'zwergenstahl');
  p.buch.push(...ctx.buch.seiten.find((s) => s.id === 'komposita').eintraege.map((e) => e.id));
  assert.ok(pruefeFreischaltungen(p, ctx).designs.includes(d.id));
});

test('Fähigkeiten: Ysoldes Runen wirken auf zwei Nomen, Theron gibt Startblock bei passendem Siegel', async () => {
  const { evaluateBag, playerContext } = await import('../js/mods.js');
  const { buildRuneLevels } = await import('../js/grammar.js');
  const H = json('heroes.json');
  const items = json('items.json').items;
  const defs = Object.fromEntries(items.map((d) => [d.id, d]));
  for (const d of buildRuneLevels(defs)) defs[d.id] = d;
  const bag = [
    { uid: 1, id: 'rune-scharf', x: 0, y: 0, rot: 0 },
    { uid: 2, id: 'dolch', x: 1, y: 0, rot: 0 },
    { uid: 3, id: 'schwert', x: 2, y: 0, rot: 0 },
    { uid: 4, id: 'siegel-das', x: 3, y: 0, rot: 0 },
  ];
  const ctx = (hero) => playerContext({ hero, day: 1 }, { heroes: H.helden, fates: H.schicksalsrunen });
  const borga = evaluateBag(bag, defs, ctx('borga'));
  const ysolde = evaluateBag(bag, defs, ctx('ysolde'));
  assert.equal(borga.get(3).adjektive.length, 0, 'normal: nur das erste Nomen');
  assert.equal(ysolde.get(3).adjektive.length, 1, 'Ysolde: auch das Schwert dahinter');
  assert.equal(ysolde.get(2).adjektive.length, 1);
  const theron = evaluateBag(bag, defs, ctx('theron'));
  assert.equal(theron.get(3).def.startblock, 3, 'das Schwert neben dem das-Siegel');
  assert.ok(!borga.get(3).def.startblock);
});
