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

test('Freischaltungen nur über die Erfahrung: Faelith ab Wanderer, Theron ab Runenkundige, Ysolde ab Wortmeister', async () => {
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
  // Buch und Siege zählen nicht mehr (sie liegen nur auf dem Gerät, nicht im Heldencode)
  p.stats.gewonnen = 3;
  p.buch = ctx.buch.eintraege.slice(0, 60).map((e) => e.id);
  assert.deepEqual(pruefeFreischaltungen(p, ctx).figuren, []);
  p.xp = 1200;
  assert.deepEqual(pruefeFreischaltungen(p, ctx).figuren, ['theron']);
  p.xp = 2600;
  assert.deepEqual(pruefeFreischaltungen(p, ctx).figuren, ['ysolde']);
  // Designs über die Ränge verteilt, alle Freischaltungen nur über den Rang
  assert.deepEqual(ACH.designs.filter((d) => d.freischaltung).map((d) => d.freischaltung.rang), [2, 3, 4, 5]);
  for (const x of [...H, ...ACH.designs, ...items]) if (x.freischaltung) assert.deepEqual(Object.keys(x.freischaltung), ['rang'], x.id);
  p.xp = 0;
  assert.equal(frei().length, 5, 'einmal frei bleibt frei');
  // Bilder der neuen Figuren
  const z = json('assets/zuordnung.json');
  for (const id of ['faelith', 'theron', 'ysolde']) assert.ok(z.figuren[id], id);
  // Items erst nach Freischaltung im Laden
  assert.deepEqual(freieItems(p, items, ctx), []);
  p.xp = 1200;
  assert.deepEqual(freieItems(p, items, ctx), ['drachenfeuerschwert', 'runenstein']);
  const { newRun, shopPool } = await import('../js/logic.js');
  const R = json('regions.json').gebiete;
  const run = newRun(items, R);
  run.day = 6;
  assert.ok(!shopPool(run, items, R).some((d) => d.id === 'drachenfeuerschwert'), 'gesperrt');
  run.freieItems = ['drachenfeuerschwert'];
  assert.ok(shopPool(run, items, R).some((d) => d.id === 'drachenfeuerschwert'), 'frei');
  // Designs: mit dem Rang freigeschaltet (bis Wortmeister drei, das Silberbanner erst beim höchsten Rang)
  assert.deepEqual([...p.designs].sort(), ['elbenseide', 'reiterleder', 'zwergenstahl']);
});

test('Erfolge: mindestens 15, jeder erreichbar geprüft; Silberbanner ab dem höchsten Rang', async () => {
  const { pruefeErfolge, pruefeFreischaltungen } = await import('../js/fortschritt.js');
  const { baueBuch } = await import('../js/buch.js');
  const { buildCompounds, buildRuneLevels } = await import('../js/grammar.js');
  const H = json('heroes.json').helden;
  const items = json('items.json').items;
  const R = json('recipes.json');
  const defs = Object.fromEntries(items.map((d) => [d.id, d]));
  for (const d of buildCompounds(defs, R)) defs[d.id] = d;
  for (const d of buildRuneLevels(defs)) defs[d.id] = d;
  const buch = baueBuch(defs, items, R);
  const ctx = { achievements: ACH, buch, heroes: H };
  assert.ok(ACH.erfolge.length >= 15);
  assert.equal(new Set(ACH.erfolge.map((e) => e.id)).size, ACH.erfolge.length);
  for (const n of ['Erstes Kompositum', 'Erste ★★★★', 'Fehlerjäger', 'Satzbauer', 'Ohne Fehlversuch', 'Alle Helden', 'Feuermeister']) {
    assert.ok(ACH.erfolge.some((e) => e.name === n), n);
  }
  for (const e of ACH.erfolge) if (e.bedingung.muster) assert.ok(buch.eintraege.some((x) => x.id.includes(e.bedingung.muster)), e.id);

  const p = neuesProfil();
  assert.deepEqual(pruefeErfolge(p, ctx), []);
  p.stats = { komposita: 1, orkFehler: 10 };
  p.buch = buch.eintraege.filter((x) => x.id.startsWith('komp:feuer+')).map((x) => x.id);
  assert.deepEqual(pruefeErfolge(p, ctx).sort(), ['erstes-kompositum', 'fehlerjaeger', 'feuer-komposita', 'wortsammler']);
  assert.deepEqual(pruefeErfolge(p, ctx), [], 'jeder nur einmal');
  p.figurSiege = H.map((h) => h.id);
  assert.deepEqual(pruefeErfolge(p, ctx), ['alle-figuren']);
  assert.ok(!pruefeFreischaltungen(p, ctx).designs.includes('silberbanner'));
  p.xp = 4000;
  assert.ok(pruefeFreischaltungen(p, ctx).designs.includes('silberbanner'));
});

test('Lernbericht: Das sitzt schon / Das üben wir noch – ohne Prozentzahlen', async () => {
  const { lernbericht } = await import('../js/fortschritt.js');
  const run = { wins: 5 };
  merkeAntwort(run, 'mehrzahl', true, true);
  merkeAntwort(run, 'mehrzahl', true, true);
  merkeAntwort(run, 'artikel', false);
  merkeAntwort(run, 'artikel', true, false);
  merkeAntwort(run, 'rechtschreibung', true, true);
  const b = lernbericht(run);
  assert.deepEqual(b.sitzt.map((r) => r.regel), ['mehrzahl', 'rechtschreibung']);
  assert.deepEqual(b.ueben.map((r) => r.regel), ['artikel']);
  assert.match(b.ueben[0].tipp, /das letzte Wort den Artikel/);
  const text = JSON.stringify(b);
  assert.ok(!/%|Note/.test(text), 'keine Prozentzahlen und keine Noten');
});
