// Heldencode und Reisecode: erzeugen → einlesen ergibt exakt denselben Stand; Tippfehler werden erkannt;
// alte Codes bleiben gültig, wenn hinten neue Inhalte angehängt werden. Die Ausgabe nennt die Codelängen.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildCompounds, buildRuneLevels } from '../js/grammar.js';
import { baueBuch } from '../js/buch.js';
import { neuesProfil } from '../js/fortschritt.js';
import { newRun, growBag, attachTasche } from '../js/logic.js';
import { ALPHABET, registryAus, heldencode, reisecode, leseCode, CodeFehler, fehlerText, saeubern, STAT_KEYS } from '../js/code.js';
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
const norm = (p) => ({ ...p, buch: [...p.buch].sort(), erfolge: [...p.erfolge].sort(), figuren: [...p.figuren].sort(), designs: [...p.designs].sort(), figurSiege: [...p.figurSiege].sort() });

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
  return p;
}

test('registry.json enthält jede aktuelle id (neue Inhalte: node tools/registry.mjs)', () => {
  const da = new Set(REGJSON.eintraege);
  const fehlt = aktuelleIds().filter((id) => !da.has(id));
  assert.deepEqual(fehlt, [], 'fehlende Einträge – bitte node tools/registry.mjs ausführen');
  assert.equal(da.size, REGJSON.eintraege.length, 'keine doppelten Einträge');
});

test('Heldencode: Format, exakt derselbe Stand, Länge wächst mit', (t) => {
  for (const [name, p] of [['Anfänger', anfaenger()], ['Mittelstand', mittel()], ['voller Fortschritt', voll()]]) {
    const code = heldencode(p, REG);
    t.diagnostic(`Heldencode ${name}: ${saeubern(code).length} Zeichen – ${code.length > 60 ? code.slice(0, 59) + '…' : code}`);
    assert.match(code, new RegExp(`^[${ALPHABET}]{1,5}(-[${ALPHABET}]{1,5})*$`));
    assert.ok(!/[01OIL]/.test(code), 'keine verwechselbaren Zeichen');
    const r = leseCode(code, REG, DATA);
    assert.equal(r.typ, 'held');
    assert.deepEqual(norm(r.profil), norm(p), name);
  }
  assert.ok(saeubern(heldencode(anfaenger(), REG)).length <= 40, 'Anfänger-Code ist kurz');
  assert.deepEqual(leseCode(heldencode(neuesProfil(), REG), REG, DATA).profil, neuesProfil());
});

test('Eingabe: Bindestriche optional, Kleinbuchstaben erlaubt; Tippfehler und Dreher werden erkannt', () => {
  const code = heldencode(mittel(), REG);
  const roh = saeubern(code);
  assert.deepEqual(norm(leseCode(roh.toLowerCase(), REG, DATA).profil), norm(mittel()));
  assert.deepEqual(norm(leseCode(' ' + code.replace(/-/g, ' ') + ' ', REG, DATA).profil), norm(mittel()));
  let erkannt = 0, versuche = 0;
  for (let i = 0; i < roh.length; i++) {
    for (const ch of ALPHABET) {
      if (ch === roh[i]) continue;
      versuche++;
      try { leseCode(roh.slice(0, i) + ch + roh.slice(i + 1), REG, DATA); } catch (e) { if (e instanceof CodeFehler) erkannt++; }
    }
  }
  assert.equal(erkannt, versuche, 'jedes einzelne falsche Zeichen wird erkannt');
  for (let i = 0; i + 1 < roh.length; i++) {
    if (roh[i] === roh[i + 1]) continue;
    const dreher = roh.slice(0, i) + roh[i + 1] + roh[i] + roh.slice(i + 2);
    assert.throws(() => leseCode(dreher, REG, DATA), CodeFehler, `Dreher an Stelle ${i}`);
  }
  assert.throws(() => leseCode(roh.slice(0, -3), REG, DATA), CodeFehler, 'zu kurz abgeschrieben');
  const meldung = (txt) => { try { leseCode(txt, REG, DATA); } catch (e) { return fehlerText(e); } return ''; };
  assert.match(meldung(roh.slice(0, 4) + 'O' + roh.slice(5)), /kein O und keine Null/);
  assert.match(meldung(roh.slice(0, 4) + '1' + roh.slice(5)), /keine 1/);
  assert.match(meldung(roh.slice(0, 4) + (roh[4] === 'A' ? 'B' : 'A') + roh.slice(5)), /Tippfehler/);
});

