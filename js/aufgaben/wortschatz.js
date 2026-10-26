// Wortschatz (wortschatz.json): Hilfen ohne Darstellung – Pluralmuster, Rechtschreibphänomene und typische
// Fehlerformen für falsche Antworten. Falsche Antworten werden aus Fehlermustern erzeugt und nie zufällig richtig.

const VOKALE = 'aeiouäöü';

// Umlaut des letzten Stammvokals: Axt → Äxt, Haus → Häus, Apfel → Äpfel, Bruder → Brüder.
export function umlaut(wort) {
  const m = [...wort.matchAll(/au|Au|[aouAOU]/g)].at(-1);
  if (!m) return null;
  const ersatz = { a: 'ä', o: 'ö', u: 'ü', A: 'Ä', O: 'Ö', U: 'Ü', au: 'äu', Au: 'Äu' }[m[0]];
  return wort.slice(0, m.index) + ersatz + wort.slice(m.index + m[0].length);
}

// Pluralmuster aus Einzahl und Mehrzahl ableiten.
export function pluralMuster(sg, pl) {
  if (pl === sg) return 'unverändert';
  const u = umlaut(sg);
  if (u && pl === u) return 'Umlaut';
  if (u && pl === u + 'e') return 'Umlaut+e';
  if (u && pl === u + 'er') return 'Umlaut+er';
  if (u && pl === u + 'en') return 'Umlaut+en';
  for (const [end, name] of [['nen', '-nen'], ['se', '-se'], ['er', '-er'], ['en', '-en'], ['e', '-e'], ['n', '-n'], ['s', '-s']]) {
    if (pl === sg + end) return name;
  }
  return 'Sonderform';
}

// Rechtschreibphänomene eines Wortes (für Rechtschreib-Aufgaben).
export function phaenomene(wort, ableitung = null) {
  const w = wort.toLowerCase();
  const p = [];
  if (/d$/.test(w)) p.push('auslaut-d');
  if (/b$/.test(w)) p.push('auslaut-b');
  if (/[^n]g$/.test(w)) p.push('auslaut-g');
  if (/(bb|dd|ff|gg|ll|mm|nn|pp|rr|ss|tt)/.test(w)) p.push('doppelkonsonant');
  if (/(?<!e)ie/.test(w)) p.push('ie'); // nicht in „Schleier“, „Eier“ (ei + e)
  if (new RegExp(`(?<!e|a|u)[${VOKALE}]h(?![${VOKALE}])`).test(w)) p.push('dehnungs-h'); // nicht nach ei/ai/au/eu: „Weihnacht“
  if (/ck/.test(w)) p.push('ck');
  if (/tz/.test(w)) p.push('tz');
  if (/ß/.test(w)) p.push('ß');
  if (ableitung && /äu/.test(w)) p.push('äu-ableitung');
  else if (ableitung && /ä/.test(w)) p.push('ä-ableitung');
  return p;
}

// Schreibfehler zu einem Phänomen (z. B. Hund → Hunt). Gibt null zurück, wenn das Phänomen nicht passt.
export function schreibfehler(wort, ph) {
  const r = (re, by) => (re.test(wort) ? wort.replace(re, by) : null);
  switch (ph) {
    case 'auslaut-d': return r(/d$/, 't');
    case 'auslaut-b': return r(/b$/, 'p');
    case 'auslaut-g': return r(/g$/, 'k');
    case 'doppelkonsonant': return r(/(bb|dd|ff|gg|ll|mm|nn|pp|rr|ss|tt)/, (m) => m[0]);
    case 'ie': return r(/ie/, 'i');
    case 'dehnungs-h': return r(new RegExp(`([${VOKALE}])h(?![${VOKALE}])`), '$1');
    case 'ck': return r(/ck/, 'k');
    case 'tz': return r(/tz/, 'z');
    case 'ß': return r(/ß/, 'ss');
    case 'ä-ableitung': return r(/ä/, 'e') || r(/Ä/, 'E');
    case 'äu-ableitung': return r(/äu/, 'eu') || r(/Äu/, 'Eu');
    default: return null;
  }
}

// Erklärung mit Merkhilfe zu einem Rechtschreibphänomen.
export function merkhilfe(ph, n) {
  const pl = n?.plural;
  switch (ph) {
    case 'auslaut-d': return `Verlängere das Wort: ${n.wort} – ${pl}. Man hört d, darum schreibt man d.`;
    case 'auslaut-b': return `Verlängere das Wort: ${n.wort} – ${pl}. Man hört b, darum schreibt man b.`;
    case 'auslaut-g': return `Verlängere das Wort: ${n.wort} – ${pl}. Man hört g, darum schreibt man g.`;
    case 'doppelkonsonant': return `Nach einem kurzen Vokal folgen oft zwei gleiche Mitlaute: ${n.silben.join('-')}.`;
    case 'ie': return `Ein lang gesprochenes i schreibt man meistens ie: ${n.wort}.`;
    case 'dehnungs-h': return `Das h macht den Vokal davor lang: ${n.wort}.`;
    case 'ck': return `Nach einem kurzen Vokal schreibt man ck statt kk: ${n.wort}.`;
    case 'tz': return `Nach einem kurzen Vokal schreibt man tz statt zz: ${n.wort}.`;
    case 'ß': return `Nach einem langen Vokal oder ei/au schreibt man oft ß: ${n.wort}.`;
    case 'ä-ableitung': return `Leite ab: ${n.wort} kommt von ${n.ableitung} – darum ä und nicht e.`;
    case 'äu-ableitung': return `Leite ab: ${n.wort} kommt von ${n.ableitung} – darum äu und nicht eu.`;
    default: return '';
  }
}

