// Sockel (ohne Darstellung): Artikel-Siegel und Adjektiv-Runen belegen kein Feld, sondern werden in ein Nomen
// (Träger, Kristall, Kompositum) eingesetzt. Jedes Nomen hat einen Artikel-Sockel und einen Adjektiv-Sockel,
// ab ★★★ einen zweiten (Ritterin Ysolde: einen mehr). Am Gegenstand: p.sockel = { siegel: id | null, runen: [id] }.
import { isNoun, isRune, runeBase, runeFits } from './grammar.js';

export const istSockelTeil = (d) => d?.art === 'siegel' || isRune(d);
export const sockelVon = (p) => p.sockel || { siegel: null, runen: [] };

// Anzahl Sockel eines Gegenstands. extraRunen: zusätzliche Adjektiv-Sockel (Ritterin Ysolde)
export function sockelPlaetze(def, stern = 1, extraRunen = 0) {
  if (!def || !isNoun(def)) return { siegel: 0, runen: 0 };
  return { siegel: 1, runen: 1 + (stern >= 3 ? 1 : 0) + extraRunen };
}

// Darf teilId in host eingesetzt werden? → { ok } oder { ok: false, grund, text }
export function kannEinsetzen(host, defs, teilId, extraRunen = 0) {
  const hd = defs[host.id], td = defs[teilId];
  const pl = sockelPlaetze(hd, host.stern || 1, extraRunen);
  const s = sockelVon(host);
  if (!pl.siegel) return { ok: false, grund: 'nomen', text: 'Siegel und Runen kommen nur auf Nomen.' };
  if (td.art === 'siegel') {
    if (td.genus !== hd.artikel) return { ok: false, grund: 'genus', text: `Es heißt „${hd.artikel} ${hd.name}“ – dazu passt nur das ${hd.artikel}-Siegel.` };
    if (s.siegel) return { ok: false, grund: 'voll', text: 'Der Artikel-Sockel ist schon besetzt.' };
    return { ok: true };
  }
  if (!isRune(td)) return { ok: false, grund: 'art', text: 'Nur Siegel und Runen passen in einen Sockel.' };
  if (!runeFits(td, hd)) return { ok: false, grund: 'passt', text: `„${td.name}“ passt nur zu ${td.adjektiv.passtText}.` };
  if (s.runen.some((id) => runeBase(defs[id]) === runeBase(td))) return { ok: false, grund: 'doppelt', text: 'Dieses Adjektiv steckt schon darin.' };
  if (s.runen.length >= pl.runen) return { ok: false, grund: 'voll', text: 'Alle Adjektiv-Sockel sind besetzt.' };
  return { ok: true };
}

// Einsetzen: das Teil verschwindet aus den Gegenständen und steckt im Sockel
export function einsetzen(run, host, teil, defs) {
  const s = { ...sockelVon(host), runen: [...sockelVon(host).runen] };
  if (defs[teil.id].art === 'siegel') s.siegel = teil.id;
  else s.runen.push(teil.id);
  host.sockel = s;
  run.items = run.items.filter((p) => p.uid !== teil.uid);
}

// Herausnehmen (art 'siegel' oder Index einer Rune): das Teil als Gegenstand zurückgeben (noch ohne Platz)
export function herausnehmen(host, wo) {
  const s = sockelVon(host);
  let id;
  if (wo === 'siegel') { id = s.siegel; host.sockel = { ...s, siegel: null }; }
  else { id = s.runen[wo]; host.sockel = { ...s, runen: s.runen.filter((_, i) => i !== wo) }; }
  if (!host.sockel.siegel && !host.sockel.runen.length) delete host.sockel;
  return id;
}

// Beim Verbinden: Sockel-Teile aller Teile auf das Ergebnis übertragen. Was nicht passt (kein Platz, doppelt,
// falscher Artikel nach dem Kompositum), wird zurückgegeben – es kommt ins Lager.
export function sockelUebertragen(ziel, quellen, defs) {
  const teile = quellen.flatMap((q) => { const s = sockelVon(q); return [s.siegel, ...s.runen].filter(Boolean); });
  delete ziel.sockel;
  const rest = [];
  for (const id of teile) {
    if (kannEinsetzen(ziel, defs, id).ok) einsetzen({ items: [] }, ziel, { id, uid: -1 }, defs);
    else rest.push(id);
  }
  return rest;
}