test('Alter Code bleibt gültig, wenn neue Inhalte hinten angehängt werden', () => {
  const code = heldencode(voll(), REG);
  const mehr = registryAus({ eintraege: [...REGJSON.eintraege, 'item:neues-schwert', 'komp:licht+schwert', 'erfolg:neu', 'held:neu'] });
  assert.deepEqual(norm(leseCode(code, mehr, DATA).profil), norm(voll()));
});

test('Gespeicherter Code aus Version 1 lässt sich weiterhin lesen', () => {
  // Dieser Code wurde mit dem ersten Stand der registry.json erzeugt und darf nie ungültig werden.
  const ALT = GOLDEN;
  const r = leseCode(ALT, REG, DATA);
  assert.equal(r.typ, 'held');
  assert.equal(r.profil.xp, 164);
  assert.deepEqual(r.profil.buch.sort(), ['komp:feuer+axt', 'stufe:axt:2']);
  assert.deepEqual(r.profil.stats, { laeufe: 1, siege: 6, richtig: 12 });
  assert.equal(r.profil.tutorial, true);
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
    ['feuer+speer', 0, 0, 0, { stern: 3, kraftStern: 2 }], ['stuermen', 1, 0, 1, {}], ['schild', 2, 0, 0, { stern: 2 }],
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
  return run;
}

// Vergleich ohne Felder, die nur zur Laufzeit existieren (Gegnernamen im Verlauf).
const laufNorm = (r) => ({ ...r, history: r.history.map(({ enemy, ...h }) => h), bagCells: [...r.bagCells].sort(), taschenFelder: r.taschenFelder });

test('Reisecode: voller Rucksack mit Stufen, Drehung, Sätzen, Fluch, Laden und gekonnten Fragen', (t) => {
  const run = vollerLauf();
  const code = reisecode(mittel(), run, REG, DATA);
  t.diagnostic(`Reisecode (voller Rucksack, Mittelstand): ${saeubern(code).length} Zeichen`);
  const r = leseCode(code, REG, DATA);
  assert.equal(r.typ, 'reise', 'erkennt selbst, dass es ein Reisecode ist');
  assert.deepEqual(norm(r.profil), norm(mittel()));
  const erwartet = laufNorm(run);
  delete erwartet.version;
  const ist = laufNorm(r.run);
  delete ist.version;
  for (const k of Object.keys(erwartet)) assert.deepEqual(ist[k], erwartet[k], k);
  assert.equal(r.run.items.find((p) => p.id === 'mond+laterne').fluch, 'Mondlatterne');
  const anfang = reisecode(anfaenger(), newRun(ITEMS, json('regions.json').gebiete, { hero: H.helden[0] }), REG, DATA);
  t.diagnostic(`Reisecode (Tag 1, Anfänger): ${saeubern(anfang).length} Zeichen`);
});

test('Dichte Listen werden als Bitfeld gespeichert (voller Fortschritt bleibt abschreibbar)', () => {
  const p = voll();
  assert.ok(saeubern(heldencode(p, REG)).length < 160, `voller Fortschritt: ${saeubern(heldencode(p, REG)).length} Zeichen`);
  // Mischung: einzelne weit auseinander liegende Einträge bleiben Abstands-Listen
  const q = { ...neuesProfil(), buch: [BUCH.eintraege[0].id, BUCH.eintraege.at(-1).id] };
  assert.deepEqual(norm(leseCode(heldencode(q, REG), REG, DATA).profil), norm(q));
});
