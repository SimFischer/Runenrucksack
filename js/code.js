// Heldencode und Reisecode (ohne Darstellung, testbar).
// - Heldencode: dauerhafter Fortschritt (Rang, Erfahrung, Figuren, Designs, Erfolge, Buch der Wörter, Statistik, Tutorial).
// - Reisecode: Heldencode + laufender Lauf (zum Unterbrechen und Weiterspielen).
//
// Format: Großbuchstaben und Ziffern ohne verwechselbare Zeichen (kein 0/O, 1/I/L), Fünfergruppen mit
// Bindestrichen, am Ende ein Prüfzeichen. Inhalt: Versionsnummer, kleine Zahlen als Varint, Listen
// (z. B. entdeckte Buch-Einträge) sortiert und als Abstände kodiert – so ist der Code am Anfang kurz und wächst mit.
// Wird eine Liste dicht (viele Einträge), speichert der Code sie automatisch als Bitfeld, falls das kürzer ist.
// Alle Einträge haben feste Nummern in registry.json; neue Inhalte werden nur hinten angehängt (tools/registry.mjs).
// Erweiterung (seit den Aufgaben-Themen): Lernstand, Regelkarten, Klassen-Einstellungen und Aufgaben-Stand des Laufs
// stehen ganz am Ende und nur, wenn es etwas zu speichern gibt – ältere Codes ohne diesen Teil bleiben gültig.
import { GROW_ORDER, baseBagCells } from './logic.js';

export const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // 31 Zeichen
export const CODE_VERSION = 1;
export const TYP = { held: 0, reise: 1 };
export const STAT_KEYS = ['laeufe', 'siege', 'gewonnen', 'ohneFehler', 'orkFehler', 'saetze', 'komposita', 'sterne4', 'richtig'];
const REGEL_KEYS = ['artikel', 'mehrzahl', 'personalform', 'praeteritum', 'steigerung', 'rechtschreibung'];
const FRAGE_ARTEN = ['artikel', 'mehrzahl', 'praeteritum', 'steigerung'];
const QUEUE = ['gebiet', 'schicksal', 'unterklasse', 'begegnung', 'verschmelzen'];

// ---------- Registry: feste Nummern für alle Einträge ----------

// Alle ids, die ein Code enthalten kann, in fester Reihenfolge (neue werden von tools/registry.mjs hinten angehängt).
// data: { defs, buch, heroes, fates, achievements, encounters }
export function alleIds(data) {
  return [
    ...STAT_KEYS.map((k) => `stat:${k}`),
    ...data.heroes.map((h) => `held:${h.id}`),
    ...data.heroes.flatMap((h) => (h.unterklassen || []).map((u) => `unterklasse:${u.id}`)),
    ...data.fates.map((f) => `schicksal:${f.id}`),
    ...(data.achievements.designs || []).map((d) => `design:${d.id}`),
    ...(data.achievements.erfolge || []).map((e) => `erfolg:${e.id}`),
    ...data.encounters.begegnungen.map((b) => `begegnung:${b.id}`),
    ...Object.keys(data.defs).map((id) => `item:${id}`),
    ...data.buch.eintraege.map((e) => e.id),
    ...(data.themen?.themen || []).flatMap((t) => [`thema:${t.id}`, ...t.regeln.map((r) => `regel:${r.id}`)]),
  ];
}

// registry.json → { nr(id), id(nr) }. Nummer 0 bedeutet „nichts“.
export function registryAus(json) {
  const ids = json.eintraege;
  const map = new Map(ids.map((id, i) => [id, i + 1]));
  return {
    nr(id) {
      const n = map.get(id);
      if (!n) throw new Error(`„${id}“ fehlt in registry.json – bitte node tools/registry.mjs ausführen.`);
      return n;
    },
    id: (n) => ids[n - 1] || null,
    // alle ids eines Bereichs in fester Reihenfolge (z. B. 'thema:') – Position = kurze Nummer im Code
    teil: (prefix) => ids.filter((id) => id.startsWith(prefix)).map((id) => id.slice(prefix.length)),
  };
}

// ---------- Bytes: Varint und Listen ----------

