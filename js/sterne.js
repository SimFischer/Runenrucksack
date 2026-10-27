// Verbinden wie in Backpack Rush – alles passiert SOFORT:
// - Zwei gleiche Gegenstände (gleiche id, gleiche Sternstufe) werden zu einem der nächsten Stufe – beim Kaufen,
//   beim Ablegen direkt auf ein gleiches Item und bei Belohnungen. Das neue Item liegt dort, wo das schon
//   vorhandene lag; gibt es dazu wieder ein gleiches, geht es weiter (Kette).
// - Ein Kraft-Kristall direkt links neben oder über einem Träger wird mit ihm zum Kompositum.
// Vorher eine Grammatik-Frage: Kompositum → Artikel, Nomen → Mehrzahl, Verben → Präteritum, Runen → Steigerung.
import { MAX_STERN, sternOf, bagGrid, STORE_GRID, findSpot, shuffle } from './logic.js';
import { isRune, runeBase, nextLevelId, pluralOf, findFusions } from './grammar.js';

export { pluralOf };

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

// Kann dieser Gegenstand durch ein gleiches aufsteigen? Siegel und Taschen verbinden sich nie.
export function canMerge(def, stern = 1) {
  if (!def || def.art === 'siegel' || def.art === 'tasche') return false;
  if (isRune(def)) return !!def.steigerung && !!nextLevelId(def);
  return stern < MAX_STERN;
}

// Gleich = gleiche id und gleiche Stufe. Feueraxt und Eisaxt haben verschiedene ids und passen nicht.
export const sameKind = (a, b) => a.id === b.id && sternOf(a) === sternOf(b);

// Ein gleiches Item zum Verbinden (Rucksack vor Lager, ältestes zuerst) oder null.
export function partnerOf(items, defs, p) {
  if (!canMerge(defs[p.id], sternOf(p))) return null;
  const order = { bag: 0, store: 1 };
  return items
    .filter((q) => q.uid !== p.uid && q.area !== 'neu' && sameKind(q, p))
    .sort((a, b) => order[a.area] - order[b.area] || a.uid - b.uid)[0] || null;
}

// Neues Item (Kauf, Belohnung, Geschenk) ablegen: an der Wunschstelle, sonst im Rucksack, sonst im Lager.
// Ist nirgends Platz, gibt es aber ein gleiches zum Verbinden, wartet es im Bereich „neu“ (unsichtbar).
// Gibt das Item zurück oder null, wenn es nirgends hinpasst.
export function placeNew(run, defs, id, wunsch = null, extra = {}) {
  const p = { uid: run.nextUid++, id, rot: 0, ...extra };
  if (wunsch) Object.assign(p, wunsch);
  else {
    for (const [area, grid] of [['bag', bagGrid(run)], ['store', STORE_GRID]]) {
      const spot = findSpot(run.items.filter((q) => q.area === area), defs, defs[id], grid);
      if (spot) { Object.assign(p, { area, ...spot }); break; }
    }
    if (!p.area) {
      if (!partnerOf(run.items, defs, p)) return null;
      Object.assign(p, { area: 'neu', x: 0, y: 0 });
    }
  }
  run.items.push(p);
  return p;
}

// Ein Item, das im Bereich „neu“ wartet, doch noch irgendwo ablegen (z. B. nach „Nicht verbinden“).
export function placeWaiting(run, defs, p) {
  if (p.area !== 'neu') return true;
  for (const [area, grid] of [['bag', bagGrid(run)], ['store', STORE_GRID]]) {
    const spot = findSpot(run.items.filter((q) => q.area === area), defs, defs[p.id], grid);
    if (spot) { Object.assign(p, { area, ...spot }); return true; }
  }
  return false;
}

