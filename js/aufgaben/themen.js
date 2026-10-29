// Aufgaben-Inhalte je Thema und Stufe (ohne Darstellung, testbar). Das Wort kommt zufällig aus dem Wortschatz,
// bevorzugt aus dem Wortfeld des aktuellen Gebiets. Sätze stammen immer vom Wort selbst (saetze.js) – keine
// Schablonen, in die beliebige Wörter eingesetzt werden; gibt es keinen passenden Satz, kommt die Aufgabe ohne Satz. Ergebnis: ein Inhalt für ein Format (siehe js/aufgaben/formate/)
// mit frage, merke (Erklärung mit Merkhilfe), regel (id der Regelkarte) und wort (Schlüssel gegen Wiederholungen).
import {
  falschePlurale, falschePraeterita, falscheFormen, falscheSteigerung, sichererSchreibfehler, schreibfehler, merkhilfe, alleFormen, gross,
} from './wortschatz.js';
import { mitLuecke, rahmenSatz, praeteritum, hilfsverbForm, artikelSatz, woerter, kern, zaehle } from './saetze.js';

// ---------- Zufall ----------
export const zufall = (liste, rng) => liste[Math.floor(rng() * liste.length)];
export function mische(liste, rng) {
  const a = [...liste];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const nimm = (liste, n, rng) => mische(liste, rng).slice(0, n);

// Ein Wort wählen: nicht schon benutzt, bevorzugt aus den Wortfeldern des Gebiets.
// n Wörter, zuerst solche, die in diesem Lauf (in diesem Thema) noch nicht dran waren. Das erste ist das
// Schlüsselwort der Aufgabe – es ist frisch, solange es überhaupt noch ein frisches gibt.
function nimmFrisch(liste, ctx, n = 3, schluessel = (x) => 'n:' + x.wort) {
  const frei = liste.filter((x) => !ctx.benutzt?.has(schluessel(x)));
  const rest = liste.filter((x) => ctx.benutzt?.has(schluessel(x)));
  return [...mische(frei, ctx.rng), ...mische(rest, ctx.rng)].slice(0, n);
}

function waehle(liste, schluessel, ctx) {
  const frei = liste.filter((x) => !ctx.benutzt?.has(schluessel(x)));
  const basis = frei.length ? frei : liste;
  const imFeld = ctx.felder?.length ? basis.filter((x) => ctx.felder.includes(x.wortfeld)) : [];
  if (imFeld.length && ctx.rng() < 0.6) return zufall(imFeld, ctx.rng);
  return zufall(basis, ctx.rng);
}

// ---------- Hilfen ----------
const PRON = { ich: 'ich', du: 'du', er: 'er/sie/es', wir: 'wir', ihr: 'ihr', sie: 'sie' };
const ART_GROSS = { der: 'Der', die: 'Die', das: 'Das' };
const optionen = (richtig, falsch, rng, n = 4) => mische([richtig, ...nimm(falsch.filter((f) => f !== richtig), n - 1, rng)], rng);
const satzText = (s) => s.glieder.map((g) => g.woerter.map((w) => w.wort).join(' ')).join(' ') + '.';
const wortListe = (s) => s.glieder.flatMap((g) => g.woerter);

const MEHRZAHL_REGEL = {
  '-e': 'mehrzahl-e', '-n': 'mehrzahl-n', '-en': 'mehrzahl-en', 'Umlaut+e': 'mehrzahl-umlaut', 'Umlaut+er': 'mehrzahl-er', '-er': 'mehrzahl-er',
  'Umlaut': 'mehrzahl-umlaut', 'Umlaut+en': 'mehrzahl-umlaut', 'unverändert': 'mehrzahl-gleich', '-s': 'mehrzahl-s', '-nen': 'mehrzahl-in', '-se': 'mehrzahl-nis',
};
const MEHRZAHL_PASST = { // welche Regeln zu einem Muster passen (für „Regel entdecken“)
  'Umlaut+e': ['mehrzahl-umlaut', 'mehrzahl-e'], 'Umlaut+er': ['mehrzahl-umlaut', 'mehrzahl-er'], 'Umlaut': ['mehrzahl-umlaut', 'mehrzahl-gleich'],
};
const MEHRZAHL_STUFE = { 1: ['-e', '-n', '-en'], 2: ['Umlaut+e', '-er', 'Umlaut+er', 'Umlaut'], 3: ['unverändert', '-s', '-nen', '-se', 'Umlaut+en'] };
// Das Wort im Satz hervorheben (nur das erste Vorkommen, Satzzeichen bleiben außerhalb)
function markiere(satz, wort, cls = '') {
  const t = woerter(satz);
  const i = t.findIndex((x) => kern(x) === wort);
  t[i] = t[i].replace(wort, `<b${cls ? ` class="${cls}"` : ''}>${wort}</b>`);
  return t.join(' ');
}

// Eigene Ableitungen (zur Laufzeit gecacht)
let FORMEN = null, WS = null;
function bereit(ws) {
  if (WS !== ws) { WS = ws; FORMEN = alleFormen(ws); }
  return FORMEN;
}
const einfach = (ws) => ws.nomen.filter((n) => !n.mehrdeutig && !n.grundwort);
// Nomen nach Stufe: 1 häufige, 2 seltenere, 3 die seltensten und langen Wörter (genug Auswahl bleibt immer)
function schwerer(liste, stufe) {
  if (stufe === 1) return liste.filter((n) => n.schwierigkeit === 1);
  if (stufe === 2) return liste.filter((n) => n.schwierigkeit >= 2);
  const schwer = liste.filter((n) => n.schwierigkeit === 3 || (n.schwierigkeit === 2 && n.wort.length >= 8));
  return schwer.length >= 8 ? schwer : liste.filter((n) => n.schwierigkeit >= 2);
}
// Wortfelder auf Stufe 1: eindeutige Kernwörter und Paare [Wortfeld, Feld des fremden Worts]
const FELD_KERN = {
  schmiede: ['Schmied', 'Hammer', 'Amboss', 'Zange', 'Säge', 'Nagel', 'Schraube', 'Feile', 'Werkzeug', 'Schwert', 'Axt'],
  zauber: ['Zauber', 'Zauberer', 'Hexe', 'Rune', 'Buch', 'Seite', 'Buchstabe', 'Stift', 'Schrift'],
  essen: ['Brot', 'Apfel', 'Birne', 'Kirsche', 'Kartoffel', 'Zwiebel', 'Kuchen', 'Keks', 'Suppe', 'Wurst', 'Gurke', 'Tomate', 'Salat', 'Banane', 'Brezel'],
  natur: ['Wolke', 'Blitz', 'Sturm', 'Wind', 'Sonne', 'Himmel', 'Nebel', 'Regen', 'Flocke', 'Pfütze'],
};
const FELD_PAARE = [['schmiede', 'essen'], ['essen', 'schmiede'], ['schmiede', 'natur'], ['natur', 'schmiede'], ['essen', 'natur'],
  ['zauber', 'essen'], ['essen', 'zauber'], ['zauber', 'schmiede'], ['schmiede', 'zauber'], ['natur', 'zauber']];

// ---------- Themen ----------
// Jede Funktion: (stufe, format, ctx) → Inhalt. ctx = { ws, rng, felder, benutzt, itemWort }

const THEMEN = {
  artikel(stufe, format, ctx) {
    const { ws, rng } = ctx;
    if (stufe === 3) {
      const alle = [...ws.komposita.map((k) => ({ wort: k.wort, artikel: k.artikel, grundwort: k.grundwort })),
        ...ws.nomen.filter((n) => n.grundwort && !n.mehrdeutig).map((n) => ({ wort: n.wort, artikel: n.artikel, grundwort: n.grundwort }))];
      const quelle = alle.filter((k, i) => alle.findIndex((x) => x.wort === k.wort) === i);
      const gwArt = (k) => ws.nomen.find((n) => n.wort === k.grundwort).artikel;
      if (format === 'regel') {
        const bsp = nimmFrisch(quelle, ctx, 3, (k) => 'k:' + k.wort);
        return {
          format, frage: 'Schau dir die Beispiele an. Welche Regel stimmt?', wort: 'k:' + bsp[0].wort, regel: 'artikel-grundwort',
          beispiele: bsp.map((k) => `${gwArt(k)} ${k.grundwort} → ${k.artikel} ${k.wort}`),
          optionen: mische([ws.regelText('artikel-grundwort'), 'Das erste Wort bestimmt den Artikel.', 'Zusammengesetzte Nomen haben immer den Artikel „das“.', 'Lange Nomen haben immer den Artikel „die“.'], rng),
          richtig: ws.regelText('artikel-grundwort'),
          merke: 'Das letzte Wort – das Grundwort – bestimmt den Artikel.',
        };
      }
      if (format === 'sortieren') return artikelSortieren(quelle, ctx, 'artikel-grundwort', (k) => `Das Grundwort ${k.grundwort} bestimmt: ${k.artikel} ${k.wort}.`);
      const k = waehle(quelle, (x) => 'k:' + x.wort, ctx);
      return {
        format: 'auswahl', frage: 'Welcher Artikel passt?', text: `<span class="blank">___</span> ${k.wort}`, wort: 'k:' + k.wort, regel: 'artikel-grundwort',
        optionen: ['der', 'die', 'das'], richtig: k.artikel, genus: true,
        merke: `Das letzte Wort bestimmt den Artikel: ${gwArt(k)} ${k.grundwort} → ${k.artikel} ${k.wort}.`,
      };
    }
    const quelle = schwerer(einfach(ws), stufe);
    if (format === 'sortieren') return artikelSortieren(quelle, ctx, 'artikel-lernen', (n) => `Lerne Nomen mit Artikel: ${n.artikel} ${n.wort}.`);
    const n = ctx.itemNomen && ctx.rng() < 0.2 ? ctx.itemNomen : waehle(quelle, (x) => 'n:' + x.wort, ctx);
    const basis = { wort: 'n:' + n.wort, regel: 'artikel-lernen', richtig: n.artikel, merke: `Es heißt ${n.artikel} ${n.wort}. Lerne Nomen immer mit Artikel.` };
    const s = format === 'luecke' && artikelSatz(n);
    if (s) return { ...basis, format, frage: 'Welcher Artikel passt?', satz: '___' + s.slice(n.artikel.length), optionen: ['Der', 'Die', 'Das'], richtig: ART_GROSS[n.artikel], genus: true };
    return { ...basis, format: 'auswahl', frage: 'Welcher Artikel passt?', text: `<span class="blank">___</span> ${n.wort}`, optionen: ['der', 'die', 'das'], genus: true };
  },

  mehrzahl(stufe, format, ctx) {
    const { ws, rng } = ctx;
    const formen = bereit(ws);
    const muster = MEHRZAHL_STUFE[stufe];
    const alle = ws.nomen.filter((n) => !n.mehrdeutig && muster.includes(n.pluralmuster) && falschePlurale(n, formen).length >= 2);
    // Stufe 3: seltene Wörter bevorzugt
    const selten = stufe === 3 ? alle.filter((n) => n.schwierigkeit >= 2) : alle;
    const quelle = selten.length >= 8 ? selten : alle;
    if (format === 'regel') {
      const m = zufall(muster.filter((x) => quelle.filter((n) => n.pluralmuster === x).length >= 3), rng);
      const bsp = nimmFrisch(quelle.filter((n) => n.pluralmuster === m), ctx, 3);
      const passt = MEHRZAHL_PASST[m] || [MEHRZAHL_REGEL[m]];
      const richtig = ws.regelText(MEHRZAHL_REGEL[m]);
      const andere = ws.themaRegeln('mehrzahl').filter((r) => !passt.includes(r.id)).map((r) => r.text);
      return {
        format, frage: 'Schau dir die Beispiele an. Welche Regel passt?', wort: 'n:' + bsp[0].wort, regel: MEHRZAHL_REGEL[m],
        beispiele: bsp.map((n) => `${n.artikel} ${n.wort} – die ${n.plural}`), optionen: optionen(richtig, andere, rng), richtig, merke: richtig,
      };
    }
    if (format === 'paare') {
      const ns = nimmFrisch(quelle, ctx, 4, (n) => 'n:' + n.wort);
      return {
        format, frage: 'Verbinde Einzahl und Mehrzahl.', wort: 'n:' + ns[0].wort, regel: MEHRZAHL_REGEL[ns[0].pluralmuster],
        paare: ns.map((n) => [`${n.artikel} ${n.wort}`, `die ${n.plural}`]), merke: ns.map((n) => `${n.wort} – ${n.plural}`).join(', ') + '.',
      };
    }
    const n = ctx.itemNomen && muster.includes(ctx.itemNomen.pluralmuster) && rng() < 0.2 ? ctx.itemNomen : waehle(quelle, (x) => 'n:' + x.wort, ctx);
    const merke = `${ws.regelText(MEHRZAHL_REGEL[n.pluralmuster])} Hier: ${n.artikel} ${n.wort} – die ${n.plural}.`;
    const basis = { wort: 'n:' + n.wort, regel: MEHRZAHL_REGEL[n.pluralmuster], merke };
    if (format === 'buchstaben') return { ...basis, format, frage: `Mehrzahl von „${n.artikel} ${n.wort}“: Ergänze die fehlenden Buchstaben.`, ...luecken(n.plural, n.wort, rng), vorsatz: 'die' };
    if (format === 'eintippen') return { ...basis, format, frage: `Schreibe die Mehrzahl: ${n.artikel} ${n.wort} → die …`, loesung: n.plural };
    const falsch = falschePlurale(n, formen);
    const satz = format === 'luecke' && n.mehrzahlSatz && mitLuecke(n.mehrzahlSatz, n.plural);
    if (satz) return { ...basis, format, frage: 'Welche Form passt?', satz, optionen: optionen(n.plural, falsch, rng), richtig: n.plural };
    return { ...basis, format: 'auswahl', frage: 'Wie heißt die Mehrzahl?', text: `${n.artikel} ${n.wort} → die <span class="blank">___</span>`, optionen: optionen(n.plural, falsch, rng), richtig: n.plural };
  },

  wortarten(stufe, format, ctx) {
    const { ws, rng } = ctx;
    const NAME = { nomen: 'Nomen', verb: 'Verb', adjektiv: 'Adjektiv', artikel: 'Artikel', pronomen: 'Pronomen', praeposition: 'Präposition' };
    const REGEL = { nomen: 'wortart-nomen', verb: 'wortart-verb', adjektiv: 'wortart-adjektiv', artikel: 'wortart-klein', pronomen: 'wortart-klein', praeposition: 'wortart-klein' };
    const adj = ws.adjektive.filter((a) => !['laut', 'gern', 'viel', 'wenig', 'nah'].includes(a.positiv));
    if (stufe === 1) {
      if (format === 'sortieren' || format === 'passtnicht') {
        const ns = nimm(einfach(ws).filter((n) => n.schwierigkeit === 1), 2, rng).map((n) => ({ text: n.wort, kiste: 'nomen' }));
        const vs = nimm(ws.verben.filter((v) => v.schwierigkeit === 1), 2, rng).map((v) => ({ text: v.infinitiv, kiste: 'verb' }));
        const as = nimm(adj.filter((a) => a.schwierigkeit === 1), 2, rng).map((a) => ({ text: a.positiv, kiste: 'adjektiv' }));
        if (format === 'passtnicht') {
          const pool = { nomen: einfach(ws).filter((n) => n.schwierigkeit === 1).map((n) => n.wort), verb: ws.verben.filter((v) => v.schwierigkeit === 1).map((v) => v.infinitiv), adjektiv: adj.filter((a) => a.schwierigkeit === 1).map((a) => a.positiv) };
          const [art, fremdArt] = nimm(['nomen', 'verb', 'adjektiv'], 2, rng);
          const drei = nimm(pool[art], 3, rng), fremd = zufall(pool[fremdArt], rng);
          return { format, frage: `Welches Wort ist kein ${NAME[art]}?`, woerter: mische([...drei, fremd], rng), richtig: fremd, wort: 'w:' + fremd,
            regel: REGEL[fremdArt], merke: `„${fremd}“ ist ein ${NAME[fremdArt]}. ${ws.regelText(REGEL[fremdArt])}` };
        }
        return { format: 'sortieren', frage: 'Sortiere die Wörter in die richtige Kiste.', kisten: ['nomen', 'verb', 'adjektiv'].map((id) => ({ id, name: NAME[id] })),
          karten: mische([...ns, ...vs, ...as], rng), wort: 'w:' + ns[0].text, regel: 'wortart-nomen', merke: 'Nomen haben einen Artikel, Verben sagen, was jemand tut, Adjektive sagen, wie etwas ist.' };
      }
      const art = zufall(['artikel', 'pronomen', 'praeposition'], rng);
      const w = zufall(ws.kleinwoerter[{ artikel: 'artikel', pronomen: 'pronomen', praeposition: 'praepositionen' }[art]], rng);
      return { format: 'auswahl', frage: `Welche Wortart ist „${w}“?`, text: `<b class="markiert">${w}</b>`, optionen: mische(['Nomen', 'Verb', 'Adjektiv', NAME[art]], rng), richtig: NAME[art],
        wort: 'w:' + w, regel: 'wortart-klein', merke: ws.regelText('wortart-klein') };
    }
    if (stufe === 2) {
      const s = waehle(ws.saetze, (x) => 's:' + satzText(x), ctx);
      const woerter = wortListe(s);
      if (format === 'fehler') {
        const ziel = zufall(['nomen', 'verb', 'adjektiv'].filter((k) => woerter.some((w) => w.wortart === k)), rng);
        return { format, modus: 'markieren', frage: `Tippe alle ${{ nomen: 'Nomen', verb: 'Verben', adjektiv: 'Adjektive' }[ziel]} an.`, woerter: woerter.map((w) => w.wort),
          ziele: woerter.map((w, i) => (w.wortart === ziel ? i : -1)).filter((i) => i >= 0), wort: 's:' + satzText(s), regel: REGEL[ziel], merke: ws.regelText(REGEL[ziel]) };
      }
      const i = Math.floor(rng() * woerter.length);
      const w = woerter[i];
      const andere = Object.values(NAME).filter((x) => x !== NAME[w.wortart]);
      return { format: 'auswahl', frage: 'Welche Wortart ist das markierte Wort?', text: woerter.map((x, k) => (k === i ? `<b class="markiert">${x.wort}</b>` : x.wort)).join(' ') + '.',
        optionen: optionen(NAME[w.wortart], andere, rng), richtig: NAME[w.wortart], wort: 's:' + satzText(s), regel: REGEL[w.wortart], merke: `„${w.wort}“ ist hier ein ${NAME[w.wortart]}. ${ws.regelText(REGEL[w.wortart])}` };
    }
    // Stufe 3: dasselbe Wort als Nomen oder Verb
    const vs = ws.verben.filter((v) => v.nominal);
    // { satz, wort }: als Nomen der Satz mit dem Verb als Nomen, sonst ein Satz des Verbs im Präsens
    const satz = (v, alsNomen) => {
      if (alsNomen) return { satz: v.nominal, wort: gross(v.infinitiv) };
      const s = rahmenSatz(v, zufall(v.rahmen, rng));
      return { satz: s.satz, wort: s.form };
    };
    if (format === 'sortieren') {
      const vv = nimm(vs, 4, rng);
      return { format, frage: 'Ist das markierte Wort ein Nomen oder ein Verb?', kisten: [{ id: 'nomen', name: 'Nomen' }, { id: 'verb', name: 'Verb' }],
        karten: vv.map((v, k) => { const n = k % 2 === 0; const s = satz(v, n); return { text: markiere(s.satz, s.wort), kiste: n ? 'nomen' : 'verb' }; }),
        wort: 'v:' + vv[0].infinitiv, regel: 'wortart-funktion', merke: ws.regelText('wortart-funktion') };
    }
    const v = waehle(vs, (x) => 'v:' + x.infinitiv, ctx);
    const n = rng() < 0.5;
    const s = satz(v, n);
    return { format: 'auswahl', frage: 'Welche Wortart ist das markierte Wort?', text: markiere(s.satz, s.wort, 'markiert'),
      optionen: mische(['Nomen', 'Verb', 'Adjektiv'], rng), richtig: n ? 'Nomen' : 'Verb', wort: 'v:' + v.infinitiv, regel: 'wortart-funktion',
      merke: n ? `Man kann „das“ davorsetzen – „${s.wort}“ ist hier ein Nomen.` : `„${s.wort}“ sagt, was jemand tut – hier ein Verb.` };
  },

  grossklein(stufe, format, ctx) {
    const { ws, rng } = ctx;
    if (stufe === 1) {
      const ns = einfach(ws).filter((n) => n.schwierigkeit === 1);
      const klein = [...ws.verben.filter((v) => v.schwierigkeit === 1).map((v) => v.infinitiv), ...ws.adjektive.filter((a) => a.schwierigkeit === 1).map((a) => a.positiv)];
      if (format === 'sortieren') {
        const g = nimm(ns, 3, rng).map((n) => ({ text: n.wort.toLowerCase(), kiste: 'gross' }));
        const k = nimm(klein, 3, rng).map((t) => ({ text: t, kiste: 'klein' }));
        return { format, frage: 'Wie schreibt man die Wörter: groß oder klein?', kisten: [{ id: 'gross', name: 'groß' }, { id: 'klein', name: 'klein' }],
          karten: mische([...g, ...k], rng), wort: 'n:' + g[0].text, regel: 'gross-nomen', merke: ws.regelText('gross-nomen') };
      }
      const n = waehle(ns, (x) => 'n:' + x.wort, ctx);
      const opt = mische([n.wort.toLowerCase(), ...nimm(klein, 3, rng)], rng);
      return { format: 'auswahl', frage: 'Welches Wort schreibt man groß?', optionen: opt, richtig: n.wort.toLowerCase(), wort: 'n:' + n.wort, regel: 'gross-nomen',
        merke: `Man kann „${n.artikel}“ davorsetzen: ${n.artikel} ${n.wort} – ein Nomen, also groß.` };
    }
    if (stufe === 2) {
      const s = waehle(ws.saetze, (x) => 's:' + satzText(x), ctx);
      const woerter = wortListe(s);
      return { format: 'fehler', modus: 'markieren', frage: 'Hier ist alles klein geschrieben. Tippe alle Wörter an, die man großschreibt.',
        woerter: woerter.map((w) => w.wort.toLowerCase()), ziele: woerter.map((w, i) => (i === 0 || w.wortart === 'nomen' ? i : -1)).filter((i) => i >= 0),
        wort: 's:' + satzText(s), regel: 'gross-satzanfang', merke: `${ws.regelText('gross-satzanfang')} Nomen schreibt man auch groß: ${satzText(s)}` };
    }
    const vs = ws.verben.filter((v) => v.schwierigkeit <= 2 && v.nominal);
    if (format === 'luecke') {
      const v = waehle(vs, (x) => 'v:' + x.infinitiv, ctx);
      const basis = { format, frage: 'Groß oder klein?', wort: 'v:' + v.infinitiv, regel: 'gross-nominalisierung', merke: ws.regelText('gross-nominalisierung') };
      if (rng() < 0.6) {
        const g = gross(v.infinitiv);
        return { ...basis, satz: mitLuecke(v.nominal, g), optionen: [g, v.infinitiv], richtig: g };
      }
      const s = rahmenSatz(v, zufall(v.rahmen, rng));
      return { ...basis, satz: s.luecke, optionen: [gross(s.form), s.form], richtig: s.form };
    }
    const vv = nimm(vs, 4, rng);
    return { format: 'sortieren', frage: 'Groß oder klein? Achte auf das Wort davor.', kisten: [{ id: 'gross', name: 'groß' }, { id: 'klein', name: 'klein' }],
      karten: vv.map((v, k) => (k % 2 === 0 ? { text: `beim <b>${v.infinitiv}</b>`, kiste: 'gross' } : { text: `wir <b>${v.infinitiv}</b>`, kiste: 'klein' })),
      wort: 'v:' + vv[0].infinitiv, regel: 'gross-nominalisierung', merke: ws.regelText('gross-nominalisierung') };
  },

  personalformen(stufe, format, ctx) {
    const { ws, rng } = ctx;
    const vokalwechsel = (v) => v.praesens.du.replace(/s?t$/, '').slice(0, 3) !== v.infinitiv.slice(0, 3);
    const quelle = stufe === 1 ? ws.verben.filter((v) => !v.unregelmaessig)
      : stufe === 2 ? ws.verben.filter((v) => v.unregelmaessig && vokalwechsel(v) && !['sein', 'haben', 'werden', 'wissen'].includes(v.infinitiv))
        : ws.verben.filter((v) => ['sein', 'haben', 'werden', 'wissen', 'tun'].includes(v.infinitiv) || (v.unregelmaessig && v.schwierigkeit === 3));
    const regel = { 1: 'person-endung', 2: 'person-vokal', 3: 'person-sein' }[stufe];
    if (format === 'paare') {
      const v = waehle(quelle, (x) => 'v:' + x.infinitiv, ctx);
      const ps = mische(['ich', 'du', 'er', 'wir'].filter((p, i, a) => a.findIndex((q) => v.praesens[q] === v.praesens[p]) === i), rng).slice(0, 4);
      return { format, frage: `Verbinde: Wer macht was? (${v.infinitiv})`, paare: ps.map((p) => [PRON[p], v.praesens[p]]), wort: 'v:' + v.infinitiv, regel,
        merke: `${v.infinitiv}: ich ${v.praesens.ich}, du ${v.praesens.du}, er ${v.praesens.er}, wir ${v.praesens.wir}.` };
    }
    const v = waehle(quelle, (x) => 'v:' + x.infinitiv, ctx);
    // Stufe 2: nur du und er/sie/es (dort wechselt der Vokal) – jedes Verb hat einen Rahmen mit er/sie/es
    const r = zufall(v.rahmen.filter((x) => stufe !== 2 || ['du', 'er'].includes(x.person)), rng);
    const p = r.person;
    const richtig = v.praesens[p];
    const merke = `${ws.regelText(regel)} Hier: ${PRON[p]} ${richtig}.`;
    const basis = { wort: 'v:' + v.infinitiv, regel, merke };
    if (format === 'buchstaben') return { ...basis, format, frage: `${PRON[p]} … (${v.infinitiv}): Ergänze die fehlenden Buchstaben.`, ...luecken(richtig, v.infinitiv, rng), vorsatz: PRON[p] };
    if (format === 'eintippen') return { ...basis, format, frage: `Schreibe die Form: ${PRON[p]} … (${v.infinitiv})`, loesung: richtig };
    const falsch = falscheFormen(v, p);
    if (format === 'auswahl') return { ...basis, format, frage: `Welche Form passt? (${v.infinitiv})`, text: `${PRON[p]} <span class="blank">___</span>`, optionen: optionen(richtig, falsch, rng), richtig };
    return { ...basis, format: 'luecke', frage: `Welche Form passt? (${v.infinitiv})`, satz: rahmenSatz(v, r).luecke, optionen: optionen(richtig, falsch, rng), richtig };
  },

  zeitformen(stufe, format, ctx) {
    const { ws, rng } = ctx;
    if (stufe === 3) {
      const quelle = ws.verben.filter((v) => v.hilfsverb !== 'beide' && !['sein', 'werden', 'sterben'].includes(v.infinitiv));
      const v = waehle(quelle, (x) => 'v:' + x.infinitiv, ctx);
      const r = zufall(v.rahmen, rng);
      if (format === 'auswahl') {
        const zeit = zufall(['Präsens', 'Präteritum', 'Perfekt'], rng);
        const satz = rahmenSatz(v, r, { Präsens: 'praesens', Präteritum: 'praeteritum', Perfekt: 'perfekt' }[zeit]).satz;
        if (v.praesens[r.person] === praeteritum(v, r.person)) return THEMEN.zeitformen(3, 'luecke', ctx);
        return { format, frage: 'In welcher Zeitform steht der Satz?', text: satz, optionen: ['Präsens', 'Präteritum', 'Perfekt'], richtig: zeit, wort: 'v:' + v.infinitiv,
          regel: 'zeit-erkennen', merke: ws.regelText('zeit-erkennen') };
      }
      const s = rahmenSatz(v, r, 'perfekt');
      const andere = ['wir', 'ihr', 'sie'].includes(r.person) ? 'er' : 'wir';
      const formen = [...new Set(['haben', 'sein'].flatMap((h) => [hilfsverbForm(h, r.person), hilfsverbForm(h, andere)]))];
      return { format: 'luecke', frage: 'haben oder sein?', satz: s.luecke, optionen: mische(formen, rng), richtig: s.form,
        wort: 'v:' + v.infinitiv, regel: 'zeit-perfekt', merke: `${ws.regelText('zeit-perfekt')} Hier: ${s.satz}` };
    }
    const quelle = ws.verben.filter((v) => (stufe === 1 ? !v.unregelmaessig : v.unregelmaessig) && v.infinitiv !== 'sterben');
    const regel = stufe === 1 ? 'zeit-te' : 'zeit-stark';
    if (format === 'regel') {
      const bsp = nimmFrisch(ws.verben.filter((v) => !v.unregelmaessig), ctx, 3, (v) => 'v:' + v.infinitiv);
      return { format, frage: 'Schau dir die Beispiele an. Welche Regel stimmt?', beispiele: bsp.map((v) => `${v.infinitiv} – er ${v.praeteritum}`), wort: 'v:' + bsp[0].infinitiv, regel: 'zeit-te',
        optionen: mische([ws.regelText('zeit-te'), 'Im Präteritum kommt immer „ge-“ vor das Verb.', 'Im Präteritum ändert sich immer der Vokal.', 'Im Präteritum hängt man -en an.'], rng),
        richtig: ws.regelText('zeit-te'), merke: ws.regelText('zeit-te') };
    }
    if (format === 'paare') {
      const vs = nimmFrisch(quelle, ctx, 4, (v) => 'v:' + v.infinitiv);
      return { format, frage: 'Verbinde Grundform und Präteritum.', paare: vs.map((v) => [v.infinitiv, `er ${v.praeteritum}`]), wort: 'v:' + vs[0].infinitiv, regel,
        merke: vs.map((v) => `${v.infinitiv} – ${v.praeteritum}`).join(', ') + '.' };
    }
    const v = waehle(quelle, (x) => 'v:' + x.infinitiv, ctx);
    const merke = `${ws.regelText(regel)} Hier: ${v.infinitiv} – er ${v.praeteritum}.`;
    const basis = { wort: 'v:' + v.infinitiv, regel, merke };
    if (format === 'buchstaben') return { ...basis, format, frage: `Präteritum von „${v.infinitiv}“: Ergänze die fehlenden Buchstaben.`, ...luecken(v.praeteritum, v.infinitiv, rng), vorsatz: 'gestern er' };
    const r = zufall(v.rahmen.filter((x) => ['ich', 'er', 'wir', 'sie'].includes(x.person)), rng);
    const s = rahmenSatz(v, r, 'praeteritum');
    const falsch = [...new Set(falschePraeterita(v).map((f) => praeteritum({ praeteritum: f }, r.person)))];
    return { ...basis, format: 'luecke', frage: `Präteritum von „${v.infinitiv}“`, satz: s.luecke, optionen: optionen(s.form, falsch, rng), richtig: s.form };
  },

  steigerung(stufe, format, ctx) {
    const { ws, rng } = ctx;
    // Stufe 3: unregelmäßige Formen und Formen im Satz mit Deklination („Das ist der ___ Weg.“)
    const quelle = ws.adjektive.filter((a) => a.schwierigkeit === stufe || (stufe === 3 && a.attributiv));
    if (stufe === 3 && rng() < 0.5) {
      const a = waehle(quelle.filter((x) => x.attributiv), (x) => 'a:' + x.positiv, ctx);
      const t = a.attributiv;
      return { format: 'luecke', frage: `Welche Form von „${a.positiv}“ passt in den Satz?`, satz: t.satz.replace(t.form, '___'),
        optionen: optionen(t.form, t.falsch, rng), richtig: t.form, wort: 'a:' + a.positiv, regel: 'steigerung-unregel',
        merke: `Vor einem Nomen bekommt der Superlativ eine Endung: ${t.satz}` };
    }
    const regel = { 1: 'steigerung-regel', 2: 'steigerung-umlaut', 3: 'steigerung-unregel' }[stufe];
    if (format === 'regel') {
      const bsp = nimmFrisch(ws.adjektive.filter((a) => a.schwierigkeit === 2), ctx, 3, (a) => 'a:' + a.positiv);
      return { format, frage: 'Schau dir die Beispiele an. Welche Regel stimmt?', beispiele: bsp.map((a) => `${a.positiv} – ${a.komparativ} – ${a.superlativ}`), wort: 'a:' + bsp[0].positiv,
        regel: 'steigerung-umlaut', optionen: mische([ws.regelText('steigerung-umlaut'), 'Beim Steigern bleibt das Wort immer gleich.', 'Beim Steigern kommt immer „mehr“ davor.', 'Beim Steigern fällt der Umlaut weg.'], rng),
        richtig: ws.regelText('steigerung-umlaut'), merke: ws.regelText('steigerung-umlaut') };
    }
    if (format === 'paare') {
      const as = nimmFrisch(quelle, ctx, 4, (a) => 'a:' + a.positiv);
      return { format, frage: 'Verbinde Grundform und Komparativ.', paare: as.map((a) => [a.positiv, a.komparativ]), wort: 'a:' + as[0].positiv, regel,
        merke: as.map((a) => `${a.positiv} – ${a.komparativ}`).join(', ') + '.' };
    }
    const a = waehle(quelle, (x) => 'a:' + x.positiv, ctx);
    const art = rng() < 0.35 ? 'komparativ' : 'superlativ'; // mehr Superlativ
    const richtig = a[art];
    const merke = `${ws.regelText(regel)} Hier: ${a.positiv} – ${a.komparativ} – ${a.superlativ}.`;
    const basis = { wort: 'a:' + a.positiv, regel, merke };
    if (format === 'buchstaben') return { ...basis, format, frage: `${art === 'komparativ' ? 'Komparativ' : 'Superlativ'} von „${a.positiv}“: Ergänze.`, ...luecken(richtig.replace('am ', ''), a.positiv, rng), vorsatz: art === 'superlativ' ? 'am' : '' };
    if (format === 'eintippen') return { ...basis, format, frage: `Schreibe den ${art === 'komparativ' ? 'Komparativ' : 'Superlativ'}: ${a.positiv} → ${art === 'superlativ' ? 'am …' : '…'}`, loesung: richtig.replace('am ', '') };
    return { ...basis, format: 'luecke', frage: `Steigere „${a.positiv}“.`, satz: a.saetze[art].replace(richtig, '___'), optionen: optionen(richtig, falscheSteigerung(a, art), rng), richtig };
  },

  verlaengerung: (s, f, c) => rechtschreibung(['auslaut-d', 'auslaut-b', 'auslaut-g'], 'verlaengern', s, f, c),
  ableitung: (s, f, c) => rechtschreibung(['ä-ableitung', 'äu-ableitung'], 'ableiten', s, f, c),
  doppel: (s, f, c) => rechtschreibung(['doppelkonsonant'], 'doppel-kurz', s, f, c),
  ie: (s, f, c) => rechtschreibung(['ie'], 'ie-lang', s, f, c),
  tzck: (s, f, c) => rechtschreibung(['tz', 'ck'], 'tzck-kurz', s, f, c),

  komposita(stufe, format, ctx) {
    const { ws, rng } = ctx;
    const quelle = ws.komposita.filter((k) => (stufe === 3 ? k.fuge : stufe === 1 ? !k.fuge : true));
    const k = waehle(quelle, (x) => 'k:' + x.wort, ctx);
    const gw = ws.nomen.find((n) => n.wort === k.grundwort);
    if (stufe === 2) {
      if (format === 'regel') return THEMEN.artikel(3, 'regel', ctx);
      const bw = ws.nomen.find((n) => n.wort === k.bestimmungswort);
      return { format: 'auswahl', frage: 'Welcher Artikel passt?', text: `${bw ? bw.artikel + ' ' : ''}${k.bestimmungswort} + ${gw.artikel} ${gw.wort} = <span class="blank">___</span> ${k.wort}`,
        optionen: ['der', 'die', 'das'], richtig: k.artikel, genus: true, wort: 'k:' + k.wort, regel: 'kompositum-artikel',
        merke: `Das Grundwort bestimmt den Artikel: ${gw.artikel} ${gw.wort} → ${k.artikel} ${k.wort}.` };
    }
    if (stufe === 3) {
      return { format: 'baukasten', modus: 'fuge', frage: 'Welches Fugenelement fehlt?', links: k.bestimmungswort, rechts: k.grundwort.toLowerCase(),
        fugen: ['–', 's', 'n', 'en', 'e', 'er'], richtig: k.fuge || '–', wort: 'k:' + k.wort, regel: 'kompositum-fuge', loesungWort: k.wort,
        merke: `${k.bestimmungswort} + ${k.fuge || ''}${k.fuge ? ' + ' : ''}${k.grundwort} = ${k.wort}. ${ws.regelText('kompositum-fuge')}` };
    }
    if (format === 'auswahl') {
      return { format, frage: `${k.bestimmungswort} + ${k.grundwort} = ?`, optionen: mische([k.wort, `${k.bestimmungswort} ${k.grundwort}`, k.wort.toLowerCase(), k.bestimmungswort + k.grundwort], rng),
        richtig: k.wort, wort: 'k:' + k.wort, regel: 'kompositum-bauen', merke: `${ws.regelText('kompositum-bauen')} Das zweite Wort schreibt man dann klein: ${k.wort}.` };
    }
    const falle = zufall(ws.nomen.filter((n) => n.wort !== k.bestimmungswort && n.wort !== k.grundwort && n.schwierigkeit === 1), rng).wort;
    return { format: 'baukasten', modus: 'reihe', frage: 'Baue das Kompositum: zuerst das Bestimmungswort, dann das Grundwort.', teile: mische([k.bestimmungswort, k.grundwort.toLowerCase(), falle.toLowerCase()], rng),
      loesung: [k.bestimmungswort, k.grundwort.toLowerCase()], wort: 'k:' + k.wort, regel: 'kompositum-bauen', loesungWort: k.wort,
      merke: `${k.bestimmungswort} + ${k.grundwort} = ${k.wort}: Das Grundwort steht hinten und bestimmt, was es ist.` };
  },

  satzglieder(stufe, format, ctx) {
    const { ws, rng } = ctx;
    const glied = (g) => g.woerter.map((w) => w.wort).join(' ');
    if (stufe <= 2) {
      const rolle = stufe === 1 ? 'subjekt' : 'praedikat';
      const s = waehle(ws.saetze, (x) => 's:' + satzText(x), ctx);
      return { format: 'ordnen', modus: 'antippen', frage: stufe === 1 ? 'Tippe auf das Subjekt. Frage: Wer oder was tut etwas?' : 'Tippe auf das Prädikat – das Verb im Satz.',
        karten: s.glieder.map(glied), richtig: s.glieder.findIndex((g) => g.rolle === rolle), wort: 's:' + satzText(s), regel: stufe === 1 ? 'satz-subjekt' : 'satz-praedikat',
        merke: stufe === 1 ? `Wer oder was ${glied(s.glieder.find((g) => g.rolle === 'praedikat'))}? – ${glied(s.glieder.find((g) => g.rolle === 'subjekt'))}.` : ws.regelText('satz-praedikat') };
    }
    const drei = ws.saetze.filter((s) => s.glieder.length === 3 && s.glieder[1].rolle === 'praedikat');
    const s = waehle(drei, (x) => 's:' + satzText(x), ctx);
    const [a, p, b] = s.glieder.map(glied);
    const klein = (t) => (s.glieder[0].woerter[0].wortart === 'nomen' ? t : t.charAt(0).toLowerCase() + t.slice(1));
    const neuAnfang = gross(b);
    const richtig = `${neuAnfang} ${p} ${klein(a)}.`;
    if (format === 'auswahl') {
      return { format, frage: `Umstellprobe: Welcher Satz ist richtig umgestellt? (${satzText(s)})`, optionen: mische([richtig, `${neuAnfang} ${klein(a)} ${p}.`, `${gross(klein(a))} ${b.charAt(0).toLowerCase() + b.slice(1)} ${p}.`], rng),
        richtig, wort: 's:' + satzText(s), regel: 'satz-umstellen', merke: `${ws.regelText('satz-umstellen')} Richtig: ${richtig}` };
    }
    return { format: 'ordnen', modus: 'reihenfolge', frage: `Stelle den Satz um. Beginne mit „${neuAnfang}“.`, karten: [neuAnfang, p, klein(a)], fest: 1, loesung: [neuAnfang, p, klein(a)],
      wort: 's:' + satzText(s), regel: 'satz-umstellen', merke: `${ws.regelText('satz-umstellen')} Richtig: ${richtig}` };
  },

  wortfelder(stufe, format, ctx) {
    const { ws, rng } = ctx;
    if (stufe === 1) {
      // Nur Kernwörter und nur Paare, bei denen das fremde Wort sicher nicht passt (Blitz und Mond könnten zaubern, Äpfel sind Natur)
      const [fa, fb] = zufall(FELD_PAARE, rng);
      const aus = (f) => ws.nomen.filter((n) => n.wortfeld === f && FELD_KERN[f].includes(n.wort));
      const drei = nimm(aus(fa), 3, rng);
      const fremd = zufall(aus(fb), rng);
      return { format: 'passtnicht', frage: `Welches Wort passt nicht zum Wortfeld „${ws.wortfelder[fa].name}“?`, woerter: mische([...drei.map((n) => n.wort), fremd.wort], rng),
        richtig: fremd.wort, wort: 'n:' + fremd.wort, regel: 'wortfeld', merke: `${drei.map((n) => n.wort).join(', ')} gehören zu „${ws.wortfelder[fa].name}“ – ${fremd.wort} nicht.` };
    }
    const f = waehle(ws.wortfamilien, (x) => 'f:' + x.wort, ctx);
    const drei = nimm(f.woerter, 3, rng);
    const fremd = stufe === 3 ? f.falle : zufall(zufall(ws.wortfamilien.filter((x) => x !== f), rng).woerter, rng);
    return { format: 'passtnicht', frage: `Welches Wort gehört nicht zur Wortfamilie von „${f.wort}“?`, woerter: mische([...drei, fremd], rng), richtig: fremd, wort: 'f:' + f.wort,
      regel: 'wortfamilie', merke: `${f.woerter.join(', ')} haben denselben Wortstamm. „${fremd}“ sieht vielleicht ähnlich aus, gehört aber nicht dazu.` };
  },
};

// ---------- gemeinsame Bausteine ----------

function artikelSortieren(quelle, ctx, regel, merkeFn) {
  const { rng } = ctx;
  const proArt = ['der', 'die', 'das'].map((a) => nimmFrisch(quelle.filter((n) => n.artikel === a), ctx, 2)).flat();
  return { format: 'sortieren', frage: 'Sortiere: der, die oder das?', kisten: ['der', 'die', 'das'].map((a) => ({ id: a, name: a, genus: a })),
    karten: mische(proArt.map((n) => ({ text: n.wort, kiste: n.artikel })), rng), wort: 'n:' + proArt[0].wort, regel, merke: merkeFn(proArt[0]) };
}

// Buchstaben-Lücken: Teile, die sich vom Ausgangswort unterscheiden (Umlaut, Endung), sonst zwei zufällige.
function luecken(ziel, ausgang, rng) {
  const idx = [];
  for (let i = 0; i < ziel.length; i++) if (ziel[i] !== ausgang[i]) idx.push(i);
  let l = idx.length && idx.length <= 4 ? idx : [...ziel].map((_, i) => i).filter((i) => i > 0 && i >= ziel.length - 3);
  if (!l.length) l = [ziel.length - 1];
  return { ziel, luecken: l, tasten: tasten(l.map((i) => ziel[i]), rng) };
}

// Bildschirmtastatur: nur die nötigen Buchstaben plus ein paar typische Verwechsler.
function tasten(noetig, rng) {
  const verwechsler = { d: 't', t: 'd', b: 'p', p: 'b', g: 'k', k: 'g', ä: 'e', e: 'ä', ö: 'o', o: 'ö', ü: 'u', u: 'ü', i: 'e', s: 'ß', ß: 's', z: 'c', c: 'z', h: 'r', n: 'm', m: 'n', r: 'n', l: 'r' };
  const set = new Set(noetig.map((c) => c.toLowerCase()));
  for (const c of [...set]) if (verwechsler[c]) set.add(verwechsler[c]);
  const fuell = 'aeinrstläöü';
  while (set.size < Math.max(6, noetig.length + 3)) set.add(fuell[Math.floor(rng() * fuell.length)]);
  return mische([...set], rng);
}

// Rechtschreib-Themen: Wörter mit dem Phänomen; Stufe 1 Auswahl/Sortieren, Stufe 2 Buchstaben/Fehler, Stufe 3 Eintippen/Fehler.
function rechtschreibung(phs, regel, stufe, format, ctx) {
  const { ws, rng } = ctx;
  const formen = bereit(ws);
  const quelle = ws.nomen.filter((n) => phs.some((p) => n.phaenomene.includes(p)) && (stufe === 1 ? n.schwierigkeit === 1 : true) && n.wort.length >= 4)
    .map((n) => ({ n, ph: phs.find((p) => n.phaenomene.includes(p)) })).filter(({ n, ph }) => sichererSchreibfehler(n.wort, ph, formen));
  if (format === 'sortieren' && phs[0] === 'auslaut-d') return verlaengerungSortieren(ctx, formen);
  const { n, ph } = waehle(quelle, (x) => 'n:' + x.n.wort, ctx);
  const falsch = sichererSchreibfehler(n.wort, ph, formen);
  const merke = merkhilfe(ph, n) || ws.regelText(regel);
  const basis = { wort: 'n:' + n.wort, regel, merke };
  if (format === 'buchstaben') {
    const teil = { 'auslaut-d': /d$/, 'auslaut-b': /b$/, 'auslaut-g': /g$/, doppelkonsonant: /(bb|dd|ff|gg|ll|mm|nn|pp|rr|ss|tt)/, ie: /ie/, tz: /tz/, ck: /ck/, 'ä-ableitung': /ä/i, 'äu-ableitung': /äu/i }[ph];
    const m = n.wort.match(teil);
    const l = [...m[0]].map((_, i) => m.index + i);
    return { ...basis, format, frage: 'Ergänze die fehlenden Buchstaben.', ziel: n.wort, luecken: l, tasten: tasten(l.map((i) => n.wort[i]), rng), vorsatz: n.artikel };
  }
  if (format === 'eintippen') return { ...basis, format, frage: `Verbessere das Wort: „${falsch}“`, loesung: n.wort };
  if (format === 'fehler') return { ...basis, ...fehlerSatz(n, falsch, rng), format, modus: 'verbessern', frage: 'Ein Wort ist falsch geschrieben. Tippe es an und verbessere es.' };
  const dritte = ph.startsWith('auslaut') ? n.wort + falsch.at(-1) : ph === 'ie' ? schreibfehler(n.wort, 'ie')?.replace(/i/, 'ih') : ph === 'tz' ? n.wort.replace('tz', 'zz') : ph === 'ck' ? n.wort.replace('ck', 'kk') : null;
  const opt = [n.wort, falsch, dritte && !formen.has(dritte) && dritte !== falsch ? dritte : null].filter(Boolean);
  return { ...basis, format: 'auswahl', frage: 'Welches Wort ist richtig geschrieben?', optionen: mische(opt, rng), richtig: n.wort };
}

function verlaengerungSortieren(ctx, formen) {
  const { ws, rng } = ctx;
  const mit = (re, ph) => ws.nomen.filter((n) => re.test(n.wort) && n.wort.length >= 4 && !/dt$/.test(n.wort) && sichererSchreibfehler(n.wort, ph, formen));
  const d = nimmFrisch(mit(/d$/, 'auslaut-d'), ctx, 3);
  const t = nimm(ws.nomen.filter((n) => /[aeiouäöülrn]t$/.test(n.wort) && n.wort.length >= 4 && !formen.has(n.wort.replace(/t$/, 'd'))), 3, rng);
  return { format: 'sortieren', frage: 'd oder t? Verlängere das Wort im Kopf.', kisten: [{ id: 'd', name: 'd' }, { id: 't', name: 't' }],
    karten: mische([...d.map((n) => ({ text: n.wort.slice(0, -1) + '_', kiste: 'd', loesung: n.wort })), ...t.map((n) => ({ text: n.wort.slice(0, -1) + '_', kiste: 't', loesung: n.wort }))], rng),
    wort: 'n:' + d[0].wort, regel: 'verlaengern', merke: `Verlängere: ${d[0].wort} – ${d[0].plural}, ${t[0].wort} – ${t[0].plural}.` };
}

// Ein Satz des Worts mit genau diesem einen falsch geschriebenen Wort (auch für die Ork-Rüstung).
export function fehlerSatz(n, falsch, rng) {
  const satz = zufall(n.saetze.filter((s) => zaehle(s, n.wort) === 1), rng);
  const w = woerter(satz);
  const ende = w.at(-1).match(/[.!?]$/)?.[0] || '';
  if (ende) w[w.length - 1] = w.at(-1).slice(0, -1);
  const i = w.findIndex((t) => kern(t) === n.wort);
  w[i] = w[i].replace(n.wort, falsch);
  return { woerter: w, ziele: [i], korrektur: { [i]: n.wort }, optionen: mische([n.wort, falsch], rng), satzEnde: ende };
}

// ---------- Öffentlich ----------

export const THEMA_IDS = Object.keys(THEMEN);

// Wortschatz um Regel-Hilfen ergänzen (themen.json).
export function mitRegeln(ws, themen) {
  const alle = themen.themen.flatMap((t) => t.regeln.map((r) => ({ ...r, thema: t.id })));
  return {
    ...ws,
    regelText: (id) => alle.find((r) => r.id === id)?.text || '',
    themaRegeln: (thema) => alle.filter((r) => r.thema === thema),
    alleRegeln: alle,
  };
}

// Einen Inhalt erzeugen. format: gewünschtes Format (sonst zufällig aus den erlaubten der Stufe).
export function erzeugeInhalt(themen, thema, stufe, ctx, format = null) {
  const t = themen.themen.find((x) => x.id === thema);
  const alleF = t.stufen[stufe - 1].formate;
  const ohne = alleF.filter((f) => f !== ctx.nichtFormat && f !== ctx.ohneFormat);
  const erlaubt = ohne.length ? ohne : alleF;
  const f = format && erlaubt.includes(format) ? format : zufall(erlaubt, ctx.rng);
  const inhalt = THEMEN[thema](stufe, f, ctx);
  return { ...inhalt, thema, stufe };
}

// ---------- Besondere Aufgaben für Begegnungen und die Ork-Rüstung ----------

// Rechtschreib-Phänomen → Thema und Regel (für Speisekarte und Lernstand)
const PHAENOMEN_THEMA = {
  'auslaut-d': ['verlaengerung', 'verlaengern'], 'auslaut-b': ['verlaengerung', 'verlaengern'], 'auslaut-g': ['verlaengerung', 'verlaengern'],
  doppelkonsonant: ['doppel', 'doppel-kurz'], 'ß': ['doppel', 'doppel-kurz'], ie: ['ie', 'ie-lang'], 'dehnungs-h': ['ie', 'ie-lang'],
  ck: ['tzck', 'tzck-kurz'], tz: ['tzck', 'tzck-kurz'], 'ä-ableitung': ['ableitung', 'ableiten'], 'äu-ableitung': ['ableitung', 'ableiten'],
};

// Auf der Speisekarte stehen nur Gerichte – keine Leute, kein Geschirr
const KEIN_GERICHT = new Set(['Glas', 'Schüssel', 'Pfanne', 'Koch', 'Köchin', 'Bäcker', 'Bäckerei', 'Teig', 'Zeit', 'Fass', 'Wirt', 'Wirtin', 'Speise', 'Gans', 'Huhn', 'Hahn']);

// Wirtin: Speisekarte mit 2–3 falsch geschriebenen Gerichten (alle antippen, dann „Fertig“).
export function speisekarteInhalt(ctx) {
  const { ws, rng } = ctx;
  const formen = bereit(ws);
  const essen = ws.nomen.filter((n) => n.wortfeld === 'essen' && !n.grundwort && n.wort.length >= 4 && !KEIN_GERICHT.has(n.wort));
  const fehlerVon = (n) => n.phaenomene.find((p) => PHAENOMEN_THEMA[p] && sichererSchreibfehler(n.wort, p, formen));
  const mitFehler = mische(essen.filter(fehlerVon), rng).slice(0, 2 + Math.floor(rng() * 2)).map((n) => ({ n, p: fehlerVon(n) }));
  const rest = mische(essen.filter((n) => !mitFehler.some((m) => m.n === n)), rng).slice(0, 6 - mitFehler.length);
  const gerichte = mische([...mitFehler.map(({ n, p }) => ({ n, falsch: sichererSchreibfehler(n.wort, p, formen) })), ...rest.map((n) => ({ n }))], rng);
  const [thema, regel] = PHAENOMEN_THEMA[mitFehler[0].p];
  const hilfen = [...new Set(mitFehler.map(({ n, p }) => merkhilfe(p, n)).filter(Boolean))];
  return {
    format: 'fehler', modus: 'markieren', frage: `Auf der Speisekarte sind ${mitFehler.length} Wörter falsch geschrieben. Tippe sie an.`,
    woerter: gerichte.map((g) => g.falsch || g.n.wort), ziele: gerichte.map((g, i) => (g.falsch ? i : -1)).filter((i) => i >= 0),
    wort: 'n:' + mitFehler[0].n.wort, regel, thema, stufe: 2, speisekarte: true,
    merke: 'Richtig: ' + mitFehler.map(({ n }) => n.wort).join(', ') + '. ' + hilfen.join(' '),
  };
}

// Pferdehirtin: Satzglieder in die richtige Reihenfolge bringen (3 Satzglieder: das großgeschriebene zuerst, das Verb an Stelle 2).
export function satzOrdnenInhalt(ctx) {
  const { ws } = ctx;
  const drei = ws.saetze.filter((s) => s.glieder.length === 3 && s.glieder[1].rolle === 'praedikat');
  const s = waehle(drei, (x) => 's:' + satzText(x), ctx);
  const karten = s.glieder.map((g) => g.woerter.map((w) => w.wort).join(' '));
  return { format: 'ordnen', modus: 'reihenfolge', frage: 'Bringe die Satzglieder in die richtige Reihenfolge.', karten, fest: 0, loesung: karten,
    wort: 's:' + satzText(s), regel: 'satz-praedikat', thema: 'satzglieder', stufe: 2, merke: `${ws.regelText('satz-praedikat')} Richtig: ${satzText(s)}` };
}

// Kobold: Name des Geschenks mit fehlenden Buchstaben (dort, wo der Kobold den Fehler versteckt hat).
// Kobold: Der verdrehte Name steht da, das Kind tippt den ganzen Namen richtig ein. Hat der Eintrag eine Fassung
// mit zwei versteckten Fehlern (zwei), kommt meist diese.
export function koboldInhalt(eintrag, ctx) {
  const zwei = eintrag.zwei && ctx.rng() < 0.7;
  const falsch = zwei ? eintrag.zwei : eintrag.teile.join('');
  return { format: 'eintippen', frage: `Der Kobold hat „${falsch}“ geschrieben. ${zwei ? 'Darin stecken zwei Fehler. ' : 'Darin steckt ein Fehler. '}Schreib den Namen richtig.`,
    loesung: eintrag.richtig, falsch, wort: 'k:' + eintrag.richtig, regel: 'doppel-kurz', thema: 'doppel', stufe: 3,
    merke: `${zwei ? eintrag.erklaerung2 : eintrag.erklaerung} Richtig: ${eintrag.richtig}.` };
}

// Ork-Rüstung: kurzer Satz mit einem Rechtschreibfehler (antippen und verbessern), passend zum Thema.
export function orkInhalt(thema, stufe, ctx) {
  return { ...THEMEN[thema](stufe, 'fehler', ctx), thema, stufe };
}
