// Sätze aus tools/saetze/*.txt prüfen und in wortschatz.json eintragen (Nomen: gruppe, saetze, mehrzahlSatz;
// Verben: rahmen, nominal; Adjektive: saetze; dazu satzUnsicher für die Prüfliste). Bricht bei jedem Fehler ab.
//
//   node tools/saetze.mjs        → prüft und schreibt wortschatz.json
import { readFileSync, writeFileSync } from 'node:fs';
import { GRUPPEN, PRONOMEN, zaehle, rahmenSatz, artikelSatz } from '../js/aufgaben/saetze.js';

const zeilen = (datei) => readFileSync(new URL(`saetze/${datei}`, import.meta.url), 'utf8').split(/\r?\n/)
  .filter((z) => z.trim() && !z.startsWith('#')).map((z) => z.split('|'));
// „?“ am Anfang: unsicher
const satz = (s, unsicher) => { if (s.startsWith('?')) { unsicher.push(s.slice(1)); return s.slice(1); } return s; };

const text = readFileSync('wortschatz.json', 'utf8');
const ws = JSON.parse(text);
const fehler = [];
const neu = { nomen: new Map(), verben: new Map(), adjektive: new Map() };

// ---------- Nomen ----------
for (const [wort, g, s1, s2, p] of [...zeilen('nomen-1.txt'), ...zeilen('nomen-2.txt')]) {
  const n = ws.nomen.find((x) => x.wort === wort);
  if (!n) { fehler.push(`Nomen ${wort}: nicht im Wortschatz`); continue; }
  if (neu.nomen.has(wort)) fehler.push(`Nomen ${wort}: doppelt`);
  if (!GRUPPEN[g]) fehler.push(`Nomen ${wort}: unbekannte Gruppe ${g}`);
  const unsicher = [];
  const saetze = [satz(s1, unsicher), satz(s2, unsicher)];
  const mehrzahl = satz(p, unsicher);
  for (const s of saetze) {
    if (zaehle(s, wort) !== 1) fehler.push(`Nomen ${wort}: „${s}“ enthält das Wort nicht genau einmal`);
    const m = s.match(/^(Der|Die|Das) (\S+) /);
    if (m && m[2] === wort && m[1].toLowerCase() !== n.artikel) fehler.push(`Nomen ${wort}: „${s}“ – Artikel ist ${n.artikel}`);
  }
  if (zaehle(mehrzahl, n.plural) !== 1) fehler.push(`Nomen ${wort}: Mehrzahl-Satz „${mehrzahl}“ enthält „${n.plural}“ nicht genau einmal`);
  if (n.plural !== wort && zaehle(mehrzahl, wort)) fehler.push(`Nomen ${wort}: Mehrzahl-Satz enthält die Einzahl`);
  neu.nomen.set(wort, { gruppe: GRUPPEN[g], saetze, mehrzahlSatz: mehrzahl, ...(unsicher.length ? { satzUnsicher: unsicher } : {}) });
}
for (const n of ws.nomen) if (!neu.nomen.has(n.wort)) fehler.push(`Nomen ${n.wort}: keine Sätze`);

