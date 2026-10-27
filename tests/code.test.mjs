// Heldencode mit 6 Zeichen: immer 6 Zeichen, Roundtrip, jeder Tippfehler und jeder Dreher wird erkannt, Rang,
// Figuren und Designs folgen aus der Erfahrung. Alte, lange Helden- und Reisecodes werden weiter gelesen (ihr Aufbau
// wird unten vollständig geprüft) und umgerechnet: Erfahrung und Tutorial werden übernommen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCompounds, buildRuneLevels } from '../js/grammar.js';
import { baueBuch } from '../js/buch.js';
import { neuesProfil, pruefeFreischaltungen, rangVon } from '../js/fortschritt.js';
import { newRun, growBag, attachTasche } from '../js/logic.js';
import {
  ALPHABET, registryAus, heldencode, alterHeldencode, alterReisecode, leseCode, leseAltenCode, MAX_XP, CodeFehler, fehlerText, saeubern, STAT_KEYS, klassenCode, leseKlassenCode, istKlassenCode,
} from '../js/code.js';
import { aktuelleIds } from '../tools/registry.mjs';

const json = (f) => JSON.parse(readFileSync(new URL('../' + f, import.meta.url)));
const ITEMS = json('items.json').items;
const RECIPES = json('recipes.json');
const DEFS = Object.fromEntries(ITEMS.map((d) => [d.id, d]));
for (const d of buildCompounds(DEFS, RECIPES)) DEFS[d.id] = d;
for (const d of buildRuneLevels(DEFS)) DEFS[d.id] = d;
const H = json('heroes.json');
const ACH = json('achievements.json');
const BUCH = baueBuch(DEFS, ITEMS, RECIPES);
const REGJSON = json('registry.json');
const REG = registryAus(REGJSON);
const DATA = { defs: DEFS, heroes: H.helden, fates: H.schicksalsrunen, encounters: json('encounters.json'), exercises: json('exercises.json') };

// Listen sind im Code sortiert gespeichert – für den Vergleich ebenso sortieren.
const norm = (p) => ({ ...p, buch: [...p.buch].sort(), erfolge: [...p.erfolge].sort(), figuren: [...p.figuren].sort(), designs: [...p.designs].sort(), figurSiege: [...p.figurSiege].sort(), regeln: [...(p.regeln || [])].sort() });

function anfaenger() {
  return { ...neuesProfil(), xp: 164, buch: ['komp:feuer+axt', 'stufe:axt:2'], stats: { laeufe: 1, siege: 6, richtig: 12 }, tutorial: true };
}
function mittel() {
  const p = neuesProfil();
  p.xp = 1650;
  p.buch = BUCH.eintraege.filter((_, i) => i % 4 === 0).map((e) => e.id);
  p.erfolge = ACH.erfolge.slice(0, 6).map((e) => e.id);
  p.figuren = ['faelith'];
  p.figurSiege = ['borga', 'eadrun'];
  p.stats = { laeufe: 12, siege: 85, gewonnen: 4, orkFehler: 40, saetze: 22, komposita: 30, sterne4: 2, richtig: 260 };
  p.tutorial = true;
  return p;
}
function voll() {
  const p = neuesProfil();
  p.xp = 98765;
  p.buch = BUCH.eintraege.map((e) => e.id);
  p.erfolge = ACH.erfolge.map((e) => e.id);
  p.figuren = H.helden.filter((h) => h.freischaltung).map((h) => h.id);
  p.designs = ACH.designs.filter((d) => d.freischaltung).map((d) => d.id);
  p.design = 'silberbanner';
  p.figurSiege = H.helden.map((h) => h.id);
  p.stats = Object.fromEntries(STAT_KEYS.map((k, i) => [k, 1000 + i * 77]));
  p.tutorial = true;
  const THEMEN = json('themen.json').themen;
  p.lernstand = Object.fromEntries(THEMEN.map((t, i) => [t.id, { stufe: 1 + (i % 3), sicher: 1 + (i % 3) }]));
  p.regeln = THEMEN.flatMap((t) => t.regeln.map((x) => x.id));
  p.klasse = { themen: Object.fromEntries(THEMEN.map((t, i) => [t.id, i % 4])) };
  return p;
}

// ---------- Heldencode mit 6 Zeichen ----------

