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
  return key === 'abklingzeit' ? td.abklingzeit > 0 : (td[key] || 0) > 0;
}

export function adjectiveForm(rd, artikel) {
  const ending = { der: 'er', die: 'e', das: 'es' }[artikel] || 'e';
  return rd.adjektiv.stamm + ending;
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
    // Runen: jedes Adjektiv zählt einmal (Steigerung kommt später als Rezept).
    const adjs = [];
    for (const r of i.runen) {
      if (!r.ok || adjs.some((a) => a.id === r.def.id)) continue;
      adjs.push(r.def);
      for (const [k, v] of Object.entries(r.def.adjektiv.bonus)) eff[k] = (eff[k] || 0) + v * runeMult;
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
    i.phrase = adjs.length ? `${adjs.map((a) => adjectiveForm(a, eff.artikel)).join(', ')} ${eff.name}` : null;
  }
  return info;
}
