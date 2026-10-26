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

export function rangVon(xp, raenge) {
  let i = 0;
  for (let k = 0; k < raenge.length; k++) if (xp >= raenge[k].ab) i = k;
  const naechster = raenge[i + 1] || null;
  return { nr: i + 1, ...raenge[i], naechster, bisNaechster: naechster ? naechster.ab - xp : 0 };
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
  const nachher = rangVon(profil.xp, ach.raenge);
  return { xp, vorher, nachher, aufgestiegen: nachher.nr > vorher.nr, gewonnen, neu: [...p.neu] };
}

// ---------- Freischaltungen ----------
// Bedingung (aus heroes.json, items.json, achievements.json): { rang } | { gewonnen } | { buch } | { seite } | { erfolg }.
// ctx: { achievements, buch (Buch der Wörter) }

export function erfuellt(bed, profil, ctx) {
  if (!bed) return true;
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
  if (bed.rang) return `Erreiche den Rang „${ctx.achievements.raenge[bed.rang - 1].name}“.`;
  if (bed.gewonnen) return `Gewinne ${bed.gewonnen} ${bed.gewonnen === 1 ? 'Lauf' : 'Läufe'} (alle zehn Tage geschafft).`;
  if (bed.buch) return `Entdecke ${bed.buch} Einträge im Buch der Wörter.`;
  if (bed.seite) return `Fülle die Seite „${ctx.buch.seiten.find((s) => s.id === bed.seite)?.titel}“ im Buch der Wörter.`;
  if (bed.erfolg) return `Schaffe den Erfolg „${ctx.achievements.erfolge?.find((e) => e.id === bed.erfolg)?.name || bed.erfolg}“.`;
  return '';
}

// Neu erfüllte Freischaltungen ins Profil übernehmen (Figuren und Designs bleiben für immer frei).
// data: { heroes, achievements, buch }. Ergebnis: { figuren: [...], designs: [...] } – nur die neuen.
export function pruefeFreischaltungen(profil, data) {
  const neu = { figuren: [], designs: [] };
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
