// Satzschmiede (satzschmiede.json), ohne Darstellung und testbar: Satzglied-Karten, Satzprüfung und die Wirkung
// der Spruchrolle. Ein Satz ist gültig, wenn er ein Aussagesatz mit dem Prädikat an zweiter Stelle ist, Subjekt und
// Prädikat übereinstimmen, das Objekt im richtigen Fall steht und Objekt und Adverbiale zum Verb passen.
// Ungültige Sätze ergeben keine Spruchrolle – ein falscher Satz ist also nie stärker als ein richtiger.

import { starDef } from './grammar.js';

export const THEMA_SATZ = 'satzglieder';
const MAX_STERN = 4;
// Die Spruchrolle: ein Gegenstand, dessen Werte aus dem Satz kommen (stehen am Gegenstand im Lauf: p.spruch)
export const SPRUCH_DEF = {
  id: 'spruchrolle', art: 'spruch', name: 'Spruchrolle', artikel: 'die', w: 2, h: 1, seltenheit: 'episch', preis: 4, laden: false,
  bild: 'ui/satzschmiede/spruchrolle.webp',
};
export const ADVERBIAL = ['zeit', 'art', 'ort'];
export const GLIED_NAME = { subjekt: 'Subjekt', praedikat: 'Prädikat', objekt: 'Objekt', zeit: 'Adverbiale der Zeit', art: 'Adverbiale der Art und Weise', ort: 'Adverbiale des Ortes' };
export const GLIED_FRAGE = { subjekt: 'Wer?', praedikat: 'Was tut?', objekt: 'Wen?', zeit: 'Wann?', art: 'Wie?', ort: 'Wo?' };

const PERSONEN = ['er', 'ich', 'wir'];
const gross = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// Karten für die Schmiede. verben: Infinitive der Verb-Rollen im Rucksack (die zur Schmiede passen), höchstens zwei.
// figur: { kurz }, begleiter: { id, name, artikel } oder null. stufe 1–3 bestimmt, welche Satzglieder vorkommen.
export function karten({ daten, ws, figur, begleiter = null, verben, stufe = 1 }) {
  const glieder = daten.stufen[stufe].glieder;
  const out = [];
  let n = 0;
  const neu = (k) => out.push({ id: `k${++n}`, ...k });
  // Subjekte: die Figur, ich, wir, der Begleiter
  neu({ glied: 'subjekt', text: figur.kurz, person: 'er', wer: 'figur' });
  neu({ glied: 'subjekt', text: 'ich', person: 'ich', wer: 'ich' });
  neu({ glied: 'subjekt', text: 'wir', person: 'wir', wer: 'wir' });
  if (begleiter) neu({ glied: 'subjekt', text: `${begleiter.artikel} ${begleiter.name}`, person: 'er', wer: 'begleiter', begleiter: begleiter.id });
  // Prädikate: je Verb die Formen für er, ich, wir – dazu eine falsche Personalform (du), wenn es sie gibt
  for (const inf of verben) {
    const v = ws.verben.find((x) => x.infinitiv === inf);
    const formen = [...new Set(PERSONEN.map((p) => v.praesens[p]))];
    for (const f of formen) neu({ glied: 'praedikat', text: f, verb: inf });
    if (!formen.includes(v.praesens.du)) neu({ glied: 'praedikat', text: v.praesens.du, verb: inf });
  }
  // Objekte (ab Stufe 2): passende Objekte der Verben, dazu Karten im falschen Fall
  if (glieder.includes('objekt')) {
    const objekte = [...new Set(verben.flatMap((inf) => daten.verben[inf].objekte))];
    for (const o of objekte) neu({ glied: 'objekt', text: o });
    for (const [falsch, richtig] of Object.entries(daten.falscherFall)) if (objekte.includes(richtig)) neu({ glied: 'objekt', text: falsch, falsch: true });
  }
  // Adverbiale (ab Stufe 3)
  for (const typ of ADVERBIAL) {
    if (!glieder.includes(typ)) continue;
    for (const a of [...new Set(verben.flatMap((inf) => daten.verben[inf][typ]))]) neu({ glied: typ, text: a });
  }
  return out;
}

