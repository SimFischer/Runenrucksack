// Spielregeln ohne Darstellung: Raster, Laden, Lauf-Zustand, Gegner.

export const CFG = {
  bagCols: 4, bagRows: 3,
  storeCols: 4, storeRows: 3,
  startGold: 12,
  rerollCost: 1,
  shopSlots: 5,
  hearts: 5,
  winsToWin: 10,
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

// ---------- Raster ----------

export function sizeOf(def, rot) {
  return rot ? { w: def.h, h: def.w } : { w: def.w, h: def.h };
}

export function areaDims(area) {
  return area === 'bag'
    ? { cols: CFG.bagCols, rows: CFG.bagRows }
    : { cols: CFG.storeCols, rows: CFG.storeRows };
}

// Prüft, ob ein Item an (x,y) passt. placed: Liste {uid,id,x,y,rot} desselben Bereichs.
export function canPlace(placed, defs, def, x, y, rot, cols, rows, ignoreUids = []) {
  const { w, h } = sizeOf(def, rot);
  if (x < 0 || y < 0 || x + w > cols || y + h > rows) return false;
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
export function findSpot(placed, defs, def, cols, rows, ignoreUids = []) {
  for (const rot of [0, 1]) {
    if (rot && def.w === def.h) continue;
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++)
        if (canPlace(placed, defs, def, x, y, rot, cols, rows, ignoreUids)) return { x, y, rot };
  }
  return null;
}

// ---------- Lauf ----------

export function newRun(items) {
  const run = {
    version: 1,
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
    pendingFusion: false, // zu Beginn des Tages verschmelzen?
    lernen: { richtig: 0, falsch: 0 },
  };
  rollShop(run, items, true);
  return run;
}

export function rollShop(run, items, force = false) {
  const weights = rarityWeights(run.day);
  const next = [];
  for (let i = 0; i < CFG.shopSlots; i++) {
    const old = run.shop[i];
    if (!force && old && old.locked) { next.push(old); continue; }
    next.push({ id: randomShopItem(items, weights).id, locked: false });
  }
  // Mindestens eine Waffe im Angebot, damit man nie ganz ohne Schaden dasteht.
  const hasWeapon = next.some((s) => s && items.find((d) => d.id === s.id)?.schaden);
  const free = next.map((s, i) => (s && !s.locked ? i : -1)).filter((i) => i >= 0);
  if (!hasWeapon && free.length) {
    const weapons = items.filter((d) => d.schaden);
    const i = free[Math.floor(Math.random() * free.length)];
    next[i] = { id: randomShopItem(weapons, weights).id, locked: false };
  }
  run.shop = next;
}

function randomShopItem(items, weights) {
  // Nur Seltenheiten, von denen es auch Items gibt.
  const rar = pickWeighted(Object.entries(weights).filter(([r]) => items.some((d) => d.seltenheit === r)));
  const pool = items.filter((d) => d.seltenheit === rar);
  const list = pool.length ? pool : items;
  return list[Math.floor(Math.random() * list.length)];
}

export function reroll(run, items) {
  if (run.gold < CFG.rerollCost) return false;
  run.gold -= CFG.rerollCost;
  rollShop(run, items);
  return true;
}

// Nach einem Kampf: Ergebnis buchen, nächsten Tag vorbereiten.
export function finishBattle(run, items, won, enemyName) {
  run.history.push({ day: run.day, won, enemy: enemyName });
  if (won) run.wins++;
  else { run.hearts--; run.losses++; }
  if (run.wins >= CFG.winsToWin) { run.over = 'won'; return; }
  if (run.hearts <= 0) { run.over = 'lost'; return; }
  run.day++;
  run.gold += income(run.day);
  run.pendingFusion = true;
  rollShop(run, items);
  for (const s of run.shop) if (s) s.locked = false;
}

// ---------- Gegner ----------

export function makeEnemy(day, enemies, items, defs, rng = Math.random) {
  const isBoss = day % 5 === 0;
  const filtered = enemies.filter((e) => !!e.boss === isBoss);
  const pool = filtered.length ? filtered : enemies;
  const enemy = pool[Math.floor(rng() * pool.length)];
  let budget = Math.floor(cumulativeGold(day) * (0.7 + 0.015 * day)) + (isBoss ? 5 : 0);
  const weights = rarityWeights(day);
  const { bagCols: cols, bagRows: rows } = CFG;
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
      const spot = randomSpot(placed, defs, cand, cols, rows, rng);
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
      const spot = randomSpot(rest, defs, cand, cols, rows, rng);
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

function randomSpot(placed, defs, def, cols, rows, rng) {
  const spots = [];
  for (const rot of def.w === def.h ? [0] : [0, 1])
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++)
        if (canPlace(placed, defs, def, x, y, rot, cols, rows)) spots.push({ x, y, rot });
  return spots.length ? spots[Math.floor(rng() * spots.length)] : null;
}
