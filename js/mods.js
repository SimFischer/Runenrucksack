// Boni, die über Siegel und Runen hinausgehen: Figur, Unterklasse, Schicksalsrune, Begegnungen, Taschen.
// evaluateBag() liefert für jedes Item die wirksamen Werte (wie grammar.analyze) plus eine Liste der Boni.
import { analyze } from './grammar.js';

// Spieler-Kontext für den Kampf und das Info-Feld.
export function playerContext(run) {
  return { mods: [], siegelBonus: undefined, runeMult: 1, tempo: 0, leben: 0 };
}

export function evaluateBag(placed, defs, ctx = {}) {
  const info = analyze(placed, defs, { siegelBonus: ctx.siegelBonus, runeMult: ctx.runeMult });
  for (const i of info.values()) i.boni = [];
  return info;
}
