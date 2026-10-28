// Themen und Stufen: Jedes Thema ist auf jeder Stufe in jedem erlaubten Format erzeugbar, die Inhalte sind
// vollständig und haben genau eine richtige Lösung; falsche Antworten sind nie zufällig richtig.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { erzeugeInhalt, mitRegeln, THEMA_IDS } from '../js/aufgaben/themen.js';
import { seededRng } from '../js/logic.js';

const json = (f) => JSON.parse(readFileSync(new URL('../' + f, import.meta.url)));
const THEMEN = json('themen.json');
const WS = mitRegeln(json('wortschatz.json'), THEMEN);
const REGELN = new Set(WS.alleRegeln.map((r) => r.id));

// Prüft einen Inhalt unabhängig von der Darstellung. Gibt einen Fehlertext zurück oder null.
export function pruefeInhalt(c) {
  if (!c.frage || !c.merke || !c.wort) return 'frage, merke oder wort fehlt';
  if (!REGELN.has(c.regel)) return `unbekannte Regel ${c.regel}`;
  const eindeutig = (opt, richtig) => {
    if (!Array.isArray(opt) || opt.length < 2) return 'zu wenige Antworten';
    if (new Set(opt).size !== opt.length) return `doppelte Antworten: ${opt}`;
    if (opt.filter((o) => o === richtig).length !== 1) return `richtige Antwort nicht genau einmal: ${richtig} in ${opt}`;
    return null;
  };
  switch (c.format) {
    case 'auswahl': case 'luecke': case 'regel': return eindeutig(c.optionen, c.richtig) || (c.format === 'luecke' && !c.satz.includes('___') ? 'Lücke fehlt' : null)
      || (c.format === 'regel' && c.beispiele?.length !== 3 ? 'drei Beispiele' : null);
    case 'passtnicht': return c.woerter.length !== 4 ? 'vier Wörter' : eindeutig(c.woerter, c.richtig);
    case 'paare': {
      const l = c.paare.map((p) => p[0]), r = c.paare.map((p) => p[1]);
      return c.paare.length < 3 ? 'zu wenige Paare' : new Set(l).size !== l.length || new Set(r).size !== r.length ? `Paare nicht eindeutig: ${JSON.stringify(c.paare)}` : null;
    }
    case 'sortieren': {
      const ids = c.kisten.map((k) => k.id);
      if (c.karten.length < 4 || c.karten.length > 6) return `4–6 Karten (${c.karten.length})`;
      if (!c.karten.every((k) => ids.includes(k.kiste))) return 'Karte ohne Kiste';
      if (new Set(c.karten.map((k) => k.text)).size !== c.karten.length) return 'doppelte Karten';
      return new Set(c.karten.map((k) => k.kiste)).size < 2 ? 'nur eine Kiste benutzt' : null;
    }
    case 'buchstaben': {
      if (!c.ziel || !c.luecken.length || c.luecken.some((i) => i < 0 || i >= c.ziel.length)) return 'Lücken ungültig';
      const fehlt = c.luecken.map((i) => c.ziel[i].toLowerCase()).filter((ch) => !c.tasten.includes(ch));
      return fehlt.length ? `Tasten fehlen: ${fehlt}` : null;
    }
    case 'eintippen': return c.loesung ? null : 'Lösung fehlt';
    case 'baukasten': return c.modus === 'fuge' ? eindeutig(c.fugen, c.richtig) : c.loesung.every((t) => c.teile.includes(t)) && new Set(c.teile).size === c.teile.length ? null : 'Bausteine ungültig';
    case 'fehler': {
      if (!c.ziele.length || c.ziele.some((i) => i < 0 || i >= c.woerter.length)) return 'Ziele ungültig';
      if (c.modus === 'verbessern') return c.ziele.every((i) => c.korrektur[i] && c.optionen.includes(c.korrektur[i])) ? null : 'Korrektur fehlt';
      return null;
    }
    case 'ordnen': return c.modus === 'antippen' ? (c.richtig >= 0 && c.richtig < c.karten.length && new Set(c.karten).size === c.karten.length ? null : 'antippen ungültig')
      : (c.loesung.length === c.karten.length && c.loesung.every((k) => c.karten.includes(k)) ? null : 'Reihenfolge ungültig');
    default: return `unbekanntes Format ${c.format}`;
  }
}

test('Jedes Thema hat drei Stufen und einen Erzeuger', () => {
  assert.ok(THEMEN.themen.length >= 14);
  for (const t of THEMEN.themen) {
    assert.equal(t.stufen.length, 3, t.id);
    if (t.spiel) continue; // eigenes Spiel (z. B. Briefe), keine Aufgaben-Erzeuger
    assert.ok(THEMA_IDS.includes(t.id), `Erzeuger für ${t.id}`);
    assert.ok(t.regeln.length >= 1, t.id);
  }
  for (const id of ['artikel', 'mehrzahl', 'wortarten', 'grossklein', 'personalformen', 'zeitformen', 'steigerung', 'verlaengerung', 'ableitung', 'doppel', 'ie', 'tzck', 'komposita', 'satzglieder', 'wortfelder']) {
    assert.ok(THEMEN.themen.some((t) => t.id === id), id);
  }
  assert.equal(new Set(WS.alleRegeln.map((r) => r.id)).size, WS.alleRegeln.length, 'Regel-ids eindeutig');
});

test('Alle Themen auf allen Stufen in allen Formaten erzeugbar, mit genau einer Lösung', () => {
  const rng = seededRng(7);
  let anzahl = 0;
  for (const t of THEMEN.themen) {
    for (let s = 1; s <= 3; s++) {
      for (const f of t.stufen[s - 1].formate) {
        for (let k = 0; k < 60; k++) {
          const c = erzeugeInhalt(THEMEN, t.id, s, { ws: WS, rng, felder: ['haus'], benutzt: new Set() }, f);
          const fehler = pruefeInhalt(c);
          assert.equal(fehler, null, `${t.id} Stufe ${s} ${f}: ${fehler}\n${JSON.stringify(c).slice(0, 400)}`);
          anzahl++;
        }
      }
    }
  }
  assert.ok(anzahl > 2000);
});
