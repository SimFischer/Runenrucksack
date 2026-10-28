// Welche Aufgabe kommt? (ohne Darstellung, testbar)
// - Das Item bestimmt das Thema (nicht das Wort): Nomen → Mehrzahl oder Artikel, Komposita → Komposita,
//   Verben → Personalformen oder Zeitformen, Runen → Steigerung, Ork-Rüstung → Rechtschreibung.
// - Die Item-Stufe bestimmt den Bereich der Aufgabenstufe: ★★ = 1–2, ★★★ = 2–3, ★★★★ = 3 (oder zwei Aufgaben).
// - Der Lernstand des Kindes (pro Thema) bestimmt, wo es in diesem Bereich steht; die Lehrkraft kann begrenzen.
import { erzeugeInhalt, zufall } from './themen.js';
import { FORMATE } from './formate/index.js';

export const ITEM_THEMEN = {
  nomen: ['mehrzahl', 'artikel'],
  kompositum: ['komposita'],
  verb: ['personalformen', 'zeitformen'],
  rune: ['steigerung'],
  siegel: ['artikel'],
  ork: ['verlaengerung', 'ableitung', 'doppel', 'ie', 'tzck'],
};

// Stufen-Bereich für die Ziel-Stufe eines Items (★★ … ★★★★); Komposita entstehen mit Bereich 1–2.
export const stufenBereich = (stern) => ({ 2: [1, 2], 3: [2, 3], 4: [3, 3] }[stern] || [1, 2]);

// Belohnung für „gleich beim ersten Versuch richtig“: Stufe 2 → 1 Gold, Stufe 3 → 2 Gold (und Glanz beim Verbinden).
export const GOLD_FUER_STUFE = { 2: 1, 3: 2 };

// Standard ohne Klassen-Code: alle Themen der Stufe 1–2.
export const STANDARD_MAX = 2;

// Einstellungen der Lehrkraft: { themen: { id: max 0–3 } } – 0 = aus. Ohne Eintrag gilt STANDARD_MAX.
export const maxStufe = (einst, thema) => einst?.themen?.[thema] ?? STANDARD_MAX;
export const themaAn = (einst, thema) => maxStufe(einst, thema) > 0;

// Lernstand eines Themas: { stufe 1–3, sicher (richtige beim ersten Versuch auf dieser Stufe), fehler }
export const lernstandVon = (profil, thema) => profil?.lernstand?.[thema] || { stufe: 1, sicher: 0 };

// Lernstand beim Laufstart kurz neu einschätzen: Er liegt nur auf dem Gerät. Fehlt er für ein Thema (z. B. nach dem
// Heldencode auf einem neuen iPad), beginnt das Thema auf einer Stufe passend zum Rang – als „geschätzt“ markiert.
// Der erste Fehler senkt eine geschätzte Stufe sofort, der erste Treffer bestätigt sie (verbucheAufgabe).
export function schaetzeLernstand(profil, rangNr, themenIds) {
  const start = rangNr >= 4 ? 3 : rangNr >= 2 ? 2 : 1;
  if (start === 1) return;
  profil.lernstand ||= {};
  for (const t of themenIds) if (!profil.lernstand[t]) profil.lernstand[t] = { stufe: start, sicher: 0, geschaetzt: true };
}

// Stufe für eine Aufgabe: Lernstand im Bereich des Items, höchstens die Höchststufe der Lehrkraft.
export function stufeFuer(profil, einst, thema, bereich) {
  const lern = lernstandVon(profil, thema).stufe;
  const s = Math.max(bereich[0], Math.min(bereich[1], lern));
  return Math.max(1, Math.min(s, maxStufe(einst, thema)));
}

// Themen eines Item-Typs, die angeschaltet sind; sonst irgendein angeschaltetes Thema.
export function themenFuer(art, einst, alle) {
  const an = (ITEM_THEMEN[art] || []).filter((t) => themaAn(einst, t));
  if (an.length) return an;
  return alle.filter((t) => themaAn(einst, t));
}

// Laufzustand der Aufgaben: Zähler, benutzte Wörter je Thema, fällige Wiederholungen.
export function aufgabenStand(run) {
  run.aufgaben ||= { zaehler: 0, benutzt: {}, wiederholen: [] };
  run.aufgaben.benutzt ||= {};
  run.aufgaben.ergebnis ||= {}; // je Thema [richtig beim ersten Versuch, mit Fehler] – für den Lernbericht
  return run.aufgaben;
}

