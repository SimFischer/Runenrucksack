// Grammatik als Spielregel: Komposita, Artikel-Siegel, Adjektiv-Runen.
// Grundsatz: Eine grammatisch falsche Kombination ist nie stärker als eine richtige –
// falsch gelegte Siegel und Runen wirken gar nicht, falsche Artikel verschmelzen nicht.
import { sizeOf } from './logic.js';

export const GENUS = {
  der: { name: 'maskulin', farbe: '#3f7fd9' },
  die: { name: 'feminin', farbe: '#d9473f' },
  das: { name: 'neutral', farbe: '#3fa65a' },
};

export const SIEGEL_BONUS = 0.25;

// Wirkungen, die Siegel verstärken.
export const EFFECT_KEYS = [
  'schaden', 'block', 'heilung', 'gift', 'brand', 'kaelte', 'betaeubung',
  'regeneration', 'tempo', 'glueck', 'leben', 'startblock',
];
const DECIMAL_KEYS = new Set(['kaelte', 'betaeubung']);

// Pfeilrichtung der Runen: 0 → rechts, 1 ↓ unten, 2 ← links, 3 ↑ oben.
export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];

export const isNoun = (d) => !!d.artikel && d.art !== 'siegel' && d.art !== 'rune';
export const isRune = (d) => d.art === 'rune';
export const canRotate = (d) => isRune(d) || d.w !== d.h;
export const nextRot = (d, rot) => (isRune(d) ? (rot + 1) % 4 : d.w !== d.h ? (rot ? 0 : 1) : rot);

const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

// ---------- Komposita ----------

export function compoundId(kraftId, traegerId) {
  return `${kraftId}+${traegerId}`;
}

const roundUp = (key, v) => (DECIMAL_KEYS.has(key) ? Math.ceil(v * 10 - 1e-9) / 10 : Math.ceil(v - 1e-9));

// Baut aus recipes.json alle Komposita (Kraft + Träger) als eigene Item-Definitionen.
// Ein Kompositum vereint beide Teile: Es behält die Wirkung des Kristalls (umgerechnet auf die
// Abklingzeit des Trägers; passive Kristalle wirken weiter auf den ganzen Rucksack) und bekommt
// die Verschmelzungs-Wirkung aus recipes.json obendrauf. So ist richtig Verschmolzenes immer
// stärker als Kraft und Träger getrennt.
export function buildCompounds(defs, recipes) {
  const out = [];
  const k = recipes.komposita;
  const bump = { gewoehnlich: 'selten', selten: 'episch', episch: 'legendaer', legendaer: 'legendaer' };
  for (const [kraftId, kraft] of Object.entries(k.kraefte)) {
    const kd = defs[kraftId];
    if (!kd) continue;
    for (const tId of k.traeger) {
      const td = defs[tId];
      if (!td) continue;
      const def = {
        ...td,
        id: compoundId(kraftId, tId),
        art: 'kompositum',
        name: kd.name + lowerFirst(td.name),
        artikel: td.artikel,
        abzeichen: kd.emoji,
        leuchten: kraft.farbe,
        seltenheit: bump[td.seltenheit] || td.seltenheit,
        preis: td.preis + kd.preis + (k.preisAufschlag || 0),
        teile: { kraft: kraftId, traeger: tId },
      };
      if (kd.abklingzeit > 0) {
        const scale = td.abklingzeit / kd.abklingzeit;
        for (const key of EFFECT_KEYS) if (kd[key]) def[key] = (def[key] || 0) + roundUp(key, kd[key] * scale);
      } else {
        def.aura = {};
        for (const key of ['tempo', 'glueck']) if (kd[key]) def.aura[key] = kd[key];
      }
      for (const [key, v] of Object.entries(kraft.wirkung)) def[key] = roundUp(key, (def[key] || 0) + v);
      out.push(def);
    }
  }
  return out;
}

// Findet Kristalle direkt links neben oder über einem Träger (nur im Rucksack).
export function findFusions(placed, defs, recipes) {
  const traeger = new Set(recipes.komposita.traeger);
  const used = new Set();
  const result = [];
  const sorted = [...placed].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const k of sorted) {
    const kd = defs[k.id];
    if (kd.art !== 'kraft' || !recipes.komposita.kraefte[k.id]) continue;
    for (const t of sorted) {
      if (used.has(t.uid) || !traeger.has(t.id)) continue;
      const s = sizeOf(defs[t.id], t.rot);
      const left = k.x + 1 === t.x && k.y >= t.y && k.y < t.y + s.h;
      const above = k.y + 1 === t.y && k.x >= t.x && k.x < t.x + s.w;
      if (left || above) {
        used.add(t.uid);
        result.push({ kraft: k, traeger: t, id: compoundId(k.id, t.id) });
        break;
      }
    }
  }
  return result;
}

