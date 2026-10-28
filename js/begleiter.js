// Begleiter-Tiere (begleiter.json), ohne Darstellung und testbar: Gegenstands-Definitionen, Freischaltung über den
// Rang, Nachbarn im Rucksack und die Wirkung auf benachbarte Gegenstände. Lauf-Wirkungen (kostenlos würfeln, Gold
// je Sieg) setzt newRun in logic.js, die Kampf-Wirkung (erster Angriff doppelt) playerContext in mods.js.

export const BEGLEITER_PREFIX = 'begleiter-';
export const istBegleiter = (d) => d?.art === 'begleiter';

// Ein Begleiter als Gegenstand: 1×1, kein Ladenartikel, Bild aus assets/ui/begleiter/
export function begleiterDefs(liste) {
  return liste.map((b) => ({
    id: BEGLEITER_PREFIX + b.id, begleiter: b.id, art: 'begleiter', name: b.name, artikel: b.artikel,
    w: 1, h: 1, seltenheit: 'selten', preis: 0, laden: false, bild: `ui/begleiter/${b.id}.webp`, wirkung: b.wirkung, text: b.text,
  }));
}

// Freigeschaltet? Nur über den Rang (Erfahrung im Heldencode). raengeNr: Rang-Nummer aus rangVon().
export const begleiterFrei = (b, rangNr) => !b.freischaltung?.rang || rangNr >= b.freischaltung.rang;

// Wirkung des gewählten Begleiters – mit imRucksack nur, wenn er im Rucksack liegt (Kampf-Wirkungen).
export function begleiterWirkung(run, liste, imRucksack = false) {
  const b = liste?.find((x) => x.id === run?.begleiter);
  if (!b) return {};
  if (imRucksack && !run.items?.some((p) => p.area === 'bag' && p.id === BEGLEITER_PREFIX + b.id)) return {};
  return b.wirkung || {};
}

// Felder eines Gegenstands (mit Drehung)
function felder(p, d) {
  const w = p.rot ? d.h : d.w, h = p.rot ? d.w : d.h;
  const out = [];
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) out.push([p.x + dx, p.y + dy]);
  return out;
}
// Gegenstände, die an einer Seite an p grenzen (nicht über Eck)
export function nachbarn(p, placed, defs) {
  const mein = felder(p, defs[p.id]);
  return placed.filter((q) => q.uid !== p.uid && felder(q, defs[q.id])
    .some(([x, y]) => mein.some(([a, b]) => Math.abs(a - x) + Math.abs(b - y) === 1)));
}

// Wirkung auf die Nachbarn im Rucksack (für evaluateBag). info: Map uid → { def, base, boni }.
// applyMod und isNoun kommen von außen, damit es keine Kreis-Importe gibt.
export function begleiterAufNachbarn(info, placed, defs, { applyMod, isNoun }) {
  for (const p of placed) {
    const d = defs[p.id];
    if (!istBegleiter(d)) continue;
    const w = d.wirkung || {};
    const nb = nachbarn(p, placed, defs).filter((q) => !istBegleiter(defs[q.id]));
    for (const q of nb) {
      const i = info.get(q.uid);
      if (w.nachbarNomenProzent && isNoun(i.base)) {
        i.def = applyMod(i.def, { prozent: w.nachbarNomenProzent });
        i.boni.push(`${d.name}: +${w.nachbarNomenProzent} %`);
      }
      if (w.nachbarTempo && i.def.abklingzeit > 0) {
        i.def = applyMod(i.def, { abklingzeit: -w.nachbarTempo });
        i.boni.push(`${d.name}: ${w.nachbarTempo} % schneller`);
      }
    }
    if (w.startblock && nb.length) {
      const i = info.get(p.uid);
      i.def = { ...i.def, startblock: (i.def.startblock || 0) + w.startblock };
      i.boni.push(`${d.name}: +${w.startblock} Startblock`);
    }
  }
}
