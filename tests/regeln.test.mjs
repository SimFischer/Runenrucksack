// Prüft die Grammatik-Regeln, vor allem: Falsch ist nie stärker als richtig.
// Ausführen im Projektordner: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { analyze, buildCompounds, findFusions, EFFECT_KEYS, isNoun } from '../js/grammar.js';
import { Battle, makeFighter, runToEnd } from '../js/battle.js';

const json = (f) => JSON.parse(readFileSync(new URL('../' + f, import.meta.url)));
const ITEMS = json('items.json').items;
const RECIPES = json('recipes.json');
const DEFS = Object.fromEntries(ITEMS.map((d) => [d.id, d]));
const COMPOUNDS = buildCompounds(DEFS, RECIPES);
for (const d of COMPOUNDS) DEFS[d.id] = d;

// Grobe Stärke eines Items im Kampf (pro Sekunde), mit einem typischen Rucksack aus 4 aktiven Items.
function value(d) {
  const passiveShare = 4;
  let v = 0;
  if (d.abklingzeit > 0) {
    const per = (d.schaden || 0) + 0.8 * (d.block || 0) + 0.8 * (d.heilung || 0) + 3 * (d.gift || 0)
      + 2 * (d.brand || 0) + 2 * (d.kaelte || 0) + 8 * (d.betaeubung || 0) + 2.5 * (d.regeneration || 0);
    v += (per / d.abklingzeit) * (1 + (d.tempo || 0) / 100) * (1 + (d.glueck || 0) / 100);
  } else {
    v += ((d.tempo || 0) / 100) * 2.5 * passiveShare + ((d.glueck || 0) / 100) * 2.5 * passiveShare;
  }
  if (d.aura) v += ((d.aura.tempo || 0) + (d.aura.glueck || 0)) / 100 * 2.5 * passiveShare;
  return v + 0.05 * (d.leben || 0) + 0.05 * (d.startblock || 0);
}

let uid = 1;
const P = (id, x, y, rot = 0) => ({ uid: uid++, id, x, y, rot });

test('Komposita: Artikel vom Grundwort, Werte nie schwächer als der Träger', () => {
  assert.ok(COMPOUNDS.length >= 80);
  for (const c of COMPOUNDS) {
    const t = DEFS[c.teile.traeger];
    assert.equal(c.artikel, t.artikel, c.name);
    for (const k of EFFECT_KEYS) assert.ok((c[k] || 0) >= (t[k] || 0), `${c.name}.${k}`);
  }
  assert.equal(DEFS['feuer+schwert'].name, 'Feuerschwert');
  assert.equal(DEFS['feuer+schwert'].artikel, 'das');
  assert.equal(DEFS['gift+bogen'].artikel, 'der');
  assert.equal(DEFS['eis+axt'].name, 'Eisaxt');
});

test('Richtig verschmolzen ist stärker als Kraft und Träger getrennt (falsche Reihenfolge)', () => {
  for (const c of COMPOUNDS) {
    const getrennt = value(DEFS[c.teile.traeger]) + value(DEFS[c.teile.kraft]);
    assert.ok(value(c) >= getrennt, `${c.name}: ${value(c).toFixed(2)} < ${getrennt.toFixed(2)}`);
  }
});

test('Verschmelzen nur, wenn die Kraft links neben oder über dem Träger liegt', () => {
  const sword = () => P('schwert', 1, 0); // 1×2: Felder (1,0) und (1,1)
  const fuse = (k) => findFusions([sword(), k], DEFS, RECIPES);
  assert.equal(fuse(P('feuer', 0, 1))[0]?.id, 'feuer+schwert', 'links');
  assert.equal(fuse(P('feuer', 0, 0))[0]?.id, 'feuer+schwert', 'links oben');
  assert.equal(findFusions([P('schwert', 1, 1), P('feuer', 1, 0)], DEFS, RECIPES)[0]?.id, 'feuer+schwert', 'über');
  assert.equal(fuse(P('feuer', 2, 0)).length, 0, 'rechts: Schwertfeuer gibt es nicht');
  assert.equal(findFusions([P('schwert', 1, 0), P('feuer', 1, 2)], DEFS, RECIPES).length, 0, 'unter');
  assert.equal(findFusions([P('schwert', 1, 0), P('siegel-das', 0, 0)], DEFS, RECIPES).length, 0, 'Siegel ist keine Kraft');
  // Ein Kristall verschmilzt nur einmal, ein Träger nur einmal
  const two = findFusions([P('schwert', 1, 0), P('feuer', 0, 0), P('eis', 0, 1)], DEFS, RECIPES);
  assert.equal(two.length, 1);
});

