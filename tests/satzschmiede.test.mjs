// Satzschmiede: Satzprüfung (Prädikat an zweiter Stelle, Subjekt und Prädikat stimmen überein, Objekt im richtigen
// Fall) für alle Kartenfolgen; keine unsinnigen Kombinationen; ein falscher Satz ist nie stärker als ein richtiger;
// die Wirkungen entsprechen den Satzgliedern; die Umstellprobe erkennt gültige und ungültige Umstellungen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { karten, pruefeSatz, spruchWerte, umstellen, istUmstellung, satzText, verbucheSatz, schmiedeVerben, schmiedeStern, SPRUCH_DEF } from '../js/satzschmiede.js';
import { applyMod } from '../js/mods.js';

const json = (f) => JSON.parse(readFileSync(new URL('../' + f, import.meta.url)));
const DATEN = json('satzschmiede.json');
const WS = json('wortschatz.json');
const ITEMS = Object.fromEntries(json('items.json').items.map((d) => [d.id, d]));
const ctx = { daten: DATEN, ws: WS };
const FIGUR = { kurz: 'Borga' };
const EULE = { id: 'eule', name: 'Eule', artikel: 'die' };
const pool = (verben, stufe = 3) => karten({ daten: DATEN, ws: WS, figur: FIGUR, begleiter: EULE, verben, stufe });
const finde = (p, text, glied) => p.find((k) => k.text === text && (!glied || k.glied === glied));
const leiste = (p, ...texte) => texte.map((t) => finde(p, t));

test('Jedes Verb der Satzschmiede gibt es als Rolle und im Wortschatz; Objekte und Adverbiale sind bekannt', () => {
  for (const [inf, v] of Object.entries(DATEN.verben)) {
    assert.ok(WS.verben.some((x) => x.infinitiv === inf), inf);
    assert.equal(ITEMS[v.item]?.name, inf, `${inf}: Rolle ${v.item}`);
    for (const o of v.objekte) assert.ok(DATEN.objekte.includes(o), `${inf}: ${o}`);
    for (const typ of ['zeit', 'art', 'ort']) for (const a of v[typ]) assert.equal(DATEN.adverbiale[a]?.typ, typ, `${inf}: ${a}`);
  }
});

test('Beispiele: gültig und ungültig mit verständlicher Erklärung', () => {
  const p = pool(['schlagen', 'heilen']);
  const ok = (...t) => pruefeSatz(leiste(p, ...t), ctx);
  assert.equal(ok('Borga', 'schlägt', 'den Ork').satz, 'Borga schlägt den Ork.');
  assert.ok(ok('Borga', 'schlägt', 'den Ork').gueltig);
  assert.ok(ok('sofort', 'schlägt', 'Borga', 'den Ork').gueltig, 'Prädikat an zweiter Stelle');
  assert.equal(ok('sofort', 'schlägt', 'Borga', 'den Ork').satz, 'Sofort schlägt Borga den Ork.');
  assert.ok(ok('ich', 'heile', 'mich').gueltig);
  assert.ok(ok('die Eule', 'heilt', 'uns', 'vorsichtig').gueltig);
  assert.match(ok('schlägt', 'Borga', 'den Ork').fehler, /Frage/);
  assert.match(ok('Borga', 'den Ork', 'schlägt').fehler, /zweiter Stelle/);
  assert.match(ok('Borga', 'schlage', 'den Ork').fehler, /Borga schlägt/);
  assert.match(ok('wir', 'schlägt', 'den Ork').fehler, /wir schlagen/);
  assert.match(ok('Borga', 'schlägt', 'der Ork').fehler, /„den Ork“/);
  assert.match(ok('Borga', 'heilt', 'den Ork').fehler, /passt nicht/);
  assert.match(ok('Borga', 'schlägt', 'mich').fehler, /passt nicht/);
  assert.match(ok('Borga', 'den Ork').fehler, /Prädikat/);
  assert.match(ok('schlägt', 'den Ork').fehler, /Subjekt|Frage/);
});

