// Sätze aus dem Wortschatz (ohne Darstellung, testbar): Jedes Wort hat eigene, sinnvolle Sätze in wortschatz.json –
// es gibt keine Schablonen, in die beliebige Wörter eingesetzt werden. Quelle: tools/saetze/*.txt (tools/saetze.mjs).
//   Nomen:      gruppe, saetze [2], mehrzahlSatz
//   Verben:     rahmen [{ person, subjekt?, rest }], nominal (Satz mit dem Verb als Nomen) – Präsens, Präteritum, Perfekt
//   Adjektive:  saetze { positiv, komparativ, superlativ }

export const GRUPPEN = {
  ge: 'Gegenstand', es: 'Essen', ti: 'Tier', pe: 'Person', or: 'Ort', pf: 'Pflanze',
  wn: 'Wetter und Natur', ze: 'Zeit', ab: 'Gefühl und Abstraktes',
};

export const PRONOMEN = { ich: 'Ich', du: 'Du', wir: 'Wir', ihr: 'Ihr' };
const HILFSVERB = {
  haben: { ich: 'habe', du: 'hast', er: 'hat', wir: 'haben', ihr: 'habt', sie: 'haben' },
  sein: { ich: 'bin', du: 'bist', er: 'ist', wir: 'sind', ihr: 'seid', sie: 'sind' },
};
export const hilfsverbForm = (hv, person) => HILFSVERB[hv][person];

// Wortkern ohne Satzzeichen und Anführungszeichen: „Kopf,“ → Kopf
export const kern = (t) => t.replace(/^[„“"(]+/, '').replace(/[.,!?:;“"”)]+$/, '');
export const woerter = (satz) => satz.split(' ');
// Wie oft steht das Wort (genau so geschrieben) im Satz?
export const zaehle = (satz, wort) => woerter(satz).filter((t) => kern(t) === wort).length;
// Satz mit Lücke: das Wort wird durch ___ ersetzt, Satzzeichen bleiben.
export function mitLuecke(satz, wort) {
  const t = woerter(satz);
  const i = t.findIndex((x) => kern(x) === wort);
  if (i < 0) return null;
  t[i] = t[i].replace(wort, '___');
  return t.join(' ');
}

// Präteritum für jede Person aus der er-Form: spielte → spielten, ging → gingen, fand → fandet
export function praeteritum(v, person) {
  const b = v.praeteritum, e = b.endsWith('e');
  if (person === 'ich' || person === 'er') return b;
  if (person === 'wir' || person === 'sie') return b + (e ? 'n' : 'en');
  if (person === 'du') return b + (e ? 'st' : /[sßz]$/.test(b) ? 'est' : 'st');
  return b + (e ? 't' : /[td]$/.test(b) ? 'et' : 't');
}

// Ein Satzrahmen in einer Zeitform: { satz, luecke (gefragt ist form), form }.
// Im Perfekt ist das Hilfsverb gefragt: „Ich ___ im kalten See geschwommen.“
export function rahmenSatz(v, r, zeit = 'praesens') {
  const subjekt = r.subjekt || PRONOMEN[r.person];
  const rest = r.rest ? ' ' + r.rest : '';
  if (zeit === 'perfekt') {
    const hv = hilfsverbForm(v.hilfsverb === 'sein' ? 'sein' : 'haben', r.person);
    return { satz: `${subjekt} ${hv}${rest} ${v.partizip}.`, luecke: `${subjekt} ___${rest} ${v.partizip}.`, form: hv };
  }
  const form = zeit === 'praeteritum' ? praeteritum(v, r.person) : v.praesens[r.person];
  return { satz: `${subjekt} ${form}${rest}.`, luecke: `${subjekt} ___${rest}.`, form };
}

// Alle Sätze eines Verbs (für Tests und die Prüfliste)
export function alleVerbSaetze(v) {
  const zeiten = ['praesens', 'praeteritum', ...(v.hilfsverb === 'beide' ? [] : ['perfekt'])];
  return [...(v.rahmen || []).flatMap((r) => zeiten.map((z) => rahmenSatz(v, r, z).satz)), ...(v.nominal ? [v.nominal] : [])];
}

// Satz für eine Artikel-Aufgabe: beginnt mit „Der/Die/Das Wort“ (Nominativ). Ohne passenden Satz: null –
// lieber kein Satz als ein unsinniger.
export function artikelSatz(n) {
  const art = n.artikel.charAt(0).toUpperCase() + n.artikel.slice(1);
  return (n.saetze || []).find((s) => s.startsWith(`${art} ${n.wort} `)) || null;
}
