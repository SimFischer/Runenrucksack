// Grammatik als Spielregel: Komposita, Artikel-Siegel, Adjektiv-Runen.
// Grundsatz: Eine grammatisch falsche Kombination ist nie stärker als eine richtige –
// falsch gelegte Siegel und Runen wirken gar nicht, mit falschem Artikel entsteht kein Kompositum.
import { sizeOf, STERN_FAKTOR } from './logic.js';

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
export const isVerb = (d) => d.art === 'verb';
// Runen und Verben drehen ihren Pfeil in vier Richtungen, andere längliche Items legen sich quer.
export const canRotate = (d) => isRune(d) || isVerb(d) || d.w !== d.h;
export const nextRot = (d, rot) => (isRune(d) || isVerb(d) ? (rot + 1) % 4 : d.w !== d.h ? (rot ? 0 : 1) : rot);

const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

// ---------- Komposita ----------

export function compoundId(kraftId, traegerId) {
  return `${kraftId}+${traegerId}`;
}

const roundUp = (key, v) => (DECIMAL_KEYS.has(key) ? Math.ceil(v * 10 - 1e-9) / 10 : Math.ceil(v - 1e-9));

// Werte eines Gegenstands mit Sternstufe (★★ 2,2-fach, ★★★ 5-fach, ★★★★ 11-fach).
// kraftStern: Ein Kompositum aus einem höherstufigen Kristall hat einen stärkeren Kraft-Anteil.
export function starDef(def, stern = 1, kraftStern = 1) {
  if (kraftStern > 1 && def.kraftWerte) {
    const kf = STERN_FAKTOR[kraftStern];
    const k = { ...def, kraftStern };
    for (const [key, v] of Object.entries(def.kraftWerte)) k[key] = roundUp(key, (k[key] || 0) + v * (kf - 1));
    if (def.aura) k.aura = Object.fromEntries(Object.entries(def.aura).map(([key, v]) => [key, Math.round(v * kf)]));
    def = k;
  }
  if (!stern || stern === 1) return def;
  const f = STERN_FAKTOR[stern];
  const out = { ...def, stern, preis: Math.round(def.preis * f) };
  for (const k of EFFECT_KEYS) if (out[k]) out[k] = roundUp(k, out[k] * f);
  if (def.aura) out.aura = Object.fromEntries(Object.entries(def.aura).map(([k, v]) => [k, Math.round(v * f)]));
  return out;
}

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
      // Was der Kristall beisteuert (wächst mit seiner Sternstufe, siehe starDef)
      def.kraftWerte = {};
      for (const key of EFFECT_KEYS) if ((def[key] || 0) > (td[key] || 0)) def.kraftWerte[key] = def[key] - (td[key] || 0);
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

// Pfeil einer Verb-Rolle zeigt entlang ihrer langen Seite: 0 ↑, 1 →, 2 ↓, 3 ←.
export function verbTargetCell(p, def) {
  const s = sizeOf(def, p.rot || 0);
  return [{ x: p.x, y: p.y - 1 }, { x: p.x + s.w, y: p.y }, { x: p.x, y: p.y + s.h }, { x: p.x - 1, y: p.y }][(p.rot || 0) % 4];
}

export const ROLLE_OHNE_SUBJEKT = 0.5; // ohne Subjekt oder mit falscher Form wirkt die Rolle nur halb

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Mehrzahl eines Items; Komposita bilden sie über ihr Grundwort (Feuer + Äxte = Feueräxte).
export function pluralOf(def, defs) {
  if (def.art === 'kompositum') {
    const k = defs[def.teile.kraft], t = pluralOf(defs[def.teile.traeger], defs);
    return {
      einzahl: def.name,
      richtig: k.name + lowerFirst(t.richtig),
      falsch: t.falsch.map((f) => k.name + lowerFirst(f)),
      grund: t,
    };
  }
  if (!def.plural) return null;
  return { einzahl: def.plural.einzahl || def.name, richtig: def.plural.richtig, falsch: def.plural.falsch };
}

// Der Satz aus Subjekt und Verb: „Das Feuerschwert schlägt.“ / „Die Speere schlagen.“ (★★ und ★★★ = Mehrzahl)
export function satzFor(verbDef, subjDef, stern, defs) {
  const mehrzahl = stern > 1;
  const f = verbDef.formen;
  const subjekt = mehrzahl ? `Die ${pluralOf(subjDef, defs).richtig}` : `${cap(subjDef.artikel)} ${subjDef.name}`;
  return {
    mehrzahl,
    subjektText: subjekt,
    richtig: mehrzahl ? f.sie : f.er,
    falsch: mehrzahl ? f.falschSie : f.falschEr,
    satz: `${subjekt} ${mehrzahl ? f.sie : f.er}.`,
    regel: mehrzahl
      ? `Sind es mehrere (sie), bleibt die Grundform: die ${pluralOf(subjDef, defs).richtig} ${f.sie}.`
      : `Bei einem (er, sie, es) endet das Verb meist auf -t: ${subjDef.artikel} ${subjDef.name} ${f.er}.`,
  };
}

function subjektPasst(bonus, sd) {
  const f = bonus?.filter || {};
  const base = sd.teile?.traeger || sd.id;
  if (f.traeger && !f.traeger.includes(base)) return false;
  if (f.kraft && !f.kraft.includes(sd.teile?.kraft)) return false;
  return !!bonus;
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
  const stamm = st >= 3 ? rd.steigerung.sStamm : st === 2 ? rd.steigerung.kStamm : rd.adjektiv.stamm;
  if (schwach || st >= 3) return stamm + 'e';
  return stamm + ({ der: 'er', die: 'e', das: 'es' }[artikel] || 'e');
}