// ---------- Falsche Formen aus typischen Fehlermustern ----------

const ohneDoppelte = (liste, richtig) => [...new Set(liste)].filter((x) => x && x !== richtig);

// Falsche Pluralformen, die typischsten zuerst: ohne Umlaut (Hande), falsche Endung (Handen), -s (Hands).
// Unaussprechbares (Buchn, Feeen) fällt weg.
// formen (optional): alle echten Wörter – Fehlerformen, die zufällig ein anderes Wort sind (Dachs, Ritter), fallen weg.
export function falschePlurale(n, formen = null) {
  const sg = n.wort, pl = n.plural;
  const kons = /[^aeiouäöüy]$/.test(sg); // endet auf Mitlaut
  const u = kons ? umlaut(sg) : null; // Umlaut nur bei Wörtern wie Axt, Haus, Vogel
  const uu = u && u !== sg ? u : null;
  const ue = /e$/.test(sg) && umlaut(sg) !== sg ? umlaut(sg) : null; // Blume → Blüme(n)
  const k = {
    '-e': [uu && uu + 'e', sg + 'en', sg + 's', sg + 'er'],
    'Umlaut+e': [sg + 'e', uu && uu + 'en', sg + 's', uu && uu + 'er'],
    '-er': [sg + 'e', sg + 's', sg + 'en', uu && uu + 'er'],
    'Umlaut+er': [sg + 'er', uu && uu + 'e', sg + 's', sg + 'e'],
    'Umlaut+en': [sg + 'en', sg + 's', uu && uu + 'e'],
    '-n': [sg + 's', ue && ue + 'n', sg],
    '-en': [sg + 's', sg + 'e', uu && uu + 'e', sg],
    '-s': [sg, sg + 'n', sg + 'en', sg + 'e'],
    '-nen': [sg + 's', sg + 'en', sg + 'ne', sg + 'e'],
    '-se': [sg + 'e', sg + 's', sg + 'sen', sg + 'en'],
    'unverändert': [sg + 's', sg + 'e', sg + 'en'],
    'Umlaut': [sg, sg + 's', uu && uu + 'e', sg + 'e'],
  }[n.pluralmuster] || [sg + 's', sg + 'e', sg + 'en'];
  return ohneDoppelte(k.filter((x) => typeof x === 'string' && x.length > 1 && !/eee|eie$/.test(x)
    && (!formen || x === sg || !formen.has(x))), pl);
}

// Falsches Präteritum: schwache Form für starke Verben (schlagte), Präsensform, Partizip ohne Hilfsverb.
export function falschePraeterita(v) {
  const stamm = v.infinitiv.replace(/e?n$/, '');
  const kandidaten = [stamm + 'te', stamm + 'ete', v.praesens.er, v.partizip, stamm + 'de', stamm + 't'];
  return ohneDoppelte(kandidaten, v.praeteritum).filter((x) => !Object.values(v.praesens).includes(x) || x === v.praesens.er);
}

// Falsche Personalform: Form einer anderen Person oder ohne Vokalwechsel (fahrst, fahrt statt fährst, fährt).
export function falscheFormen(v, person) {
  const richtig = v.praesens[person];
  const stamm = v.infinitiv.replace(/e?n$/, '');
  const kandidaten = [...Object.values(v.praesens), stamm + 'st', stamm + 't', stamm + 'e', v.infinitiv, stamm + 'est'];
  return ohneDoppelte(kandidaten, richtig);
}

// Falsche Steigerung: ohne Umlaut, „mehr …“, doppelte Endung, regelmäßig gebildet bei unregelmäßigen.
export function falscheSteigerung(a, stufe) {
  const p = a.positiv;
  const ohneUmlaut = (s) => s.replace(/[äöü]/, (c) => ({ ä: 'a', ö: 'o', ü: 'u' }[c]));
  if (stufe === 'komparativ') {
    const k = [p + 'er', ohneUmlaut(a.komparativ), `mehr ${p}`, a.komparativ + 'er', umlaut(p) && umlaut(p) + 'er'];
    return ohneDoppelte(k, a.komparativ).filter((x) => !x.includes('undefined'));
  }
  const s = [`am ${p}sten`, `am ${p}esten`, `am ${ohneUmlaut(a.superlativ.slice(3))}`, `am ${a.komparativ}sten`, `am meisten ${p}`];
  return ohneDoppelte(s, a.superlativ);
}

// Alle richtigen Wortformen (für den Test „falsche Antworten sind nie zufällig ein anderes echtes Wort“).
export function alleFormen(ws) {
  const s = new Set();
  for (const n of ws.nomen) { s.add(n.wort); s.add(n.plural); }
  for (const v of ws.verben) { s.add(v.infinitiv); for (const f of Object.values(v.praesens)) s.add(f); s.add(v.praeteritum); s.add(v.partizip); }
  for (const a of ws.adjektive) { s.add(a.positiv); s.add(a.komparativ); s.add(a.superlativ); }
  return s;
}

// Großer Anfangsbuchstabe
export const gross = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Schreibfehler, der garantiert kein echtes Wort ergibt (sonst null).
export function sichererSchreibfehler(wort, ph, formen) {
  const f = schreibfehler(wort, ph);
  if (!f || f === wort) return null;
  const klein = f.toLowerCase();
  for (const x of formen) if (x.toLowerCase() === klein) return null;
  return f;
}