class Schreiber {
  constructor() { this.b = []; }
  uint(n) {
    n = Math.max(0, Math.floor(n || 0));
    while (n >= 128) { this.b.push((n % 128) | 128); n = Math.floor(n / 128); }
    this.b.push(n);
  }
  // Sortierte Liste: Kopf gerade → Anzahl·2, danach Abstände; Kopf ungerade → Bitfeld (Bytes·2+1, Start, Bits).
  liste(nums) {
    const s = [...new Set(nums)].sort((a, b) => a - b);
    const abstaende = new Schreiber();
    abstaende.uint(s.length * 2);
    let prev = 0;
    for (const n of s) { abstaende.uint(n - prev); prev = n; }
    if (s.length > 2) {
      const start = s[0], bytes = new Array(Math.ceil((s.at(-1) - start + 1) / 8)).fill(0);
      for (const n of s) bytes[(n - start) >> 3] |= 1 << ((n - start) & 7);
      const bits = new Schreiber();
      bits.uint(bytes.length * 2 + 1);
      bits.uint(start);
      bits.b.push(...bytes);
      if (bits.b.length < abstaende.b.length) { this.b.push(...bits.b); return; }
    }
    this.b.push(...abstaende.b);
  }
}

class Leser {
  constructor(b) { this.b = b; this.i = 0; }
  mehr() { return this.i < this.b.length; }
  uint() {
    let n = 0, f = 1;
    for (;;) {
      if (this.i >= this.b.length) throw new CodeFehler('kaputt');
      const x = this.b[this.i++];
      n += (x & 127) * f;
      if (x < 128) return n;
      f *= 128;
    }
  }
  liste() {
    const kopf = this.uint(), out = [];
    if (kopf % 2) {
      const n = (kopf - 1) / 2, start = this.uint();
      for (let k = 0; k < n; k++) {
        if (this.i >= this.b.length) throw new CodeFehler('kaputt');
        const x = this.b[this.i++];
        for (let bit = 0; bit < 8; bit++) if (x & (1 << bit)) out.push(start + k * 8 + bit);
      }
      return out;
    }
    let prev = 0;
    for (let k = 0; k < kopf / 2; k++) { prev += this.uint(); out.push(prev); }
    return out;
  }
}

export class CodeFehler extends Error {
  constructor(art, zeichen = '') { super(art); this.art = art; this.zeichen = zeichen; }
}

// ---------- Text: Basis 31, Prüfzeichen, Fünfergruppen ----------

const gewicht = (i) => (i % 30) + 1;
const potenz = (a, e) => { let r = 1; for (let k = 0; k < e; k++) r = (r * a) % 31; return r; };

function pruefzeichen(werte) {
  let s = 0;
  werte.forEach((v, i) => { s = (s + gewicht(i) * v) % 31; });
  const w = gewicht(werte.length);
  return ((31 - s) % 31) * potenz(w, 29) % 31; // so wird die gewichtete Summe durch 31 teilbar
}

function bytesZuText(bytes) {
  let n = 1n; // führende 1, damit Nullen am Anfang erhalten bleiben
  for (const b of bytes) n = n * 256n + BigInt(b);
  const werte = [];
  while (n > 0n) { werte.unshift(Number(n % 31n)); n /= 31n; }
  werte.push(pruefzeichen(werte));
  const roh = werte.map((v) => ALPHABET[v]).join('');
  return roh.match(/.{1,5}/g).join('-');
}

// Eingabe säubern: Bindestriche und Leerzeichen weg, Großbuchstaben.
export const saeubern = (text) => String(text || '').toUpperCase().replace(/[\s\-–_.]/g, '');

function textZuBytes(text) {
  const roh = saeubern(text);
  if (roh.length < 4) throw new CodeFehler('kurz');
  const werte = [];
  for (const ch of roh) {
    const v = ALPHABET.indexOf(ch);
    if (v < 0) throw new CodeFehler('zeichen', ch);
    werte.push(v);
  }
  let s = 0;
  werte.forEach((v, i) => { s = (s + gewicht(i) * v) % 31; });
  if (s !== 0) throw new CodeFehler('pruefung');
  let n = 0n;
  for (const v of werte.slice(0, -1)) n = n * 31n + BigInt(v);
  const bytes = [];
  while (n > 1n) { bytes.unshift(Number(n % 256n)); n /= 256n; }
  if (n !== 1n) throw new CodeFehler('kaputt');
  return bytes;
}