const FORMAT = new RegExp(`^[${ALPHABET}]{3}-[${ALPHABET}]{3}$`);
const XP_PROBEN = [0, 1, 2, 30, 164, 349, 350, 1199, 1200, 2600, 4000, 12345, 98765, MAX_XP - 1, MAX_XP];

test('Heldencode: immer 6 Zeichen (zwei Dreiergruppen), auch bei höchster Erfahrung; einlesen ergibt denselben Stand', (t) => {
  for (const xp of XP_PROBEN) {
    for (const tutorial of [false, true]) {
      const code = heldencode({ ...neuesProfil(), xp, tutorial });
      assert.match(code, FORMAT, `${xp}: ${code}`);
      assert.ok(!/[01OIL]/.test(code), 'keine verwechselbaren Zeichen');
      assert.deepEqual(leseCode(code, REG, DATA), { typ: 'held', xp, tutorial, alt: false });
    }
  }
  // Mehr Erfahrung wird gekappt – der Code bleibt 6 Zeichen lang
  assert.match(heldencode({ xp: MAX_XP * 10, tutorial: true }), FORMAT);
  assert.equal(leseCode(heldencode({ xp: MAX_XP * 10 }), REG, DATA).xp, MAX_XP);
  assert.ok(MAX_XP > 100 * ACH.raenge.at(-1).ab, 'die Kappung liegt weit über dem höchsten Rang');
  // Buch, Erfolge, Statistik und Lernstand stehen nicht im Code: gleicher Code für gleiche Erfahrung
  assert.equal(heldencode(voll()), heldencode({ ...neuesProfil(), xp: voll().xp, tutorial: true }));
  t.diagnostic(`Beispiele: ${[0, 350, 4000, 98765].map((xp) => heldencode({ xp, tutorial: true })).join(', ')}`);
});

test('Heldencode: jeder einzelne Tippfehler und jeder Dreher zweier Nachbarzeichen wird erkannt', () => {
  const codes = [...XP_PROBEN, ...Array.from({ length: 300 }, (_, i) => (i * 7919) % (MAX_XP + 1))]
    .flatMap((xp) => [false, true].map((tutorial) => saeubern(heldencode({ xp, tutorial }))));
  let tippfehler = 0, dreher = 0;
  for (const roh of codes) {
    for (let i = 0; i < 6; i++) {
      for (const ch of ALPHABET) {
        if (ch === roh[i]) continue;
        assert.throws(() => leseCode(roh.slice(0, i) + ch + roh.slice(i + 1), REG, DATA), CodeFehler, `${roh}: Stelle ${i} → ${ch}`);
        tippfehler++;
      }
      if (i < 5 && roh[i] !== roh[i + 1]) {
        assert.throws(() => leseCode(roh.slice(0, i) + roh[i + 1] + roh[i] + roh.slice(i + 2), REG, DATA), CodeFehler, `${roh}: Dreher ${i}`);
        dreher++;
      }
    }
  }
  assert.ok(tippfehler > 10000 && dreher > 1000, `${tippfehler} Tippfehler, ${dreher} Dreher geprüft`);
});

test('Heldencode eingeben: Bindestrich optional, Kleinbuchstaben und Leerzeichen erlaubt, freundliche Meldungen', () => {
  const code = heldencode({ xp: 1650, tutorial: true }), roh = saeubern(code);
  for (const eingabe of [code, roh, roh.toLowerCase(), ` ${roh.slice(0, 3)} ${roh.slice(3)} `, code.toLowerCase()]) {
    assert.equal(leseCode(eingabe, REG, DATA).xp, 1650, eingabe);
  }
  const meldung = (txt) => { try { leseCode(txt, REG, DATA); } catch (e) { return fehlerText(e); } return ''; };
  assert.match(meldung(roh.slice(0, 5)), /zu kurz.*6 Zeichen/);
  assert.match(meldung(roh + 'A'), /zu viele Zeichen/);
  assert.match(meldung(roh.slice(0, 2) + 'O' + roh.slice(3)), /kein O und keine Null/);
  assert.match(meldung(roh.slice(0, 2) + '1' + roh.slice(3)), /keine 1/);
  assert.match(meldung(roh.slice(0, 2) + (roh[2] === 'A' ? 'B' : 'A') + roh.slice(3)), /Tippfehler.*vertauscht/);
  assert.match(meldung(roh[1] + roh[0] + roh.slice(2)) || 'gleiche Zeichen', /Tippfehler|gleiche Zeichen/);
});