// ---------- Verben ----------
for (const [inf, nominal, ...rahmenText] of zeilen('verben.txt')) {
  const v = ws.verben.find((x) => x.infinitiv === inf);
  if (!v) { fehler.push(`Verb ${inf}: nicht im Wortschatz`); continue; }
  const unsicher = [];
  const rahmen = rahmenText.map((t) => {
    const u = t.startsWith('?');
    const teile = (u ? t.slice(1) : t).split(':');
    const person = teile[0];
    const r = PRONOMEN[person] ? { person, rest: teile.slice(1).join(':') } : { person, subjekt: teile[1], rest: teile.slice(2).join(':') };
    if (!['ich', 'du', 'er', 'wir', 'ihr', 'sie'].includes(person)) fehler.push(`Verb ${inf}: unbekannte Person ${person}`);
    if (!PRONOMEN[person] && !r.subjekt) fehler.push(`Verb ${inf}: Rahmen „${t}“ ohne Subjekt`);
    if (u) unsicher.push(rahmenSatz(v, r).satz);
    for (const z of ['praesens', 'praeteritum', 'perfekt']) {
      const s = rahmenSatz(v, r, z);
      if (s.satz.includes('undefined') || zaehle(s.luecke, '___') !== 1) fehler.push(`Verb ${inf}: kaputter Satz „${s.satz}“`);
    }
    return r;
  });
  if (!rahmen.some((r) => r.person === 'er')) fehler.push(`Verb ${inf}: kein Rahmen mit er/sie/es`);
  if (new Set(rahmen.map((r) => r.person)).size < 2) fehler.push(`Verb ${inf}: zu wenige verschiedene Personen`);
  const gross = inf.charAt(0).toUpperCase() + inf.slice(1);
  if (nominal !== '-' && zaehle(nominal, gross) !== 1) fehler.push(`Verb ${inf}: „${nominal}“ enthält „${gross}“ nicht genau einmal`);
  neu.verben.set(inf, { rahmen, ...(nominal !== '-' ? { nominal } : {}), ...(unsicher.length ? { satzUnsicher: unsicher } : {}) });
}
for (const v of ws.verben) if (!neu.verben.has(v.infinitiv)) fehler.push(`Verb ${v.infinitiv}: keine Sätze`);

// ---------- Adjektive ----------
const enthaeltForm = (s, form) => s.split(new RegExp(`(?<![\\wäöüß])${form}(?![\\wäöüß])`)).length === 2;
for (const [pos, sp, sk, ss] of zeilen('adjektive.txt')) {
  const a = ws.adjektive.find((x) => x.positiv === pos);
  if (!a) { fehler.push(`Adjektiv ${pos}: nicht im Wortschatz`); continue; }
  const unsicher = [];
  const saetze = { positiv: satz(sp, unsicher), komparativ: satz(sk, unsicher), superlativ: satz(ss, unsicher) };
  for (const [stufe, s] of Object.entries(saetze)) {
    if (!enthaeltForm(s, a[stufe])) fehler.push(`Adjektiv ${pos}: „${s}“ enthält „${a[stufe]}“ nicht genau einmal`);
  }
  neu.adjektive.set(pos, { saetze, ...(unsicher.length ? { satzUnsicher: unsicher } : {}) });
}
for (const a of ws.adjektive) if (!neu.adjektive.has(a.positiv)) fehler.push(`Adjektiv ${a.positiv}: keine Sätze`);

if (fehler.length) { console.log(fehler.join('\n') + `\n\n${fehler.length} Fehler – nichts geschrieben.`); process.exit(1); }

// Schreiben: eine Zeile pro Eintrag, wie bisher
const crlf = text.includes('\r\n');
let abschnitt = '';
const SCHLUESSEL = { nomen: 'wort', verben: 'infinitiv', adjektive: 'positiv' };
const aus = text.split(/\r?\n/).map((z) => {
  const kopf = z.match(/^ {2}"(\w+)": \[/);
  if (kopf) abschnitt = kopf[1];
  if (!neu[abschnitt] || !z.startsWith('    {')) return z;
  const komma = z.trimEnd().endsWith(',');
  const e = JSON.parse(z.trim().replace(/,$/, ''));
  for (const k of ['gruppe', 'saetze', 'mehrzahlSatz', 'rahmen', 'nominal', 'satzUnsicher']) delete e[k];
  Object.assign(e, neu[abschnitt].get(e[SCHLUESSEL[abschnitt]]));
  return '    ' + JSON.stringify(e) + (komma ? ',' : '');
});
writeFileSync('wortschatz.json', aus.join(crlf ? '\r\n' : '\n'));
const mitArtikelSatz = ws.nomen.filter((n) => artikelSatz({ ...n, ...neu.nomen.get(n.wort) })).length;
const unsicher = [...neu.nomen.values(), ...neu.verben.values(), ...neu.adjektive.values()].reduce((s, e) => s + (e.satzUnsicher?.length || 0), 0);
console.log(`ok: ${neu.nomen.size} Nomen (${mitArtikelSatz} mit Satz für Artikel-Aufgaben), ${neu.verben.size} Verben, ${neu.adjektive.size} Adjektive, ${unsicher} unsichere Sätze`);