// Verbindet neu + alt. Das Ergebnis liegt dort, wo das schon vorhandene (alt) lag.
export function mergePair(run, neu, alt, defs) {
  const d = defs[alt.id];
  run.items = run.items.filter((p) => p.uid !== neu.uid && p.uid !== alt.uid);
  const p = { uid: run.nextUid++, id: isRune(d) ? nextLevelId(d) : alt.id, area: alt.area, x: alt.x, y: alt.y, rot: alt.rot || 0 };
  if (!isRune(d)) p.stern = sternOf(alt) + 1;
  const ks = Math.max(alt.kraftStern || 1, neu.kraftStern || 1); // Komposita: der stärkere Kristall bleibt
  if (ks > 1) p.kraftStern = ks;
  const fluch = alt.fluch || neu.fluch; // ein Fluch verschwindet nicht durch Verbinden
  if (fluch) p.fluch = fluch;
  // Verb-Rollen: Eine aufgewertete Rolle behält ihren Satz; zeigte eine Rolle auf eines der beiden Teile,
  // zeigt ihr Satz jetzt auf das neue Item – so kommt nach dem Aufwerten keine neue Frage.
  const satz = alt.satz || neu.satz;
  if (satz) p.satz = satz;
  for (const q of run.items) if (q.satz && (q.satz.uid === neu.uid || q.satz.uid === alt.uid)) q.satz = { ...q.satz, uid: p.uid };
  run.items.push(p);
  return p;
}

// Kristall + Träger → Kompositum. Es behält Platz und Sternstufe des Trägers; ein höherstufiger Kristall
// gibt eine stärkere Kraftwirkung (kraftStern).
export function applyFusion(run, a) {
  run.items = run.items.filter((p) => p.uid !== a.kraft.uid);
  const t = a.traeger;
  t.id = a.id;
  const ks = sternOf(a.kraft);
  if (ks > 1) t.kraftStern = Math.max(ks, t.kraftStern || 1);
  return t;
}

// Die nächste Verbindung für eine Prüfung { uid, paar, mit }:
// paar = nach einem gleichen Item suchen (bei neuen Items), mit = genau dieses Item (Ablegen auf ein gleiches).
// Danach: Liegt das Item als Kristall links neben / über einem Träger (oder umgekehrt)? → Kompositum.
export function findeVerbindung(run, defs, recipes, check) {
  const p = run.items.find((q) => q.uid === check.uid);
  if (!p) return null;
  if (check.paar || check.mit) {
    const alt = check.mit
      ? run.items.find((q) => q.uid === check.mit && q.uid !== p.uid && sameKind(q, p) && canMerge(defs[q.id], sternOf(q)))
      : partnerOf(run.items, defs, p);
    if (alt) return { typ: 'paar', neu: p, alt };
  }
  if (p.area === 'bag' && recipes) {
    const f = findFusions(run.items.filter((q) => q.area === 'bag'), defs, recipes)
      .find((x) => x.kraft.uid === p.uid || x.traeger.uid === p.uid);
    if (f) return { typ: 'kompositum', kraft: f.kraft, traeger: f.traeger, id: f.id };
  }
  return null;
}

export function fuehreAus(run, a, defs) {
  return a.typ === 'kompositum' ? applyFusion(run, a) : mergePair(run, a.neu, a.alt, defs);
}

const hasNewUmlaut = (sg, pl) => [...'äöüÄÖÜ'].some((u) => pl.includes(u) && !sg.includes(u));
const blank = '<span class="blank">___</span>';

