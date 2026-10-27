// Gemeinsamer Zustand: geladene Inhalte (JSON-Dateien) und der laufende Lauf.
import { bagGrid, STORE_GRID, regionOf } from './logic.js';
import { buildCompounds, buildRuneLevels } from './grammar.js';
import { playerContext } from './mods.js';
import { placeWaiting } from './sterne.js';
import { baueBuch } from './buch.js';
import { neuesProfil } from './fortschritt.js';

export const G = {
  ITEMS: [],      // Items im Laden (items.json)
  COMPOUNDS: [],  // Komposita aus recipes.json
  DEFS: {},       // alle Item-Definitionen nach id
  RAR: {},
  WORTFELDER: {},
  ENEMIES: [],
  RECIPES: null,
  REGIONS: [],
  HEROES: [],
  FATES: [],       // Schicksalsrunen
  ENCOUNTERS: null, // encounters.json
  EXERCISES: null,  // exercises.json
  TUTORIAL: null,   // tutorial.json
  ACH: null,        // achievements.json: Erfahrung, Ränge, Erfolge, Designs
  REGISTRY: null,   // registry.json: feste Nummern für Helden- und Reisecodes
  WORTSCHATZ: null, // wortschatz.json: Wörter für die Aufgaben
  THEMEN: null,     // themen.json: Themen und Stufen der Aufgaben
  LEHRKRAFT: null,  // lehrkraft.json: Code für den Bereich „Für Lehrkräfte“
  BILDER: { items: {}, gegner: {}, figuren: {}, bosse: {}, hintergruende: {} }, // assets/zuordnung.json
  BUCH: null,       // Buch der Wörter (aus items.json und recipes.json erzeugt)
  PROFIL: null,     // dauerhafter Fortschritt (js/fortschritt.js)
  run: null,
};

const SAVE_KEY = 'runenrucksack.lauf.v2';

export async function loadData() {
  const get = (f) => fetch(f).then((r) => r.json());
  const [itemData, enemyData, recipes, regions, heroes, encounters, exercises, tutorial, ach, registry, wortschatz, themen, lehrkraft, bilder] = await Promise.all([
    get('items.json'), get('enemies.json'), get('recipes.json'), get('regions.json'), get('heroes.json'),
    get('encounters.json'), get('exercises.json'), get('tutorial.json'), get('achievements.json'), get('registry.json'), get('wortschatz.json'), get('themen.json'), get('lehrkraft.json').catch(() => ({})),
    get('assets/zuordnung.json').catch(() => null),
  ]);
  G.ITEMS = itemData.items;
  G.RAR = itemData.seltenheiten;
  G.WORTFELDER = itemData.wortfelder || {};
  G.RECIPES = recipes;
  for (const d of G.ITEMS) G.DEFS[d.id] = d;
  G.COMPOUNDS = buildCompounds(G.DEFS, G.RECIPES);
  for (const d of G.COMPOUNDS) G.DEFS[d.id] = d;
  for (const d of buildRuneLevels(G.DEFS)) G.DEFS[d.id] = d;
  G.ENEMIES = enemyData.gegner;
  G.REGIONS = regions.gebiete;
  G.HEROES = heroes.helden;
  G.FATES = heroes.schicksalsrunen;
  G.ENCOUNTERS = encounters;
  G.EXERCISES = exercises;
  G.TUTORIAL = tutorial;
  G.ACH = ach;
  G.REGISTRY = registry;
  G.WORTSCHATZ = wortschatz;
  G.THEMEN = themen;
  G.LEHRKRAFT = lehrkraft;
  if (bilder) Object.assign(G.BILDER, bilder);
  G.BUCH = baueBuch(G.DEFS, G.ITEMS, G.RECIPES);
  G.PROFIL = loadProfil();
}

// ---------- Profil (dauerhafter Fortschritt; maßgeblich ist der Heldencode) ----------

const PROFIL_KEY = 'runenrucksack.profil.v1';
export function loadProfil() {
  try {
    const p = JSON.parse(localStorage.getItem(PROFIL_KEY));
    if (p && p.v === 1) return { ...neuesProfil(), ...p };
  } catch { /* privater Modus o. ä. */ }
  return neuesProfil();
}
export function saveProfil() {
  try { localStorage.setItem(PROFIL_KEY, JSON.stringify(G.PROFIL)); } catch { /* privater Modus */ }
}

// ---------- Speichern (Komfort, nur in diesem Browser) ----------

export function save() {
  if (G.run?.tutorial) return; // Das Tutorial zählt nicht und überschreibt keinen Lauf.
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
    // Ein Item, das beim Schließen gerade aufs Verbinden wartete, kommt in Rucksack oder Lager.
    for (const p of r.items.filter((i) => i.area === 'neu')) if (!placeWaiting(r, G.DEFS, p)) r.items = r.items.filter((i) => i !== p);
    r.shop = r.shop.map((s) => (s && G.DEFS[s.id] ? s : null));
    return r;
  } catch { return null; }
}

// ---------- Ereignisse (für das Tutorial und die Erste-Mal-Tipps) ----------

const listeners = [];
export const onEvent = (fn) => listeners.push(fn);
export const emit = (typ, data = {}) => { for (const fn of listeners) fn({ typ, ...data }); };

// ---------- Kleine Einstellungen auf diesem Gerät (immer mit try/catch) ----------

export function getPref(key, fallback = null) {
  try { return localStorage.getItem('runenrucksack.' + key) ?? fallback; } catch { return fallback; }
}
export function setPref(key, value) {
  try { localStorage.setItem('runenrucksack.' + key, value); } catch { /* privater Modus */ }
}

// ---------- Bilder (fehlt eines, steht das Emoji) ----------

// Komposita zeigen das Bild ihres Trägers, gesteigerte Runen das der Grundrune.
export function bildFuer(def) {
  const it = G.BILDER.items || {};
  const p = it[def.id] || it[def.teile?.traeger] || it[def.basis];
  return p ? 'assets/' + p : null;
}
export const figurBild = (id) => (G.BILDER.figuren?.[id] ? 'assets/' + G.BILDER.figuren[id] : null);
export const gegnerBild = (id) => {
  const p = G.BILDER.bosse?.[id] || G.BILDER.gegner?.[id];
  return p ? 'assets/' + p : null;
};
export const hintergrundBild = (id) => (G.BILDER.hintergruende?.[id] ? 'assets/' + G.BILDER.hintergruende[id] : null);

// ---------- Abkürzungen ----------

export const placedOf = (uid) => G.run.items.find((p) => p.uid === uid);
export const itemsIn = (area, exceptUid) => G.run.items.filter((p) => p.area === area && p.uid !== exceptUid);
export const gridOf = (area) => (area === 'bag' ? bagGrid(G.run) : STORE_GRID);
export const region = () => regionOf(G.run.day, G.REGIONS);
export const hero = () => G.HEROES.find((h) => h.id === G.run.hero);
export const playerCtx = () => playerContext(G.run, { heroes: G.HEROES, fates: G.FATES });
