// Spielregeln ohne Darstellung: Raster, Laden, Lauf-Zustand, Gebiete, Gegner.

export const CFG = {
  bagCols: 4, bagRows: 3,
  storeCols: 4, storeRows: 3,
  startGold: 12,
  rerollCost: 1,
  shopSlots: 5,
  hearts: 5,
  lastDay: 10,
};

export const income = (day) => 8 + day;
export const baseHp = (day) => Math.round(40 + 8 * (day - 1) + 1.5 * (day - 1) ** 2);
export const sellValue = (def) => Math.max(1, Math.floor(def.preis / 2));

// Gewichte der Seltenheiten im Laden, abhängig vom Tag.
export function rarityWeights(day) {
  const d = day - 1;
  return {
    gewoehnlich: Math.max(20, 80 - 8 * d),
    selten: Math.min(40, 18 + 4 * d),
    episch: Math.min(30, 2 + 3 * d),
    legendaer: Math.min(12, Math.max(0, (d - 3) * 2)),
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
  return rot ? { w: def.h, h: def.w } : { w: def.w, h: def.h };
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
  let cols = 0, rows = 0;
  for (const c of mask) {
    const [x, y] = c.split(',').map(Number);
    cols = Math.max(cols, x + 1);
    rows = Math.max(rows, y + 1);
  }
  return { cols, rows, mask };
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
  };
  rollShop(run, items, regions, true, rng);
  return run;
}

// Items, die im Laden des aktuellen Gebiets erscheinen dürfen.
export function shopPool(run, items, regions) {
  const region = regionOf(run.day, regions).id;
  return items.filter((d) => d.laden !== false && (!d.gebiete || d.gebiete.includes(region)));
}

export function rollShop(run, items, regions, force = false, rng = Math.random) {
  const pool = shopPool(run, items, regions);
  const weights = rarityWeights(run.day);
  const slots = run.shopSlots || CFG.shopSlots;
  const next = [];
  for (let i = 0; i < slots; i++) {
    const old = run.shop[i];
    if (!force && old && old.locked) { next.push(old); continue; }
    next.push({ id: randomShopItem(pool, weights, rng).id, locked: false });
  }
  // Mindestens eine Waffe im Angebot, damit man nie ganz ohne Schaden dasteht.
  const hasWeapon = next.some((s) => s && pool.find((d) => d.id === s.id)?.schaden);
  const free = next.map((s, i) => (s && !s.locked ? i : -1)).filter((i) => i >= 0);
  if (!hasWeapon && free.length) {
    const weapons = pool.filter((d) => d.schaden);
    next[pickOne(free, rng)] = { id: randomShopItem(weapons, weights, rng).id, locked: false };
  }
  run.shop = next;
}

function randomShopItem(items, weights, rng) {
  // Nur Seltenheiten, von denen es auch Items gibt.
  const rar = pickWeighted(Object.entries(weights).filter(([r]) => items.some((d) => d.seltenheit === r)), rng);
  const pool = items.filter((d) => d.seltenheit === rar);
  return pickOne(pool.length ? pool : items, rng);
}

export function reroll(run, items, regions, rng = Math.random) {
  if (run.gold < CFG.rerollCost) return false;
  run.gold -= CFG.rerollCost;
  rollShop(run, items, regions, false, rng);
  return true;
}

// Nach einem Kampf: Ergebnis buchen, nächsten Tag vorbereiten.
export function finishBattle(run, items, regions, won, enemyName, rng = Math.random) {
  run.history.push({ day: run.day, won, enemy: enemyName });
  if (won) run.wins++;
  else { run.hearts--; run.losses++; }
  if (run.hearts <= 0) { run.over = 'lost'; return; }
  if (run.day >= CFG.lastDay) { run.over = 'won'; return; }
  run.day++;
  run.gold += income(run.day);
  rollShop(run, items, regions, false, rng);
  for (const s of run.shop) if (s) s.locked = false;
  run.queue = [];
  if (isRegionStart(run.day, regions)) run.queue.push('gebiet');
  run.queue.push('verschmelzen');
}

// ---------- Gegner ----------

export function pickEnemy(day, regions, enemies, rng = Math.random) {
  const region = regionOf(day, regions);
  const byId = (id) => enemies.find((e) => e.id === id);
  if (isBossDay(day, regions)) return byId(region.boss);
  return byId(pickOne(region.gegner, rng));
}

export function enemyBudget(day, boss) {
  return Math.floor(cumulativeGold(day) * (0.7 + 0.015 * day)) + (boss ? 5 : 0);
}

export function makeEnemy(day, enemy, items, defs, rng = Math.random) {
  let budget = enemyBudget(day, enemy.boss);
  const weights = rarityWeights(day);
  const grid = rectGrid(CFG.bagCols, CFG.bagRows);
  const placed = [];
  let uid = 1;

  const score = (d) => {
    let s = 1;
    for (const [k, v] of Object.entries(enemy.vorliebe || {})) if (d[k]) s += v;
    return s * (weights[d.seltenheit] || 0);
  };

  for (let tries = 0; tries < 80 && budget > 0; tries++) {
    const affordable = items.filter((d) => d.preis <= budget + cheapestPrice(placed, defs));
    if (!affordable.length) break;
    const cand = pickWeighted(affordable.map((d) => [d, score(d)]), rng);
    if (!cand) break;

    if (cand.preis <= budget) {
      const spot = randomSpot(placed, defs, cand, grid, rng);
      if (spot) {
        placed.push({ uid: uid++, id: cand.id, ...spot });
        budget -= cand.preis;
        continue;
      }
    }
    // Kein Platz: ein billigeres Item gegen ein besseres tauschen.
    const sorted = [...placed].sort((a, b) => defs[a.id].preis - defs[b.id].preis);
    for (const old of sorted) {
      const diff = cand.preis - defs[old.id].preis;
      if (diff <= 0 || diff > budget) continue;
      const rest = placed.filter((p) => p !== old);
      const spot = randomSpot(rest, defs, cand, grid, rng);
      if (spot) {
        placed.splice(placed.indexOf(old), 1);
        placed.push({ uid: uid++, id: cand.id, ...spot });
        budget -= diff;
        break;
      }
    }
  }
  return { ...enemy, items: placed };
}

function cheapestPrice(placed, defs) {
  return placed.length ? Math.min(...placed.map((p) => defs[p.id].preis)) : 0;
}

function randomSpot(placed, defs, def, grid, rng) {
  const spots = [];
  for (const rot of def.w === def.h ? [0] : [0, 1])
    for (let y = 0; y < grid.rows; y++)
      for (let x = 0; x < grid.cols; x++)
        if (canPlace(placed, defs, def, x, y, rot, grid)) spots.push({ x, y, rot });
  return spots.length ? pickOne(spots, rng) : null;
}