// Kristall rechts neben oder unter einem Träger: falsche Reihenfolge (für den Hinweis im Info-Feld).
export function wrongOrderNeighbor(k, placed, defs, recipes) {
  const traeger = new Set(recipes.komposita.traeger);
  for (const t of placed) {
    if (!traeger.has(t.id)) continue;
    const s = sizeOf(defs[t.id], t.rot);
    const right = t.x + s.w === k.x && k.y >= t.y && k.y < t.y + s.h;
    const below = t.y + s.h === k.y && k.x >= t.x && k.x < t.x + s.w;
    if (right || below) return t;
  }
  return null;
}

// ---------- Siegel und Runen ----------

function cellMap(placed, defs) {
  const map = new Map();
  for (const p of placed) {
    const s = sizeOf(defs[p.id], p.rot);
    for (let dy = 0; dy < s.h; dy++) for (let dx = 0; dx < s.w; dx++) map.set(`${p.x + dx},${p.y + dy}`, p);
  }
  return map;
}

function neighbors(p, defs, map) {
  const s = sizeOf(defs[p.id], p.rot);
  const found = new Set();
  for (let dy = 0; dy < s.h; dy++)
    for (let dx = 0; dx < s.w; dx++)
      for (const [ox, oy] of DIRS) {
        const q = map.get(`${p.x + dx + ox},${p.y + dy + oy}`);
        if (q && q !== p) found.add(q);
      }
  return [...found];
}

export const runeTargetCell = (r) => {
  const [dx, dy] = DIRS[(r.rot || 0) % 4];
  return { x: r.x + dx, y: r.y + dy };
};

export function runeFits(rd, td) {
  if (!isNoun(td)) return false;
  const key = rd.adjektiv.passt;
  if (key === 'nomen') return true;
  return key === 'abklingzeit' ? td.abklingzeit > 0 : (td[key] || 0) > 0;
}

// Adjektiv vor dem Nomen: ohne Artikel stark (scharfes Schwert), nach „der/die/das“ schwach (das scharfe Schwert).
export function adjectiveForm(rd, artikel, schwach = false) {
  const st = rd.stufe || 1;
  const stamm = st === 3 ? rd.steigerung.sStamm : st === 2 ? rd.steigerung.kStamm : rd.adjektiv.stamm;
  if (schwach || st === 3) return stamm + 'e';
  return stamm + ({ der: 'er', die: 'e', das: 'es' }[artikel] || 'e');
}

export function phraseFor(adjs, def) {
  if (!adjs.length) return null;
  const sup = adjs.some((a) => a.stufe === 3);
  const words = adjs.map((a) => adjectiveForm(a, def.artikel, sup)).join(', ');
  return sup ? `${def.artikel} ${words} ${def.name}` : `${words} ${def.name}`;
}

// ---------- Steigerung ----------

export const STEIGERUNG_FAKTOR = 1.5; // jede Stufe +50 % Wirkung
export const runeBase = (d) => d.basis || d.id;

// Baut aus jeder Rune Komparativ (Stufe 2) und Superlativ (Stufe 3).
export function buildRuneLevels(defs) {
  const out = [];
  const bump = { gewoehnlich: 'selten', selten: 'episch', episch: 'legendaer', legendaer: 'legendaer' };
  for (const d of Object.values(defs)) {
    if (!isRune(d) || !d.steigerung || d.stufe) continue;
    let prev = d;
    for (const stufe of [2, 3]) {
      const f = STEIGERUNG_FAKTOR ** (stufe - 1);
      const adj = { ...d.adjektiv, bonus: {} };
      for (const [k, v] of Object.entries(d.adjektiv.bonus || {})) adj.bonus[k] = roundUp(k, v * f);
      if (d.adjektiv.bonusProzent) adj.bonusProzent = Math.round(d.adjektiv.bonusProzent * f);
      const lvl = {
        ...d,
        id: `${d.id}@${stufe}`,
        basis: d.id,
        stufe,
        name: stufe === 2 ? d.steigerung.komparativ : d.steigerung.superlativ,
        abzeichen: stufe === 2 ? 'Ⅱ' : 'Ⅲ',
        seltenheit: bump[prev.seltenheit],
        preis: d.preis * (stufe === 2 ? 3 : 9),
        adjektiv: adj,
        laden: false,
      };
      out.push(lvl);
      prev = lvl;
    }
  }
  return out;
}

