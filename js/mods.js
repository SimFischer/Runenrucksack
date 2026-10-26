// Boni, die über Siegel und Runen hinausgehen: Figur, Unterklasse, Schicksalsrune, Begegnungen, Taschen.
// evaluateBag() liefert für jedes Item die wirksamen Werte (wie grammar.analyze) plus eine Liste der Boni.
import { analyze, EFFECT_KEYS } from './grammar.js';

// Ein Modifikator: { filter, prozent, abklingzeit, text }.
// filter: { art, id, kraft, traeger, wortfeld } – alle angegebenen Bedingungen müssen passen.
export function matches(filter = {}, def) {
  if (filter.art && def.art !== filter.art) return false;
  if (filter.id && def.id !== filter.id) return false;
  if (filter.kraft && def.teile?.kraft !== filter.kraft) return false;
  if (filter.traeger && def.id !== filter.traeger && def.teile?.traeger !== filter.traeger) return false;
  if (filter.wortfeld && def.wortfeld !== filter.wortfeld) return false;
  return true;
}

const roundUp = (k, v) => (k === 'kaelte' || k === 'betaeubung' ? Math.ceil(v * 10 - 1e-9) / 10 : Math.ceil(v - 1e-9));

export function applyMod(def, mod) {
  const out = { ...def };
  if (mod.prozent) {
    for (const k of EFFECT_KEYS) if (out[k]) out[k] = roundUp(k, out[k] * (1 + mod.prozent / 100));
  }
  if (mod.abklingzeit && out.abklingzeit > 0) {
    out.abklingzeit = Math.max(0.5, Math.round(out.abklingzeit * (1 + mod.abklingzeit / 100) * 10) / 10);
  }
  return out;
}

// Spieler-Kontext für Kampf und Info-Feld. data: { heroes } aus den JSON-Dateien.
export function playerContext(run, data = {}) {
  const ctx = { mods: [], siegelBonus: undefined, runeMult: 1, tempo: 0, leben: 0, hero: null };
  const hero = data.heroes?.find((h) => h.id === run?.hero);
  if (hero) {
    ctx.hero = hero;
    if (hero.bonus) ctx.mods.push(hero.bonus);
  }
  for (const mod of run?.mods || []) ctx.mods.push(mod);
  // Verfluchte Kobold-Geschenke schaden zu Kampfbeginn.
  ctx.selbstschaden = 2 * (run?.items || []).filter((p) => p.area === 'bag' && p.fluch).length;
  return ctx;
}

export function evaluateBag(placed, defs, ctx = {}) {
  const info = analyze(placed, defs, { siegelBonus: ctx.siegelBonus, runeMult: ctx.runeMult });
  for (const i of info.values()) {
    i.boni = [];
    for (const mod of ctx.mods || []) {
      if (!matches(mod.filter, i.base)) continue;
      i.def = applyMod(i.def, mod);
      if (mod.text) i.boni.push(mod.text);
    }
  }
  return info;
}