export function phraseFor(adjs, def) {
  if (!adjs.length) return null;
  const sup = adjs.some((a) => a.stufe >= 3);
  const words = adjs.map((a) => adjectiveForm(a, def.artikel, sup)).join(', ');
  return sup ? `${def.artikel} ${words} ${def.name}` : `${words} ${def.name}`;
}

// ---------- Steigerung ----------

// Runen steigen wie alle Items: Zwei gleiche ergeben die nächste Stufe, mit denselben Faktoren
// (STERN_FAKTOR). Stufe 2 = Komparativ, 3 = Superlativ, 4 = Superlativ mit leuchtender Krone.
export const MAX_RUNENSTUFE = 4;
export const runeBase = (d) => d.basis || d.id;

// Baut aus jeder Rune Komparativ (Stufe 2), Superlativ (Stufe 3) und Kronen-Superlativ (Stufe 4).
export function buildRuneLevels(defs) {
  const out = [];
  const bump = { gewoehnlich: 'selten', selten: 'episch', episch: 'legendaer', legendaer: 'legendaer' };
  for (const d of Object.values(defs)) {
    if (!isRune(d) || !d.steigerung || d.stufe) continue;
    let prev = d;
    for (let stufe = 2; stufe <= MAX_RUNENSTUFE; stufe++) {
      const f = STERN_FAKTOR[stufe];
      const adj = { ...d.adjektiv, bonus: {} };
      for (const [k, v] of Object.entries(d.adjektiv.bonus || {})) adj.bonus[k] = roundUp(k, v * f);
      if (d.adjektiv.bonusProzent) adj.bonusProzent = Math.round(d.adjektiv.bonusProzent * f);
      const lvl = {
        ...d,
        id: `${d.id}@${stufe}`,
        basis: d.id,
        stufe,
        name: stufe === 2 ? d.steigerung.komparativ : d.steigerung.superlativ,
        abzeichen: stufe === 4 ? '👑' : null,
        krone: stufe === 4,
        seltenheit: stufe === 4 ? 'legendaer' : bump[prev.seltenheit],
        preis: d.preis * 2 ** (stufe - 1),
        adjektiv: adj,
        laden: false,
      };
      out.push(lvl);
      prev = lvl;
    }
  }
  return out;
}

export const nextLevelId = (d) => ((d.stufe || 1) >= MAX_RUNENSTUFE ? null : `${runeBase(d)}@${(d.stufe || 1) + 1}`);

// Wertet einen Rucksack aus: wirksame Werte jedes Items und Erklärungen für das Info-Feld.
// Ergebnis: Map uid → { def, siegel: [{uid, genus, ok}], runen: [{uid, def, ok}], phrase, ziele }
export function analyze(placed, defs, opts = {}) {
  const siegelBonus = opts.siegelBonus ?? SIEGEL_BONUS;
  const runeMult = opts.runeMult ?? 1;
  const map = cellMap(placed, defs);
  const info = new Map();
  for (const p of placed) info.set(p.uid, { base: starDef(defs[p.id], p.stern, p.kraftStern), siegel: [], runen: [], ziele: [], ziel: null });

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
      // Ritterin Ysolde: Die Rune wirkt auch auf das nächste Nomen dahinter (in Pfeilrichtung).
      if ((opts.runenZiele || 1) >= 2) {
        const [dx, dy] = DIRS[(p.rot || 0) % 4];
        let x = c.x, y = c.y;
        while (map.get(`${x},${y}`) === t) { x += dx; y += dy; }
        const t2 = map.get(`${x},${y}`);
        if (t2 && t2 !== p) {
          const ok2 = runeFits(d, defs[t2.id]);
          info.get(p.uid).ziel2 = { uid: t2.uid, def: defs[t2.id], ok: ok2 };
          info.get(t2.uid).runen.push({ uid: p.uid, def: d, ok: ok2 });
        }
      }
    } else if (isVerb(d) && d.formen) {
      const c = verbTargetCell(p, d);
      const t = map.get(`${c.x},${c.y}`);
      const vi = info.get(p.uid);
      vi.verb = { status: 'kein' };
      if (!t || !isNoun(defs[t.id])) continue;
      const stern = t.stern || 1;
      const s = p.satz;
      const passt = s && s.uid === t.uid && s.id === t.id && (s.stern || 1) === stern;
      vi.verb = {
        status: passt ? (s.ok ? 'ok' : 'falsch') : 'offen',
        subjekt: { uid: t.uid, id: t.id, stern, def: defs[t.id] },
        ...satzFor(d, defs[t.id], stern, defs),
      };
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

  // Verb-Rollen: mit richtigem Subjekt volle Wirkung und das Subjekt schlägt mit,
  // sonst nur halbe Wirkung – grammatisch falsch ist nie stärker als richtig.
  for (const p of placed) {
    const i = info.get(p.uid);
    if (!i.verb) continue;
    const v = i.verb;
    if (v.status === 'ok') {
      i.def.subjektUid = v.subjekt.uid;
      const bonus = i.base.subjektBonus;
      if (subjektPasst(bonus, v.subjekt.def)) {
        v.bonus = bonus.text;
        if (bonus.prozent) for (const k of EFFECT_KEYS) if (i.def[k]) i.def[k] = roundUp(k, i.def[k] * (1 + bonus.prozent / 100));
        const sub = info.get(v.subjekt.uid);
        for (const [k, val] of Object.entries(bonus.plus || {})) sub.def[k] = (sub.def[k] || 0) + val;
      }
    } else {
      for (const k of EFFECT_KEYS) {
        if (!i.def[k]) continue;
        const half = i.def[k] * ROLLE_OHNE_SUBJEKT;
        i.def[k] = DECIMAL_KEYS.has(k) ? Math.floor(half * 10) / 10 : Math.floor(half);
      }
    }
  }
  return info;
}
