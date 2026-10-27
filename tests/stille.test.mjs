// Keine Töne: kein Web Audio, keine Sprachausgabe, keine Audio-Dateien, kein Klang-Schalter.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const url = (f) => new URL('../' + f, import.meta.url);
function dateien(ordner) {
  return readdirSync(url(ordner), { withFileTypes: true }).flatMap((e) => {
    const p = `${ordner}/${e.name}`;
    if (e.isDirectory()) return p.endsWith('vendor') ? [] : dateien(p);
    return /\.(js|html|css|json)$/.test(e.name) ? [p] : [];
  });
}

test('Keine Töne im Spiel', () => {
  const verboten = [/AudioContext/, /speechSynthesis/, /SpeechSynthesisUtterance/, /new Audio\(/, /<audio\b/, /\.mp3|\.ogg|\.wav/, /\bklang\b/i, /🔊|🔇/, /Vorlesen/];
  const funde = [];
  for (const f of [...dateien('js'), 'index.html', 'style.css', 'tutorial.json', 'sw.js']) {
    const text = readFileSync(url(f), 'utf8');
    for (const re of verboten) if (re.test(text)) funde.push(`${f}: ${re}`);
  }
  assert.deepEqual(funde, []);
});
