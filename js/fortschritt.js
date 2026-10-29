// Dauerhafter Fortschritt zwischen den Läufen (ohne Darstellung, testbar):
// Buch der Wörter, Erfahrung und Rang, Freischaltungen, Erfolge, Statistik.
// Maßgeblich ist der Heldencode (js/code.js); der Browser merkt sich den Stand nur als Komfort.

export function neuesProfil() {
  return {
    v: 1,
    xp: 0,
    buch: [],       // entdeckte Einträge im Buch der Wörter (ids)
    erfolge: [],    // erreichte Erfolge (ids)
    figuren: [],    // freigeschaltete Figuren (zusätzlich zu den Start-Figuren)
    designs: [],    // freigeschaltete Rucksack-Designs (zusätzlich zu Leder)
    design: 'leder',
    stats: {},      // Zähler für Erfolge, z. B. { laeufe: 3, orkFehler: 5 }
    figurSiege: [], // Figuren, mit denen schon ein Lauf gewonnen wurde
    tutorial: false,
    lernstand: {},  // pro Thema { stufe 1–3, sicher } (Aufgaben, js/aufgaben/wahl.js)
    regeln: [],     // gesammelte Regelkarten (ids aus themen.json)
    klasse: null,   // Einstellungen der Lehrkraft aus dem Klassen-Code: { themen: { id: max 0–3 } }
  };
}

// Neue Einträge ins Buch schreiben. Gibt die wirklich neuen ids zurück.
export function entdecke(profil, ids) {
  const set = new Set(profil.buch);
  const neu = ids.filter((id) => !set.has(id));
  profil.buch.push(...neu);
  return neu;
}

// ---------- Während eines Laufs ----------

// Grammatik-Regeln für den Lernbericht.
export const REGELN = {
  artikel: 'Artikel (der, die, das)',
  mehrzahl: 'Mehrzahl',
  personalform: 'Personalform (er schlägt, sie schlagen)',
  praeteritum: 'Präteritum (gestern schlug er)',
  steigerung: 'Steigerung (schärfer, am schärfsten)',
  rechtschreibung: 'Rechtschreibung',
  lesen: 'Leseverständnis (Briefe)',
};

export function laufStand(run) {
  run.prog ||= {};
  const p = run.prog;
  p.neu ||= [];
  p.regeln ||= {};
  for (const k of ['erster', 'fehler', 'orkFehler', 'saetze', 'komposita', 'sterne4']) p[k] ||= 0;
  return p;
}

// Eine Antwort auf eine Grammatik-Frage merken: richtig/falsch je Regel, richtig beim ersten Versuch zählt Erfahrung.
export function merkeAntwort(run, regel, richtig, ersterVersuch) {
  const p = laufStand(run);
  const r = (p.regeln[regel] ||= [0, 0]);
  if (richtig) {
    r[0]++;
    if (ersterVersuch) p.erster++;
  } else {
    r[1]++;
    p.fehler++;
  }
}

// ---------- Erfahrung und Rang ----------

// Rang mit Unterstufe: Jeder Rang hat drei Stufen (Lehrling I, II, III). nr: Rang-Nummer (1–5), unterNr: fortlaufend.
const ROEMISCH = ['I', 'II', 'III'];
export function rangVon(xp, raenge) {
  let i = 0;
  for (let k = 0; k < raenge.length; k++) if (xp >= raenge[k].ab) i = k;
  const r = raenge[i], weiter = raenge[i + 1];
  const spanne = (weiter ? weiter.ab : r.ab + 1500) - r.ab;
  const stufe = Math.min(3, Math.floor(((xp - r.ab) * 3) / spanne) + 1);
  const naechster = stufe < 3 ? { name: `${r.name} ${ROEMISCH[stufe]}`, ab: Math.round(r.ab + (spanne * stufe) / 3) }
    : weiter ? { name: `${weiter.name} I`, ab: weiter.ab } : null;
  return { nr: i + 1, ...r, grundName: r.name, name: `${r.name} ${ROEMISCH[stufe - 1]}`, stufe, unterNr: i * 3 + stufe,
    stufeAb: Math.round(r.ab + (spanne * (stufe - 1)) / 3),
    naechster, bisNaechster: naechster ? naechster.ab - xp : 0 };
}