// Freundliche Meldung für das Kind.
export function fehlerText(e) {
  if (!(e instanceof CodeFehler)) return 'Mit diesem Code stimmt etwas nicht. Schau noch einmal genau hin.';
  if (e.art === 'kurz') return 'Der Code ist zu kurz. Hast du alle Gruppen abgeschrieben?';
  if (e.art === 'zeichen') {
    if ('0O'.includes(e.zeichen)) return 'Im Code gibt es kein O und keine Null. Schau noch einmal genau hin – vielleicht ist es ein Q oder ein D?';
    if ('1IL'.includes(e.zeichen)) return 'Im Code gibt es keine 1, kein I und kein L. Vielleicht ist es eine 7 oder ein J?';
    return `Das Zeichen „${e.zeichen}“ gibt es im Code nicht.`;
  }
  if (e.art === 'pruefung') return 'Da hat sich ein Tippfehler eingeschlichen. Vergleiche den Code Zeichen für Zeichen.';
  if (e.art === 'version') return 'Dieser Code stammt aus einer neueren Version des Spiels. Lade die Seite neu.';
  return 'Mit diesem Code stimmt etwas nicht. Schau noch einmal genau hin.';
}

// ---------- Inhalt ----------

function schreibeHeld(w, profil, reg) {
  w.uint(profil.xp);
  w.uint(profil.tutorial ? 1 : 0);
  w.uint(profil.design && profil.design !== 'leder' ? reg.nr(`design:${profil.design}`) : 0);
  w.liste(profil.buch.map((id) => reg.nr(id)));
  w.liste(profil.erfolge.map((id) => reg.nr(`erfolg:${id}`)));
  w.liste(profil.figuren.map((id) => reg.nr(`held:${id}`)));
  w.liste(profil.designs.map((id) => reg.nr(`design:${id}`)));
  w.liste(profil.figurSiege.map((id) => reg.nr(`held:${id}`)));
  const stats = Object.entries(profil.stats).filter(([, v]) => v > 0);
  w.uint(stats.length);
  for (const [k, v] of stats.sort((a, b) => reg.nr(`stat:${a[0]}`) - reg.nr(`stat:${b[0]}`))) { w.uint(reg.nr(`stat:${k}`)); w.uint(v); }
}

// Nummern aus einer Liste in ids eines Bereichs (Präfix) zurückverwandeln; Unbekanntes (neuere Inhalte) fällt weg.
const ids = (reg, nums, prefix = '') => nums.map((n) => reg.id(n)).filter((id) => id && id.startsWith(prefix)).map((id) => id.slice(prefix.length));

function leseHeld(r, reg) {
  const profil = { v: 1, xp: r.uint(), buch: [], erfolge: [], figuren: [], designs: [], design: 'leder', stats: {}, figurSiege: [], tutorial: false, lernstand: {}, regeln: [], klasse: null };
  profil.tutorial = (r.uint() & 1) === 1;
  const d = r.uint();
  if (d) profil.design = (reg.id(d) || 'design:leder').replace('design:', '');
  profil.buch = r.liste().map((n) => reg.id(n)).filter((id) => id && /^(komp|stufe|steig|satz|schatz):/.test(id));
  profil.erfolge = ids(reg, r.liste(), 'erfolg:');
  profil.figuren = ids(reg, r.liste(), 'held:');
  profil.designs = ids(reg, r.liste(), 'design:');
  profil.figurSiege = ids(reg, r.liste(), 'held:');
  const n = r.uint();
  for (let k = 0; k < n; k++) {
    const key = reg.id(r.uint()), v = r.uint();
    if (key?.startsWith('stat:')) profil.stats[key.slice(5)] = v;
  }
  return profil;
}

