// Gegenstandspakete (gegenstandspakete.json), ohne Darstellung: Startpaket, kleine Pakete mit Erfahrungsschwelle,
// größere Startbestände für höhere Pfade. Jedes Paket-Item bekommt beim Laden { freischaltung: { xp, paket } } –
// so gelten dieselben Regeln wie für alle Freischaltungen (Laden, Sammlung, Feier, Heldencode über die Erfahrung).

export function paketeAnwenden(items, daten) {
  if (!daten) return;
  const byId = new Map(items.map((d) => [d.id, d]));
  for (const p of daten.pakete) {
    for (const id of p.items) {
      const d = byId.get(id);
      if (d && !d.freischaltung) d.freischaltung = { xp: p.xp, paket: p.id };
    }
  }
}

export const paketVon = (daten, id) => daten?.pakete.find((p) => p.items.includes(id)) || null;

// Zusätzliche Items eines Pfads (höhere Pfade starten mit einem größeren Paket)
export function pfadItems(daten, pfad) {
  const ids = daten?.pfade?.[pfad]?.pakete || [];
  return daten ? daten.pakete.filter((p) => ids.includes(p.id)).flatMap((p) => p.items) : [];
}

// Darf ein Gegenstand (auch ein Kompositum) im Lauf vorkommen? frei: freigeschaltete Items (run.freieItems)
export function imBestand(d, frei, defs) {
  if (!d) return false;
  if (d.teile) return imBestand(defs[d.teile.kraft], frei, defs) && imBestand(defs[d.teile.traeger], frei, defs);
  return !d.freischaltung || frei.includes(d.id);
}