// Eine Aufgabe auswählen und erzeugen. opts: { themen (themen.json), ws, profil, einst, run, art | kandidaten,
// bereich, rng, felder, itemNomen, format (erzwingen), nurThemen (z. B. für Begegnungen) }
export function waehleAufgabe(opts) {
  const { themen, ws, profil, einst, run, rng } = opts;
  const stand = aufgabenStand(run);
  // Themen mit eigenem Spiel (Briefe, Satzschmiede) haben keine Aufgaben-Erzeuger
  const alle = themen.themen.filter((t) => !t.spiel).map((t) => t.id);
  let kandidaten = opts.kandidaten || themenFuer(opts.art, einst, alle);
  kandidaten = kandidaten.filter((t) => themaAn(einst, t));
  if (!kandidaten.length) kandidaten = alle.filter((t) => themaAn(einst, t));
  if (!kandidaten.length) kandidaten = ['artikel'];
  // Fällige Wiederholung eines Fehlers: anderes Format, anderes Wort (nicht bei erzwungenem Format)
  let wiederholung = null;
  if (!opts.format) {
    wiederholung = stand.wiederholen.find((w) => w.faellig <= stand.zaehler && themaAn(einst, w.thema)) || null;
  }
  // Erzwungenes Format (Begegnungen): nur Themen, die es auf einer erlaubten Stufe haben
  const mitFormat = (t, s) => themen.themen.find((x) => x.id === t).stufen[s - 1].formate.includes(opts.format);
  const stufeMitFormat = (t) => {
    const ziel = stufeFuer(profil, einst, t, opts.bereich || [1, 3]);
    const moeglich = [1, 2, 3].filter((s) => s <= Math.max(1, maxStufe(einst, t)) && mitFormat(t, s));
    return moeglich.sort((a, b) => Math.abs(a - ziel) - Math.abs(b - ziel))[0];
  };
  if (opts.format) {
    const passend = kandidaten.filter((t) => stufeMitFormat(t));
    kandidaten = passend.length ? passend : alle.filter((t) => [1, 2, 3].some((s) => mitFormat(t, s)));
  }
  const thema = wiederholung ? wiederholung.thema : zufall(kandidaten, rng);
  const stufe = wiederholung ? Math.min(wiederholung.stufe, maxStufe(einst, thema)) || 1
    : opts.format ? stufeMitFormat(thema) || [1, 2, 3].find((s) => mitFormat(thema, s)) : stufeFuer(profil, einst, thema, opts.bereich || [1, 3]);
  const benutzt = new Set(stand.benutzt[thema] || []);
  if (wiederholung) benutzt.add(wiederholung.wort);
  const ctx = { ws, rng, felder: opts.felder || [], benutzt, itemNomen: opts.itemNomen, nichtFormat: wiederholung?.format };
  const inhalt = erzeugeInhalt(themen, thema, stufe, ctx, opts.format);
  const aufgabe = FORMATE[inhalt.format].erzeuge(inhalt, rng);
  if (wiederholung) stand.wiederholen = stand.wiederholen.filter((w) => w !== wiederholung);
  return aufgabe;
}

// Nach einer Antwort: Zähler, benutztes Wort, Lernstand, Wiederholung nach einem Fehler.
// ergebnis: { richtig, ersterVersuch }. Gibt { aufgestiegen } zurück.
export function verbucheAufgabe({ run, profil, aufgabe, ergebnis, rng }) {
  const stand = aufgabenStand(run);
  stand.zaehler++;
  (stand.benutzt[aufgabe.thema] ||= []).push(aufgabe.wort);
  profil.lernstand ||= {};
  const l = (profil.lernstand[aufgabe.thema] ||= { stufe: 1, sicher: 0 });
  let aufgestiegen = false;
  const e = (stand.ergebnis[aufgabe.thema] ||= [0, 0]);
  e[ergebnis.richtig && ergebnis.ersterVersuch ? 0 : 1]++;
  // Geschätzte Stufe: ein Treffer auf dieser Stufe bestätigt sie, ein Fehler senkt sie gleich um eins
  if (l.geschaetzt && aufgabe.stufe >= l.stufe) {
    if (ergebnis.richtig && ergebnis.ersterVersuch) delete l.geschaetzt;
    else { l.stufe = Math.max(1, l.stufe - 1); if (l.stufe === 1) delete l.geschaetzt; }
  }
  if (ergebnis.richtig && ergebnis.ersterVersuch) {
    // Zwei richtige in Folge (beim ersten Versuch) → nächste Stufe, auch wenn das Item eine niedrigere Stufe fragte
    l.sicher++;
    if (l.sicher >= 2 && l.stufe < 3) { l.stufe++; l.sicher = 0; aufgestiegen = true; } else if (l.stufe === 3) l.sicher = Math.min(l.sicher, 3);
  } else {
    l.sicher = 0;
    // Ein Fehler: kommt als zweite, dritte oder vierte Aufgabe danach zurück – in anderer Form und mit anderem Wort
    stand.wiederholen.push({ thema: aufgabe.thema, stufe: aufgabe.stufe, format: aufgabe.format, wort: aufgabe.wort, faellig: stand.zaehler + 1 + Math.floor((rng || Math.random)() * 3) });
  }
  return { aufgestiegen, stufe: l.stufe };
}

// Lernbericht nach dem Lauf: je geübtem Thema die Sterne des Lernstands (keine Prozente, keine Noten).
// Ergebnis: [{ id, name, emoji, stufe, richtig, fehler, tipp }] – zuerst die Themen mit Fehlern.
export function themenBericht(run, profil, themen) {
  const ergebnis = run.aufgaben?.ergebnis || {};
  return Object.entries(ergebnis).map(([id, [richtig, fehler]]) => {
    const t = themen.themen.find((x) => x.id === id);
    if (!t) return null;
    const stufe = lernstandVon(profil, id).stufe;
    return { id, name: t.name, stufe, richtig, fehler, tipp: t.regeln[Math.min(stufe, t.regeln.length) - 1]?.text || '' };
  }).filter(Boolean).sort((a, b) => b.fehler - a.fehler || a.name.localeCompare(b.name));
}