export const nextLevelId = (d) => (d.stufe === 3 ? null : `${runeBase(d)}@${(d.stufe || 1) + 1}`);

// Drei gleiche Runen (gleiche Stufe) direkt nebeneinander in einer Reihe oder Spalte.
export function findSteigerungen(placed, defs) {
  const map = new Map(placed.map((p) => [`${p.x},${p.y}`, p]));
  const used = new Set();
  const out = [];
  const sorted = [...placed].sort((a, b) => a.y - b.y || a.x - b.x);
  for (const p of sorted) {
    const d = defs[p.id];
    if (!isRune(d) || !d.steigerung || d.stufe === 3 || used.has(p.uid)) continue;
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const a = map.get(`${p.x + dx},${p.y + dy}`), b = map.get(`${p.x + 2 * dx},${p.y + 2 * dy}`);
      if (a && b && a.id === p.id && b.id === p.id && !used.has(a.uid) && !used.has(b.uid)) {
        used.add(p.uid).add(a.uid).add(b.uid);
        out.push({ runen: [p, a, b], mitte: a, id: nextLevelId(d) });
        break;
      }
    }
  }
  return out;
}

// Wertet einen Rucksack aus: wirksame Werte jedes Items und Erklärungen für das Info-Feld.
// Ergebnis: Map uid → { def, siegel: [{uid, genus, ok}], runen: [{uid, def, ok}], phrase, ziele }
export function analyze(placed, defs, opts = {}) {
  const siegelBonus = opts.siegelBonus ?? SIEGEL_BONUS;
  const runeMult = opts.runeMult ?? 1;
  const map = cellMap(placed, defs);
  const info = new Map();
  for (const p of placed) info.set(p.uid, { base: defs[p.id], siegel: [], runen: [], ziele: [], ziel: null });

  for (const p of placed) {
    const d = defs[p.id];
    if (d.art === 'siegel') {
      for (const n of neighbors(p, defs, map)) {
        const nd = defs[n.id];
        if (!isNoun(nd)) continue;
        const ok = nd.artikel === d.genus;
        info.get(n.uid).siegel.push({ uid: p.uid, genus: d.genus, ok });
        info.get(p.uid).ziele.push({ uid: n.uid, def: nd, ok });
      }
    } else if (isRune(d)) {
      const c = runeTargetCell(p);
      const t = map.get(`${c.x},${c.y}`);
      if (!t) continue;
      const td = defs[t.id];
      const ok = runeFits(d, td);
      info.get(p.uid).ziel = { uid: t.uid, def: td, ok };
      info.get(t.uid).runen.push({ uid: p.uid, def: d, ok });
    }
  }

  for (const p of placed) {
    const i = info.get(p.uid);
    const eff = { ...i.base };
    // Runen: jedes Adjektiv zählt einmal, bei mehreren Stufen die höchste.
    const best = new Map();
    for (const r of i.runen) {
      if (!r.ok) continue;
      const key = runeBase(r.def);
      if (!best.has(key) || (r.def.stufe || 1) > (best.get(key).stufe || 1)) best.set(key, r.def);
    }
    const adjs = [...best.values()];
    for (const a of adjs) {
      for (const [k, v] of Object.entries(a.adjektiv.bonus || {})) eff[k] = (eff[k] || 0) + v * runeMult;
    }
    for (const a of adjs) {
      if (!a.adjektiv.bonusProzent) continue;
      for (const k of EFFECT_KEYS) if (eff[k]) eff[k] = roundUp(k, eff[k] * (1 + (a.adjektiv.bonusProzent * runeMult) / 100));
    }
    // Siegel: ein passendes Siegel verstärkt alle Wirkungen um 25 %, mehrere zählen einmal.
    if (i.siegel.some((s) => s.ok)) {
      for (const k of EFFECT_KEYS) {
        if (!eff[k]) continue;
        const v = eff[k] * (1 + siegelBonus);
        eff[k] = roundUp(k, v);
      }
    }
    i.def = eff;
    i.adjektive = adjs;
    i.phrase = phraseFor(adjs, eff);
  }
  return info;
}
