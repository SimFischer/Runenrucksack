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
