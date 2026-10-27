// Offline: Jede Skript-Datei und jede Datendatei, die das Spiel lädt, steht in der Liste des Service Workers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const datei = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const SW = datei('sw.js');
const liste = new Set([...SW.matchAll(/^\s+'([^']+)',?$/gm)].map((m) => m[1]));

function jsDateien(ordner) {
  return readdirSync(new URL('../' + ordner, import.meta.url), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? jsDateien(`${ordner}/${e.name}`) : e.name.endsWith('.js') ? [`${ordner}/${e.name}`] : []);
}

test('Service Worker kennt alle Skripte und Daten', () => {
  // js/sim.js gehört nur zu den Tests (Balance-Simulation), nicht ins Spiel
  const fehlt = jsDateien('js').filter((f) => f !== 'js/sim.js' && !liste.has(f));
  const daten = [...datei('js/state.js').matchAll(/get\('([^']+\.json)'\)/g)].map((m) => m[1]);
  fehlt.push(...daten.filter((f) => !liste.has(f)));
  assert.deepEqual(fehlt, [], 'in sw.js ergänzen und CACHE erhöhen');
});

test('Service Worker kennt Oberflächen-Bilder, Schriften und Stylesheets – aber nicht die Rohbilder', () => {
  const alle = (ordner) => readdirSync(new URL('../' + ordner, import.meta.url), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? alle(`${ordner}/${e.name}`) : [`${ordner}/${e.name}`]);
  const noetig = [
    ...alle('assets/ui').filter((f) => f.endsWith('.webp')),
    ...alle('schrift').filter((f) => /\.(woff2|css)$/.test(f)),
    ...[...datei('index.html').matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]),
  ];
  assert.deepEqual(noetig.filter((f) => !liste.has(f)), [], 'in sw.js ergänzen und CACHE erhöhen');
  assert.ok(![...liste].some((f) => f.includes('assets/roh/')), 'Rohbilder gehören nicht in den Service Worker');
});
