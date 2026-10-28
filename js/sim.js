// Simulation ganzer Läufe mit einer einfachen Kaufstrategie – für die Balance (siehe tests/balance.test.mjs).
// Annahmen über das Kind: löst Aufgaben meist richtig, kauft das Beste, was es sich leisten kann.
// Strategien: „zufall“ (Standard) kauft irgendetwas, das es sich leisten kann, würfelt bis zu dreimal neu und verkauft
// Schwaches für Besseres; „gut“ sammelt gleiche Gegenstände, setzt Siegel und Runen in die Sockel und investiert in den
// Händler; „vorsichtig“ würfelt höchstens einmal und kauft nur, was noch Platz hat oder sich verbindet.
// Händler-Vertrauen und Schmied lassen sich für den Vergleich abschalten (opts.haendler, opts.schmied, opts.wuerfelAlt).
import {
  CFG, newRun, finishBattle, rollShop, pickEnemy, makeEnemy, findSpot, bagGrid, STORE_GRID,
  growBag, attachTasche, enemyPool, shopPool, pickEncounters, pickOne, sellValue, seededRng, ARMOR_BONUS, reroll, wuerfelPreis,
  HAENDLER, haendlerStufe, vertrauenKosten, vertrauenErhoehen, STERN_FAKTOR, canPlace,
} from './logic.js';
import { buildCompounds, buildRuneLevels, isVerb, isNoun, verbTargetCell } from './grammar.js';
import { partnerOf, compoundPartner, placeNew, verbindeAlles, schmiedZiel, schmiedPreis, schmiedSperre, schmiedAufwerten } from './sterne.js';
import { playerContext, evaluateBag } from './mods.js';
import { baueBuch, entdeckungenIn } from './buch.js';
import { neuesProfil, entdecke, merkeAntwort, laufStand, laufAbschluss, rangVon } from './fortschritt.js';
import { Battle, makeFighter, runToEnd } from './battle.js';
import { begleiterDefs } from './begleiter.js';
import { waehleBrief, werteAus } from './botschaften.js';
import { karten, pruefeSatz, spruchWerte, schmiedeVerben, schmiedeStern, schmiedeOffen, SPRUCH_DEF } from './satzschmiede.js';
import { applyMod } from './mods.js';
import { istSockelTeil, kannEinsetzen, einsetzen } from './sockel.js';

export function prepareData(raw) {
  const defs = {};
  for (const d of raw.items) defs[d.id] = d;
  const compounds = buildCompounds(defs, raw.recipes);
  for (const d of compounds) defs[d.id] = d;
  for (const d of buildRuneLevels(defs)) defs[d.id] = d;
  for (const d of begleiterDefs(raw.begleiter || [])) defs[d.id] = d;
  defs[SPRUCH_DEF.id] = SPRUCH_DEF;
  return { ...raw, defs, compounds, buch: baueBuch(defs, raw.items, raw.recipes) };
}

// Spruchrolle: Werte stehen am Gegenstand
const defVon = (p, defs) => (p.spruch ? { ...defs[p.id], ...p.spruch.werte } : defs[p.id]);

// Grobe Stärke eines Items pro Sekunde (zum Einkaufen).
function worth(d) {
  if (d.art === 'siegel' || d.art === 'rune') return 0;
  if (!d.abklingzeit) return (d.tempo || 0) * 0.25 + (d.leben || 0) * 0.08 + (d.startblock || 0) * 0.08 + (d.glueck || 0) * 0.2;
  const per = (d.schaden || 0) + 0.7 * (d.block || 0) + 0.7 * (d.heilung || 0) + 2.5 * (d.gift || 0) + 1.8 * (d.brand || 0)
    + 1.5 * (d.kaelte || 0) + 6 * (d.betaeubung || 0) + 2 * (d.regeneration || 0);
  return per / d.abklingzeit;
}

// Händler-Vertrauen erhöhen mit Gold, das nach dem Einkaufen übrig ist (bis Tag 8 – danach lohnt es kaum).
const HAENDLER_RESERVE = 3;
function haendlerKaufen(run, gut = false) {
  const k = vertrauenKosten(run);
  if (k && run.day <= (gut ? 9 : 8) && run.gold >= k + (gut ? 0 : HAENDLER_RESERVE)) vertrauenErhoehen(run);
}

