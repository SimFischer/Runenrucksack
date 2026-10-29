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

// Antworten auswerten: antworten = gewählte Antwort je Frage (in Reihenfolge).
// Ergebnis: { belohnungen (für jede richtige Antwort ihre Belohnung, bei einem Fehler zusätzlich der Trost),
//   falsch: [{ frage, textstelle }] (diese Stellen werden im Text markiert), alleRichtig }
export function werteAus(brief, antworten) {
  const belohnungen = [], falsch = [];
  brief.fragen.forEach((f, i) => {
    if (antworten[i] === f.richtig) belohnungen.push(f.belohnung);
    else falsch.push({ frage: f.frage, textstelle: f.textstelle });
  });
  if (falsch.length && brief.trost) belohnungen.push(brief.trost);
  return { belohnungen, falsch, alleRichtig: !falsch.length };
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
