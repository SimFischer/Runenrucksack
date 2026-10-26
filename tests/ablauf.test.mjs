// Prüft den Ablauf eines Laufs: Gebiete, Bosse, Ende nach Tag 10.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newRun, finishBattle, regionOf, pickEnemy, isBossDay, CFG } from '../js/logic.js';

const json = (f) => JSON.parse(readFileSync(new URL('../' + f, import.meta.url)));
const ITEMS = json('items.json').items;
const REGIONS = json('regions.json').gebiete;
const ENEMIES = json('enemies.json').gegner;

test('Gebiete: Kleinwurzel Tag 1–5, Hrossmark Tag 6–10', () => {
  for (let d = 1; d <= 5; d++) assert.equal(regionOf(d, REGIONS).id, 'kleinwurzel');
  for (let d = 6; d <= 10; d++) assert.equal(regionOf(d, REGIONS).id, 'hrossmark');
  for (const r of REGIONS) {
    assert.ok(r.name && r.wortfeld && r.stimmung?.oben && r.stimmung?.unten, r.id);
    for (const id of [...r.gegner, r.boss]) assert.ok(ENEMIES.find((e) => e.id === id), `Gegner ${id} fehlt`);
  }
});

test('Bosse: Ork-Plünderer an Tag 5, Wolfsreiter-Häuptling an Tag 10', () => {
  assert.equal(pickEnemy(5, REGIONS, ENEMIES).name, 'Ork-Plünderer');
  assert.equal(pickEnemy(10, REGIONS, ENEMIES).name, 'Wolfsreiter-Häuptling');
  for (const d of [1, 2, 3, 4, 6, 7, 8, 9]) {
    assert.equal(isBossDay(d, REGIONS), false);
    assert.ok(!pickEnemy(d, REGIONS, ENEMIES).boss, `Tag ${d}`);
  }
});

test('Ein Lauf endet nach Tag 10 oder ohne Herzen; Übergang an Tag 6', () => {
  const run = newRun(ITEMS, REGIONS);
  assert.deepEqual(run.queue, ['gebiet']);
  for (let d = 1; d < CFG.lastDay; d++) {
    finishBattle(run, ITEMS, REGIONS, d % 3 !== 0, 'Ork');
    assert.equal(run.over, null);
    assert.equal(run.day, d + 1);
    assert.equal(run.queue.includes('gebiet'), d + 1 === 6, `Tag ${d + 1}`);
  }
  finishBattle(run, ITEMS, REGIONS, true, 'Häuptling');
  assert.equal(run.over, 'won');

  const lost = newRun(ITEMS, REGIONS);
  for (let i = 0; i < CFG.hearts; i++) finishBattle(lost, ITEMS, REGIONS, false, 'Ork');
  assert.equal(lost.over, 'lost');
});

test('Startfiguren: Start-Items und Boni', async () => {
  const { playerContext, evaluateBag } = await import('../js/mods.js');
  const { buildCompounds } = await import('../js/grammar.js');
  const HEROES = json('heroes.json').helden;
  const DEFS = Object.fromEntries(ITEMS.map((d) => [d.id, d]));
  for (const c of buildCompounds(DEFS, json('recipes.json'))) DEFS[c.id] = c;
  const borga = HEROES.find((h) => h.id === 'borga'), eadrun = HEROES.find((h) => h.id === 'eadrun');

  const run = newRun(ITEMS, REGIONS, { hero: borga });
  assert.deepEqual(run.items.map((p) => p.id).sort(), ['axt', 'feuer']);
  assert.equal(newRun(ITEMS, REGIONS, { hero: eadrun }).items.map((p) => p.id).sort().join(), 'speer,stuermen');

  const fs = [{ uid: 1, id: 'feuer+schwert', x: 0, y: 0, rot: 0 }, { uid: 2, id: 'schwert', x: 1, y: 0, rot: 0 }];
  const b = evaluateBag(fs, DEFS, playerContext({ hero: 'borga' }, { heroes: HEROES }));
  assert.equal(b.get(1).def.schaden, Math.ceil(DEFS['feuer+schwert'].schaden * 1.2));
  assert.equal(b.get(2).def.schaden, DEFS.schwert.schaden, 'Borga stärkt nur Komposita');

  const vs = [{ uid: 1, id: 'stuermen', x: 0, y: 0, rot: 0 }, { uid: 2, id: 'speer', x: 1, y: 0, rot: 0 }];
  const e = evaluateBag(vs, DEFS, playerContext({ hero: 'eadrun' }, { heroes: HEROES }));
  assert.ok(Math.abs(e.get(1).def.abklingzeit - DEFS.stuermen.abklingzeit * 0.8) < 0.06);
  assert.equal(e.get(2).def.abklingzeit, DEFS.speer.abklingzeit, 'Eadrun beschleunigt nur Verben');
});