export function erfahrungFuer(run, regeln) {
  const p = laufStand(run);
  const teile = {
    siege: run.wins * regeln.sieg,
    entdeckungen: p.neu.length * regeln.entdeckung,
    ersterVersuch: p.erster * regeln.ersterVersuch,
  };
  return { ...teile, gesamt: teile.siege + teile.entdeckungen + teile.ersterVersuch };
}

const plus = (stats, key, n) => { if (n) stats[key] = (stats[key] || 0) + n; };

// Am Ende eines Laufs: Erfahrung und Statistik ins Profil übernehmen.
// data: { achievements } (achievements.json). Ergebnis für die Abschluss-Anzeige.
export function laufAbschluss(profil, run, data) {
  const ach = data.achievements;
  const p = laufStand(run);
  const vorher = rangVon(profil.xp, ach.raenge);
  const xp = erfahrungFuer(run, ach.erfahrung);
  profil.xp += xp.gesamt;
  const gewonnen = run.over === 'won';
  const s = profil.stats;
  plus(s, 'laeufe', 1);
  plus(s, 'siege', run.wins);
  plus(s, 'gewonnen', gewonnen ? 1 : 0);
  plus(s, 'ohneFehler', gewonnen && !p.fehler ? 1 : 0);
  plus(s, 'orkFehler', p.orkFehler);
  plus(s, 'saetze', p.saetze);
  plus(s, 'komposita', p.komposita);
  plus(s, 'sterne4', p.sterne4);
  plus(s, 'richtig', p.erster);
  if (gewonnen && run.hero && !profil.figurSiege.includes(run.hero)) profil.figurSiege.push(run.hero);
  // Wie oft mit jeder Figur geschafft (nur auf dem Gerät, für das Pokal-Abzeichen auf der Figurenkarte)
  if (gewonnen && run.hero) { profil.figurSiegeZahl ||= {}; profil.figurSiegeZahl[run.hero] = (profil.figurSiegeZahl[run.hero] || 0) + 1; }
  const nachher = rangVon(profil.xp, ach.raenge);
  return { xp, vorher, nachher, aufgestiegen: nachher.unterNr > vorher.unterNr, gewonnen, neu: [...p.neu] };
}

// ---------- Freischaltungen ----------
// Bedingung (aus heroes.json, items.json, achievements.json): { rang } | { gewonnen } | { buch } | { seite } | { erfolg }.
// ctx: { achievements, buch (Buch der Wörter) }

export function erfuellt(bed, profil, ctx) {
  if (!bed) return true;
  if (bed.xp) return profil.xp >= bed.xp;
  if (bed.rang) return rangVon(profil.xp, ctx.achievements.raenge).nr >= bed.rang;
  if (bed.gewonnen) return (profil.stats.gewonnen || 0) >= bed.gewonnen;
  if (bed.buch) return profil.buch.length >= bed.buch;
  if (bed.seite) {
    const s = ctx.buch.seiten.find((x) => x.id === bed.seite);
    const da = new Set(profil.buch);
    return !!s && s.eintraege.every((e) => da.has(e.id));
  }
  if (bed.erfolg) return profil.erfolge.includes(bed.erfolg);
  return false;
}

// Kindgerechter Hinweis, wie man etwas bekommt.
export function bedingungText(bed, ctx) {
  if (bed.xp) return `Wird frei bei ${bed.xp} Erfahrung (Rang „${rangVon(bed.xp, ctx.achievements.raenge).name}“).`;
  if (bed.rang) return `Erreiche den Rang „${ctx.achievements.raenge[bed.rang - 1].name}“.`;
  if (bed.gewonnen) return `Gewinne ${bed.gewonnen} ${bed.gewonnen === 1 ? 'Lauf' : 'Läufe'} (alle zehn Tage geschafft).`;
  if (bed.buch) return `Entdecke ${bed.buch} Einträge im Buch der Wörter.`;
  if (bed.seite) return `Fülle die Seite „${ctx.buch.seiten.find((s) => s.id === bed.seite)?.titel}“ im Buch der Wörter.`;
  if (bed.erfolg) return `Schaffe den Erfolg „${ctx.achievements.erfolge?.find((e) => e.id === bed.erfolg)?.name || bed.erfolg}“.`;
  return '';
}

