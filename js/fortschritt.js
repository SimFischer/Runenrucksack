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
