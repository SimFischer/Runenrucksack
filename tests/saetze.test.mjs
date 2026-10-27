// Sinnvolle Sätze: Jedes Wort hat eigene Sätze (Bedeutungsgruppe, Einzahl, Mehrzahl, Zeitformen, Steigerung),
// jede Aufgabe mit Satz nimmt einen Satz genau dieses Worts, das Wort (oder die Lücke) steht genau einmal darin,
// und im Code gibt es keine Schablonen mehr, in die beliebige Wörter eingesetzt werden.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { erzeugeInhalt, mitRegeln, THEMA_IDS, fehlerSatz } from '../js/aufgaben/themen.js';
import { GRUPPEN, zaehle, praeteritum, rahmenSatz, alleVerbSaetze, artikelSatz } from '../js/aufgaben/saetze.js';
import { lueckeHtml } from '../js/aufgaben/formate/luecke.js';
import { frageFuer } from '../js/sterne.js';
import { seededRng } from '../js/logic.js';

const json = (f) => JSON.parse(readFileSync(new URL('../' + f, import.meta.url)));
const quelle = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const THEMEN = json('themen.json');
const WS = mitRegeln(json('wortschatz.json'), THEMEN);
const ITEMS = json('items.json').items;

// Alle Sätze eines Worts, nach dem Schlüssel der Aufgabe (n:, v:, a:)
const SAETZE = new Map();
for (const n of WS.nomen) SAETZE.set('n:' + n.wort, new Set([...n.saetze, n.mehrzahlSatz]));
for (const v of WS.verben) SAETZE.set('v:' + v.infinitiv, new Set(alleVerbSaetze(v)));
for (const a of WS.adjektive) SAETZE.set('a:' + a.positiv, new Set(Object.values(a.saetze)));
const ALLE_VERB_SAETZE = new Set(WS.verben.flatMap(alleVerbSaetze));
const ohneHtml = (t) => t.replace(/<[^>]+>/g, '');

test('Jedes Nomen: Bedeutungsgruppe, zwei Sätze mit dem Wort, ein Mehrzahl-Satz', () => {
  const gruppen = new Set(Object.values(GRUPPEN));
  for (const n of WS.nomen) {
    assert.ok(gruppen.has(n.gruppe), `${n.wort}: Gruppe ${n.gruppe}`);
    assert.ok(n.saetze.length >= 2, n.wort);
    for (const s of n.saetze) assert.equal(zaehle(s, n.wort), 1, `${n.wort}: ${s}`);
    assert.equal(zaehle(n.mehrzahlSatz, n.plural), 1, `${n.wort}: ${n.mehrzahlSatz}`);
    const a = artikelSatz(n);
    if (a) assert.ok(a.toLowerCase().startsWith(n.artikel + ' '), `${n.wort}: Artikel im Satz „${a}“`);
  }
  for (const g of gruppen) assert.ok(WS.nomen.some((n) => n.gruppe === g), `Gruppe ${g} kommt vor`);
});

test('Jedes Verb: Sätze mit wechselnden Personen in Präsens, Präteritum und Perfekt', () => {
  for (const v of WS.verben) {
    assert.ok(v.rahmen.length >= 3, v.infinitiv);
    assert.ok(v.rahmen.some((r) => r.person === 'er'), `${v.infinitiv}: Satz mit er/sie/es`);
    assert.ok(new Set(v.rahmen.map((r) => r.person)).size >= 2, `${v.infinitiv}: verschiedene Personen`);
    for (const r of v.rahmen) {
      for (const z of ['praesens', 'praeteritum', 'perfekt']) {
        const s = rahmenSatz(v, r, z);
        assert.equal(zaehle(s.luecke, '___'), 1, s.luecke);
        assert.equal(s.luecke.replace('___', s.form), s.satz);
        assert.ok(/^[A-ZÄÖÜ]/.test(s.satz) && s.satz.endsWith('.'), s.satz);
      }
    }
  }
  assert.equal(rahmenSatz(WS.verben.find((v) => v.infinitiv === 'schmieden'), { person: 'er', subjekt: 'Borga', rest: 'ein Schwert' }, 'perfekt').satz,
    'Borga hat ein Schwert geschmiedet.');
  // Präteritum für jede Person
  assert.equal(praeteritum({ praeteritum: 'spielte' }, 'wir'), 'spielten');
  assert.equal(praeteritum({ praeteritum: 'ging' }, 'sie'), 'gingen');
  assert.equal(praeteritum({ praeteritum: 'fand' }, 'ihr'), 'fandet');
  assert.equal(praeteritum({ praeteritum: 'las' }, 'du'), 'lasest');
});

test('Jedes Adjektiv: Sätze mit Grundform, Komparativ und Superlativ', () => {
  for (const a of WS.adjektive) {
    for (const stufe of ['positiv', 'komparativ', 'superlativ']) {
      assert.equal(a.saetze[stufe].split(a[stufe]).length, 2, `${a.positiv}: ${a.saetze[stufe]}`);
    }
  }
});

