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