test('Alle Kartenfolgen (2–4 Karten): Jeder gültige Satz hält alle Regeln ein und ist sinnvoll', () => {
  const p = pool(['schlagen', 'heilen']);
  let gueltig = 0, geprueft = 0;
  const pruefe = (folge) => {
    geprueft++;
    const r = pruefeSatz(folge, ctx);
    if (!r.gueltig) { assert.ok(r.fehler, satzText(folge)); return; }
    gueltig++;
    const s = folge.find((k) => k.glied === 'subjekt'), pr = folge.find((k) => k.glied === 'praedikat');
    assert.equal(folge.indexOf(pr), 1, `${r.satz}: Prädikat an zweiter Stelle`);
    assert.equal(folge.filter((k) => k.glied === 'subjekt').length, 1, r.satz);
    const v = WS.verben.find((x) => x.infinitiv === pr.verb);
    assert.equal(pr.text, v.praesens[s.person], `${r.satz}: Subjekt und Prädikat stimmen überein`);
    for (const k of folge) {
      assert.ok(!k.falsch, `${r.satz}: keine Karte im falschen Fall`);
      if (k.glied === 'objekt') assert.ok(DATEN.verben[pr.verb].objekte.includes(k.text), `${r.satz}: sinnvolles Objekt`);
      if (['zeit', 'art', 'ort'].includes(k.glied)) assert.ok(DATEN.verben[pr.verb][k.glied].includes(k.text), r.satz);
    }
    if (pr.verb === 'heilen') assert.ok(!/Ork/.test(r.satz), `${r.satz}: niemand heilt einen Ork`);
    if (pr.verb === 'schlagen') assert.ok(!/\b(mich|uns)\b/.test(r.satz), `${r.satz}: niemand schlägt sich selbst`);
  };
  const rek = (folge, rest, max) => {
    if (folge.length >= 2) pruefe(folge);
    if (folge.length === max) return;
    for (let i = 0; i < rest.length; i++) rek([...folge, rest[i]], [...rest.slice(0, i), ...rest.slice(i + 1)], max);
  };
  rek([], p, 4);
  assert.ok(geprueft > 100000 && gueltig > 200, `${geprueft} Folgen geprüft, ${gueltig} gültige Sätze`);
});

test('Ein falscher Satz ist nie stärker: er ergibt keine Spruchrolle. Wirkungen passen zu den Satzgliedern', () => {
  const p = pool(['schlagen']);
  const werte = (...t) => {
    const r = pruefeSatz(leiste(p, ...t), ctx);
    return r.gueltig ? spruchWerte(r, { daten: DATEN, verbDef: ITEMS.schlagen, applyMod }).werte : null;
  };
  assert.equal(werte('Borga', 'schlage', 'den Ork'), null, 'falsch: keine Spruchrolle');
  assert.equal(werte('Borga', 'schlägt', 'der Ork'), null);
  const grund = werte('ich', 'schlage');
  const mitObjekt = werte('ich', 'schlage', 'den Ork');
  assert.ok(grund.schaden >= ITEMS.schlagen.schaden && mitObjekt.schaden > grund.schaden, 'jedes Satzglied mehr macht stärker');
  assert.equal(werte('sofort', 'schlage', 'ich', 'den Ork').sofort, true, 'sofort: gleich zu Beginn');
  assert.equal(werte('ich', 'schlage', 'den Ork', 'am Ende des Kampfes').verzoegerung, 3);
  assert.ok(werte('ich', 'schlage', 'den Ork', 'am Ende des Kampfes').schaden > mitObjekt.schaden, 'später, dafür stärker');
  assert.ok(werte('ich', 'schlage', 'den Ork', 'blitzschnell').abklingzeit < mitObjekt.abklingzeit, 'blitzschnell: schneller');
  assert.ok(werte('ich', 'schlage', 'den Ork', 'mit voller Kraft').schaden > mitObjekt.schaden, 'mit voller Kraft: stärker');
  assert.ok(werte('Borga', 'schlägt', 'den Ork').schaden > mitObjekt.schaden, 'die Figur gibt mehr als „ich“');
  const ige = pool(['schlagen']).map((k) => (k.wer === 'begleiter' ? { ...k, begleiter: 'igel', text: 'der Igel' } : k));
  const r = pruefeSatz([ige.find((k) => k.wer === 'begleiter'), finde(ige, 'schlägt'), finde(ige, 'den Ork')], ctx);
  assert.equal(spruchWerte(r, { daten: DATEN, verbDef: ITEMS.schlagen, applyMod }).werte.startblock, 3, 'Begleiter Igel: Startblock');
  assert.equal(SPRUCH_DEF.w * SPRUCH_DEF.h, 2, 'Spruchrolle belegt zwei Felder');
});