// Die Frage vor dem Verbinden: { art, wort, titel, prompt, options, correct, explain, kurz } –
// oder null, wenn keine Frage nötig ist (Superlativ → Krone).
export function frageFuer(a, defs, rng = Math.random) {
  if (a.typ === 'kompositum') {
    const kd = defs[a.kraft.id], td = defs[a.traeger.id], cd = defs[a.id];
    return {
      art: 'artikel', wort: cd.name, ref: cd.id, genus: true,
      titel: `${kd.name} + ${td.name}`,
      prompt: `${blank} ${cd.name}`,
      options: ['der', 'die', 'das'],
      correct: cd.artikel,
      explain: `Das letzte Wort bestimmt den Artikel: ${td.artikel} ${td.name} → ${cd.artikel} ${cd.name}.`,
      kurz: `${cd.artikel} ${cd.name} ✓`,
    };
  }
  const d = defs[a.alt.id];
  if (isRune(d)) {
    const base = defs[runeBase(d)], to = defs[nextLevelId(d)], st = base.steigerung;
    if (to.stufe > 3) return null;
    const sup = to.stufe === 3;
    return {
      art: 'steigerung', wort: to.name, ref: to.id,
      titel: sup ? 'Superlativ (höchste Stufe)' : 'Komparativ (Vergleichsstufe)',
      prompt: `${d.name} → ${blank}`,
      options: shuffle([to.name, ...(sup ? st.falschS : st.falschK)], rng),
      correct: to.name,
      explain: `${base.name} → ${st.komparativ} → ${st.superlativ}${st.unregelmaessig ? ' – eine unregelmäßige Steigerung!' : ''}`,
      kurz: `${to.name} ✓`,
    };
  }
  if (d.art === 'verb') {
    const f = d.formen;
    return {
      art: 'praeteritum', wort: d.name, ref: d.id,
      titel: 'Präteritum (so erzählt man, was gestern war)',
      prompt: `Gestern ${blank} der Ritter. <small>(${d.name})</small>`,
      options: shuffle([f.praeteritum, ...f.falschPraeteritum], rng),
      correct: f.praeteritum,
      explain: `${d.name} → er ${f.praeteritum}. Im Präteritum erzählt man, was schon passiert ist.`,
      kurz: `gestern ${f.praeteritum} ✓`,
    };
  }
  const pl = pluralOf(d, defs);
  const art = d.artikel, einzahl = pl.einzahl;
  let explain;
  if (pl.richtig === einzahl) explain = `Manche Nomen sehen in der Mehrzahl genauso aus: ${art} ${einzahl} → die ${pl.richtig}.`;
  else if (hasNewUmlaut(einzahl, pl.richtig)) explain = `Viele Nomen bekommen in der Mehrzahl einen Umlaut: ${art} ${einzahl} → die ${pl.richtig}.`;
  else explain = `Die Mehrzahl von „${art} ${einzahl}“ heißt „die ${pl.richtig}“.`;
  if (pl.grund) explain += ' Bei zusammengesetzten Wörtern ändert sich nur das letzte Wort.';
  return {
    art: 'mehrzahl', wort: einzahl, ref: d.id,
    titel: 'Mehrzahl',
    prompt: `${art} ${einzahl} + ${art} ${einzahl} = zwei ${blank}`,
    options: shuffle([pl.richtig, ...pl.falsch], rng),
    correct: pl.richtig,
    explain,
    kurz: `die ${pl.richtig} ✓`,
  };
}

// „Nicht verbinden“: Das neue Item bleibt, wo es liegt. Wartete es (kein Platz, auf ein gleiches gezogen),
// kommt es in Rucksack oder Lager. Gibt false zurück, wenn es nirgends hinpasst – dann muss es weg
// (beim Kauf: Gold zurück).
export function nichtVerbinden(run, defs, a) {
  if (a.typ !== 'paar' || a.neu.area !== 'neu') return true;
  if (placeWaiting(run, defs, a.neu)) return true;
  run.items = run.items.filter((p) => p !== a.neu);
  return false;
}

// Löst alle Verbindungen auf, die von den Prüfungen ausgehen (ohne Darstellung: Simulation und Tests).
// antwort(aktion, frage) → 'richtig' (verbinden) oder 'nein' (nicht verbinden). Gibt die Ergebnisse zurück.
export function verbindeAlles(run, defs, recipes, checks, antwort = () => 'richtig') {
  const queue = [...checks];
  const log = [];
  for (let guard = 0; queue.length && guard < 50; guard++) {
    const c = queue.shift();
    const a = findeVerbindung(run, defs, recipes, c);
    if (!a) continue;
    if (antwort(a, frageFuer(a, defs)) !== 'richtig') {
      // nicht verbunden – liegt das Item vielleicht neben einem Träger?
      if (nichtVerbinden(run, defs, a) && a.typ === 'paar') queue.unshift({ uid: a.neu.uid });
      continue;
    }
    const p = fuehreAus(run, a, defs);
    log.push({ typ: a.typ, id: p.id, stern: sternOf(p), uid: p.uid });
    queue.unshift({ uid: p.uid, paar: true }); // Kette: gibt es wieder ein gleiches (oder einen Träger)?
  }
  return log;
}
