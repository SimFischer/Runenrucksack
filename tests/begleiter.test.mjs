// Begleiter-Tiere: Wirkungen, Freischaltung aus der Erfahrung, bleiben im gespeicherten Lauf erhalten,
// verbinden sich nie, lassen sich nicht schmieden und sind kein Ziel für Siegel, Runen oder Verben.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { newRun, finishBattle, reroll, wuerfelPreis, WUERFEL } from '../js/logic.js';
import { buildCompounds, buildRuneLevels, isNoun } from '../js/grammar.js';
import { evaluateBag, playerContext } from '../js/mods.js';
import { makeFighter, Battle } from '../js/battle.js';
import { canMerge, schmiedSperre } from '../js/sterne.js';
import { rangVon } from '../js/fortschritt.js';
import { begleiterDefs, begleiterFrei, nachbarn, BEGLEITER_PREFIX } from '../js/begleiter.js';

const json = (f) => JSON.parse(readFileSync(new URL('../' + f, import.meta.url)));
const ITEMS = json('items.json').items;
const REGIONS = json('regions.json').gebiete;
const B = json('begleiter.json').begleiter;
const RAENGE = json('achievements.json').raenge;
const DEFS = Object.fromEntries(ITEMS.map((d) => [d.id, d]));
for (const d of buildCompounds(DEFS, json('recipes.json'))) DEFS[d.id] = d;
for (const d of buildRuneLevels(DEFS)) DEFS[d.id] = d;
for (const d of begleiterDefs(B)) DEFS[d.id] = d;
const bid = (id) => BEGLEITER_PREFIX + id;
const lauf = (id) => {
  const run = newRun(ITEMS, REGIONS, { begleiter: DEFS[bid(id)] });
  run.items = run.items.filter((p) => DEFS[p.id].art === 'begleiter');
  return run;
};

test('Sechs Begleiter mit Bild, Text und Wirkung; Freischaltung nur über den Rang', () => {
  assert.deepEqual(B.map((b) => b.id).sort(), ['eule', 'falke', 'fuchs', 'igel', 'pony', 'rabe']);
  for (const b of B) {
    assert.ok(b.text && b.name && b.artikel && b.wirkung, b.id);
    assert.ok(!b.freischaltung || Object.keys(b.freischaltung).join() === 'rang', `${b.id}: nur über den Rang`);
  }
  const frei = (xp) => B.filter((b) => begleiterFrei(b, rangVon(xp, RAENGE).nr)).map((b) => b.id).sort();
  assert.deepEqual(frei(0), ['eule', 'igel']);
  assert.deepEqual(frei(350), ['eule', 'igel', 'pony']);
  assert.deepEqual(frei(1200), ['eule', 'fuchs', 'igel', 'pony']);
  assert.deepEqual(frei(2600), ['eule', 'fuchs', 'igel', 'pony', 'rabe']);
  assert.deepEqual(frei(4000), B.map((b) => b.id).sort());
});

test('Begleiter liegt als 1×1-Gegenstand im Rucksack und bleibt im gespeicherten Lauf erhalten', () => {
  const run = newRun(ITEMS, REGIONS, { hero: json('heroes.json').helden[0], begleiter: DEFS[bid('igel')] });
  const p = run.items.find((q) => q.id === bid('igel'));
  assert.ok(p && p.area === 'bag', 'im Rucksack');
  assert.equal(run.begleiter, 'igel');
  const gespeichert = JSON.parse(JSON.stringify(run)); // so liegt der Lauf im localStorage
  assert.equal(gespeichert.begleiter, 'igel');
  assert.ok(gespeichert.items.some((q) => q.id === bid('igel')));
});

test('Begleiter verbinden sich nie, lassen sich nicht schmieden und sind kein Nomen-Ziel', () => {
  for (const b of B) {
    const d = DEFS[bid(b.id)];
    assert.equal(canMerge(d), false, b.id);
    assert.equal(isNoun(d), false, b.id);
    assert.equal(schmiedSperre({ day: 1, gold: 999 }, { id: d.id }, DEFS), 'art', b.id);
  }
});

