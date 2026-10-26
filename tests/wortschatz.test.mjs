// Wortschatz: Pflichtfelder vollständig, keine doppelten Wörter, Mehrzahl und Artikel passend zur
// Komposita-Regel (Grundwort), falsche Antworten nie zufällig richtig.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  pluralMuster, phaenomene, falschePlurale, falschePraeterita, falscheFormen, falscheSteigerung, sichererSchreibfehler, alleFormen,
} from '../js/aufgaben/wortschatz.js';

const WS = JSON.parse(readFileSync(new URL('../wortschatz.json', import.meta.url)));
const FORMEN = alleFormen(WS);

test('Umfang: 400 Nomen, 100 Verben, 80 Adjektive, 40 Wortfamilien, Wortfelder der Gebiete', () => {
  assert.ok(WS.nomen.length >= 400, `Nomen ${WS.nomen.length}`);
  assert.ok(WS.verben.length >= 100, `Verben ${WS.verben.length}`);
  assert.ok(WS.adjektive.length >= 80, `Adjektive ${WS.adjektive.length}`);
  assert.ok(WS.wortfamilien.length >= 40, `Wortfamilien ${WS.wortfamilien.length}`);
  for (const f of ['haus', 'pferd', 'schmiede', 'wald', 'burg', 'zauber', 'essen']) assert.ok(WS.wortfelder[f], f);
  for (const f of Object.keys(WS.wortfelder)) assert.ok(WS.nomen.filter((n) => n.wortfeld === f).length >= 30, `Wortfeld ${f} hat genug Nomen`);
});

test('Pflichtfelder vollständig, keine doppelten Wörter', () => {
  const doppelt = (liste) => liste.filter((x, i) => liste.indexOf(x) !== i);
  assert.deepEqual(doppelt(WS.nomen.map((n) => n.wort)), []);
  assert.deepEqual(doppelt(WS.verben.map((v) => v.infinitiv)), []);
  assert.deepEqual(doppelt(WS.adjektive.map((a) => a.positiv)), []);
  for (const n of WS.nomen) {
    assert.ok(['der', 'die', 'das'].includes(n.artikel), n.wort);
    assert.match(n.wort, /^[A-ZÄÖÜ][a-zäöüß]+$/, n.wort);
    assert.match(n.plural, /^[A-ZÄÖÜ][a-zäöüß]+$/, n.wort);
    assert.equal(n.silben.join(''), n.wort, `${n.wort}: Silben`);
    assert.ok(WS.wortfelder[n.wortfeld], `${n.wort}: Wortfeld`);
    assert.ok([1, 2, 3].includes(n.schwierigkeit), n.wort);
    assert.equal(n.pluralmuster, pluralMuster(n.wort, n.plural), `${n.wort}: Pluralmuster`);
    assert.notEqual(n.pluralmuster, 'Sonderform', `${n.wort}: unbekanntes Pluralmuster`);
    assert.deepEqual(n.phaenomene, phaenomene(n.wort, n.ableitung), `${n.wort}: Phänomene`);
  }
  for (const v of WS.verben) {
    for (const p of ['ich', 'du', 'er', 'wir', 'ihr', 'sie']) assert.ok(v.praesens[p], `${v.infinitiv}: ${p}`);
    assert.ok(v.praeteritum && v.partizip && ['haben', 'sein', 'beide'].includes(v.hilfsverb) && v.ergaenzung, v.infinitiv);
    assert.equal(typeof v.unregelmaessig, 'boolean', v.infinitiv);
  }
  for (const a of WS.adjektive) {
    assert.ok(a.komparativ && a.superlativ.startsWith('am ') && a.gegenteil, a.positiv);
    assert.equal(typeof a.unregelmaessig, 'boolean', a.positiv);
  }
});

test('Komposita: Das Grundwort bestimmt Artikel und Mehrzahl', () => {
  const nach = Object.fromEntries(WS.nomen.map((n) => [n.wort, n]));
  for (const n of WS.nomen.filter((x) => x.grundwort)) {
    const g = nach[n.grundwort];
    assert.ok(g, `${n.wort}: Grundwort ${n.grundwort} fehlt`);
    assert.equal(n.artikel, g.artikel, `${n.wort}: Artikel vom Grundwort`);
    assert.ok(n.plural.endsWith(g.plural.toLowerCase()), `${n.wort}: Mehrzahl ${n.plural} endet wie ${g.plural}`);
  }
  for (const k of WS.komposita) {
    assert.equal(k.wort, k.bestimmungswort + k.fuge + k.grundwort.toLowerCase(), k.wort);
    assert.equal(k.artikel, nach[k.grundwort].artikel, `${k.wort}: Artikel`);
    assert.ok(['', 's', 'n', 'en', 'e', 'er'].includes(k.fuge), k.wort);
  }
  assert.ok(new Set(WS.komposita.map((k) => k.fuge)).size === 6, 'alle Fugenelemente kommen vor');
});

test('Falsche Antworten aus Fehlermustern sind nie zufällig richtig', () => {
  for (const n of WS.nomen.filter((x) => !x.mehrdeutig)) {
    const f = falschePlurale(n, FORMEN);
    assert.ok(f.length >= 2, `${n.wort}: genug falsche Mehrzahlformen (${f})`);
    for (const x of f) assert.ok(x === n.wort || !FORMEN.has(x), `${n.wort}: ${x} ist ein anderes echtes Wort`);
    assert.ok(!f.includes(n.plural), n.wort);
  }
  for (const v of WS.verben) {
    const f = falschePraeterita(v);
    assert.ok(f.length >= 2 && !f.includes(v.praeteritum), v.infinitiv);
    for (const p of ['ich', 'du', 'er', 'wir', 'ihr', 'sie']) {
      const ff = falscheFormen(v, p);
      assert.ok(ff.length >= 2 && !ff.includes(v.praesens[p]), `${v.infinitiv} ${p}`);
    }
  }
  for (const a of WS.adjektive) {
    for (const s of ['komparativ', 'superlativ']) {
      const f = falscheSteigerung(a, s);
      assert.ok(f.length >= 2 && !f.includes(a[s]), `${a.positiv} ${s}: ${f}`);
    }
  }
  assert.ok(falschePraeterita(WS.verben.find((v) => v.infinitiv === 'schlagen')).includes('schlagte'), 'schwache Form für starke Verben');
  assert.ok(falschePlurale(WS.nomen.find((n) => n.wort === 'Axt')).includes('Axte'), 'Mehrzahl ohne Umlaut');
});

test('Schreibfehler ergeben nie zufällig ein echtes Wort', () => {
  let anzahl = 0;
  for (const n of WS.nomen) {
    for (const ph of n.phaenomene) {
      const f = sichererSchreibfehler(n.wort, ph, FORMEN);
      if (!f) continue;
      anzahl++;
      assert.notEqual(f, n.wort);
      assert.ok(![...FORMEN].some((x) => x.toLowerCase() === f.toLowerCase()), `${n.wort} → ${f}`);
    }
  }
  assert.ok(anzahl > 200, `genug Schreibfehler-Aufgaben (${anzahl})`);
  assert.equal(sichererSchreibfehler('Hund', 'auslaut-d', FORMEN), 'Hunt');
});