// Lauf. data: { heroes, fates, encounters, exercises } für abgeleitete Teile (Gold-Bonus, Ladenplätze, Fluch-Namen, Begegnungs-Boni).
function schreibeLauf(w, run, reg, data) {
  w.uint(reg.nr(`held:${run.hero}`));
  w.uint(run.unterklasse ? reg.nr(`unterklasse:${run.unterklasse}`) : 0);
  w.uint(run.fate ? reg.nr(`schicksal:${run.fate}`) : 0);
  for (const k of ['day', 'hearts', 'wins', 'losses', 'gold']) w.uint(run[k]);
  w.uint(run.lernen?.richtig); w.uint(run.lernen?.falsch);
  w.uint(run.queue.length); for (const q of run.queue) w.uint(QUEUE.indexOf(q));
  // Rucksack-Felder: gewachsene Felder (Eulenbibliothekarin) + Taschen
  w.uint(GROW_ORDER.filter(([x, y]) => run.bagCells.includes(`${x},${y}`)).length);
  w.liste(Object.keys(run.taschen || {}).map((id) => reg.nr(`item:${id}`)));
  w.liste((run.mods || []).map((m) => reg.nr(`begegnung:${data.encounters.begegnungen.find((b) => JSON.stringify(b.belohnung.mod) === JSON.stringify(m)).id}`)));
  w.liste((run.freieItems || []).map((id) => reg.nr(`item:${id}`)));
  w.uint(run.history.length); for (const h of run.history) w.uint(h.won ? 1 : 0);
  const letzte = run.history.at(-1)?.begegnung;
  w.uint(letzte ? reg.nr(`begegnung:${letzte}`) : 0);
  // Items: id + gepackte Lage (x, y, Drehung, Stufe, Kraft-Stufe, Bereich, Fluch, Satz)
  const items = run.items.filter((p) => p.area === 'bag' || p.area === 'store');
  w.uint(items.length);
  for (const p of items) {
    const s = p.satz;
    w.uint(reg.nr(`item:${p.id}`));
    w.uint(p.x | (p.y << 3) | ((p.rot || 0) << 6) | (((p.stern || 1) - 1) << 8) | (((p.kraftStern || 1) - 1) << 10)
      | ((p.area === 'store' ? 1 : 0) << 12) | ((p.fluch ? 1 : 0) << 13) | ((s ? 1 : 0) << 14) | ((s?.ok ? 1 : 0) << 15));
    if (s) {
      w.uint(items.findIndex((q) => q.uid === s.uid) + 1);
      w.uint(reg.nr(`item:${s.id}`));
      w.uint(s.stern || 1);
    }
  }
  w.uint(run.shop.length);
  for (const sl of run.shop) w.uint(sl ? reg.nr(`item:${sl.id}`) * 2 + (sl.locked ? 1 : 0) : 0);
  const gekonnt = Object.entries(run.gekonnt || {});
  w.uint(gekonnt.length);
  for (const [key, n] of gekonnt) {
    const [art, ref] = key.split('|');
    w.uint(FRAGE_ARTEN.indexOf(art)); w.uint(reg.nr(`item:${ref}`)); w.uint(n);
  }
  const p = run.prog || {};
  w.liste((p.neu || []).map((id) => reg.nr(id)));
  for (const k of ['erster', 'fehler', 'orkFehler', 'saetze', 'komposita', 'sterne4']) w.uint(p[k]);
  for (const k of REGEL_KEYS) { const [a, b] = p.regeln?.[k] || [0, 0]; w.uint(a); w.uint(b); }
}