test('Rang, Figuren und Designs ergeben sich aus der Erfahrung im Code', () => {
  const ctx = { achievements: ACH, buch: BUCH, heroes: H.helden };
  const nachCode = (xp) => {
    const r = leseCode(heldencode({ xp, tutorial: true }), REG, DATA);
    const p = { ...neuesProfil(), xp: r.xp, tutorial: r.tutorial };
    pruefeFreischaltungen(p, ctx);
    return { rang: rangVon(p.xp, ACH.raenge).id, figuren: [...p.figuren].sort(), designs: [...p.designs].sort() };
  };
  assert.deepEqual(nachCode(0), { rang: 'lehrling', figuren: [], designs: [] });
  assert.deepEqual(nachCode(350), { rang: 'wanderer', figuren: ['faelith'], designs: ['zwergenstahl'] });
  assert.deepEqual(nachCode(1200), { rang: 'runenkundige', figuren: ['faelith', 'theron'], designs: ['elbenseide', 'zwergenstahl'] });
  assert.deepEqual(nachCode(2600), { rang: 'wortmeister', figuren: ['faelith', 'theron', 'ysolde'], designs: ['elbenseide', 'reiterleder', 'zwergenstahl'] });
  assert.deepEqual(nachCode(4000).designs, ['elbenseide', 'reiterleder', 'silberbanner', 'zwergenstahl']);
});

test('Alte, lange Codes werden umgerechnet: Erfahrung und Tutorial (auch aus Reisecodes)', () => {
  assert.deepEqual(leseCode(alterHeldencode(voll(), REG), REG, DATA), { typ: 'held', xp: 98765, tutorial: true, alt: true, altTyp: 'held' });
  const reise = alterReisecode(mittel(), vollerLauf(), REG, DATA);
  assert.deepEqual(leseCode(reise, REG, DATA), { typ: 'held', xp: 1650, tutorial: true, alt: true, altTyp: 'reise' });
  // Ein Tippfehler im alten Code wird weiterhin erkannt
  const roh = saeubern(GOLDEN);
  assert.throws(() => leseCode(roh.slice(0, 7) + (roh[7] === 'A' ? 'B' : 'A') + roh.slice(8), REG, DATA), CodeFehler);
});

test('registry.json enthält jede aktuelle id (neue Inhalte: node tools/registry.mjs)', () => {
  const da = new Set(REGJSON.eintraege);
  const fehlt = aktuelleIds().filter((id) => !da.has(id));
  assert.deepEqual(fehlt, [], 'fehlende Einträge – bitte node tools/registry.mjs ausführen');
  assert.equal(da.size, REGJSON.eintraege.length, 'keine doppelten Einträge');
});

test('Alter Heldencode: exakt derselbe Stand beim Lesen, Länge wächst mit', (t) => {
  for (const [name, p] of [['Anfänger', anfaenger()], ['Mittelstand', mittel()], ['voller Fortschritt', voll()]]) {
    const code = alterHeldencode(p, REG);
    t.diagnostic(`Heldencode ${name}: ${saeubern(code).length} Zeichen – ${code.length > 60 ? code.slice(0, 59) + '…' : code}`);
    assert.match(code, new RegExp(`^[${ALPHABET}]{1,5}(-[${ALPHABET}]{1,5})*$`));
    assert.ok(!/[01OIL]/.test(code), 'keine verwechselbaren Zeichen');
    const r = leseAltenCode(code, REG, DATA);
    assert.equal(r.typ, 'held');
    assert.deepEqual(norm(r.profil), norm(p), name);
  }
  assert.ok(saeubern(alterHeldencode(anfaenger(), REG)).length <= 40, 'Anfänger-Code ist kurz');
  assert.deepEqual(leseAltenCode(alterHeldencode(neuesProfil(), REG), REG, DATA).profil, neuesProfil());
});

