// Spielregeln ohne Darstellung: Raster, Laden, Lauf-Zustand, Gebiete, Gegner.

export const CFG = {
  bagCols: 4, bagRows: 3,
  storeCols: 4, storeRows: 3,
  startGold: 12,
  shopSlots: 5,
  hearts: 5,
  lastDay: 10,
};

export const income = (day) => 8 + day;
// Botschaften lesen: An manchen Morgen kommt statt der Begegnung ein Brief – frühestens ab abTag, nie an zwei Tagen
// hintereinander. Mit chance 0,5 und dieser Sperre kommt im Schnitt etwa jeden dritten Tag ein Brief.
export const BRIEF = { abTag: 2, chance: 0.5 };
export const briefAmMorgen = (run, rng = Math.random) => run.day >= BRIEF.abTag && run.briefTag !== run.day - 1 && rng() < BRIEF.chance;

// Neu würfeln: die ersten Würfe pro Tag sind billig, jeder weitere teurer. Der Zähler beginnt jeden Tag neu.
export const WUERFEL = { billig: 3, preis: 1, teuer: 2 };
// Kostenlose Würfe (Begleiter Fuchs) kommen zuerst und zählen nicht zu den billigen.
export const wuerfelPreis = (run) => (run.freiWuerfe > 0 ? 0 : (run.wuerfe || 0) < WUERFEL.billig ? WUERFEL.preis : WUERFEL.teuer);
export const ARMOR_BONUS = 0.15; // Rüstungsfehler richtig verbessert: Gegner startet mit 15 % weniger Leben
export const baseHp = (day) => Math.round(60 + 14 * (day - 1) + 2.5 * (day - 1) ** 2);
// Sternstufen: Zwei gleiche Gegenstände verbinden sich sofort zu einem der nächsten Stufe.
// Jede Stufe ist deutlich stärker als zwei der Stufe darunter (man spart ja auch Platz):
// ★★ wirkt 2,2-fach, ★★★ 5-fach, ★★★★ (legendär) 11-fach – auch der Verkaufspreis steigt so.
export const STERN_FAKTOR = { 1: 1, 2: 2.2, 3: 5, 4: 11 };
export const MAX_STERN = 4;
export const sternOf = (p) => p?.stern || 1;
// Items, die man schon besitzt, kommen im Laden so viel häufiger, damit Sammeln sich lohnt.
export const SAMMEL_GEWICHT = 2.5;

// Wie viele gleiche ★-Items (Runen: Grundstufe) liegen schon in Rucksack und Lager?
export const ownedCount = (run, id) => run.items.filter((p) => p.id === id && sternOf(p) === 1).length;
// Rabatt vom Händler (Begegnung): die nächsten Käufe je 2 Gold billiger, mindestens 1 Gold.
export const RABATT = { kaeufe: 3, gold: 2 };
export const preisVon = (run, def) => (run?.rabatt > 0 && def.art !== 'tasche' ? Math.max(1, def.preis - RABATT.gold) : def.preis);
export const sellValue = (def, stern = 1) => Math.max(1, Math.floor((def.preis * STERN_FAKTOR[stern]) / 2));