// Gute Strategie: Siegel und Runen aus dem Laden in den stärksten passenden Gegenstand einsetzen
function sockelKaufen(run, data, rng, skill) {
  const { defs } = data;
  const hosts = run.items.filter((p) => p.area === 'bag').sort((a, b) => worth(starDefOf(b, defs)) - worth(starDefOf(a, defs)));
  run.shop.forEach((s, i) => {
    if (!s || !istSockelTeil(defs[s.id]) || defs[s.id].preis > run.gold) return;
    const host = hosts.find((h) => kannEinsetzen(h, defs, s.id).ok && worth(starDefOf(h, defs)) > 0);
    if (!host) return;
    run.gold -= defs[s.id].preis;
    run.shop[i] = null;
    if (rng() > skill) run.gold = Math.max(0, run.gold - 1);
    einsetzen(run, host, { uid: -1, id: s.id }, defs);
  });
}
// Gute Strategie: Verb-Rollen so drehen, dass der Pfeil auf ein Nomen zeigt (Satz meist richtig gebildet)
function verbenRichten(run, defs, rng, skill) {
  const bag = run.items.filter((p) => p.area === 'bag');
  const at = (x, y) => bag.find((q) => { const d = defs[q.id], w = q.rot % 2 ? d.h : d.w, h = q.rot % 2 ? d.w : d.h; return x >= q.x && x < q.x + w && y >= q.y && y < q.y + h; });
  for (const p of bag) {
    const d = defs[p.id];
    if (!isVerb(d) || !d.formen) continue;
    const ziel = at(...Object.values(verbTargetCell(p, d)));
    if (ziel && isNoun(defs[ziel.id]) && p.satz?.uid === ziel.uid) continue;
    for (let rot = 0; rot < 4; rot++) {
      if (!canPlace(bag, defs, d, p.x, p.y, rot, bagGrid(run), [p.uid])) continue;
      const t = at(...Object.values(verbTargetCell({ ...p, rot }, d)));
      if (t && t !== p && isNoun(defs[t.id])) { p.rot = rot; p.satz = { uid: t.uid, ok: rng() < skill + 0.15 }; break; }
    }
  }
}
// Gute Strategie: Kristall gezielt links neben oder über einen Träger legen (und umgekehrt) – sofort ein Kompositum
function kompositumSpot(run, data, d) {
  const { defs, recipes } = data;
  const bag = run.items.filter((p) => p.area === 'bag');
  const grid = bagGrid(run);
  const k = recipes.komposita;
  const versuche = [];
  if (d.art === 'kraft' && k.kraefte[d.id]) {
    for (const t of bag.filter((p) => k.traeger.includes(p.id))) versuche.push({ x: t.x - 1, y: t.y }, { x: t.x, y: t.y - 1 });
  } else if (k.traeger.includes(d.id)) {
    for (const c of bag.filter((p) => defs[p.id].art === 'kraft' && k.kraefte[p.id])) versuche.push({ x: c.x + 1, y: c.y }, { x: c.x, y: c.y + 1 });
  }
  for (const v of versuche) for (const rot of d.w === d.h ? [0] : [0, 1]) if (canPlace(bag, defs, d, v.x, v.y, rot, grid)) return { ...v, rot };
  return null;
}
const starDefOf = (p, defs) => ({ ...defVon(p, defs), ...(p.stern > 1 ? { schaden: (defs[p.id].schaden || 0) * STERN_FAKTOR[p.stern], block: (defs[p.id].block || 0) * STERN_FAKTOR[p.stern], heilung: (defs[p.id].heilung || 0) * STERN_FAKTOR[p.stern] } : {}) });

// Schmied: der Gegenstand mit dem meisten Gewinn pro Gold (eine falsche erste Antwort kostet 1 Gold, wie beim Verbinden).
function schmiedNutzen(run, data, rng, skill) {
  const { defs } = data;
  const kandidaten = run.items.filter((p) => p.area === 'bag' && !schmiedSperre(run, p, defs) && worth(defs[p.id]) > 0)
    .map((p) => {
      const z = schmiedZiel(p, defs);
      return { p, nutzen: (worth(defs[p.id]) * (STERN_FAKTOR[z] - STERN_FAKTOR[z - 1])) / schmiedPreis(p, defs) };
    })
    .sort((a, b) => b.nutzen - a.nutzen);
  const best = kandidaten[0];
  if (!best) return;
  if (rng() > skill) run.gold = Math.max(0, run.gold - 1);
  schmiedAufwerten(run, best.p, defs);
}

