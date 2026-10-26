// Simulation ganzer Läufe mit einer einfachen Kaufstrategie – für die Balance (siehe tests/balance.test.mjs).
// Annahmen über das Kind: löst Aufgaben meist richtig, kauft das Beste, was es sich leisten kann.
import {
  CFG, newRun, finishBattle, rollShop, pickEnemy, makeEnemy, findSpot, bagGrid, STORE_GRID,
  growBag, attachTasche, enemyPool, shopPool, pickEncounters, pickOne, sellValue, seededRng, ARMOR_BONUS,
} from './logic.js';
import { buildCompounds, buildRuneLevels } from './grammar.js';
import { partnerOf, placeNew, verbindeAlles } from './sterne.js';
import { playerContext, evaluateBag } from './mods.js';
import { Battle, makeFighter, runToEnd } from './battle.js';

export function prepareData(raw) {
  const defs = {};
  for (const d of raw.items) defs[d.id] = d;
  const compounds = buildCompounds(defs, raw.recipes);
  for (const d of compounds) defs[d.id] = d;
  for (const d of buildRuneLevels(defs)) defs[d.id] = d;
  return { ...raw, defs, compounds };
}

// Grobe Stärke eines Items pro Sekunde (zum Einkaufen).
function worth(d) {
  if (d.art === 'siegel' || d.art === 'rune') return 0;
  if (!d.abklingzeit) return (d.tempo || 0) * 0.25 + (d.leben || 0) * 0.08 + (d.startblock || 0) * 0.08 + (d.glueck || 0) * 0.2;
  const per = (d.schaden || 0) + 0.7 * (d.block || 0) + 0.7 * (d.heilung || 0) + 2.5 * (d.gift || 0) + 1.8 * (d.brand || 0)
    + 1.5 * (d.kaelte || 0) + 6 * (d.betaeubung || 0) + 2 * (d.regeneration || 0);
  return per / d.abklingzeit;
}

function shop(run, data, rng, skill) {
  const { defs, items, regions } = data;
  // Ein gleiches besitzt man schon: Kaufen verbindet sofort (braucht keinen Platz, spart sogar welchen).
  const value = (d) => worth(d) * (partnerOf(run.items, defs, { uid: -1, id: d.id }) ? 1.3 : 1);
  for (let round = 0; round < 3; round++) {
    let bought = true;
    while (bought) {
      bought = false;
      const offers = run.shop.map((s, i) => (s ? { i, d: defs[s.id] } : null)).filter(Boolean)
        .filter((o) => o.d.preis <= run.gold && (worth(o.d) > 0 || o.d.art === 'tasche'))
        .sort((a, b) => value(b.d) / b.d.preis - value(a.d) / a.d.preis);
      for (const o of offers) {
        if (o.d.art === 'tasche') { run.gold -= o.d.preis; run.shop[o.i] = null; attachTasche(run, o.d); bought = true; break; }
        if (partnerOf(run.items, defs, { uid: -1, id: o.d.id })) {
          run.gold -= o.d.preis;
          run.shop[o.i] = null;
          verbinde(run, data, rng, skill, placeNew(run, defs, o.d.id));
          bought = true;
          break;
        }
        const bag = run.items.filter((p) => p.area === 'bag');
        let spot = findSpot(bag, defs, o.d, bagGrid(run));
        if (!spot) {
          // Rucksack voll: schwächstes Item verkaufen, wenn das neue besser ist
          const weakest = bag.filter((p) => !p.fluch).sort((a, b) => worth(defs[a.id]) - worth(defs[b.id]))[0];
          if (!weakest || worth(defs[weakest.id]) * 1.3 >= worth(o.d)) continue;
          run.items = run.items.filter((p) => p !== weakest);
          run.gold += sellValue(defs[weakest.id], weakest.stern || 1);
          spot = findSpot(run.items.filter((p) => p.area === 'bag'), defs, o.d, bagGrid(run));
          if (!spot) continue;
        }
        run.gold -= o.d.preis;
        run.shop[o.i] = null;
        const p = { uid: run.nextUid++, id: o.d.id, area: 'bag', ...spot };
        run.items.push(p);
        verbinde(run, data, rng, skill, p); // liegt es zufällig neben einem Träger? → Kompositum
        bought = true;
        break;
      }
    }
    if (run.gold >= CFG.rerollCost + 3) { run.gold -= CFG.rerollCost; rollShop(run, items, regions, false, rng); } else break;
  }
}

// Zwei gleiche sofort verbinden, auch als Kette (eine falsche erste Antwort kostet 1 Gold).
function verbinde(run, data, rng, skill, p) {
  if (!p) return;
  verbindeAlles(run, data.defs, data.recipes, [{ uid: p.uid, paar: true }], (a, q) => {
    if (q && rng() > skill) run.gold = Math.max(0, run.gold - 1);
    return 'richtig';
  });
}