// Neu erfüllte Freischaltungen ins Profil übernehmen (Figuren und Designs bleiben für immer frei).
// data: { heroes, achievements, buch, begleiter, items }. Ergebnis: { figuren, designs, begleiter, items } – nur die neuen.
// Begleiter und Items ergeben sich direkt aus der Erfahrung: neu sind die, deren Schwelle seit xpVorher erreicht wurde.
export function pruefeFreischaltungen(profil, data, xpVorher = null) {
  const neu = { figuren: [], designs: [], begleiter: [], items: [] };
  const geradeErreicht = (bed) => xpVorher != null && bed?.xp > xpVorher && bed.xp <= profil.xp;
  for (const b of data.begleiter || []) if (geradeErreicht(b.freischaltung)) neu.begleiter.push(b.id);
  for (const d of data.items || []) if (geradeErreicht(d.freischaltung)) neu.items.push(d.id);
  for (const h of data.heroes) {
    if (!h.freischaltung || profil.figuren.includes(h.id)) continue;
    if (erfuellt(h.freischaltung, profil, data)) { profil.figuren.push(h.id); neu.figuren.push(h.id); }
  }
  for (const d of data.achievements.designs || []) {
    if (!d.freischaltung || profil.designs.includes(d.id)) continue;
    if (erfuellt(d.freischaltung, profil, data)) { profil.designs.push(d.id); neu.designs.push(d.id); }
  }
  return neu;
}

export const figurFrei = (profil, h) => !h.freischaltung || profil.figuren.includes(h.id);
export const designFrei = (profil, d) => !d.freischaltung || profil.designs.includes(d.id);

// Items mit Freischaltung, die im Laden schon erscheinen dürfen.
export const freieItems = (profil, items, ctx) => items.filter((d) => d.freischaltung && erfuellt(d.freischaltung, profil, ctx)).map((d) => d.id);

// ---------- Erfolge (achievements.json) ----------

export function erfolgErfuellt(b, profil, ctx) {
  if (b.stat) return (profil.stats[b.stat] || 0) >= b.min;
  if (b.muster) {
    const passend = ctx.buch.eintraege.filter((e) => e.id.includes(b.muster)).map((e) => e.id);
    const da = new Set(profil.buch);
    const n = passend.filter((id) => da.has(id)).length;
    return b.alle ? n === passend.length && n > 0 : n >= b.min;
  }
  if (b.figurSiege) return (ctx.heroes || []).every((h) => profil.figurSiege.includes(h.id));
  return erfuellt(b, profil, ctx); // rang, buch, seite, gewonnen
}

// Neu erreichte Erfolge ins Profil schreiben. Gibt die neuen ids zurück.
export function pruefeErfolge(profil, ctx) {
  const neu = [];
  for (const e of ctx.achievements.erfolge || []) {
    if (profil.erfolge.includes(e.id) || !erfolgErfuellt(e.bedingung, profil, ctx)) continue;
    profil.erfolge.push(e.id);
    neu.push(e.id);
  }
  return neu;
}

// ---------- Lernbericht (nur für das Kind: keine Noten, keine Prozentzahlen) ----------

export const TIPPS = {
  artikel: 'Bei zusammengesetzten Wörtern bestimmt das letzte Wort den Artikel: Feuer + das Schwert = das Feuerschwert.',
  mehrzahl: 'Viele Nomen bekommen in der Mehrzahl einen Umlaut oder eine Endung: die Axt → die Äxte, das Schwert → die Schwerter.',
  personalform: 'Bei einem (er, sie, es) endet das Verb meist auf -t: die Axt schlägt. Bei mehreren bleibt die Grundform: die Äxte schlagen.',
  praeteritum: 'Viele Verben ändern im Präteritum ihren Vokal: schlagen → schlug, stechen → stach.',
  steigerung: 'Steigern geht so: scharf → schärfer → am schärfsten. Oft kommt ein Umlaut dazu.',
  rechtschreibung: 'Sprich das Wort langsam in Silben und achte auf doppelte Buchstaben: Ham-mer, Schup-pe.',
  lesen: 'Lies die Frage genau und such die Stelle im Brief, an der die Antwort steht. Unbekannte Wörter verstehst du oft aus den Sätzen drumherum.',
};

// Welche Regeln saßen, welche üben wir noch? (aus den Antworten des Laufs)
export function lernbericht(run) {
  const p = laufStand(run);
  const sitzt = [], ueben = [];
  for (const regel of Object.keys(REGELN)) {
    const [richtig, falsch] = p.regeln[regel] || [0, 0];
    if (falsch) ueben.push({ regel, name: REGELN[regel], tipp: TIPPS[regel] });
    else if (richtig) sitzt.push({ regel, name: REGELN[regel] });
  }
  return { sitzt, ueben };
}