test('Ork-Rüstungen: 3–5 Fehler, je genau eine richtige Schreibung', () => {
  for (const e of ENEMIES) {
    assert.ok(e.fehler.length >= 3 && e.fehler.length <= 5, e.id);
    for (const f of e.fehler) {
      assert.equal(f.optionen.length, 3, `${e.id}: ${f.falsch}`);
      assert.equal(new Set(f.optionen).size, 3);
      assert.equal(f.optionen.filter((o) => o === f.richtig).length, 1);
      assert.ok(f.optionen.includes(f.falsch) && f.falsch !== f.richtig);
      assert.ok(f.erklaerung);
    }
  }
});

test('Schicksalsrunen und Unterklassen wirken', async () => {
  const { playerContext } = await import('../js/mods.js');
  const { seededRng } = await import('../js/logic.js');
  const H = json('heroes.json');
  assert.equal(H.schicksalsrunen.length, 6);
  for (const h of H.helden) assert.equal(h.unterklassen.length, 2, h.id);

  // Jede Schicksalsrune kommt vor, der Lauf beginnt mit ihrer Anzeige.
  const seen = new Set();
  for (let s = 1; s < 200 && seen.size < 6; s++) seen.add(newRun(ITEMS, REGIONS, { fates: H.schicksalsrunen, rng: seededRng(s) }).fate);
  assert.equal(seen.size, 6);
  const markt = newRun(ITEMS, REGIONS, { fates: [H.schicksalsrunen.find((f) => f.id === 'markt')] });
  assert.equal(markt.shop.length, 6);
  assert.deepEqual(markt.queue, ['schicksal', 'gebiet']);
  const gold = newRun(ITEMS, REGIONS, { fates: [H.schicksalsrunen.find((f) => f.id === 'gold')] });
  const before = gold.gold;
  finishBattle(gold, ITEMS, REGIONS, true, 'Ork');
  assert.equal(gold.gold - before, 8 + 2 + 2, 'Einkommen Tag 2 plus 2 Gold');

  const data = { heroes: H.helden, fates: H.schicksalsrunen };
  assert.equal(playerContext({ fate: 'leben', day: 4 }, data).leben, 20);
  assert.equal(playerContext({ fate: 'siegel', day: 1 }, data).siegelBonus, 0.5);
  assert.equal(playerContext({ hero: 'eadrun', unterklasse: 'sturmreiterin', day: 6 }, data).tempo, 15);
  assert.equal(playerContext({ hero: 'borga', unterklasse: 'wortweberin', fate: 'worte', day: 6 }, data).runeMult, 4);

  // Unterklasse wird bei der Ankunft in Hrossmark (Tag 6) gewählt.
  const run = newRun(ITEMS, REGIONS);
  for (let d = 1; d < 6; d++) finishBattle(run, ITEMS, REGIONS, true, 'Ork');
  assert.equal(run.day, 6);
  assert.deepEqual(run.queue, ['gebiet', 'unterklasse', 'begegnung', 'verschmelzen']);
});

test('Wortfeld-Taschen: +2 Felder, passende Items darin +20 %', async () => {
  const { attachTasche, shopPool, bagGrid } = await import('../js/logic.js');
  const { evaluateBag, playerContext } = await import('../js/mods.js');
  const DEFS = Object.fromEntries(ITEMS.map((d) => [d.id, d]));
  const WF = json('items.json').wortfelder;
  for (const d of ITEMS) assert.ok(WF[d.wortfeld], `${d.id} braucht ein Wortfeld`);
  const garten = DEFS.gartentasche, sattel = DEFS.satteltasche;
  assert.equal(garten.wortfeld, 'haus');
  assert.equal(sattel.wortfeld, 'pferd');

  const run = newRun(ITEMS, REGIONS);
  assert.ok(shopPool(run, ITEMS, REGIONS).some((d) => d.id === 'gartentasche'));
  assert.ok(!shopPool(run, ITEMS, REGIONS).some((d) => d.id === 'satteltasche'), 'Satteltasche nur in Hrossmark');
  attachTasche(run, garten);
  assert.equal(run.bagCells.length, 14);
  assert.ok(!shopPool(run, ITEMS, REGIONS).some((d) => d.id === 'gartentasche'), 'nur einmal kaufbar');
  assert.equal(bagGrid(run).taschen['5,0'], 'gartentasche');

  const items = [
    { uid: 1, id: 'brot', area: 'bag', x: 5, y: 0, rot: 0 },   // Haus und Garten in der Gartentasche
    { uid: 2, id: 'dolch', area: 'bag', x: 5, y: 1, rot: 0 },  // Schmiede: kein Bonus
    { uid: 3, id: 'apfel', area: 'bag', x: 0, y: 0, rot: 0 },  // außerhalb
  ];
  run.items = items;
  const info = evaluateBag(items, DEFS, playerContext(run));
  assert.equal(info.get(1).def.heilung, Math.ceil(DEFS.brot.heilung * 1.2));
  assert.equal(info.get(2).def.schaden, DEFS.dolch.schaden);
  assert.equal(info.get(2).tasche.ok, false);
  assert.equal(info.get(3).def.heilung, DEFS.apfel.heilung);
});
