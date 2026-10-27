// Boni, die über Siegel und Runen hinausgehen: Figur, Unterklasse, Schicksalsrune, Begegnungen, Taschen.
// evaluateBag() liefert für jedes Item die wirksamen Werte (wie grammar.analyze) plus eine Liste der Boni.
import { analyze, EFFECT_KEYS } from './grammar.js';

export const GLANZ_BONUS = 10; // Prozent

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

// Wirkung einer Unterklasse oder Schicksalsrune auf den Kontext.
function applyEffekt(ctx, e = {}, day = 1) {
  if (e.mod) ctx.mods.push(e.mod);
  if (e.tempo) ctx.tempo += e.tempo;
  if (e.lebenProTag) ctx.leben += e.lebenProTag * day;
  if (e.siegelBonus) ctx.siegelBonus = e.siegelBonus;
  if (e.runenFaktor) ctx.runeMult *= e.runenFaktor;
}

// Spieler-Kontext für Kampf und Info-Feld. data: { heroes, fates } aus heroes.json.
export function playerContext(run, data = {}) {
  const ctx = { mods: [], siegelBonus: undefined, runeMult: 1, tempo: 0, leben: 0, hero: null, fate: null, unterklasse: null };
  const hero = data.heroes?.find((h) => h.id === run?.hero);
  if (hero) {
    ctx.hero = hero;
    if (hero.bonus) ctx.mods.push(hero.bonus);
    ctx.unterklasse = hero.unterklassen?.find((u) => u.id === run.unterklasse) || null;
    if (ctx.unterklasse) applyEffekt(ctx, ctx.unterklasse.effekt, run.day);
  }
  Object.assign(ctx, hero?.extra || {}); // besondere Fähigkeit der Figur (fernsicht, siegelStartblock, runenZiele)
  ctx.fate = data.fates?.find((f) => f.id === run?.fate) || null;
  if (ctx.fate) applyEffekt(ctx, ctx.fate.effekt, run.day);
  for (const mod of run?.mods || []) ctx.mods.push(mod);
  // Verfluchte Kobold-Geschenke schaden zu Kampfbeginn.
  ctx.selbstschaden = 2 * (run?.items || []).filter((p) => p.area === 'bag' && p.fluch).length;
  ctx.taschenFelder = run?.taschenFelder || {};
  return ctx;
}

// In welcher Tasche liegt das Item ganz? Gibt die Tasche zurück oder null.
export function tascheOf(p, defs, taschenFelder = {}) {
  const d = defs[p.id];
  const w = p.rot ? d.h : d.w, h = p.rot ? d.w : d.h;
  let id = null;
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++) {
      const t = taschenFelder[`${p.x + dx},${p.y + dy}`];
      if (!t || (id && t !== id)) return null;
      id = t;
    }
  return id ? defs[id] : null;
}

export function evaluateBag(placed, defs, ctx = {}) {
  const info = analyze(placed, defs, { siegelBonus: ctx.siegelBonus, runeMult: ctx.runeMult, runenZiele: ctx.runenZiele });
  for (const p of placed) {
    const i = info.get(p.uid);
    i.boni = [];
    // Hauptmann Theron: Nomen mit passendem Artikel-Siegel bekommen Startblock.
    if (ctx.siegelStartblock && i.siegel.some((s) => s.ok)) {
      i.def = { ...i.def, startblock: (i.def.startblock || 0) + ctx.siegelStartblock };
      i.boni.push(`Hauptmann Theron: passendes Siegel, +${ctx.siegelStartblock} Startblock`);
    }
    for (const mod of ctx.mods || []) {
      if (!matches(mod.filter, i.base)) continue;
      i.def = applyMod(i.def, mod);
      if (mod.text) i.boni.push(mod.text);
    }
    // Glanz (Aufgabe der Stufe 3 gleich richtig): +10 % im nächsten Kampf.
    if (p.glanz) {
      i.def = applyMod(i.def, { prozent: GLANZ_BONUS });
      i.boni.push(`✨ Glanz: +${GLANZ_BONUS} % im nächsten Kampf`);
    }
    // Wortfeld-Tasche: passende Items darin werden stärker.
    const t = tascheOf(p, defs, ctx.taschenFelder);
    if (t) {
      i.tasche = { def: t, ok: i.base.wortfeld === t.wortfeld };
      if (i.tasche.ok) {
        i.def = applyMod(i.def, { prozent: t.tasche.bonus });
        i.boni.push(`${t.name}: passendes Wortfeld, +${t.tasche.bonus} %`);
      }
    }
  }
  return info;
}
