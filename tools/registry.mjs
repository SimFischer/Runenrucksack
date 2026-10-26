// Feste Nummern für Helden- und Reisecodes: registry.json aktualisieren.
// Neue Inhalte (Items, Figuren, Erfolge, Buch-Einträge …) werden NUR HINTEN angehängt – nie umnummerieren
// und nie etwas löschen, sonst passen alte Codes nicht mehr.
//
//   node tools/registry.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { buildCompounds, buildRuneLevels } from '../js/grammar.js';
import { baueBuch } from '../js/buch.js';
import { alleIds } from '../js/code.js';

const json = (f) => JSON.parse(readFileSync(f, 'utf8'));

export function aktuelleIds() {
  const items = json('items.json').items;
  const recipes = json('recipes.json');
  const defs = Object.fromEntries(items.map((d) => [d.id, d]));
  for (const d of buildCompounds(defs, recipes)) defs[d.id] = d;
  for (const d of buildRuneLevels(defs)) defs[d.id] = d;
  const H = json('heroes.json');
  return alleIds({
    defs, buch: baueBuch(defs, items, recipes), heroes: H.helden, fates: H.schicksalsrunen,
    achievements: json('achievements.json'), encounters: json('encounters.json'),
  });
}

if (process.argv[1]?.endsWith('registry.mjs')) {
  const alt = existsSync('registry.json') ? json('registry.json') : { eintraege: [] };
  const da = new Set(alt.eintraege);
  const neu = aktuelleIds().filter((id) => !da.has(id));
  const reg = {
    _hinweis: 'Feste Nummern für Helden- und Reisecodes: Nummer = Position in der Liste (ab 1). Neue Einträge nur hinten anhängen (node tools/registry.mjs), nie umsortieren oder löschen – sonst passen alte Codes nicht mehr.',
    eintraege: [...alt.eintraege, ...neu],
  };
  writeFileSync('registry.json', JSON.stringify(reg, null, 1).replace(/\n {2,}/g, '\n  ') + '\n');
  console.log(`registry.json: ${reg.eintraege.length} Einträge (${neu.length} neu angehängt)`);
}