test('Umstellprobe: gültig, solange das Prädikat an zweiter Stelle bleibt – und dann eine Stufe stärker', () => {
  const p = pool(['schlagen']);
  const satz = leiste(p, 'Borga', 'schlägt', 'den Ork', 'sofort');
  const r = pruefeSatz(satz, ctx);
  assert.ok(r.gueltig);
  assert.equal(pruefeSatz(umstellen(satz, 3), ctx).satz, 'Sofort schlägt Borga den Ork.');
  assert.ok(pruefeSatz(umstellen(satz, 3), ctx).gueltig);
  assert.ok(pruefeSatz(umstellen(satz, 2), ctx).gueltig, 'Den Ork schlägt Borga sofort.');
  assert.equal(pruefeSatz(umstellen(satz, 1), ctx).gueltig, false, 'Prädikat vorn: Frage');
  assert.ok(istUmstellung(satz, umstellen(satz, 3), ctx));
  assert.equal(istUmstellung(satz, [satz[3], satz[0], satz[1], satz[2]], ctx), false, 'Prädikat an dritter Stelle');
  assert.equal(istUmstellung(satz, satz, ctx), false, 'nichts umgestellt');
  assert.equal(istUmstellung(satz, [satz[0], satz[1], satz[3], satz[2]], ctx), false, 'gleiches Satzglied vorn');
  const normal = spruchWerte(r, { daten: DATEN, verbDef: ITEMS.schlagen, applyMod });
  const um = spruchWerte(pruefeSatz(umstellen(satz, 3), ctx), { daten: DATEN, verbDef: ITEMS.schlagen, applyMod, umgestellt: true });
  assert.equal(um.stufe, 2);
  assert.ok(um.werte.schaden > normal.werte.schaden);
});