function leseLauf(r, reg, data) {
  const id = (n, prefix) => { const x = reg.id(n); return x?.startsWith(prefix) ? x.slice(prefix.length) : null; };
  const run = { version: 2, nextUid: 1, items: [], shop: [], history: [], over: null, mods: [], unterklasse: null, fate: null };
  run.hero = id(r.uint(), 'held:');
  run.unterklasse = id(r.uint(), 'unterklasse:');
  run.fate = id(r.uint(), 'schicksal:');
  for (const k of ['day', 'hearts', 'wins', 'losses', 'gold']) run[k] = r.uint();
  run.lernen = { richtig: r.uint(), falsch: r.uint() };
  run.queue = Array.from({ length: r.uint() }, () => QUEUE[r.uint()]).filter(Boolean);
  const gewachsen = r.uint();
  run.bagCells = [...baseBagCells(), ...GROW_ORDER.slice(0, gewachsen).map(([x, y]) => `${x},${y}`)];
  for (const t of ids(reg, r.liste(), 'item:')) {
    const def = data.defs[t];
    if (!def?.tasche) continue;
    run.taschen = { ...(run.taschen || {}), [t]: true };
    run.taschenFelder ||= {};
    for (const [x, y] of def.tasche.felder) {
      if (!run.bagCells.includes(`${x},${y}`)) run.bagCells.push(`${x},${y}`);
      run.taschenFelder[`${x},${y}`] = t;
    }
  }
  run.mods = ids(reg, r.liste(), 'begegnung:').map((b) => data.encounters.begegnungen.find((x) => x.id === b)?.belohnung.mod).filter(Boolean);
  run.freieItems = ids(reg, r.liste(), 'item:');
  const nh = r.uint();
  for (let k = 0; k < nh; k++) run.history.push({ day: k + 1, won: r.uint() === 1, enemy: '' });
  const letzte = id(r.uint(), 'begegnung:');
  if (letzte && run.history.length) run.history.at(-1).begegnung = letzte;
  const n = r.uint();
  const saetze = [];
  for (let k = 0; k < n; k++) {
    const itemId = id(r.uint(), 'item:');
    const v = r.uint();
    const p = { uid: k + 1, id: itemId, area: (v >> 12) & 1 ? 'store' : 'bag', x: v & 7, y: (v >> 3) & 7, rot: (v >> 6) & 3 };
    const stern = ((v >> 8) & 3) + 1, ks = ((v >> 10) & 3) + 1;
    if (stern > 1) p.stern = stern;
    if (ks > 1) p.kraftStern = ks;
    if ((v >> 13) & 1) p.fluch = fluchName(itemId, data);
    if ((v >> 14) & 1) {
      const subj = r.uint(), sid = id(r.uint(), 'item:'), sst = r.uint();
      saetze.push([p, { uid: subj || -1, id: sid, stern: sst, ok: ((v >> 15) & 1) === 1 }]);
    }
    if (itemId && data.defs[itemId]) run.items.push(p);
  }
  for (const [p, s] of saetze) p.satz = s;
  run.nextUid = n + 1;
  const ns = r.uint();
  for (let k = 0; k < ns; k++) {
    const v = r.uint();
    const sid = v ? id(Math.floor(v / 2), 'item:') : null;
    run.shop.push(sid ? { id: sid, locked: v % 2 === 1 } : null);
  }
  const ng = r.uint();
  for (let k = 0; k < ng; k++) {
    const art = FRAGE_ARTEN[r.uint()], ref = id(r.uint(), 'item:'), c = r.uint();
    if (art && ref) (run.gekonnt ||= {})[`${art}|${ref}`] = c;
  }
  const p = { neu: r.liste().map((x) => reg.id(x)).filter(Boolean), regeln: {} };
  for (const k of ['erster', 'fehler', 'orkFehler', 'saetze', 'komposita', 'sterne4']) p[k] = r.uint();
  for (const k of REGEL_KEYS) { const a = r.uint(), b = r.uint(); if (a || b) p.regeln[k] = [a, b]; }
  run.prog = p;
  // aus der Schicksalsrune abgeleitet
  const fate = data.fates.find((f) => f.id === run.fate);
  if (fate?.effekt.ladenPlaetze) run.shopSlots = fate.effekt.ladenPlaetze;
  if (fate?.effekt.goldProTag) run.goldBonus = fate.effekt.goldProTag;
  return run;
}

// ---------- Erweiterung: Lernstand, Regelkarten, Klasse, Aufgaben-Stand ----------

const STANDARD_STUFE = 2; // wie STANDARD_MAX in js/aufgaben/wahl.js
const FORMAT_IDS = ['auswahl', 'luecke', 'buchstaben', 'eintippen', 'baukasten', 'sortieren', 'fehler', 'ordnen', 'passtnicht', 'regel', 'paare'];
const heldErweitert = (profil) => Object.values(profil.lernstand || {}).some((l) => l.stufe > 1 || l.sicher > 0) || (profil.regeln || []).length > 0 || !!profil.klasse;
const laufErweitert = (run) => !!(run.rabatt || run.aufgaben?.zaehler || run.aufgaben?.wiederholen?.length);

// Kleine Werte (0–15 bzw. 0–3) je Thema dicht gepackt: Anzahl, dann Bits. Themen in fester Reihenfolge (registry.json).
function packe(w, werte, bits) {
  let n = werte.length;
  while (n > 0 && !werte[n - 1]) n--;
  w.uint(n);
  const proByte = 8 / bits;
  for (let k = 0; k < n; k += proByte) {
    let b = 0;
    for (let m = 0; m < proByte; m++) b |= ((werte[k + m] || 0) & ((1 << bits) - 1)) << (m * bits);
    w.b.push(b);
  }
}
function entpacke(r, bits) {
  const n = r.uint(), proByte = 8 / bits, out = [];
  for (let k = 0; k < n; k += proByte) {
    if (!r.mehr()) throw new CodeFehler('kaputt');
    const b = r.b[r.i++];
    for (let m = 0; m < proByte && k + m < n; m++) out.push((b >> (m * bits)) & ((1 << bits) - 1));
  }
  return out;
}