test('Alter Code: Bindestriche optional, Kleinbuchstaben erlaubt; Tippfehler und Dreher werden erkannt', () => {
  const code = alterHeldencode(mittel(), REG);
  const roh = saeubern(code);
  assert.deepEqual(norm(leseAltenCode(roh.toLowerCase(), REG, DATA).profil), norm(mittel()));
  assert.deepEqual(norm(leseAltenCode(' ' + code.replace(/-/g, ' ') + ' ', REG, DATA).profil), norm(mittel()));
  let erkannt = 0, versuche = 0;
  for (let i = 0; i < roh.length; i++) {
    for (const ch of ALPHABET) {
      if (ch === roh[i]) continue;
      versuche++;
      try { leseAltenCode(roh.slice(0, i) + ch + roh.slice(i + 1), REG, DATA); } catch (e) { if (e instanceof CodeFehler) erkannt++; }
    }
  }
  assert.equal(erkannt, versuche, 'jedes einzelne falsche Zeichen wird erkannt');
  for (let i = 0; i + 1 < roh.length; i++) {
    if (roh[i] === roh[i + 1]) continue;
    const dreher = roh.slice(0, i) + roh[i + 1] + roh[i] + roh.slice(i + 2);
    assert.throws(() => leseAltenCode(dreher, REG, DATA), CodeFehler, `Dreher an Stelle ${i}`);
  }
  assert.throws(() => leseAltenCode(roh.slice(0, -3), REG, DATA), CodeFehler, 'zu kurz abgeschrieben');
  const meldung = (txt) => { try { leseAltenCode(txt, REG, DATA); } catch (e) { return fehlerText(e); } return ''; };
  assert.match(meldung(roh.slice(0, 4) + 'O' + roh.slice(5)), /kein O und keine Null/);
  assert.match(meldung(roh.slice(0, 4) + '1' + roh.slice(5)), /keine 1/);
  assert.match(meldung(roh.slice(0, 4) + (roh[4] === 'A' ? 'B' : 'A') + roh.slice(5)), /Tippfehler/);
});

test('Alter Code bleibt gültig, wenn neue Inhalte hinten angehängt werden', () => {
  const code = alterHeldencode(voll(), REG);
  const mehr = registryAus({ eintraege: [...REGJSON.eintraege, 'item:neues-schwert', 'komp:licht+schwert', 'erfolg:neu', 'held:neu'] });
  assert.deepEqual(norm(leseAltenCode(code, mehr, DATA).profil), norm(voll()));
});

test('Gespeicherter Code aus Version 1 lässt sich weiterhin lesen', () => {
  // Dieser Code wurde mit dem ersten Stand der registry.json erzeugt und darf nie ungültig werden.
  const ALT = GOLDEN;
  const r = leseAltenCode(ALT, REG, DATA);
  assert.equal(r.typ, 'held');
  assert.equal(r.profil.xp, 164);
  assert.deepEqual(r.profil.buch.sort(), ['komp:feuer+axt', 'stufe:axt:2']);
  assert.deepEqual(r.profil.stats, { laeufe: 1, siege: 6, richtig: 12 });
  assert.equal(r.profil.tutorial, true);
  // Umgerechnet: Erfahrung und Tutorial
  assert.deepEqual(leseCode(ALT, REG, DATA), { typ: 'held', xp: 164, tutorial: true, alt: true, altTyp: 'held' });
});
const GOLDEN = 'RWV6D-8AWXP-UXKUP-EQHE4-FGCHA-NM6U8-GK5PA';

// ---------- Reisecode ----------