function shop(run, data, rng, skill, opts = {}) {
  const { defs, items, regions } = data;
  const vorsichtig = opts.strategie === 'vorsichtig';
  const gut = opts.strategie === 'gut';
  const zufall = !gut && !vorsichtig;
  // Ein gleiches besitzt man schon: Kaufen verbindet sofort (braucht keinen Platz, spart sogar welchen).
  // Die gute Strategie sammelt gezielt; die Zufallsstrategie kauft irgendetwas Bezahlbares.
  const value = (d) => (zufall ? rng() : worth(d) * (partnerOf(run.items, defs, { uid: -1, id: d.id }) ? (gut ? 2.5 : 1.3) : 1)
    * (gut && compoundPartner(d, run.items.filter((p) => p.area === 'bag'), defs, data.recipes) ? 2 : 1));
  for (let round = 0; round < 3; round++) {
    if (gut) sockelKaufen(run, data, rng, skill);
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
        let spot = (gut && kompositumSpot(run, data, o.d)) || findSpot(bag, defs, o.d, bagGrid(run));
        if (!spot && (vorsichtig || zufall)) continue;
        if (!spot) {
          // Rucksack voll: schwächstes Item verkaufen, wenn das neue besser ist
          const weakest = bag.filter((p) => !p.fluch).sort((a, b) => worth(defVon(a, defs)) - worth(defVon(b, defs)))[0];
          if (!weakest || worth(defVon(weakest, defs)) * (gut ? 1.1 : 1.3) >= worth(o.d)) continue;
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
    if (gut) verbenRichten(run, defs, rng, skill);
    if (opts.schmied !== false && !zufall) schmiedNutzen(run, data, rng, skill);
    if (opts.haendler !== false && !zufall) haendlerKaufen(run, gut);
    if ((vorsichtig || zufall) && round > 0) break;
    if (run.gold >= wuerfelPreis(run) + 3) {
      reroll(run, items, regions, rng);
      run.wuerfeTag = (run.wuerfeTag || 0) + 1;
      if (opts.wuerfelAlt) { run.gold += wuerfelPreis(run) - 1; run.wuerfe = 0; } // bisher: jeder Wurf 1 Gold
    } else break;
  }
}

// Zwei gleiche sofort verbinden, auch als Kette (eine falsche erste Antwort kostet 1 Gold).
// Gleich beim ersten Versuch richtig: Das neue Item glänzt (+10 % im nächsten Kampf), wie im Spiel.
function verbinde(run, data, rng, skill, p) {
  if (!p) return;
  let erster = true;
  const log = verbindeAlles(run, data.defs, data.recipes, [{ uid: p.uid, paar: true }], (a, q) => {
    if (!q) return 'richtig';
    erster = rng() <= skill;
    if (!erster) { run.gold = Math.max(0, run.gold - 1); merkeAntwort(run, q.art, false); }
    merkeAntwort(run, q.art, true, erster);
    return 'richtig';
  });
  const letzt = log.at(-1) && run.items.find((q) => q.uid === log.at(-1).uid);
  if (letzt && erster) letzt.glanz = 1;
}

function morning(run, data, rng, skill, opts = {}) {
  const { defs } = data;
  for (const step of run.queue) {
    if (step === 'unterklasse') {
      const h = data.heroes.find((x) => x.id === run.hero);
      run.unterklasse = pickOne(h.unterklassen, rng).id;
    }
    // Brief: jede Frage mit der Wahrscheinlichkeit skill richtig; Belohnungen wie im Spiel
    if (step === 'brief' && data.botschaften?.length) {
      const brief = waehleBrief(data.botschaften, { gebiet: data.regions.find((g) => run.day >= g.tage[0] && run.day <= g.tage[1]).id, stufe: 1, gelesen: run.gelesen || [], rng });
      if (brief) {
        run.gelesen = [...(run.gelesen || []), brief.id];
        const r = werteAus(brief, brief.fragen.map((q) => (rng() < skill ? q.richtig : null)));
        for (const b of r.belohnungen) {
          merkeAntwort(run, 'lesen', r.alleRichtig, true);
          if (b.typ === 'gold') run.gold += b.menge;
          else verbinde(run, data, rng, skill, placeNew(run, defs, b.id));
        }
      }
    }
    // Satzschmiede statt Begegnung (opts.satzschmiede, Stufe 1–3; 3 Gold): Figur + Prädikat, ab Stufe 2 mit Objekt,
    // ab Stufe 3 mit Zeit-Adverbiale und Umstellprobe. Mit Wahrscheinlichkeit skill gelingt der Satz.
    const daten = data.satzschmiede;
    if (step === 'begegnung' && daten && data.wortschatz && opts.satzschmiede && schmiedeOffen(run, daten) && run.gold >= daten.besuch.preis) {
      run.gold -= daten.besuch.preis;
      run.satzschmiedeTag = run.day;
      run.satzschmiedeBesuche = (run.satzschmiedeBesuche || 0) + 1;
      if (rng() >= skill) continue;
      const stufe = opts.satzschmiede;
      const inf = pickOne(schmiedeVerben(run, defs, daten), rng);
      const pool = karten({ daten, ws: data.wortschatz, figur: { kurz: 'Figur' }, verben: [inf], stufe });
      const v = data.wortschatz.verben.find((x) => x.infinitiv === inf);
      const leiste = [pool.find((k) => k.wer === 'figur'), pool.find((k) => k.glied === 'praedikat' && k.text === v.praesens.er)];
      if (stufe >= 2) leiste.push(pool.find((k) => k.glied === 'objekt' && !k.falsch));
      if (stufe >= 3) leiste.push(pool.find((k) => k.glied === 'zeit' && k.text === 'am Ende des Kampfes'));
      const r = pruefeSatz(leiste.filter(Boolean), { daten, ws: data.wortschatz });
      if (r.gueltig) {
        const w = spruchWerte(r, { daten, verbDef: defs[daten.verben[inf].item], stern: schmiedeStern(run, defs, inf, daten), applyMod, umgestellt: stufe >= 3 });
        placeNew(run, defs, 'spruchrolle', null, { spruch: { satz: r.satz, werte: w.werte, zeilen: w.zeilen }, stern: w.stufe });
        run.gold += 2; // Lohn für die Bestellung
      }
      continue;
    }
    if (step === 'begegnung') {
      // Die gute Strategie wählt die Begegnung mit der besten Belohnung (Rucksack-Feld vor Item, Rabatt, Gold)
      const wahl = pickEncounters(run, data.encounters, data.regions, rng);
      const rangOf = (eid) => ['feld', 'item', 'mod', 'rabatt', 'gold', 'kobold'].indexOf(data.encounters.begegnungen.find((b) => b.id === eid).belohnung.typ);
      const id = opts.strategie === 'gut' ? [...wahl].sort((a, b) => rangOf(a) - rangOf(b))[0] : pickOne(wahl, rng);
      const enc = data.encounters.begegnungen.find((b) => b.id === id);
      const ok = rng() < skill;
      if (!ok) run.gold = Math.max(0, run.gold - 1);
      // Aufgaben der Begegnung: bei „ok“ alle gleich richtig, sonst eine mit Fehler
      const n = enc.aufgabe ? enc.aufgabe.anzahl || 1 : 0;
      for (let i = 0; i < n; i++) merkeAntwort(run, 'mehrzahl', ok || i > 0, ok || i > 0);
      if (n && !ok) merkeAntwort(run, 'mehrzahl', false);
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
  // Die gute Strategie löst auch die Aufgaben sicherer (Rüstungsfehler, Verbinden ohne Fehlversuch)
  const skill = opts.skill ?? (opts.strategie === 'gut' ? 0.95 : 0.75);
  const hero = pickOne(data.heroes, rng);
  // Begleiter: zufällig (ohne begleiter.json im Datensatz keiner)
  const begleiter = data.begleiter?.length ? data.defs['begleiter-' + pickOne(data.begleiter, rng).id] : null;
  const run = newRun(data.items, data.regions, { hero, fates: data.fates, rng, begleiter });
  const ctxData = { heroes: data.heroes, fates: data.fates, begleiter: data.begleiter };
  const days = [];
  while (!run.over) {
    morning(run, data, rng, skill, opts);
    run.wuerfeTag = 0;
    shop(run, data, rng, skill, opts);
    const ctx = playerContext(run, ctxData);
    const bag = run.items.filter((p) => p.area === 'bag');
    const player = makeFighter('p', bag, data.defs, run.day, {
      info: evaluateBag(bag, data.defs, ctx), leben: ctx.leben, tempo: ctx.tempo, selbstschaden: ctx.selbstschaden, rng,
      ersterAngriffDoppelt: ctx.ersterAngriffDoppelt,
    });
    const foeDef = pickEnemy(run.day, data.regions, data.enemies, rng);
    const enemy = makeEnemy(run.day, foeDef, enemyPool(data.items, data.compounds, run.day), data.defs, rng);
    const armor = rng() < skill;
    merkeAntwort(run, 'rechtschreibung', armor, true);
    if (armor) laufStand(run).orkFehler++;
    if (opts.profil) laufStand(run).neu.push(...entdecke(opts.profil, entdeckungenIn(run, data.defs, data.buch)));
    const f = enemy.faehigkeit;
    const faehigkeit = f ? (f.typ === 'wolf' ? { ...f, schaden: Math.round(f.schaden + (f.schadenProTag || 0) * run.day) } : { ...f }) : null;
    const foe = makeFighter('e', enemy.items, data.defs, run.day, { startHp: armor ? 1 - ARMOR_BONUS : 1, rng, klug: enemy.klug, faehigkeit });
    const battle = new Battle(player, foe);
    const won = runToEnd(battle) === 'win';
    days.push({ day: run.day, won, time: battle.time, boss: !!foeDef.boss,
      gold: run.gold, haendler: haendlerStufe(run), schmied: run.schmiedTag === run.day ? 1 : 0, wuerfe: run.wuerfeTag || 0 });
    finishBattle(run, data.items, data.regions, won, enemy.name, rng);
  }
  const abschluss = opts.profil && data.achievements ? laufAbschluss(opts.profil, run, data) : null;
  return { wins: run.wins, won: run.over === 'won', days, abschluss };
}

// Geschätzte Spielzeit: Kampf in 1×-Tempo plus Zeit für Laden und Morgen (Annahmen in Sekunden).
export const ZEIT = { laden: 45, morgen: 25, kampfExtra: 8 };
export function estimateMinutes(days) {
  return days.reduce((s, d) => s + d.time + ZEIT.kampfExtra + ZEIT.laden + (d.day > 1 ? ZEIT.morgen : 0), 0) / 60;
}

// Viele Läufe nacheinander mit demselben Profil: Wann steigt man in welchen Rang auf?
// Ergebnis: Rang-Nummer nach jedem Lauf und die Erfahrung.
export function simulateCareer(data, n, seed = 1, opts = {}) {
  const profil = neuesProfil();
  const raenge = [];
  for (let i = 0; i < n; i++) {
    simulateRun(data, seededRng(seed + i * 7919), { ...opts, profil });
    raenge.push(rangVon(profil.xp, data.achievements.raenge).nr);
  }
  return { raenge, xp: profil.xp, buch: profil.buch.length };
}

export function simulateMany(data, n, seed = 1, opts = {}) {
  const results = [];
  for (let i = 0; i < n; i++) results.push(simulateRun(data, seededRng(seed + i), opts));
  return results;
}

export function summarize(results) {
  const perDay = {};
  for (const r of results) for (const d of r.days) {
    perDay[d.day] ||= { kaempfe: 0, siege: 0, gold: 0, haendler: 0, schmied: 0, wuerfe: 0 };
    const t = perDay[d.day];
    t.kaempfe++;
    if (d.won) t.siege++;
    t.gold += d.gold || 0; t.haendler += d.haendler || 1; t.schmied += d.schmied || 0; t.wuerfe += d.wuerfe || 0;
  }
  const jeTag = (k, stellen = 1) => Object.fromEntries(Object.entries(perDay).map(([d, v]) => [d, +(v[k] / v.kaempfe).toFixed(stellen)]));
  const avg = (f) => results.reduce((s, r) => s + f(r), 0) / results.length;
  return {
    siegquoteProTag: Object.fromEntries(Object.entries(perDay).map(([d, v]) => [d, Math.round((100 * v.siege) / v.kaempfe)])),
    erreichtProTag: Object.fromEntries(Object.entries(perDay).map(([d, v]) => [d, Math.round((100 * v.kaempfe) / results.length)])),
    goldProTag: jeTag('gold'),          // ungenutztes Gold am Tagesende (vor dem Kampf)
    haendlerProTag: jeTag('haendler'),  // durchschnittliche Händler-Stufe
    schmiedProTag: jeTag('schmied', 2), // Anteil der Läufe, die an diesem Tag den Schmied nutzen
    wuerfeProTag: jeTag('wuerfe'),      // Würfe pro Tag
    siegeDurchschnitt: avg((r) => r.wins),
    // Reise geschafft: bis zum Ende durchgehalten und den Endboss besiegt
    reiseGeschafft: Math.round(100 * avg((r) => (r.won && r.days.at(-1)?.won ? 1 : 0))),
    minutenDurchschnitt: avg((r) => estimateMinutes(r.days)),
    kampfSekunden: avg((r) => r.days.reduce((s, d) => s + d.time, 0) / r.days.length),
  };
}