test('Artikel-Siegel: +25 % nur bei passendem Genus, falsches Siegel wirkt nicht', () => {
  for (const noun of ITEMS.filter(isNoun)) {
    if (noun.w > 1 || noun.h > 1) continue;
    for (const g of ['der', 'die', 'das']) {
      const n = P(noun.id, 1, 0), s = P('siegel-' + g, 0, 0);
      const eff = analyze([n, s], DEFS).get(n.uid).def;
      const right = analyze([n, P('siegel-' + noun.artikel, 0, 0)], DEFS).get(n.uid).def;
      for (const k of EFFECT_KEYS) {
        if (g === noun.artikel) {
          if (noun[k]) assert.ok(eff[k] >= noun[k] * 1.25 - 1e-9, `${noun.name} ${k}`);
        } else {
          assert.equal(eff[k] || 0, noun[k] || 0, `falsches Siegel ${g} bei ${noun.name}`);
        }
        assert.ok((eff[k] || 0) <= (right[k] || 0), 'falsch nie stärker als richtig');
      }
    }
  }
  // nicht benachbart: keine Wirkung
  const n = P('brot', 2, 0);
  assert.equal(analyze([n, P('siegel-das', 0, 0)], DEFS).get(n.uid).def.heilung, DEFS.brot.heilung);
});

test('Adjektiv-Runen: nur wenn der Pfeil auf ein passendes Nomen zeigt', () => {
  const check = (runeId, rot, targetId, expectOk, phrase) => {
    const t = P(targetId, 1, 0), r = P(runeId, 0, 0, rot);
    const i = analyze([t, r], DEFS).get(t.uid);
    assert.equal(i.adjektive.length > 0, expectOk, `${runeId} rot ${rot} → ${targetId}`);
    if (phrase) assert.equal(i.phrase, phrase);
    return i.def;
  };
  check('rune-scharf', 0, 'schwert', true, 'scharfes Schwert');
  check('rune-scharf', 0, 'bogen', true, 'scharfer Bogen');
  check('rune-scharf', 0, 'axt', true, 'scharfe Axt');
  check('rune-schwer', 0, 'schild', true, 'schwerer Schild');
  check('rune-edel', 0, 'brot', true, 'edles Brot');
  check('rune-schnell', 0, 'apfel', true, 'schneller Apfel');
  check('rune-scharf', 0, 'feuer+schwert', true, 'scharfes Feuerschwert');
  // falsche Richtung, unpassendes Nomen, kein Nomen
  for (const rot of [1, 2, 3]) check('rune-scharf', rot, 'schwert', false);
  check('rune-scharf', 0, 'brot', false);
  check('rune-schwer', 0, 'schwert', false);
  check('rune-scharf', 0, 'schlagen', false);
  // Wirkung
  const eff = check('rune-scharf', 0, 'schwert', true);
  assert.equal(eff.schaden, DEFS.schwert.schaden + 3);
  const wrong = check('rune-scharf', 2, 'schwert', false);
  assert.equal(wrong.schaden, DEFS.schwert.schaden);
});

test('Kampf: richtig gelegte Siegel und Runen gewinnen gegen falsch gelegte', () => {
  const build = (genus, runeRot) => [
    P('schwert', 1, 0), P('siegel-' + genus, 0, 0), P('rune-scharf', 2, 0, runeRot),
    P('axt', 3, 0), P('siegel-' + (genus === 'das' ? 'die' : 'der'), 3, 2),
  ];
  let rightWins = 0;
  const N = 60;
  for (let i = 0; i < N; i++) {
    const right = makeFighter('richtig', build('das', 2), DEFS, 5);
    const wrong = makeFighter('falsch', build('der', 0), DEFS, 5);
    if (runToEnd(new Battle(right, wrong)) === 'win') rightWins++;
  }
  assert.ok(rightWins > N * 0.9, `richtig gewinnt nur ${rightWins}/${N}`);
});