function vollerLauf() {
  const run = newRun(ITEMS, json('regions.json').gebiete, { hero: H.helden.find((h) => h.id === 'eadrun'), fates: [H.schicksalsrunen.find((f) => f.id === 'markt')], freieItems: ['drachenfeuerschwert'] });
  Object.assign(run, { day: 7, hearts: 3, wins: 5, losses: 1, gold: 23, unterklasse: 'lanzenfuehrerin', queue: [] });
  run.history = [true, true, false, true, true, true].map((won, i) => ({ day: i + 1, won, enemy: '' }));
  run.history.at(-1).begegnung = 'hirtin';
  run.mods = [json('encounters.json').begegnungen.find((b) => b.id === 'hirtin').belohnung.mod];
  growBag(run); growBag(run); growBag(run); growBag(run); growBag(run);
  attachTasche(run, DEFS.satteltasche);
  run.lernen = { richtig: 30, falsch: 4 };
  const bag = [
    ['feuer+speer', 0, 0, 0, { stern: 3, kraftStern: 2 }], ['stuermen', 1, 0, 1, {}], ['schild', 2, 0, 0, { stern: 2, glanz: 1 }],
    ['rune-scharf@4', 4, 0, 2, {}], ['siegel-der', 4, 1, 0, {}], ['dolch', 4, 2, 0, { stern: 4 }],
    ['eis+bogen', 0, 2, 1, {}], ['apfel', 2, 2, 0, {}], ['brot', 3, 2, 0, {}],
    ['honig', 0, 3, 0, {}], ['karotte', 1, 3, 0, {}], ['hafer', 2, 3, 0, { stern: 2 }], ['zaumzeug', 3, 3, 0, {}], ['horn', 4, 3, 0, {}],
    ['mond+laterne', 5, 2, 0, { fluch: 'Mondlatterne' }], ['heiltrank', 5, 3, 0, {}],
  ];
  const store = [['gift', 0, 0, 0, {}], ['blitz', 1, 0, 0, { stern: 2 }], ['axt', 2, 0, 0, {}], ['rune-gut@2', 3, 0, 3, {}],
    ['schlagen', 0, 1, 0, { satz: null }], ['siegel-das', 1, 1, 0, {}], ['kuerbis', 3, 1, 0, {}], ['pfanne', 3, 2, 0, {}]];
  run.items = [];
  let uid = 1;
  for (const [area, list] of [['bag', bag], ['store', store]]) {
    for (const [id, x, y, rot, extra] of list) run.items.push({ uid: uid++, id, area, x, y, rot, ...extra });
  }
  const rolle = run.items.find((p) => p.id === 'stuermen');
  rolle.satz = { uid: 1, id: 'feuer+speer', stern: 3, ok: true };
  run.items.find((p) => p.id === 'schlagen').satz = { uid: 3, id: 'schild', stern: 2, ok: false };
  for (const p of run.items) if (p.satz === null) delete p.satz;
  run.nextUid = uid;
  run.shop = [{ id: 'axt', locked: true }, null, { id: 'feuer', locked: false }, { id: 'rune-gut', locked: true }, { id: 'satteltasche', locked: false }, { id: 'speer', locked: false }];
  run.gekonnt = { 'mehrzahl|axt': 3, 'artikel|feuer+speer': 1, 'praeteritum|schlagen': 2, 'steigerung|rune-scharf@2': 3 };
  run.prog = { neu: ['komp:feuer+speer', 'stufe:dolch:4'], erster: 21, fehler: 3, orkFehler: 4, saetze: 2, komposita: 3, sterne4: 1,
    regeln: { mehrzahl: [8, 1], artikel: [5, 0], personalform: [2, 1], rechtschreibung: [6, 1] } };
  run.rabatt = 2;
  run.aufgaben = { zaehler: 17, benutzt: {}, wiederholen: [{ thema: 'mehrzahl', stufe: 2, format: 'luecke', wort: null, faellig: 19 }, { thema: 'ie', stufe: 3, format: 'fehler', wort: null, faellig: 20 }] };
  return run;
}

// Vergleich ohne Felder, die nur zur Laufzeit existieren (Gegnernamen im Verlauf).
const laufNorm = (r) => ({ ...r, history: r.history.map(({ enemy, ...h }) => h), bagCells: [...r.bagCells].sort(), taschenFelder: r.taschenFelder });

test('Alter Reisecode: voller Rucksack mit Stufen, Drehung, Sätzen, Fluch, Laden und gekonnten Fragen', (t) => {
  const run = vollerLauf();
  const code = alterReisecode(mittel(), run, REG, DATA);
  t.diagnostic(`Reisecode (voller Rucksack, Mittelstand): ${saeubern(code).length} Zeichen`);
  const r = leseAltenCode(code, REG, DATA);
  assert.equal(r.typ, 'reise', 'erkennt selbst, dass es ein Reisecode ist');
  assert.deepEqual(norm(r.profil), norm(mittel()));
  const erwartet = laufNorm(run);
  delete erwartet.version;
  delete erwartet.haendler; // kennt der alte Reisecode nicht (liegt nur im gespeicherten Lauf)
  const ist = laufNorm(r.run);
  delete ist.version;
  for (const k of Object.keys(erwartet)) assert.deepEqual(ist[k], erwartet[k], k);
  assert.equal(r.run.items.find((p) => p.id === 'mond+laterne').fluch, 'Mondlatterne');
  const anfang = alterReisecode(anfaenger(), newRun(ITEMS, json('regions.json').gebiete, { hero: H.helden[0] }), REG, DATA);
  t.diagnostic(`Reisecode (Tag 1, Anfänger): ${saeubern(anfang).length} Zeichen`);
});