test('Stufen: weniger und einfachere Karten auf niedrigen Stufen; Lernstand und Verben aus dem Rucksack', () => {
  const s1 = pool(['schlagen'], 1), s2 = pool(['schlagen'], 2), s3 = pool(['schlagen'], 3);
  assert.deepEqual([...new Set(s1.map((k) => k.glied))].sort(), ['praedikat', 'subjekt']);
  assert.ok(s2.some((k) => k.glied === 'objekt') && !s2.some((k) => k.glied === 'zeit'));
  assert.ok(s3.some((k) => k.glied === 'zeit') && s3.length > s2.length && s2.length > s1.length);
  assert.ok(s2.some((k) => k.falsch), 'falsche Karten (falscher Fall) ab Stufe 2');
  assert.ok(s1.some((k) => k.glied === 'praedikat' && k.text === 'schlägst'), 'eine falsche Personalform');
  const profil = {};
  verbucheSatz(profil, true);
  assert.equal(verbucheSatz(profil, true).stufe, 2);
  const run = { items: [{ id: 'heilen', area: 'bag' }, { id: 'brennen', area: 'bag' }, { id: 'schlagen', area: 'store' }] };
  assert.deepEqual(schmiedeVerben(run, ITEMS, DATEN), ['heilen'], 'nur Rollen im Rucksack, die zu einer Person passen');
  assert.deepEqual(schmiedeVerben({ items: [] }, ITEMS, DATEN), DATEN.grundverben.slice(0, 2), 'ohne Rolle: Grundverben');
  // Die Spruchrolle wächst mit der Verb-Rolle: ★★-Rolle im Rucksack → ★★-Spruchrolle, Umstellprobe → ★★★
  const run2 = { items: [{ id: 'schlagen', area: 'bag', stern: 2 }, { id: 'schlagen', area: 'store', stern: 3 }] };
  assert.equal(schmiedeStern(run2, ITEMS, 'schlagen'), 2, 'nur Rollen im Rucksack zählen');
  assert.equal(schmiedeStern({ items: [] }, ITEMS, 'schlagen'), 1);
  assert.equal(schmiedeStern({ day: 1, items: [] }, ITEMS, 'schlagen', DATEN), 1);
  assert.equal(schmiedeStern({ day: 3, items: [] }, ITEMS, 'schlagen', DATEN), 2, 'ab Tag 2 mindestens ★★');
  assert.equal(schmiedeStern({ day: 7, items: [] }, ITEMS, 'schlagen', DATEN), 3, 'ab Tag 6 mindestens ★★★');
  assert.equal(schmiedeStern({ day: 3, items: [{ id: 'schlagen', area: 'bag', stern: 3 }] }, ITEMS, 'schlagen', DATEN), 3);
  const p = pool(['schlagen']);
  const r = pruefeSatz(leiste(p, 'Borga', 'schlägt', 'den Ork'), ctx);
  const eins = spruchWerte(r, { daten: DATEN, verbDef: ITEMS.schlagen, applyMod });
  const zwei = spruchWerte(r, { daten: DATEN, verbDef: ITEMS.schlagen, applyMod, stern: 2 });
  const drei = spruchWerte(r, { daten: DATEN, verbDef: ITEMS.schlagen, applyMod, stern: 2, umgestellt: true });
  assert.deepEqual([eins.stufe, zwei.stufe, drei.stufe], [1, 2, 3]);
  assert.ok(eins.werte.schaden < zwei.werte.schaden && zwei.werte.schaden < drei.werte.schaden);
  assert.equal(spruchWerte(r, { daten: DATEN, verbDef: ITEMS.schlagen, applyMod, stern: 4, umgestellt: true }).stufe, 4, 'höchstens ★★★★');
});

test('Im Rucksack: die Spruchrolle wirkt mit den Werten ihres Satzes; „sofort“ und „am Ende des Kampfes“ verschieben den Start', async () => {
  const { evaluateBag } = await import('../js/mods.js');
  const { makeFighter } = await import('../js/battle.js');
  const { canMerge } = await import('../js/sterne.js');
  const defs = { ...ITEMS, spruchrolle: SPRUCH_DEF };
  const p = pool(['schlagen']);
  const rolle = (...t) => {
    const r = pruefeSatz(leiste(p, ...t), ctx);
    const w = spruchWerte(r, { daten: DATEN, verbDef: ITEMS.schlagen, applyMod });
    return { uid: 1, id: 'spruchrolle', area: 'bag', x: 0, y: 0, rot: 0, spruch: { satz: r.satz, werte: w.werte, zeilen: w.zeilen } };
  };
  const a = rolle('sofort', 'schlage', 'ich', 'den Ork');
  const info = evaluateBag([a], defs);
  assert.equal(info.get(1).def.schaden, a.spruch.werte.schaden);
  const f = makeFighter('p', [a], defs, 1, { info });
  assert.equal(f.items[0].t, f.items[0].def.abklingzeit, 'sofort: gleich bereit');
  const b = rolle('ich', 'schlage', 'den Ork', 'am Ende des Kampfes');
  const g = makeFighter('p', [b], defs, 1, { info: evaluateBag([b], defs) });
  assert.equal(g.items[0].t, -3, 'beginnt erst nach 3 Sekunden');
  assert.equal(canMerge(SPRUCH_DEF, 1), false, 'Spruchrollen verschmelzen nicht');
});

test('Die Spruchrolle ist kein Nomen: kein Subjekt für Verb-Rollen, keine Siegel und Runen', async () => {
  const { isNoun } = await import('../js/grammar.js');
  assert.equal(isNoun(SPRUCH_DEF), false);
});