// Der Satz aus der Leiste (Reihenfolge der Karten), mit großem Anfangsbuchstaben und Punkt
export const satzText = (leiste) => (leiste.length ? gross(leiste.map((k) => k.text).join(' ')) + '.' : '');

// Satzprüfung. Ergebnis: { gueltig, fehler (freundliche Erklärung), satz, verb, subjekt, objekt, adverbiale }
export function pruefeSatz(leiste, { daten, ws }) {
  const satz = satzText(leiste);
  const nein = (fehler) => ({ gueltig: false, fehler, satz });
  const von = (g) => leiste.filter((k) => k.glied === g);
  const pr = von('praedikat'), su = von('subjekt'), ob = von('objekt');
  if (!pr.length) return nein('Es fehlt das Prädikat – das Verb, das sagt, was jemand tut.');
  if (pr.length > 1) return nein('Ein Satz braucht genau ein Prädikat.');
  if (!su.length) return nein('Es fehlt das Subjekt. Frag: Wer tut etwas?');
  if (su.length > 1) return nein('Ein Satz braucht genau ein Subjekt.');
  const p = pr[0], s = su[0];
  if (leiste.indexOf(p) !== 1) {
    return nein(leiste.indexOf(p) === 0
      ? 'Steht das Prädikat vorn, wird der Satz zur Frage. Im Aussagesatz steht es an zweiter Stelle.'
      : 'Im Aussagesatz steht das Prädikat an zweiter Stelle.');
  }
  const v = ws.verben.find((x) => x.infinitiv === p.verb);
  const passend = v.praesens[s.person];
  if (p.text !== passend) return nein(`„${s.text}“ und „${p.text}“ passen nicht zusammen. Es heißt: ${s.text} ${passend}.`);
  const regeln = daten.verben[p.verb];
  if (ob.length > 1) return nein('Ein Objekt reicht – nimm nur eins.');
  const o = ob[0] || null;
  if (o?.falsch) return nein(`Nach „${p.verb}“ fragt man „Wen?“ – es heißt „${daten.falscherFall[o.text]}“, nicht „${o.text}“.`);
  if (o && !regeln.objekte.includes(o.text)) return nein(`„${p.verb}“ passt nicht zu „${o.text}“ – überleg, wen man ${p.verb} möchte.`);
  const adverbiale = {};
  for (const typ of ADVERBIAL) {
    const a = von(typ);
    if (a.length > 1) return nein(`Nimm nur eine Karte für „${GLIED_FRAGE[typ]}“.`);
    if (a[0] && !regeln[typ].includes(a[0].text)) return nein(`„${a[0].text}“ passt nicht gut zu „${p.verb}“.`);
    if (a[0]) adverbiale[typ] = a[0].text;
  }
  return { gueltig: true, fehler: '', satz, verb: p.verb, subjekt: s, objekt: o?.text || null, adverbiale };
}

// Umstellprobe: ein Satzglied an den Anfang stellen. Das Prädikat bleibt an zweiter Stelle, die übrigen Satzglieder
// folgen in ihrer Reihenfolge. Stellt man das Prädikat selbst nach vorn, wird der Satz zur Frage (ungültig).
export function umstellen(leiste, i) {
  const p = leiste.find((k) => k.glied === 'praedikat');
  if (!p || leiste[i] === p) return [leiste[i], ...leiste.filter((_, k) => k !== i)];
  return [leiste[i], p, ...leiste.filter((k, n) => n !== i && k !== p)];
}
// Ist neu eine gelungene Umstellung von alt? Dieselben Karten, ein anderes Satzglied vorn, und der Satz ist gültig.
export function istUmstellung(alt, neu, ctx) {
  if (alt.length !== neu.length || !neu.every((k) => alt.includes(k)) || neu[0] === alt[0]) return false;
  return pruefeSatz(neu, ctx).gueltig;
}

