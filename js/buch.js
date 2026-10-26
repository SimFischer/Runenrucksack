// Buch der Wörter: alle möglichen Entdeckungen – erzeugt aus items.json und recipes.json, nicht von Hand gepflegt.
// Jede Kombination steht von Anfang an im Buch (unentdeckt als Silhouette mit „???“).
import { STERN_FAKTOR, MAX_STERN } from './logic.js';
import { isRune, pluralOf } from './grammar.js';

export const SEITEN = [
  { id: 'komposita', titel: 'Komposita', emoji: '🔥', text: 'Kraft + Träger = ein neues Wort. Das letzte Wort bestimmt den Artikel.' },
  { id: 'stufen', titel: 'Sternstufen', emoji: '⭐', text: 'Zwei gleiche werden sofort stärker – bis zur legendären Stufe ★★★★.' },
  { id: 'steigerungen', titel: 'Steigerungen', emoji: '✨', text: 'Adjektive steigern: scharf → schärfer → am schärfsten.' },
  { id: 'saetze', titel: 'Sätze', emoji: '📜', text: 'Ein Verb braucht ein Subjekt: „Die Axt schlägt.“' },
  { id: 'besondere', titel: 'Schätze', emoji: '💎', text: 'Seltene Fundstücke aus den Wanderlanden.' },
];

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const voll = (d) => (d.artikel ? `${d.artikel} ${d.name}` : d.name);
// Kurze Wirkung für die Karte im Buch.
const WIRKUNG = [['schaden', '⚔️'], ['block', '🛡️'], ['heilung', '💚'], ['gift', '🧪'], ['brand', '🔥'], ['kaelte', '❄️'],
  ['betaeubung', '💫'], ['regeneration', '🌙'], ['leben', '❤️'], ['startblock', '🧱'], ['tempo', '💨'], ['glueck', '🍀']];
export const kurzWirkung = (d) => WIRKUNG.filter(([k]) => d[k]).slice(0, 3).map(([k, e]) => `${e} ${String(d[k]).replace('.', ',')}`).join(' · ');

// Kann ein Item Sternstufen bekommen? (wie sterne.canMerge, ohne Runen)
const stufbar = (d) => d.art !== 'siegel' && d.art !== 'tasche' && !isRune(d) && d.art !== 'kompositum' && !d.stufe;

