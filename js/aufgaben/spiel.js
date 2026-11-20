// Aufgaben im Spiel: wählt die Aufgabe, zeigt sie im Aufgaben-Fenster und verbucht das Ergebnis
// (Lernstand, Wiederholung, benutzte Wörter). Für Verbinden, Begegnungen und die Ork-Rüstung.
import { G, saveProfil, emit, region } from '../state.js';
import { mitRegeln } from './themen.js';
import { FORMATE } from './formate/index.js';
import { waehleAufgabe, verbucheAufgabe, lernstandVon, maxStufe, GOLD_FUER_STUFE, aufgabenStand } from './wahl.js';
import { stelleAufgabe } from './host.js';
import { merkeAntwort } from '../fortschritt.js';
import { bump, toast } from '../ui.js';
import { meldeRegel } from '../buch-ui.js';

let WS = null;
export const wortschatz = () => (WS ||= mitRegeln(G.WORTSCHATZ, G.THEMEN));
export const einstellungen = () => G.PROFIL?.klasse || null;
const thema = (id) => G.THEMEN.themen.find((t) => t.id === id);

// Wortfelder des aktuellen Gebiets (für die Wortwahl)
export function felderJetzt() {
  const r = region();
  return Object.entries(G.WORTSCHATZ.wortfelder).filter(([, f]) => f.gebiete?.includes(r.id)).map(([id]) => id);
}

// Regeln der Lernauswertung (fortschritt.js) je Thema – für Lernbericht und Erfahrung
const REGEL_GRUPPE = {
  artikel: 'artikel', komposita: 'artikel', mehrzahl: 'mehrzahl', personalformen: 'personalform', zeitformen: 'praeteritum', steigerung: 'steigerung',
  verlaengerung: 'rechtschreibung', ableitung: 'rechtschreibung', doppel: 'rechtschreibung', ie: 'rechtschreibung', tzck: 'rechtschreibung',
  grossklein: 'rechtschreibung', wortarten: 'wortarten', satzglieder: 'satzglieder', wortfelder: 'wortfelder',
};

// Eine Aufgabe auswählen (oder einen fertigen Inhalt nehmen) und stellen.
// opts: { art | kandidaten, bereich, format, inhalt, anker, beteiligt, nein, trotzdem, einVersuch, itemWort, titel }
export async function frageImSpiel(opts) {
  const run = G.run;
  const rng = Math.random;
  const ws = wortschatz();
  const itemNomen = opts.itemWort ? ws.nomen.find((n) => n.wort === opts.itemWort) : null;
  const waehle = (extra = {}) => waehleAufgabe({ themen: G.THEMEN, ws, profil: G.PROFIL, einst: einstellungen(), run, rng, art: opts.art, kandidaten: opts.kandidaten,
    bereich: opts.bereich, format: opts.format, felder: felderJetzt(), itemNomen, ...extra });
  const erste = opts.inhalt ? FORMATE[opts.inhalt.format].erzeuge(opts.inhalt, rng) : waehle();
  // Nach einem Fehlversuch: neue Aufgabe zum selben Thema auf derselben Stufe, mit anderem Wort und möglichst
  // anderem Format (nicht bei festen Inhalten wie der Speisekarte, nicht im Tutorial)
  const naechste = opts.inhalt || run.tutorial ? null : (alt) => {
    (aufgabenStand(run).benutzt[alt.thema] ||= []).push(alt.wort);
    try {
      return waehle({ kandidaten: [alt.thema], stufe: opts.format ? undefined : alt.stufe, keineWiederholung: true, nichtFormat: opts.format ? undefined : alt.format });
    } catch { return null; }
  };
  const t = thema(erste.thema);
  emit('tipp', { key: 'stufen' });
  if (opts.zielMarkieren) erste.zielMarkiert = true; // Begleiter Rabe
  // Begleiter Eule: einmal pro Lauf die passende Regel vorab zeigen
  const eule = run.begleiter === 'eule' && !run.euleGenutzt && erste.regel && !run.tutorial
    ? { text: ws.regelText(erste.regel), nutzen: () => { run.euleGenutzt = true; } } : null;
  const ergebnis = await stelleAufgabe(erste, {
    naechste,
    anker: opts.anker,
    beteiligt: opts.beteiligt,
    titel: t?.name || '',
    kopf: opts.kopf,
    tutorial: run.tutorial,
    gold: () => run.gold,
    zahle: () => { if (opts.einVersuch || run.gold < 1) return false; run.gold -= 1; bump('stat-gold'); return true; },
    nein: opts.nein,
    trotzdem: opts.trotzdem,
    einVersuch: opts.einVersuch,
    onRegel: (id) => emit('regelGesehen', { id }),
    eule,
  });
  const aufgabe = ergebnis.aufgabe || erste;
  if (!ergebnis.abgebrochen) {
    run.lernen ||= { richtig: 0, falsch: 0 };
    if (ergebnis.richtig) run.lernen.richtig++;
    run.lernen.falsch += (ergebnis.versuche || 0) - (ergebnis.richtig ? 1 : 0);
    merkeAntwort(run, REGEL_GRUPPE[aufgabe.thema] || 'rechtschreibung', !!ergebnis.richtig, !!ergebnis.ersterVersuch);
    const v = verbucheAufgabe({ run, profil: G.PROFIL, aufgabe, ergebnis, rng });
    if (v.aufgestiegen && v.stufe <= maxStufe(einstellungen(), aufgabe.thema)) {
      toast(`${t.name}: Du kannst das schon sicher – jetzt kommt Stufe ${'★'.repeat(v.stufe)}!`);
    }
    if (ergebnis.richtig && ergebnis.ersterVersuch && !run.tutorial) {
      const gold = GOLD_FUER_STUFE[aufgabe.stufe] || 0;
      if (gold) { run.gold += gold; bump('stat-gold'); toast(`Gleich richtig auf Stufe ${aufgabe.stufe}: +${gold} Gold`); }
    }
    // Regelkarte fürs Buch: jede Regel, die richtig angewendet wurde
    G.PROFIL.regeln ||= [];
    if (ergebnis.richtig && aufgabe.regel && !G.PROFIL.regeln.includes(aufgabe.regel) && t?.regeln.some((r) => r.id === aufgabe.regel)) {
      G.PROFIL.regeln.push(aufgabe.regel);
      meldeRegel(t, t.regeln.find((r) => r.id === aufgabe.regel));
    }
    saveProfil();
    emit('aufgabeFertig', { thema: aufgabe.thema, stufe: aufgabe.stufe, richtig: !!ergebnis.richtig, ersterVersuch: !!ergebnis.ersterVersuch });
  }
  // Glanz fürs verbundene Item: gleich beim ersten Versuch richtig (nach einem Fehler: kein Glanz, kein Gold)
  return { ...ergebnis, aufgabe, glanz: !!(ergebnis.richtig && ergebnis.ersterVersuch && !run.tutorial) };
}

export { lernstandVon };
