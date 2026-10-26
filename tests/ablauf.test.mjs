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