// Werte der Spruchrolle aus dem geprüften Satz. verbDef: die Verb-Rolle aus items.json, stern: deren Sternstufe im
// Rucksack (so wächst die Spruchrolle mit dem Lauf). Die Umstellprobe macht sie eine Sternstufe stärker.
// Ergebnis: { werte (wie bei einem Gegenstand: schaden, block, heilung, abklingzeit, startblock, glueck, sofort,
//   verzoegerung), zeilen (Erklärung je Satzglied), stufe (Sternstufe der Spruchrolle) }
export function spruchWerte(r, { daten, verbDef, stern = 1, umgestellt = false, applyMod }) {
  let prozent = 0, abk = 0, startblock = 0, glueck = 0, sofort = false, verzoegerung = 0;
  const zeilen = [`Prädikat „${r.verb}“: ${verbDef.schaden ? 'Schaden' : verbDef.heilung ? 'Heilung' : 'Block'} wie die Rolle „${verbDef.name}“ ${'★'.repeat(Math.min(MAX_STERN, stern))}`];
  const nimm = (w, text) => {
    prozent += w.prozent || 0; abk += w.abklingzeit || 0; startblock += w.startblock || 0; glueck += w.glueck || 0;
    if (w.sofort) sofort = true;
    verzoegerung = Math.max(verzoegerung, w.verzoegerung || 0);
    zeilen.push(text);
  };
  const sb = r.subjekt.wer === 'begleiter' ? daten.subjektBonus.begleiter[r.subjekt.begleiter] : daten.subjektBonus[r.subjekt.wer];
  if (sb) nimm(sb, `Subjekt „${r.subjekt.text}“: ${sb.text}`);
  if (r.objekt) nimm(daten.objektBonus, `Objekt „${r.objekt}“: ${daten.objektBonus.text}`);
  for (const typ of ADVERBIAL) {
    const a = r.adverbiale[typ];
    if (a) nimm(daten.adverbiale[a].wirkung, `${GLIED_NAME[typ]} „${a}“: ${daten.adverbiale[a].text}`);
  }
  const stufe = Math.min(MAX_STERN, stern + (umgestellt ? 1 : 0));
  if (umgestellt) zeilen.push(daten.umstellBonus.text);
  const sd = starDef(verbDef, stufe);
  const basis = { abklingzeit: sd.abklingzeit };
  for (const k of ['schaden', 'block', 'heilung', 'gift', 'brand', 'kaelte', 'regeneration']) if (sd[k]) basis[k] = sd[k];
  const werte = applyMod(basis, { prozent, abklingzeit: abk });
  if (startblock) werte.startblock = startblock;
  if (glueck) werte.glueck = glueck;
  if (sofort) werte.sofort = true;
  if (verzoegerung) werte.verzoegerung = verzoegerung;
  return { werte, zeilen, stufe };
}

// Lernstand im Thema Satzglieder: zweimal gleich ein gültiger Satz → nächste Stufe (wie bei den Aufgaben)
export function verbucheSatz(profil, gleichRichtig) {
  profil.lernstand ||= {};
  const l = (profil.lernstand[THEMA_SATZ] ||= { stufe: 1, sicher: 0 });
  let aufgestiegen = false;
  if (gleichRichtig) {
    l.sicher++;
    if (l.sicher >= 2 && l.stufe < 3) { l.stufe++; l.sicher = 0; aufgestiegen = true; }
  } else l.sicher = 0;
  delete l.geschaetzt;
  return { aufgestiegen, stufe: l.stufe };
}

// Grund-Sternstufe der Spruchrolle: die der Verb-Rolle im Rucksack (die beste, wenn es mehrere gibt), mindestens
// die Stufe des Tages (daten.sternAbTag) – so bleibt die Spruchrolle bis zum Ende der Reise nützlich.
export function schmiedeStern(run, defs, inf, daten = {}) {
  const st = run.items.filter((p) => p.area === 'bag' && defs[p.id]?.art === 'verb' && defs[p.id].name === inf).map((p) => p.stern || 1);
  const tag = Math.max(1, ...Object.entries(daten.sternAbTag || {}).filter(([t]) => (run.day || 1) >= +t).map(([, s]) => s));
  return Math.max(tag, ...st);
}

// Verben im Rucksack, aus denen man schmieden kann (sonst die Grundverben), höchstens zwei
export function schmiedeVerben(run, defs, daten) {
  const imRucksack = [...new Set(run.items.filter((p) => p.area === 'bag' && defs[p.id]?.art === 'verb').map((p) => defs[p.id].name))]
    .filter((inf) => daten.verben[inf]);
  return (imRucksack.length ? imRucksack : daten.grundverben).slice(0, 2);
}