function morning(run, data, rng, skill) {
  const { defs } = data;
  for (const step of run.queue) {
    if (step === 'unterklasse') {
      const h = data.heroes.find((x) => x.id === run.hero);
      run.unterklasse = pickOne(h.unterklassen, rng).id;
    }
    if (step === 'begegnung') {
      const id = pickOne(pickEncounters(run, data.encounters, data.regions, rng), rng);
      const enc = data.encounters.begegnungen.find((b) => b.id === id);
      const ok = rng() < skill;
      if (!ok) run.gold = Math.max(0, run.gold - 1);
      const b = enc.belohnung;
      if (b.typ === 'feld' && ok) growBag(run);
      if (b.typ === 'gold' && ok) run.gold += b.menge;
      if (b.typ === 'mod' && ok) run.mods.push(b.mod);
      if (b.typ === 'item' && ok) {
        const pool = shopPool(run, data.items, data.regions).filter((d) => d.seltenheit === 'selten' && worth(d) > 0);
        if (pool.length) verbinde(run, data, rng, skill, placeNew(run, defs, pickOne(pool, rng).id));
      }
      if (b.typ === 'kobold') {
        const e = pickOne(data.exercises.kobold, rng);
        verbinde(run, data, rng, skill, placeNew(run, defs, e.item, null, ok ? {} : { fluch: e.teile.join('') }));
      }
    }
  }
  run.queue = [];
}

// Spielt einen ganzen Lauf. Gibt Siege, Tage und Kampfzeiten zurück.
export function simulateRun(data, rng, opts = {}) {
  const skill = opts.skill ?? 0.75;
  const hero = pickOne(data.heroes, rng);
  const run = newRun(data.items, data.regions, { hero, fates: data.fates, rng });
  const ctxData = { heroes: data.heroes, fates: data.fates };
  const days = [];
  while (!run.over) {
    morning(run, data, rng, skill);
    shop(run, data, rng, skill);
    const ctx = playerContext(run, ctxData);
    const bag = run.items.filter((p) => p.area === 'bag');
    const player = makeFighter('p', bag, data.defs, run.day, {
      info: evaluateBag(bag, data.defs, ctx), leben: ctx.leben, tempo: ctx.tempo, selbstschaden: ctx.selbstschaden, rng,
    });
    const foeDef = pickEnemy(run.day, data.regions, data.enemies, rng);
    const enemy = makeEnemy(run.day, foeDef, enemyPool(data.items, data.compounds, run.day), data.defs, rng);
    const armor = rng() < skill;
    const foe = makeFighter('e', enemy.items, data.defs, run.day, { startHp: armor ? 1 - ARMOR_BONUS : 1, rng });
    const battle = new Battle(player, foe);
    const won = runToEnd(battle) === 'win';
    days.push({ day: run.day, won, time: battle.time, boss: !!foeDef.boss });
    finishBattle(run, data.items, data.regions, won, enemy.name, rng);
  }
  return { wins: run.wins, won: run.over === 'won', days };
}

// Geschätzte Spielzeit: Kampf in 1×-Tempo plus Zeit für Laden und Morgen (Annahmen in Sekunden).
export const ZEIT = { laden: 45, morgen: 25, kampfExtra: 8 };
export function estimateMinutes(days) {
  return days.reduce((s, d) => s + d.time + ZEIT.kampfExtra + ZEIT.laden + (d.day > 1 ? ZEIT.morgen : 0), 0) / 60;
}

export function simulateMany(data, n, seed = 1, opts = {}) {
  const results = [];
  for (let i = 0; i < n; i++) results.push(simulateRun(data, seededRng(seed + i), opts));
  return results;
}

export function summarize(results) {
  const perDay = {};
  for (const r of results) for (const d of r.days) {
    perDay[d.day] ||= { kaempfe: 0, siege: 0 };
    perDay[d.day].kaempfe++;
    if (d.won) perDay[d.day].siege++;
  }
  const avg = (f) => results.reduce((s, r) => s + f(r), 0) / results.length;
  return {
    siegquoteProTag: Object.fromEntries(Object.entries(perDay).map(([d, v]) => [d, Math.round((100 * v.siege) / v.kaempfe)])),
    erreichtProTag: Object.fromEntries(Object.entries(perDay).map(([d, v]) => [d, Math.round((100 * v.kaempfe) / results.length)])),
    siegeDurchschnitt: avg((r) => r.wins),
    reiseGeschafft: Math.round(100 * avg((r) => (r.won ? 1 : 0))),
    minutenDurchschnitt: avg((r) => estimateMinutes(r.days)),
    kampfSekunden: avg((r) => r.days.reduce((s, d) => s + d.time, 0) / r.days.length),
  };
}
