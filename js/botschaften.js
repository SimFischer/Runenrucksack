// Botschaften lesen (botschaften.json), ohne Darstellung und testbar: Welcher Brief kommt, was bringen die
// Antworten, wie ändert sich der Lernstand im Thema „Leseverständnis“ (id lesen). Ob an einem Morgen ein Brief
// statt der Begegnung kommt, entscheidet finishBattle in logic.js (BRIEF).

export const THEMA_LESEN = 'lesen';

// Ein Brief für den Lauf: aus dem aktuellen Gebiet, passende Schwierigkeit (Lernstand, höchstens die Höchststufe der
// Lehrkraft), noch nicht gelesen. Gibt es keinen passenden, darf die Schwierigkeit abweichen.
export function waehleBrief(briefe, { gebiet, stufe, gelesen = [], rng = Math.random }) {
  const offen = briefe.filter((b) => b.gebiet === gebiet && !gelesen.includes(b.id));
  const passend = offen.filter((b) => b.schwierigkeit === stufe);
  const liste = passend.length ? passend : offen.length ? offen : briefe.filter((b) => b.gebiet === gebiet);
  return liste.length ? liste[Math.floor(rng() * liste.length)] : null;
}

// Mit Merkliste auf dem Gerät: Ein Brief kommt erst wieder, wenn alle Briefe seines Gebiets und seiner Stufe dran
// waren – dann beginnt die Liste für diese Gruppe von vorn. Ergebnis: { brief, merkliste (neu, mit dem gewählten Brief) }
export function waehleBriefMerk(briefe, { gebiet, stufe, merkliste = [], gelesen = [], rng = Math.random }) {
  const gruppe = briefe.filter((b) => b.gebiet === gebiet && b.schwierigkeit === stufe);
  let merk = merkliste;
  if (gruppe.length && gruppe.every((b) => merk.includes(b.id) || gelesen.includes(b.id))) merk = merk.filter((id) => !gruppe.some((b) => b.id === id));
  const brief = waehleBrief(briefe, { gebiet, stufe, gelesen: [...new Set([...merk, ...gelesen])], rng });
  return { brief, merkliste: brief && !merk.includes(brief.id) ? [...merk, brief.id] : merk };
}

// ---------- Belegen: Wo steht das im Text? ----------
// Ab Schwierigkeit 2 reicht die richtige Antwort nicht: Das Kind tippt im Brief den Satz an, der sie belegt.
export const BELEG_AB = 2;
export const BELEG_GOLD = 1;
export const mitBeleg = (brief, frage) => brief.schwierigkeit >= BELEG_AB && !!frage.textstelle;

// Text in Sätze zerlegen (Satzzeichen und schließende Anführungszeichen bleiben am Satz; der Gruß am Ende
// hat oft kein Satzzeichen und bleibt ein eigener „Satz“).
export function saetzeVon(text) {
  return (text.match(/[^.!?]+(?:[.!?]+[“”"»«]*|$)\s*/g) || [text]).map((s) => s.trim()).filter(Boolean);
}

// Gehört ein Satz zur Textstelle? Die Stelle kann ein Teil eines Satzes oder mehrere Sätze sein.
const norm = (s) => s.replace(/[„“”"»«]/g, '').replace(/\s+/g, ' ').trim();
export function satzInStelle(satz, stelle) {
  const a = norm(satz), b = norm(stelle);
  if (!a || !b) return false;
  // ganzer Satz in der Stelle, Stelle in einem Satz, oder der erste Satz der Stelle steckt in diesem Satz
  return b.includes(a) || a.includes(b) || a.includes(b.split(/(?<=[.!?])\s/)[0]);
}
export const belegRichtig = (brief, frage, satzNr) => satzInStelle(saetzeVon(brief.text)[satzNr] || '', frage.textstelle);

// Antworten auswerten: antworten = gewählte Antwort je Frage (in Reihenfolge), belege = je Frage true/false
// (Beleg gefunden?) oder undefined (kein Beleg verlangt).
// Ergebnis: { belohnungen (für jede richtige Antwort ihre Belohnung, je gefundenem Beleg 1 Gold, bei einem Fehler
//   zusätzlich der Trost), falsch: [{ frage, textstelle }] (diese Stellen werden im Text markiert),
//   ohneBeleg (richtige Antworten ohne gefundenen Beleg), alleRichtig (alle Antworten und alle Belege) }
export function werteAus(brief, antworten, belege = []) {
  const belohnungen = [], falsch = [];
  let ohneBeleg = 0;
  brief.fragen.forEach((f, i) => {
    if (antworten[i] === f.richtig) {
      belohnungen.push(f.belohnung);
      if (belege[i] === true) belohnungen.push({ typ: 'gold', menge: BELEG_GOLD });
      if (belege[i] === false) ohneBeleg++;
    } else falsch.push({ frage: f.frage, textstelle: f.textstelle });
  });
  if (falsch.length && brief.trost) belohnungen.push(brief.trost);
  return { belohnungen, falsch, ohneBeleg, alleRichtig: !falsch.length && !ohneBeleg };
}

// ---------- Hinweise: Wer genau liest, kämpft besser ----------
// Manche Briefe verraten eine Schwäche der Gegner (hinweis: { gegner: id oder "alle", kraft, prozent }). Nach dem
// Lesen gilt der Hinweis für den Rest des Laufs – aber er hilft nur, wer passende Gegenstände (Kristall oder
// Kompositum mit dieser Kraft) in den Rucksack packt. Im Laden steht der Hinweis nirgends: Man muss ihn sich merken.
export function merkeHinweis(run, brief) {
  if (!brief.hinweis) return;
  run.hinweise ||= [];
  if (!run.hinweise.some((h) => h.von === brief.id)) run.hinweise.push({ ...brief.hinweis, von: brief.id, absender: brief.absender });
}
const passtGegner = (h, gegnerId) => h.gegner === 'alle' || h.gegner === gegnerId;
const hatKraft = (def, kraft) => def?.id === kraft || def?.teile?.kraft === kraft;

// Modifikatoren für den Kampf gegen gegnerId (für ctx.mods in mods.js)
export function hinweisMods(run, gegnerId) {
  return (run?.hinweise || []).filter((h) => passtGegner(h, gegnerId)).map((h) => ({
    filter: { kraftOderKristall: h.kraft }, prozent: h.prozent, text: `Tipp aus dem Brief: +${h.prozent} %`,
  }));
}

// Welche Hinweise wirken in diesem Kampf? Ergebnis: [{ hinweis, genutzt (passender Gegenstand im Rucksack) }]
export function hinweiseImKampf(run, gegnerId, bagDefs) {
  return (run?.hinweise || []).filter((h) => passtGegner(h, gegnerId))
    .map((h) => ({ hinweis: h, genutzt: bagDefs.some((d) => hatKraft(d, h.kraft)) }));
}

// Lernstand im Thema Leseverständnis: zwei Briefe hintereinander ganz richtig → nächste Stufe (wie bei den Aufgaben).
export function verbucheBrief(profil, alleRichtig) {
  profil.lernstand ||= {};
  const l = (profil.lernstand[THEMA_LESEN] ||= { stufe: 1, sicher: 0 });
  let aufgestiegen = false;
  if (alleRichtig) {
    l.sicher++;
    if (l.sicher >= 2 && l.stufe < 3) { l.stufe++; l.sicher = 0; aufgestiegen = true; }
  } else l.sicher = 0;
  delete l.geschaetzt;
  return { aufgestiegen, stufe: l.stufe };
}