test('Eule: Nomen daneben +10 %; Pony: Nachbarn 10 % schneller; Igel: 3 Startblock, sobald etwas daneben liegt', () => {
  const at = (id, x, y, uid) => ({ uid, id, area: 'bag', x, y, rot: 0 });
  // Eule bei (1,0), Dolch links daneben, Apfel weit weg
  let bag = [at(bid('eule'), 1, 0, 1), at('dolch', 0, 0, 2), at('dolch', 3, 2, 3)];
  let info = evaluateBag(bag, DEFS, {});
  assert.ok(isNoun(DEFS.dolch));
  assert.equal(info.get(2).def.schaden, Math.ceil(DEFS.dolch.schaden * 1.1 - 1e-9), 'Nachbar +10 %');
  assert.equal(info.get(3).def.schaden, DEFS.dolch.schaden, 'weit weg: unverändert');
  assert.deepEqual(nachbarn(bag[0], bag, DEFS).map((q) => q.uid), [2]);
  // Pony
  bag = [at(bid('pony'), 1, 0, 1), at('dolch', 0, 0, 2), at('dolch', 3, 2, 3)];
  info = evaluateBag(bag, DEFS, {});
  assert.ok(info.get(2).def.abklingzeit < DEFS.dolch.abklingzeit, 'schneller');
  assert.equal(info.get(3).def.abklingzeit, DEFS.dolch.abklingzeit);
  // Igel
  const allein = evaluateBag([at(bid('igel'), 0, 0, 1)], DEFS, {});
  assert.equal(makeFighter('p', [at(bid('igel'), 0, 0, 1)], DEFS, 1, { info: allein }).block, 0, 'allein: kein Startblock');
  bag = [at(bid('igel'), 1, 0, 1), at('dolch', 0, 0, 2)];
  assert.equal(makeFighter('p', bag, DEFS, 1, { info: evaluateBag(bag, DEFS, {}) }).block, 3);
});

test('Falke: der erste Angriff im Kampf trifft doppelt, danach normal', () => {
  const bag = [{ uid: 1, id: 'dolch', area: 'bag', x: 0, y: 0, rot: 0 }];
  const me = makeFighter('p', bag, DEFS, 1, { ersterAngriffDoppelt: true, rng: () => 0.99 });
  const foe = makeFighter('e', [], DEFS, 1, { rng: () => 0.99 });
  const b = new Battle(me, foe);
  const vorher = foe.hp;
  b.trigger('player', me, 'enemy', foe, me.items[0], []);
  const erster = vorher - foe.hp;
  b.trigger('player', me, 'enemy', foe, me.items[0], []);
  const zweiter = vorher - erster - foe.hp;
  assert.equal(erster, 2 * DEFS.dolch.schaden);
  assert.equal(zweiter, DEFS.dolch.schaden);
  // Nur mit dem Falken im Rucksack
  const run = lauf('falke');
  assert.equal(playerContext(run, { begleiter: B }).ersterAngriffDoppelt, true);
  run.items[0].area = 'store';
  assert.equal(playerContext(run, { begleiter: B }).ersterAngriffDoppelt, undefined, 'im Lager wirkt er nicht');
});

test('Fuchs: einmal am Tag kostenlos neu würfeln; Rabe: zeigt den Fehler und bringt 1 Gold je Sieg', () => {
  const run = lauf('fuchs');
  run.gold = 10;
  assert.equal(wuerfelPreis(run), 0);
  reroll(run, ITEMS, REGIONS);
  assert.equal(run.gold, 10, 'erster Wurf kostenlos');
  assert.equal(wuerfelPreis(run), WUERFEL.preis);
  reroll(run, ITEMS, REGIONS);
  assert.equal(run.gold, 9);
  finishBattle(run, ITEMS, REGIONS, true, 'Ork');
  assert.equal(wuerfelPreis(run), 0, 'am nächsten Tag wieder einer frei');

  const rabe = lauf('rabe');
  assert.equal(playerContext(rabe, { begleiter: B }).ruestungMarkieren, true);
  const g = rabe.gold;
  finishBattle(rabe, ITEMS, REGIONS, true, 'Ork');
  const mitSieg = rabe.gold - g;
  const ohne = lauf('igel');
  const g2 = ohne.gold;
  finishBattle(ohne, ITEMS, REGIONS, true, 'Ork');
  assert.equal(mitSieg - (ohne.gold - g2), 1, 'Rabe: +1 Gold je Sieg');
});