test('Neu würfeln: 1-1-1-2-2 Gold, der Zähler beginnt jeden Tag neu', async () => {
  const { newRun, reroll, wuerfelPreis, finishBattle, WUERFEL } = await import('../js/logic.js');
  const items = JSON.parse(readFileSync(new URL('../items.json', import.meta.url))).items;
  const regions = JSON.parse(readFileSync(new URL('../regions.json', import.meta.url))).gebiete;
  const run = newRun(items, regions);
  run.gold = 100;
  const preise = [];
  for (let i = 0; i < 5; i++) { preise.push(wuerfelPreis(run)); reroll(run, items, regions); }
  assert.deepEqual(preise, [1, 1, 1, 2, 2]);
  assert.equal(run.gold, 100 - 7);
  assert.equal(WUERFEL.billig, 3);
  finishBattle(run, items, regions, true, 'Ork');
  assert.equal(wuerfelPreis(run), 1, 'am nächsten Tag wieder billig');
  run.gold = 1;
  assert.ok(reroll(run, items, regions));
  assert.ok(!reroll(run, items, regions), 'ohne Gold kein Wurf');
});

test('Händler-Vertrauen: Stufen verschieben die Seltenheiten, Kosten 6-9-12-15, höchstens eine Stufe pro Tag, wird gespeichert', async () => {
  const L = await import('../js/logic.js');
  const items = json('items.json').items;
  const regions = json('regions.json').gebiete;
  const anteil = (day, stufe, r) => { const w = L.rarityWeights(day, stufe); return w[r] / Object.values(w).reduce((a, b) => a + b, 0); };
  // Stufe 1 wie bisher, jede Stufe verschiebt nach oben
  assert.deepEqual(L.rarityWeights(1, 1), L.rarityWeights(1));
  for (let s = 2; s <= 5; s++) {
    assert.ok(anteil(1, s, 'gewoehnlich') < anteil(1, s - 1, 'gewoehnlich'), `Stufe ${s}: weniger gewöhnliche`);
    assert.ok(anteil(5, s, 'episch') > anteil(5, s - 1, 'episch'), `Stufe ${s}: mehr epische`);
  }
  assert.ok(anteil(1, 2, 'selten') > 1.6 * anteil(1, 1, 'selten'), 'Stufe 2: deutlich mehr seltene');
  assert.ok(anteil(1, 3, 'episch') >= 0.12, 'Stufe 3: epische regelmäßig');
  assert.equal(anteil(1, 3, 'legendaer') < 0.02 && anteil(1, 1, 'legendaer'), 0, 'Tag 1, Stufe 1: keine legendären');
  assert.ok(anteil(1, 4, 'legendaer') > 0.03, 'Stufe 4: legendäre schon an Tag 1 möglich');
  assert.ok(anteil(5, 5, 'legendaer') > 1.4 * anteil(5, 4, 'legendaer'), 'Stufe 5: legendäre häufiger');
  assert.deepEqual(L.HAENDLER.kosten, { 2: 6, 3: 9, 4: 12, 5: 15 });

  const run = L.newRun(items, regions);
  assert.equal(L.haendlerStufe(run), 1, 'jeder Lauf beginnt auf Stufe 1');
  run.gold = 100;
  const laden = JSON.stringify(run.shop);
  assert.ok(L.vertrauenErhoehen(run));
  assert.equal(run.haendler, 2);
  assert.equal(run.gold, 94);
  assert.equal(JSON.stringify(run.shop), laden, 'der aktuelle Laden wird nicht neu gewürfelt');
  assert.equal(L.vertrauenSperre(run), 'heute');
  assert.ok(!L.vertrauenErhoehen(run), 'höchstens eine Stufe pro Tag');
  // Gespeicherter Lauf (JSON im localStorage) enthält die Stufe
  assert.equal(JSON.parse(JSON.stringify(run)).haendler, 2);
  for (let tag = 2; tag <= 4; tag++) { L.finishBattle(run, items, regions, true, 'Ork'); assert.ok(L.vertrauenErhoehen(run), `Tag ${tag}`); }
  assert.equal(run.haendler, 5);
  assert.equal(run.gold, 100 - 6 - 9 - 12 - 15 + [2, 3, 4].reduce((s, d) => s + L.income(d), 0));
  L.finishBattle(run, items, regions, true, 'Ork');
  assert.equal(L.vertrauenSperre(run), 'max');
  run.haendler = 1; run.haendlerTag = 0; run.gold = 5;
  assert.equal(L.vertrauenSperre(run), 'gold');
  // Gegner kaufen mit den Tagen bei einem vertrauteren Händler
  assert.deepEqual([1, 3, 5, 7, 9, 10].map(L.gegnerHaendler), [1, 2, 3, 4, 5, 5]);
});