test('Alter Code: Lernstand, Regelkarten und Klasse nur angehängt, wenn vorhanden', () => {
  // Ohne Lernstand ist der Code genau so lang wie früher (alte Codes und alte Leser bleiben passend)
  assert.equal(alterHeldencode(anfaenger(), REG), alterHeldencode({ ...anfaenger(), lernstand: { artikel: { stufe: 1, sicher: 0 } } }, REG));
  const p = { ...anfaenger(), lernstand: { mehrzahl: { stufe: 3, sicher: 1 }, ie: { stufe: 2, sicher: 0 } }, regeln: ['ie-lang'], klasse: { themen: { artikel: 3, ie: 0 } } };
  const r = leseAltenCode(alterHeldencode(p, REG), REG, DATA).profil;
  assert.deepEqual(r.lernstand, p.lernstand);
  assert.deepEqual(r.regeln, ['ie-lang']);
  assert.equal(r.klasse.themen.artikel, 3);
  assert.equal(r.klasse.themen.ie, 0, 'ausgeschaltet bleibt aus');
  assert.equal(r.klasse.themen.mehrzahl, 2, 'nicht eingestellt: Standard 1–2');
  assert.equal(Object.keys(r.klasse.themen).length, json('themen.json').themen.length);
});

test('Klassen-Code: THEMEN-…, kurz, exakt dieselben Einstellungen, Tippfehler erkannt', (t) => {
  const THEMEN = json('themen.json').themen;
  const einst = { themen: Object.fromEntries(THEMEN.map((x, i) => [x.id, i % 4])) };
  const code = klassenCode(einst, REG);
  t.diagnostic(`Klassen-Code: ${code}`);
  assert.match(code, /^THEMEN-[23456789A-HJKMNP-Z-]+$/);
  assert.ok(saeubern(code).length <= 6 + 10, 'kurz genug zum Abtippen');
  assert.ok(istKlassenCode(code.toLowerCase().replace(/-/g, ' ')));
  assert.ok(!istKlassenCode(GOLDEN));
  assert.deepEqual(leseKlassenCode(code, REG), einst);
  // Standard: alle Themen bis Stufe 2
  assert.ok(Object.values(leseKlassenCode(klassenCode({ themen: {} }, REG), REG).themen).every((m) => m === 2));
  // Ein Tippfehler wird erkannt
  const roh = saeubern(code), i = roh.length - 3;
  assert.throws(() => leseKlassenCode(roh.slice(0, i) + (roh[i] === 'A' ? 'B' : 'A') + roh.slice(i + 1), REG), CodeFehler);
  // Neue Themen (hinten in registry.json) sind bei einem alten Klassen-Code aus
  const mehr = registryAus({ eintraege: [...REGJSON.eintraege, 'thema:neu'] });
  assert.equal(leseKlassenCode(code, mehr).themen.neu, 0);
});

test('Dichte Listen werden als Bitfeld gespeichert (voller Fortschritt bleibt abschreibbar)', () => {
  const p = voll();
  // mit allen Regelkarten, vollem Lernstand und Klassen-Einstellungen (zusammen etwa 22 Byte mehr)
  assert.ok(saeubern(alterHeldencode(p, REG)).length < 200, `voller Fortschritt: ${saeubern(alterHeldencode(p, REG)).length} Zeichen`);
  // Mischung: einzelne weit auseinander liegende Einträge bleiben Abstands-Listen
  const q = { ...neuesProfil(), buch: [BUCH.eintraege[0].id, BUCH.eintraege.at(-1).id] };
  assert.deepEqual(norm(leseAltenCode(alterHeldencode(q, REG), REG, DATA).profil), norm(q));
});