// Händler-Vertrauen (wie in Oaken Tower): 5 Stufen, jeder Lauf beginnt auf Stufe 1. Jede Stufe verschiebt die
// Seltenheiten im Laden nach oben – zusätzlich zum Tag. bonus wird zu den Gewichten des Tages addiert
// (gewöhnliche nie unter 5). kosten: Gold für die nächste Stufe; höchstens eine Stufe pro Tag.
// Die Erhöhung wirkt ab dem nächsten Neu-Würfeln bzw. dem nächsten Tag (der aktuelle Laden bleibt).
export const HAENDLER = {
  max: 5,
  kosten: { 2: 6, 3: 9, 4: 12, 5: 15 },
  bonus: {
    1: { gewoehnlich: 0, selten: 0, episch: 0, legendaer: 0 },
    2: { gewoehnlich: -15, selten: 18, episch: 4, legendaer: 0 },   // deutlich mehr seltene
    3: { gewoehnlich: -25, selten: 20, episch: 14, legendaer: 1 },  // epische regelmäßig
    4: { gewoehnlich: -32, selten: 18, episch: 18, legendaer: 5 },  // legendäre möglich, auch früh
    5: { gewoehnlich: -40, selten: 15, episch: 22, legendaer: 10 }, // legendäre häufiger
  },
  // In einfachen Worten für die Tafel am Händlerstand (statt Prozenttabellen)
  texte: {
    1: 'Der Händler zeigt dir vor allem gewöhnliche Gegenstände.',
    2: 'Mehr seltene Gegenstände.',
    3: 'Epische Gegenstände kommen regelmäßig.',
    4: 'Legendäre Gegenstände sind möglich – auch schon früh.',
    5: 'Legendäre Gegenstände kommen öfter.',
  },
};
export const haendlerStufe = (run) => run?.haendler || 1;
export const vertrauenKosten = (run) => HAENDLER.kosten[haendlerStufe(run) + 1] ?? null;
// Warum es gerade nicht geht: 'max' | 'heute' | 'gold' | null
export function vertrauenSperre(run) {
  if (haendlerStufe(run) >= HAENDLER.max) return 'max';
  if (run.haendlerTag === run.day) return 'heute';
  if (run.gold < vertrauenKosten(run)) return 'gold';
  return null;
}
export function vertrauenErhoehen(run) {
  if (vertrauenSperre(run)) return false;
  run.gold -= vertrauenKosten(run);
  run.haendler = haendlerStufe(run) + 1;
  run.haendlerTag = run.day;
  return true;
}
// Schmied: wertet einen Gegenstand aus Rucksack oder Lager für Gold um eine Sternstufe auf – ohne zweites Exemplar.
// Teuer: faktor × Grundpreis × Zielstufe (Preis 4 von ★ auf ★★: 3 × 4 × 2 = 24 Gold). Höchstens einmal
// pro Tag; höchstens bis maxZiel (★★★) – ★★★★ (legendär) gibt es nur durch Verbinden. Siegel und Taschen nie.
export const SCHMIED = { faktor: 3, maxZiel: 3 };
export const schmiedKosten = (grundpreis, ziel) => SCHMIED.faktor * grundpreis * ziel;

// Gegner kaufen intern bei einem Händler, dem sie mit den Tagen mehr vertrauen – etwa so wie ein Kind im Schnitt.
// So wie ein Kind im Schnitt (laut Simulation): Tag 1–3 Stufe 1, 4–5 Stufe 2, 6–8 Stufe 3, ab Tag 9 Stufe 4.
export const GEGNER_HAENDLER_PRO_TAG = 0.4;
export const gegnerHaendler = (day) => Math.min(HAENDLER.max, 1 + Math.floor((day - 1) * GEGNER_HAENDLER_PRO_TAG));

// Gewichte der Seltenheiten im Laden, abhängig vom Tag und der Händler-Stufe.
export function rarityWeights(day, stufe = 1) {
  const d = day - 1;
  const b = HAENDLER.bonus[stufe] || HAENDLER.bonus[1];
  return {
    gewoehnlich: Math.max(5, Math.max(20, 80 - 8 * d) + b.gewoehnlich),
    selten: Math.min(40, 18 + 4 * d) + b.selten,
    episch: Math.min(30, 2 + 3 * d) + b.episch,
    legendaer: Math.min(12, Math.max(0, (d - 3) * 2)) + b.legendaer,
  };
}

export function cumulativeGold(day) {
  let g = CFG.startGold;
  for (let d = 2; d <= day; d++) g += income(d);
  return g;
}

// ---------- Zufall ----------

export function pickWeighted(entries, rng = Math.random) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const [v, w] of entries) {
    r -= w;
    if (r < 0) return v;
  }
  return entries[entries.length - 1][0];
}

export const pickOne = (list, rng = Math.random) => list[Math.floor(rng() * list.length)];

