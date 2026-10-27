// Oberfläche: keine Emojis in index.html, in den Skripten und in den Tutorial-Texten – Symbole kommen als Bilder
// aus assets/ui/. Ausnahme: der Ersatz für fehlende Item-Bilder (Klasse emoji-ersatz in js/ui.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const url = (f) => new URL('../' + f, import.meta.url);
const lesen = (f) => readFileSync(url(f), 'utf8');
function jsDateien(ordner) {
  return readdirSync(url(ordner), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? (e.name === 'vendor' ? [] : jsDateien(`${ordner}/${e.name}`)) : e.name.endsWith('.js') ? [`${ordner}/${e.name}`] : []);
}
const EMOJI = /\p{Extended_Pictographic}/u;

test('Keine Emojis in index.html, den Skripten und tutorial.json', () => {
  const funde = [];
  // encounters.json: Texte werden angezeigt (das Datenfeld "emoji" nicht)
  for (const f of ['index.html', 'tutorial.json', 'encounters.json', ...jsDateien('js')]) {
    lesen(f).split(/\r?\n/).forEach((zeile, i) => {
      if (EMOJI.test(zeile) && !zeile.includes('emoji-ersatz') && !/"emoji":/.test(zeile)) funde.push(`${f}:${i + 1}: ${zeile.trim().slice(0, 80)}`);
    });
  }
  assert.deepEqual(funde, []);
});

test('Emoji-Felder aus den Daten werden nur als Ersatz für fehlende Item-Bilder angezeigt', () => {
  const funde = [];
  for (const f of jsDateien('js')) {
    lesen(f).split(/\r?\n/).forEach((zeile, i) => {
      if (/\.emoji\b/.test(zeile) && !zeile.includes('emoji-ersatz') && !zeile.trim().startsWith('//')) funde.push(`${f}:${i + 1}: ${zeile.trim().slice(0, 80)}`);
    });
  }
  assert.deepEqual(funde, []);
});

test('Alle Symbole, Fenwick-Posen und Schriften liegen im Projekt', () => {
  const sym = lesen('js/symbole.js');
  for (const [, pfad] of sym.matchAll(/'((?:symbole|zustand)\/[a-z-]+)'/g)) assert.ok(existsSync(url(`assets/ui/${pfad}.webp`)), pfad);
  for (const p of ['erklaert', 'tipp', 'jubelt']) assert.ok(existsSync(url(`assets/ui/fenwick/${p}.webp`)), p);
  for (const s of ['andika-400', 'andika-700', 'cinzel-700', 'cinzel-900']) assert.ok(existsSync(url(`schrift/${s}.woff2`)), s);
  for (const l of ['OFL-Andika.txt', 'OFL-Cinzel.txt']) assert.match(lesen(`schrift/${l}`), /SIL Open Font License/);
  // Schriften lokal: keine Verbindung zu Google oder anderen Servern
  for (const f of ['index.html', 'style.css', 'gestaltung.css', 'schrift/schrift.css']) assert.ok(!/fonts\.googleapis|fonts\.gstatic|https?:\/\//.test(lesen(f).replace(/<!--[\s\S]*?-->/g, '')), f);
});