// Baut das ganze Buch. defs: alle Definitionen (mit Komposita und Runenstufen), items: items.json, recipes: recipes.json.
export function baueBuch(defs, items, recipes) {
  const eintraege = [];
  const add = (seite, e) => eintraege.push({ seite, ...e });
  const k = recipes.komposita;

  for (const kraft of Object.keys(k.kraefte)) {
    for (const t of k.traeger) {
      const cd = defs[`${kraft}+${t}`], td = defs[t];
      if (!cd || !td) continue;
      add('komposita', {
        id: `komp:${kraft}+${t}`, def: cd, name: cd.name, artikel: cd.artikel, gruppe: kraft,
        wirkung: kurzWirkung(cd),
        hinweis: `${defs[kraft].name} + ${td.name}: Das Grundwort ${td.name} bestimmt den Artikel → ${voll(cd)}.`,
      });
    }
  }
  for (const d of items) {
    if (!stufbar(d)) continue;
    const pl = pluralOf(d, defs);
    for (let s = 2; s <= MAX_STERN; s++) {
      add('stufen', {
        id: `stufe:${d.id}:${s}`, def: d, stern: s, name: d.name, artikel: d.artikel, gruppe: d.id,
        wirkung: `${String(STERN_FAKTOR[s]).replace('.', ',')}-fache Wirkung`,
        hinweis: d.art === 'verb'
          ? `Gestern ${d.formen.praeteritum} der Ritter. (${d.name})`
          : pl ? `Zwei gleiche: ${voll(d)} + ${voll(d)} = zwei ${pl.richtig}.` : '',
      });
    }
  }
  for (const d of items) {
    if (!isRune(d) || !d.steigerung) continue;
    for (let s = 2; s <= 4; s++) {
      const lv = defs[`${d.id}@${s}`];
      if (!lv) continue;
      add('steigerungen', {
        id: `steig:${d.id}@${s}`, def: lv, stern: s, name: lv.name + (s === 4 ? ' 👑' : ''), gruppe: d.id,
        wirkung: s === 2 ? 'Komparativ (Vergleichsstufe)' : s === 3 ? 'Superlativ (höchste Stufe)' : 'Superlativ mit Krone',
        hinweis: `${d.name} → ${d.steigerung.komparativ} → ${d.steigerung.superlativ}${d.steigerung.unregelmaessig ? ' (unregelmäßig!)' : ''}`,
      });
    }
  }
  for (const v of items) {
    if (v.art !== 'verb' || !v.formen) continue;
    for (const t of k.traeger) {
      const td = defs[t];
      const pl = pluralOf(td, defs);
      add('saetze', {
        id: `satz:${v.id}:${t}`, def: v, subjekt: td, gruppe: v.id,
        name: `${cap(td.artikel)} ${td.name} ${v.formen.er}.`, artikel: null,
        wirkung: `Mehrzahl: Die ${pl.richtig} ${v.formen.sie}.`,
        hinweis: `Bei einem endet das Verb meist auf -t: ${v.formen.er}. Bei mehreren bleibt die Grundform: ${v.formen.sie}.`,
      });
    }
  }
  for (const d of items) {
    if (isRune(d) || !(d.seltenheit === 'episch' || d.seltenheit === 'legendaer' || d.art === 'tasche')) continue;
    add('besondere', {
      id: `schatz:${d.id}`, def: d, name: d.name, artikel: d.artikel, gruppe: d.art,
      wirkung: d.art === 'tasche' ? `+${d.tasche.felder.length} Felder` : kurzWirkung(d),
      hinweis: d.plural ? `Mehrzahl: die ${d.plural.richtig}` : '',
    });
  }
  const byId = new Map(eintraege.map((e) => [e.id, e]));
  const seiten = SEITEN.map((s) => ({ ...s, eintraege: eintraege.filter((e) => e.seite === s.id) }));
  return { seiten, eintraege, byId };
}

// Welche Buch-Einträge stecken im Lauf? (Rucksack und Lager). Ergebnis: Liste von Eintrags-ids.
export function entdeckungenIn(run, defs, buch) {
  const ids = new Set();
  const has = (id) => buch.byId.has(id) && ids.add(id);
  const byUid = new Map(run.items.map((p) => [p.uid, p]));
  for (const p of run.items) {
    if (p.area !== 'bag' && p.area !== 'store') continue;
    const d = defs[p.id];
    if (!d) continue;
    if (d.art === 'kompositum') has(`komp:${d.id}`);
    const base = d.teile?.traeger || d.id;
    for (let s = 2; s <= (p.stern || 1); s++) has(`stufe:${base}:${s}`);
    if (isRune(d) && d.stufe) for (let s = 2; s <= d.stufe; s++) has(`steig:${d.basis}@${s}`);
    if (d.art === 'verb' && p.satz?.ok) {
      const subj = byUid.get(p.satz.uid);
      const sd = subj && defs[subj.id];
      if (sd && subj.id === p.satz.id) has(`satz:${d.id}:${sd.teile?.traeger || sd.id}`);
    }
    has(`schatz:${d.id}`);
  }
  return [...ids];
}

// Fortschritt einer Seite: { gefunden, gesamt, voll }
export function seitenStand(seite, entdeckt) {
  const gefunden = seite.eintraege.filter((e) => entdeckt.has(e.id)).length;
  return { gefunden, gesamt: seite.eintraege.length, voll: gefunden === seite.eintraege.length };
}
