// Rune der Woche (ohne Darstellung, testbar): ein besonderer Lauf, der in einer Kalenderwoche für alle gleich ist –
// optional je Klasse (Klassen-Einstellung der Lehrkraft). Der Startwert kommt aus Jahr und ISO-Kalenderwoche; daraus
// folgt fester Zufall für Figur, Begleiter, Schicksalsrune, Laden (auch beim Neu würfeln), Gegner, Kämpfe,
// Begegnungen und Briefe (logic.js: laufRng). Die Lernaufgaben bleiben an das Kind angepasst und zählen nicht in die Punkte.
//
// Ergebnis-Siegel: 4 Zeichen aus dem Code-Alphabet – 3 für Woche und Punkte, 1 Prüfzeichen (erkennt jeden einzelnen
// Tippfehler und jeden Dreher zweier Nachbarn). Namen werden nirgends gespeichert.
import { ALPHABET } from './code.js';
import { hashText } from './logic.js';

// ISO-Kalenderwoche (Montag ist der erste Tag, Woche 1 enthält den ersten Donnerstag des Jahres)
export function isoWoche(datum = new Date()) {
  const d = new Date(Date.UTC(datum.getFullYear(), datum.getMonth(), datum.getDate()));
  const tag = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - tag);
  const jahr = d.getUTCFullYear();
  const woche = Math.ceil(((d - Date.UTC(jahr, 0, 1)) / 86400000 + 1) / 7);
  return { jahr, woche };
}

// Klassen-Schlüssel aus den Einstellungen der Lehrkraft: gleiche Einstellungen (gleicher Klassen-Code) → gleiche Rune
export const klassenSchluessel = (klasse) => (klasse?.themen
  ? Object.entries(klasse.themen).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}${v}`).join('') : '');

export const wochenSeed = ({ jahr, woche }, klasse = null) => hashText(`rune-der-woche|${jahr}|${woche}|${klassenSchluessel(klasse)}`);

// Punkte am Ende: Siege, übrige Herzen, erreichter Tag, beim ersten Versuch richtig gelöste Aufgaben.
// Alle Werte sind Vielfache von 5 – so passt die Punktzahl ins Siegel.
export const PUNKTE = { sieg: 100, herz: 40, tag: 20, ersterVersuch: 5 };
export const MAX_PUNKTE = 2805; // höchste Punktzahl, die ins Siegel passt (561 Fünferschritte)
export function punkteVon(run) {
  const erster = run.prog?.erster || 0;
  const p = run.wins * PUNKTE.sieg + Math.max(0, run.hearts) * PUNKTE.herz + run.day * PUNKTE.tag + erster * PUNKTE.ersterVersuch;
  return Math.min(MAX_PUNKTE, p);
}

// ---------- Ergebnis-Siegel ----------
const SCHRITTE = MAX_PUNKTE / 5 + 1; // 562 Punkte-Stufen
const pruef = (werte) => werte.reduce((s, v, i) => (s + (i + 1) * v) % 31, 0);
const INV4 = 8; // 4 · 8 = 32 = 31 + 1

export function ergebnisSiegel(woche, punkte) {
  let n = (woche - 1) * SCHRITTE + Math.round(Math.min(MAX_PUNKTE, Math.max(0, punkte)) / 5);
  const werte = [];
  for (let k = 0; k < 3; k++) { werte.unshift(n % 31); n = Math.floor(n / 31); }
  werte.push(((31 - pruef(werte)) * INV4) % 31);
  return werte.map((v) => ALPHABET[v]).join('');
}

// Liest ein Siegel: { gueltig, woche, punkte } oder { gueltig: false, grund }
export function leseSiegel(text) {
  const roh = String(text || '').toUpperCase().replace(/[\s\-–_.]/g, '');
  if (roh.length !== 4) return { gueltig: false, grund: 'Ein Ergebnis-Siegel hat genau 4 Zeichen.' };
  const werte = [...roh].map((c) => ALPHABET.indexOf(c));
  if (werte.some((v) => v < 0)) return { gueltig: false, grund: 'Im Siegel gibt es kein O, keine 0, keine 1, kein I und kein L.' };
  if (pruef(werte) !== 0) return { gueltig: false, grund: 'Das Siegel stimmt nicht – vielleicht ein Tippfehler oder zwei vertauschte Zeichen.' };
  const n = werte.slice(0, 3).reduce((a, v) => a * 31 + v, 0);
  const woche = Math.floor(n / SCHRITTE) + 1;
  if (woche > 53) return { gueltig: false, grund: 'Das Siegel stimmt nicht.' };
  return { gueltig: true, woche, punkte: (n % SCHRITTE) * 5 };
}