// Wiederholbarer Zufall für Tests und Simulationen.
// Zahl aus einem Text (FNV-1a) – für feste Startwerte
export function hashText(t) {
  let h = 2166136261;
  for (const c of String(t)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

// Zufall für einen Lauf: In der Rune der Woche (run.woche) fest – aus Startwert, Tag, Zweck und Zähler –, sonst Math.random.
// So bekommen alle in derselben Woche (und Klasse) dieselben Läden, Gegner, Kämpfe, Begegnungen und Briefe.
export function laufRng(run, zweck, n = 0) {
  return run?.woche ? seededRng(hashText(`${run.woche.seed}|${run.day}|${zweck}|${n}`)) : Math.random;
}

export function seededRng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Raster ----------
// Ein Raster ist { cols, rows, mask }. mask (Set "x,y") enthält die benutzbaren Felder;
// ohne mask ist das ganze Rechteck benutzbar.

export function sizeOf(def, rot) {
  return rot % 2 ? { w: def.h, h: def.w } : { w: def.w, h: def.h };
}

export const rectGrid = (cols, rows) => ({ cols, rows, mask: null });
export const STORE_GRID = rectGrid(CFG.storeCols, CFG.storeRows);

export function baseBagCells() {
  const cells = [];
  for (let y = 0; y < CFG.bagRows; y++) for (let x = 0; x < CFG.bagCols; x++) cells.push(`${x},${y}`);
  return cells;
}

export function bagGrid(run) {
  const mask = new Set(run.bagCells);
  const taschen = run.taschenFelder || {}; // "x,y" → id der Tasche
  let cols = 0, rows = 0;
  for (const c of mask) {
    const [x, y] = c.split(',').map(Number);
    cols = Math.max(cols, x + 1);
    rows = Math.max(rows, y + 1);
  }
  return { cols, rows, mask, taschen };
}

const usable = (grid, x, y) => x >= 0 && y >= 0 && x < grid.cols && y < grid.rows && (!grid.mask || grid.mask.has(`${x},${y}`));

// Prüft, ob ein Item an (x,y) passt. placed: Liste {uid,id,x,y,rot} desselben Bereichs.
export function canPlace(placed, defs, def, x, y, rot, grid, ignoreUids = []) {
  const { w, h } = sizeOf(def, rot);
  for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (!usable(grid, x + dx, y + dy)) return false;
  return overlapping(placed, defs, x, y, w, h, ignoreUids).length === 0;
}

export function overlapping(placed, defs, x, y, w, h, ignoreUids = []) {
  return placed.filter((p) => {
    if (ignoreUids.includes(p.uid)) return false;
    const s = sizeOf(defs[p.id], p.rot);
    return p.x < x + w && x < p.x + s.w && p.y < y + h && y < p.y + s.h;
  });
}

// Erster freier Platz (probiert beide Drehungen).
export function findSpot(placed, defs, def, grid, ignoreUids = []) {
  for (const rot of [0, 1]) {
    if (rot && def.w === def.h) continue;
    for (let y = 0; y < grid.rows; y++)
      for (let x = 0; x < grid.cols; x++)
        if (canPlace(placed, defs, def, x, y, rot, grid, ignoreUids)) return { x, y, rot };
  }
  return null;
}

// ---------- Gebiete ----------

export function regionOf(day, regions) {
  return regions.find((r) => day >= r.tage[0] && day <= r.tage[1]) || regions[regions.length - 1];
}

export const isRegionStart = (day, regions) => regions.some((r) => r.tage[0] === day);
export const isBossDay = (day, regions) => regionOf(day, regions).tage[1] === day;

// ---------- Lauf ----------

export function newRun(items, regions, opts = {}) {
  const rng = opts.rng || Math.random;
  const run = {
    version: 2,
    day: 1,
    gold: CFG.startGold,
    hearts: CFG.hearts,
    wins: 0,
    losses: 0,
    nextUid: 1,
    items: [],
    shop: [],
    history: [],
    over: null, // null | 'won' | 'lost'
    bagCells: baseBagCells(),
    queue: ['gebiet'], // Schritte am Morgen, bevor der Laden öffnet
    lernen: { richtig: 0, falsch: 0 },
    hero: opts.hero?.id || null,
    haendler: 1, // Händler-Vertrauen (1–5)
    mods: [], // dauerhafte Boni aus Begegnungen
    fate: null, // Schicksalsrune
    unterklasse: null,
    freieItems: opts.freieItems || [], // freigeschaltete Items (z. B. Drachenfeuerschwert)
  };
  if (opts.fates?.length) {
    const fate = pickOne(opts.fates, rng);
    run.fate = fate.id;
    if (fate.effekt.ladenPlaetze) run.shopSlots = fate.effekt.ladenPlaetze;
    if (fate.effekt.goldProTag) run.goldBonus = fate.effekt.goldProTag;
    run.queue.unshift('schicksal');
  }
  // Start-Items der Figur
  for (const s of opts.hero?.start || []) run.items.push({ uid: run.nextUid++, id: s.id, area: 'bag', x: s.x, y: s.y, rot: s.rot || 0 });
  // Begleiter (opts.begleiter: Gegenstands-Definition aus js/begleiter.js): 1×1 auf den ersten freien Platz im Rucksack
  if (opts.begleiter) {
    const b = opts.begleiter, w = b.wirkung || {};
    const defs = Object.fromEntries([...items, b].map((d) => [d.id, d]));
    for (const [area, grid] of [['bag', bagGrid(run)], ['store', STORE_GRID]]) {
      const spot = findSpot(run.items.filter((p) => p.area === area), defs, b, grid);
      if (spot) { run.items.push({ uid: run.nextUid++, id: b.id, area, ...spot, rot: 0 }); break; }
    }
    run.begleiter = b.begleiter;
    if (w.siegGold) run.siegGold = w.siegGold;
    if (w.freiWuerfeProTag) run.freiWuerfe = run.freiWuerfeProTag = w.freiWuerfeProTag;
  }
  rollShop(run, items, regions, true, rng);
  return run;
}

// Items, die im Laden des aktuellen Gebiets erscheinen dürfen.
export function shopPool(run, items, regions) {
  const region = regionOf(run.day, regions).id;
  return items.filter((d) => d.laden !== false && (!d.gebiete || d.gebiete.includes(region))
    && !(d.art === 'tasche' && run.taschen?.[d.id])
    && !(d.freischaltung && !run.freieItems?.includes(d.id))); // erst nach Freischaltung (js/fortschritt.js)
}

// Tasche kaufen: Der Rucksack bekommt ihre Felder dazu.
export function attachTasche(run, def) {
  run.taschen = { ...(run.taschen || {}), [def.id]: true };
  run.taschenFelder = { ...(run.taschenFelder || {}) };
  for (const [x, y] of def.tasche.felder) {
    const key = `${x},${y}`;
    if (!run.bagCells.includes(key)) run.bagCells.push(key);
    run.taschenFelder[key] = def.id;
  }
}

export function rollShop(run, items, regions, force = false, rng = Math.random) {
  const pool = shopPool(run, items, regions);
  const weights = rarityWeights(run.day, haendlerStufe(run));
  const slots = run.shopSlots || CFG.shopSlots;
  // Rune der Woche: Angebote hängen nur von Woche, Tag und Wurf ab – nicht davon, was jemand schon besitzt
  const sammeln = run.woche ? null : run;
  const next = [];
  for (let i = 0; i < slots; i++) {
    const old = run.shop[i];
    if (!force && old && old.locked) { next.push(old); continue; }
    next.push({ id: randomShopItem(pool, weights, rng, sammeln).id, locked: false });
  }
  // Mindestens eine Waffe im Angebot, damit man nie ganz ohne Schaden dasteht.
  const hasWeapon = next.some((s) => s && pool.find((d) => d.id === s.id)?.schaden);
  const free = next.map((s, i) => (s && !s.locked ? i : -1)).filter((i) => i >= 0);
  if (!hasWeapon && free.length) {
    const weapons = pool.filter((d) => d.schaden);
    next[pickOne(free, rng)] = { id: randomShopItem(weapons, weights, rng, sammeln).id, locked: false };
  }
  run.shop = next;
}

export function randomShopItem(items, weights, rng = Math.random, run = null) {
  // Nur Seltenheiten, von denen es auch Items gibt.
  const rar = pickWeighted(Object.entries(weights).filter(([r]) => items.some((d) => d.seltenheit === r)), rng);
  const pool = items.filter((d) => d.seltenheit === rar);
  const list = pool.length ? pool : items;
  if (!run) return pickOne(list, rng);
  const owned = new Set(run.items.map((p) => p.id));
  return pickWeighted(list.map((d) => [d, owned.has(d.id) ? SAMMEL_GEWICHT : 1]), rng);
}

export function reroll(run, items, regions, rng = null) {
  const preis = wuerfelPreis(run);
  if (run.gold < preis) return false;
  run.ladenZug = (run.ladenZug || 0) + 1; // der wievielte Wurf im Lauf (für den festen Zufall der Rune der Woche)
  rng ||= laufRng(run, 'laden', run.ladenZug);
  if (run.freiWuerfe > 0) run.freiWuerfe--;
  else { run.gold -= preis; run.wuerfe = (run.wuerfe || 0) + 1; }
  rollShop(run, items, regions, false, rng);
  return true;
}

// Nach einem Kampf: Ergebnis buchen, nächsten Tag vorbereiten.
export function finishBattle(run, items, regions, won, enemyName, rng = null) {
  rng ||= laufRng({ ...run, day: run.day + 1 }, 'tag');
  run.history.push({ day: run.day, won, enemy: enemyName });
  for (const p of run.items) delete p.glanz; // Glanz gilt nur für einen Kampf
  if (won) { run.wins++; run.gold += run.siegGold || 0; } // Begleiter Rabe: Gold je Sieg
  else { run.hearts--; run.losses++; }
  if (run.hearts <= 0) { run.over = 'lost'; return; }
  if (run.day >= CFG.lastDay) { run.over = 'won'; return; }
  run.day++;
  run.gold += income(run.day) + (run.goldBonus || 0);
  run.wuerfe = 0;
  run.freiWuerfe = run.freiWuerfeProTag || 0;
  rollShop(run, items, regions, false, rng);
  for (const s of run.shop) if (s) s.locked = false;
  run.queue = [];
  if (isRegionStart(run.day, regions)) run.queue.push('gebiet');
  // Ankunft im zweiten Gebiet: Unterklasse wählen
  if (regions[1] && run.day === regions[1].tage[0]) run.queue.push('unterklasse');
  if (briefAmMorgen(run, rng)) { run.queue.push('brief'); run.briefTag = run.day; } else run.queue.push('begegnung');
}

// ---------- Gegner ----------

export const COMPOUNDS_FROM_DAY = 4; // ab diesem Tag bringen Orks auch Komposita mit

export function enemyPool(items, compounds, day) {
  const base = items.filter((d) => d.art !== 'siegel' && d.art !== 'rune' && d.art !== 'tasche');
  return day >= COMPOUNDS_FROM_DAY ? base.concat(compounds) : base;
}

export function pickEnemy(day, regions, enemies, rng = Math.random) {
  const region = regionOf(day, regions);
  const byId = (id) => enemies.find((e) => e.id === id);
  if (isBossDay(day, regions)) return byId(region.boss);
  return byId(pickOne(region.gegner, rng));
}

export function enemyBudget(day, boss) {
  // Gegner bekommen anfangs fast so viel Gold wie du (plus Start-Items), später anteilig weniger:
  // Du verbesserst deinen Rucksack mit Grammatik (Komposita, Siegel, Runen), die Orks nicht.
  return Math.floor((cumulativeGold(day) + 8) * (0.92 - 0.035 * (day - 1))) + (boss ? 3 : 0);
}

// Ab diesen Tagen bringen Orks auch Gegenstände mit Sternstufe mit (★★ ab Tag 3, ★★★ ab Tag 6);
// der Boss am letzten Tag hat immer ein legendäres ★★★★-Item dabei.
export const GEGNER_STERNE_AB = { 2: 3, 3: 6 };
export const GEGNER_LEGENDAER_TAG = 10;
// Ein Item der Stufe s kostet den Gegner so viel wie 2^(s-1) einfache – wie beim Verbinden von zwei gleichen.
export const sternPreis = (preis, stern = 1) => preis * 2 ** (stern - 1);

export function makeEnemy(day, enemy, items, defs, rng = Math.random) {
  let budget = enemyBudget(day, enemy.boss);
  const weights = rarityWeights(day, gegnerHaendler(day));
  const grid = rectGrid(CFG.bagCols, CFG.bagRows);
  const placed = [];
  let uid = 1;

  const score = (d) => {
    let s = 1;
    for (const [k, v] of Object.entries(enemy.vorliebe || {})) if (d[k]) s += v;
    return s * (weights[d.seltenheit] || 0);
  };
  // Angebot des Gegners: jedes Item als ★, ab Tag 3 auch als ★★, ab Tag 6 auch als ★★★.
  const offers = [];
  for (const d of items) {
    offers.push({ d, stern: 1, preis: d.preis });
    for (const stern of [2, 3]) if (day >= GEGNER_STERNE_AB[stern]) offers.push({ d, stern, preis: sternPreis(d.preis, stern) });
  }
  const priceOf = (p) => sternPreis(defs[p.id].preis, p.stern || 1);
  const add = (o, spot) => placed.push({ uid: uid++, id: o.d.id, ...spot, ...(o.stern > 1 ? { stern: o.stern } : {}) });

  // Boss am letzten Tag: zuerst ein legendäres ★★★★-Item
  if (enemy.boss && day >= GEGNER_LEGENDAER_TAG) {
    const legendaer = items.filter((d) => d.abklingzeit && sternPreis(d.preis, 4) <= budget)
      .map((d) => ({ d, stern: 4, preis: sternPreis(d.preis, 4) }));
    const o = pickWeighted(legendaer.map((x) => [x, score(x.d) || 1]), rng);
    const spot = o && randomSpot(placed, defs, o.d, grid, rng);
    if (spot) { add(o, spot); budget -= o.preis; }
  }

  for (let tries = 0; tries < 80 && budget > 0; tries++) {
    const cheapest = placed.length ? Math.min(...placed.map(priceOf)) : 0;
    const affordable = offers.filter((o) => o.preis <= budget + cheapest);
    if (!affordable.length) break;
    const cand = pickWeighted(affordable.map((o) => [o, score(o.d) / o.stern]), rng);
    if (!cand) break;

    if (cand.preis <= budget) {
      const spot = randomSpot(placed, defs, cand.d, grid, rng);
      if (spot) {
        add(cand, spot);
        budget -= cand.preis;
        continue;
      }
    }
    // Kein Platz: ein billigeres Item gegen ein besseres tauschen.
    const sorted = [...placed].sort((a, b) => priceOf(a) - priceOf(b));
    for (const old of sorted) {
      const diff = cand.preis - priceOf(old);
      if (diff <= 0 || diff > budget) continue;
      const rest = placed.filter((p) => p !== old);
      const spot = randomSpot(rest, defs, cand.d, grid, rng);
      if (spot) {
        placed.splice(placed.indexOf(old), 1);
        add(cand, spot);
        budget -= diff;
        break;
      }
    }
  }
  return { ...enemy, items: placed };
}

function randomSpot(placed, defs, def, grid, rng) {
  const spots = [];
  for (const rot of def.w === def.h ? [0] : [0, 1])
    for (let y = 0; y < grid.rows; y++)
      for (let x = 0; x < grid.cols; x++)
        if (canPlace(placed, defs, def, x, y, rot, grid)) spots.push({ x, y, rot });
  return spots.length ? pickOne(spots, rng) : null;
}

// ---------- Begegnungen ----------

// Reihenfolge, in der der Rucksack durch die Eulenbibliothekarin wächst (bis 5×4).
export const GROW_ORDER = [[4, 0], [4, 1], [4, 2], [0, 3], [1, 3], [2, 3], [3, 3], [4, 3]];

export function growBag(run) {
  for (const [x, y] of GROW_ORDER) {
    const key = `${x},${y}`;
    if (!run.bagCells.includes(key)) {
      run.bagCells.push(key);
      return { x, y };
    }
  }
  return null;
}

export function shuffle(list, rng = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Legt ein neues Item in den Rucksack, sonst ins Lager. Gibt das platzierte Item zurück oder null.
export function addItem(run, defs, id, extra = {}) {
  for (const [area, grid] of [['bag', bagGrid(run)], ['store', STORE_GRID]]) {
    const placed = run.items.filter((p) => p.area === area);
    const spot = findSpot(placed, defs, defs[id], grid);
    if (spot) {
      const p = { uid: run.nextUid++, id, area, ...spot, ...extra };
      run.items.push(p);
      return p;
    }
  }
  return null;
}

// Wählt die Begegnungen für den Morgen (passend zum Gebiet, nicht dieselbe wie gestern zuerst).
export function pickEncounters(run, data, regions, rng = Math.random) {
  const reg = regionOf(run.day, regions).id;
  const ok = data.begegnungen.filter((b) => !b.gebiete || b.gebiete.includes(reg));
  const last = run.history.at(-1)?.begegnung;
  const fresh = shuffle(ok.filter((b) => b.id !== last), rng);
  return fresh.slice(0, data.auswahl || 3).map((b) => b.id);
}