function schreibeErweiterung(w, profil, run, reg) {
  w.uint(1); // Version der Erweiterung
  const themen = reg.teil('thema:');
  // Lernstand: je Thema stufe·4 + sicher (0 = noch nichts)
  packe(w, themen.map((t) => { const l = profil.lernstand?.[t]; return l && (l.stufe > 1 || l.sicher > 0) ? Math.min(3, l.stufe) * 4 + Math.min(3, l.sicher) : 0; }), 4);
  const regeln = reg.teil('regel:'), da = new Set(profil.regeln || []);
  packe(w, regeln.map((id) => (da.has(id) ? 1 : 0)), 1);
  // Klasse: 0 = keine; sonst je Thema die Höchststufe 0–3 (0 = aus; fehlt ein Thema, gilt der Standard)
  w.uint(profil.klasse ? 1 : 0);
  if (profil.klasse) packe(w, themen.map((t) => profil.klasse.themen?.[t] ?? STANDARD_STUFE), 2);
  if (!run) return;
  const a = run.aufgaben || { zaehler: 0, wiederholen: [] };
  w.uint(run.rabatt); w.uint(a.zaehler);
  w.uint(a.wiederholen.length);
  for (const x of a.wiederholen) {
    w.uint(themen.indexOf(x.thema)); w.uint(x.stufe); w.uint(FORMAT_IDS.indexOf(x.format) + 1); w.uint(Math.max(0, x.faellig - a.zaehler));
  }
}

function leseErweiterung(r, reg, profil, run) {
  if (!r.mehr()) return;
  r.uint(); // Version
  const themen = reg.teil('thema:'), regeln = reg.teil('regel:');
  entpacke(r, 4).forEach((v, k) => { if (v && themen[k]) profil.lernstand[themen[k]] = { stufe: Math.max(1, v >> 2), sicher: v & 3 }; });
  profil.regeln = entpacke(r, 1).map((v, k) => (v ? regeln[k] : null)).filter(Boolean);
  if (r.uint()) {
    const werte = entpacke(r, 2);
    profil.klasse = { themen: Object.fromEntries(themen.map((t, k) => [t, werte[k] ?? 0])) };
  }
  if (!run || !r.mehr()) return;
  run.rabatt = r.uint();
  const a = { zaehler: r.uint(), benutzt: {}, wiederholen: [] };
  for (let k = r.uint(); k > 0; k--) {
    const t = themen[r.uint()], stufe = r.uint(), f = FORMAT_IDS[r.uint() - 1], faellig = a.zaehler + r.uint();
    if (t) a.wiederholen.push({ thema: t, stufe, format: f || null, wort: null, faellig });
  }
  run.aufgaben = a;
}

function fluchName(itemId, data) {
  const e = data.exercises?.kobold?.find((k) => k.item === itemId);
  return e ? e.teile.join('') : data.defs[itemId]?.name || '???';
}

// ---------- Öffentlich ----------

export function heldencode(profil, reg) {
  const w = new Schreiber();
  w.uint(CODE_VERSION); w.uint(TYP.held);
  schreibeHeld(w, profil, reg);
  if (heldErweitert(profil)) schreibeErweiterung(w, profil, null, reg);
  return bytesZuText(w.b);
}

export function reisecode(profil, run, reg, data) {
  const w = new Schreiber();
  w.uint(CODE_VERSION); w.uint(TYP.reise);
  schreibeHeld(w, profil, reg);
  schreibeLauf(w, run, reg, data);
  if (heldErweitert(profil) || laufErweitert(run)) schreibeErweiterung(w, profil, run, reg);
  return bytesZuText(w.b);
}

// Liest einen Code; erkennt selbst, ob Helden- oder Reisecode. Ergebnis: { typ, profil, run? }
// Wirft CodeFehler (fehlerText() macht daraus eine freundliche Meldung).
export function leseCode(text, reg, data) {
  const r = new Leser(textZuBytes(text));
  const version = r.uint();
  if (version > CODE_VERSION) throw new CodeFehler('version');
  const typ = r.uint();
  if (typ !== TYP.held && typ !== TYP.reise) throw new CodeFehler('kaputt');
  const profil = leseHeld(r, reg);
  if (typ === TYP.held) { leseErweiterung(r, reg, profil, null); return { typ: 'held', profil }; }
  const run = leseLauf(r, reg, data);
  leseErweiterung(r, reg, profil, run);
  return { typ: 'reise', profil, run };
}
