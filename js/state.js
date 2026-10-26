// Gemeinsamer Zustand: geladene Inhalte (JSON-Dateien) und der laufende Lauf.
import { bagGrid, STORE_GRID, regionOf } from './logic.js';
import { buildCompounds } from './grammar.js';

export const G = {
  ITEMS: [],      // Items im Laden (items.json)
  COMPOUNDS: [],  // Komposita aus recipes.json
  DEFS: {},       // alle Item-Definitionen nach id
  RAR: {},
  ENEMIES: [],
  RECIPES: null,
  REGIONS: [],
  run: null,
};

const SAVE_KEY = 'runenrucksack.lauf.v2';

export async function loadData() {
  const get = (f) => fetch(f).then((r) => r.json());
  const [itemData, enemyData, recipes, regions] = await Promise.all([
    get('items.json'), get('enemies.json'), get('recipes.json'), get('regions.json'),
  ]);
  G.ITEMS = itemData.items;
  G.RAR = itemData.seltenheiten;
  G.RECIPES = recipes;
  for (const d of G.ITEMS) G.DEFS[d.id] = d;
  G.COMPOUNDS = buildCompounds(G.DEFS, G.RECIPES);
  for (const d of G.COMPOUNDS) G.DEFS[d.id] = d;
  G.ENEMIES = enemyData.gegner;
  G.REGIONS = regions.gebiete;
}

// ---------- Speichern (Komfort, nur in diesem Browser) ----------

export function save() {
  try {
    if (G.run && !G.run.over) localStorage.setItem(SAVE_KEY, JSON.stringify(G.run));
    else localStorage.removeItem(SAVE_KEY);
  } catch { /* privater Modus o. ä. */ }
}

export function loadRun() {
  try {
    const r = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!r || r.version !== 2 || r.over) return null;
    // Items, die es nicht mehr gibt, fallen weg.
    r.items = r.items.filter((p) => G.DEFS[p.id]);
    r.shop = r.shop.map((s) => (s && G.DEFS[s.id] ? s : null));
    return r;
  } catch { return null; }
}

// ---------- Abkürzungen ----------

export const placedOf = (uid) => G.run.items.find((p) => p.uid === uid);
export const itemsIn = (area, exceptUid) => G.run.items.filter((p) => p.area === area && p.uid !== exceptUid);
export const gridOf = (area) => (area === 'bag' ? bagGrid(G.run) : STORE_GRID);
export const region = () => regionOf(G.run.day, G.REGIONS);