test('Jede Aufgabe mit Satz nimmt einen Satz genau dieses Worts – Wort oder Lücke genau einmal', () => {
  let n = 0;
  for (const thema of THEMA_IDS) {
    const t = THEMEN.themen.find((x) => x.id === thema);
    t.stufen.forEach((st, i) => {
      for (const format of st.formate) {
        for (let seed = 1; seed <= 40; seed++) {
          const c = erzeugeInhalt(THEMEN, thema, i + 1, { ws: WS, rng: seededRng(seed * 7 + i), felder: [], benutzt: new Set() }, format);
          const wo = `${thema} ${i + 1} ${c.format}`;
          // Die Sätze dieser Aufgabe, ausgefüllt
          const saetze = [];
          if (c.format === 'luecke') {
            assert.equal(zaehle(c.satz, '___') + (c.satz.match(/___[^\s.,!?]/g) || []).length, 1, `${wo}: genau eine Lücke in „${c.satz}“`);
            saetze.push(c.satz.replace('___', c.richtig));
          }
          if (c.format === 'auswahl' && c.text && /\.$/.test(ohneHtml(c.text))) saetze.push(ohneHtml(c.text));
          if (c.format === 'fehler' && c.modus === 'verbessern') {
            saetze.push(c.woerter.map((w, k) => (c.korrektur[k] ? w.replace(/[^„“"(),.!?:;]+/, c.korrektur[k]) : w)).join(' ') + c.satzEnde);
          }
          if (c.format === 'sortieren') for (const k of c.karten) if (/\.$/.test(ohneHtml(k.text))) saetze.push(ohneHtml(k.text));
          for (const s of saetze) {
            n++;
            if (c.wort.startsWith('s:')) continue; // Satzglieder-Sätze aus wortschatz.json (saetze)
            if (c.format === 'sortieren') { assert.ok(ALLE_VERB_SAETZE.has(s), `${wo}: „${s}“ ist kein Satz aus dem Wortschatz`); continue; }
            const eigene = SAETZE.get(c.wort);
            assert.ok(eigene, `${wo}: Satz ohne Wort-Quelle (${c.wort}): „${s}“`);
            assert.ok(eigene.has(s), `${wo}: „${s}“ gehört nicht zu ${c.wort}`);
          }
        }
      }
    });
  }
  assert.ok(n > 500, `${n} Sätze geprüft`);
});

test('Fehler-Satz (auch Ork-Rüstung): ein eigener Satz des Worts, das falsche Wort genau einmal', () => {
  const rng = seededRng(3);
  for (const n of WS.nomen) {
    const f = fehlerSatz(n, n.wort + 'x', rng);
    assert.equal(f.woerter.filter((w) => w.includes(n.wort + 'x')).length, 1, n.wort);
    const voll = f.woerter.map((w, k) => (k === f.ziele[0] ? w.replace(n.wort + 'x', n.wort) : w)).join(' ') + f.satzEnde;
    assert.ok(n.saetze.includes(voll), `${n.wort}: „${voll}“`);
  }
});

test('Präteritum-Frage beim Verbinden: Satz des Verbs statt „Gestern ___ der Ritter.“', () => {
  const DEFS = Object.fromEntries(ITEMS.map((d) => [d.id, d]));
  for (const d of ITEMS.filter((x) => x.art === 'verb')) {
    const q = frageFuer({ typ: 'paar', alt: { id: d.id, stern: 1 }, neu: { id: d.id, stern: 1 } }, DEFS, seededRng(1), WS);
    const v = WS.verben.find((x) => x.infinitiv === d.name);
    const satz = ohneHtml(q.prompt).replace(/\s*\(.*\)$/, '').replace('___', q.correct);
    assert.ok(alleVerbSaetze(v).includes(satz), `${d.name}: „${satz}“`);
  }
});

test('Verb-Rollen: jedes Verb-Item hat eigene Vorlagen, Artikel der Items stimmen mit dem Wortschatz', () => {
  for (const d of ITEMS.filter((x) => x.art === 'verb')) {
    assert.ok(WS.verben.find((v) => v.infinitiv === d.name)?.vorlagen?.length, `${d.name}: Vorlagen`);
  }
  const artikel = new Map([...WS.nomen.map((n) => [n.wort, n.artikel]), ...WS.komposita.map((k) => [k.wort, k.artikel])]);
  for (const d of ITEMS.filter((x) => x.artikel && artikel.has(x.name))) assert.equal(d.artikel, artikel.get(d.name), d.name);
});

test('Lücke: steht in derselben Zeile wie das Wort danach', () => {
  assert.equal(lueckeHtml('___ Apfel ist rot.'), '<span class="luecke-paar"><span class="blank">___</span> Apfel</span> ist rot.');
  assert.equal(lueckeHtml('Im Korb liegen fünf ___.'), 'Im Korb liegen fünf <span class="luecke-paar"><span class="blank">___</span>.</span>');
});

test('Keine Satzschablonen mehr im Code', () => {
  const code = ['js/aufgaben/themen.js', 'js/sterne.js', 'js/aufgaben/verbsatz.js', 'js/aufgaben/spiel.js', 'js/encounters.js'].map(quelle).join('\n');
  for (const muster of [/liegt im Rucksack/, /MEHRZAHL_SATZ/, /hilft Fenwick/, /macht Spaß/, /Gestern (___|\$\{blank\})/, /Die Kinder ___/,
    /Borga (___|\$\{v\.)/, /Der Ork (stiehlt|legt|schwingt)/, /steigerungsSatz/, /ERSATZ_VORLAGE/, /\.ergaenzung/, /\$\{PERSONEN\[/]) {
    assert.ok(!muster.test(code), `Schablone gefunden: ${muster}`);
  }
});
