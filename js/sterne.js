// Sammeln und Aufwerten: Drei gleiche Gegenstände (gleiche id, gleiche Sternstufe) werden sofort zu
// einem der nächsten Stufe – Rucksack und Lager zählen zusammen. Vorher eine Grammatik-Frage:
// Nomen → Mehrzahl, Verben → Präteritum, Adjektiv-Runen → Steigerung.
import { MAX_STERN, sternOf, bagGrid, STORE_GRID, canPlace, findSpot, shuffle } from './logic.js';
import { isRune, runeBase, nextLevelId } from './grammar.js';

const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

// Kann ein Item aus dem Laden mit etwas im Rucksack ein Kompositum bilden? → Kompositum-id oder null.
export function compoundPartner(def, bag, defs, recipes) {
  const k = recipes.komposita;
  if (def.art === 'kraft' && k.kraefte[def.id]) {
    const t = bag.find((p) => k.traeger.includes(p.id));
    return t ? { id: `${def.id}+${t.id}`, mit: defs[t.id] } : null;
  }
  if (k.traeger.includes(def.id)) {
    const c = bag.find((p) => defs[p.id].art === 'kraft' && k.kraefte[p.id]);
    return c ? { id: `${c.id}+${def.id}`, mit: defs[c.id] } : null;
  }
  return null;
}

// Kann dieser Gegenstand durch drei gleiche aufsteigen?
export function canMerge(def, stern = 1) {
  if (def.art === 'siegel' || def.art === 'tasche') return false;
  if (isRune(def)) return !!def.steigerung && (def.stufe || 1) < 3;
  return stern < MAX_STERN;
}

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

// Alle Dreiergruppen im Besitz (Rucksack + Lager). Der neue Gegenstand kommt an die Stelle des zuletzt hinzugekommenen.
export function findTriples(items, defs) {
  const groups = new Map();
  for (const p of items) {
    const d = defs[p.id];
    if (!d || !canMerge(d, sternOf(p))) continue;
    const key = isRune(d) ? p.id : `${p.id}|${sternOf(p)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  const out = [];
  for (const list of groups.values()) {
    if (list.length < 3) continue;
    const three = [...list].sort((a, b) => b.uid - a.uid).slice(0, 3);
    const d = defs[three[0].id];
    out.push({
      teile: three,
      ziel: three[0],
      typ: isRune(d) ? 'rune' : d.art === 'verb' ? 'verb' : 'nomen',
      neu: isRune(d) ? { id: nextLevelId(d) } : { id: three[0].id, stern: sternOf(three[0]) + 1 },
    });
  }
  return out;
}

const hasNewUmlaut = (sg, pl) => [...'äöüÄÖÜ'].some((u) => pl.includes(u) && !sg.includes(u));

// Die Frage vor dem Verschmelzen: { titel, prompt, options, correct, explain }.
export function mergeQuestion(group, defs) {
  const d = defs[group.ziel.id];
  if (group.typ === 'rune') {
    const base = defs[runeBase(d)], to = defs[group.neu.id], st = base.steigerung;
    const sup = to.stufe === 3;
    return {
      titel: sup ? 'Superlativ (höchste Stufe)' : 'Komparativ (Vergleichsstufe)',
      prompt: `${d.name} → <span class="blank">___</span>`,
      options: shuffle([to.name, ...(sup ? st.falschS : st.falschK)]),
      correct: to.name,
      explain: `${base.name} → ${st.komparativ} → ${st.superlativ}${st.unregelmaessig ? ' – eine unregelmäßige Steigerung!' : ''}`,
    };
  }
  if (group.typ === 'verb') {
    const f = d.formen;
    return {
      titel: 'Präteritum (so erzählt man, was gestern war)',
      prompt: `Gestern <span class="blank">___</span> der Ritter. <small>(${d.name})</small>`,
      options: shuffle([f.praeteritum, ...f.falschPraeteritum]),
      correct: f.praeteritum,
      explain: `${d.name} → er ${f.praeteritum}. Im Präteritum erzählt man, was schon passiert ist.`,
    };
  }
  const pl = pluralOf(d, defs);
  const art = d.artikel;
  const einzahl = pl.einzahl;
  let explain;
  if (pl.richtig === einzahl) explain = `Manche Nomen sehen in der Mehrzahl genauso aus: ${art} ${einzahl} → die ${pl.richtig}.`;
  else if (hasNewUmlaut(einzahl, pl.richtig)) explain = `Viele Nomen bekommen in der Mehrzahl einen Umlaut: ${art} ${einzahl} → die ${pl.richtig}.`;
  else explain = `Die Mehrzahl von „${art} ${einzahl}“ heißt „die ${pl.richtig}“.`;
  if (pl.grund) explain += ' Bei zusammengesetzten Wörtern ändert sich nur das letzte Wort.';
  return {
    titel: 'Mehrzahl',
    prompt: `${art} ${einzahl} + ${art} ${einzahl} + ${art} ${einzahl} = die <span class="blank">___</span>`,
    options: shuffle([pl.richtig, ...pl.falsch]),
    correct: pl.richtig,
    explain,
  };
}

// Führt die Verschmelzung aus. Der neue Gegenstand liegt dort, wo der zuletzt hinzugekommene lag;
// passt er nicht (z. B. weil er dort anders gedreht wäre), kommt er ins Lager.
export function applyMerge(run, group, defs) {
  const z = group.ziel;
  const gone = new Set(group.teile.map((p) => p.uid));
  run.items = run.items.filter((p) => !gone.has(p.uid));
  const p = { uid: run.nextUid++, id: group.neu.id, area: z.area, x: z.x, y: z.y, rot: z.rot || 0 };
  if (group.neu.stern && group.neu.stern > 1) p.stern = group.neu.stern;
  const grid = z.area === 'bag' ? bagGrid(run) : STORE_GRID;
  const same = run.items.filter((i) => i.area === z.area);
  if (!canPlace(same, defs, defs[p.id], p.x, p.y, p.rot, grid)) {
    const inStore = findSpot(run.items.filter((i) => i.area === 'store'), defs, defs[p.id], STORE_GRID);
    const inBag = !inStore && findSpot(run.items.filter((i) => i.area === 'bag'), defs, defs[p.id], bagGrid(run));
    if (!inStore && !inBag) { run.items.push(...group.teile); return null; }
    Object.assign(p, inStore || inBag, { area: inStore ? 'store' : 'bag' });
  }
  run.items.push(p);
  return p;
}
