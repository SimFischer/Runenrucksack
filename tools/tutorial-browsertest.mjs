// Spielt das Tutorial in einem echten Browser per Touch durch (headless Chrome oder Edge).
// Prüft: jeder Schritt erscheint, falsche Aktionen werden zurückgesetzt, Überspringen funktioniert,
// danach startet ein normaler Lauf ohne Tutorial-Reste.
//
//   node tools/serve.mjs                                   (in einem zweiten Fenster)
//   node tools/tutorial-browsertest.mjs [url] [breite] [höhe]
//   z. B. node tools/tutorial-browsertest.mjs http://localhost:8080/ 1024 768
//
// Chrome wird automatisch gesucht; sonst den Pfad in der Umgebungsvariable CHROME angeben.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL_ = process.argv[2] || 'http://localhost:8080/';
const W = +(process.argv[3] || 1180), H = +(process.argv[4] || 820);
const CHROME = [process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find((p) => p && existsSync(p));
if (!CHROME) { console.error('Kein Chrome gefunden. Bitte CHROME=/pfad/zu/chrome setzen.'); process.exit(2); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9500 + Math.floor(Math.random() * 300);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, '--user-data-dir=' + mkdtempSync(join(tmpdir(), 'rr-')), `--window-size=${W},${H}`, 'about:blank']);
let list;
for (let i = 0; i < 50; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (list.some((t) => t.type === 'page')) break; } catch { /* startet noch */ } await sleep(200); }
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = {}; const errors = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending[d.id]) { pending[d.id](d); delete pending[d.id]; }
  if (d.method === 'Runtime.exceptionThrown') errors.push(JSON.stringify(d.params.exceptionDetails).slice(0, 300));
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
const rect = async (sel) => JSON.parse(await ev(`JSON.stringify(document.querySelector(${JSON.stringify(sel)})?.getBoundingClientRect() || null)`));
const touch = (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts });
const tap = async (sel) => {
  const r = await rect(sel);
  if (!r) throw new Error('nicht gefunden: ' + sel);
  await touch('touchStart', [{ x: r.left + r.width / 2, y: r.top + r.height / 2, id: 1 }]); await touch('touchEnd', []); await sleep(250);
};
const drag = async (sel, tx, ty) => {
  const r = await rect(sel);
  if (!r) throw new Error('nicht gefunden: ' + sel);
  const x0 = r.left + r.width / 2, y0 = r.top + r.height / 2;
  await touch('touchStart', [{ x: x0, y: y0, id: 1 }]);
  for (let i = 1; i <= 10; i++) { await touch('touchMove', [{ x: x0 + (tx - x0) * i / 10, y: y0 + (ty - y0) * i / 10, id: 1 }]); await sleep(20); }
  await touch('touchEnd', []); await sleep(300);
};
const cell = async () => parseFloat(await ev(`getComputedStyle(document.documentElement).getPropertyValue('--cell')`));
const bubble = async () => (await ev(`document.getElementById('tut-text')?.textContent || ''`));
const freeNextTo = async (sel) => {
  const r = await rect(sel), c = await cell(), g = await rect('#grid-bag');
  for (const [x, y] of [[r.right + c / 2, r.top + c / 2], [r.left + c / 2, r.bottom + c / 2], [r.left - c / 2, r.top + c / 2], [r.left + c / 2, r.top - c / 2]]) {
    if (x < g.left || x > g.right || y < g.top || y > g.bottom) continue;
    if (await ev(`!document.elementsFromPoint(${x}, ${y}).some((e) => e.classList?.contains('item'))`)) return [x, y];
  }
  throw new Error('kein freies Feld neben ' + sel);
};

let ok = true;
const seen = [];
const expect = async (part) => {
  await sleep(500);
  const t = await bubble();
  seen.push(t.slice(0, 40));
  if (!t.includes(part)) { ok = false; console.log(`✗ erwartet „${part}“, gesehen „${t}“`); } else console.log(`✓ ${part}`);
};
const check = (cond, text) => { if (!cond) ok = false; console.log(`${cond ? '✓' : '✗'} ${text}`); };

await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Page.navigate', { url: URL_ }); await sleep(1500);
console.log(`Tutorial-Test bei ${W}×${H} auf ${URL_}`);

try {
  await tap('#btn-first'); await expect('Meister Fenwick');
  await tap('#tut-next'); await expect('dein Gold');
  await tap('#btn-fight'); check(await ev('document.getElementById("battle").hidden'), 'Zum Kampf ist noch gesperrt');
  await tap('#tut-next'); await expect('Zieh das Schwert');
  const st = await rect('#grid-store');
  await drag('[data-tut="laden-schwert"]', st.left + 40, st.top + 40); await expect('Zieh das Schwert');
  check((await ev(`document.getElementById('tut-tip').textContent`)).includes('nicht ins Lager'), 'Hinweis „nicht ins Lager“ und Schwert zurück im Laden');
  const bg = await rect('#grid-bag'), c = await cell();
  await drag('[data-tut="laden-schwert"]', bg.left + c * 1.5, bg.top + c); await expect('Tipp das Schwert an');
  await tap('#grid-bag [data-tut="item-schwert"]'); await expect('drehen');
  await tap('#grid-bag [data-tut="item-schwert"]'); await expect('Lager');
  await tap('#tut-next'); await expect('Feuer-Kristall');
  const sw = await rect('#grid-bag [data-tut="item-schwert"]');
  await drag('[data-tut="laden-feuer"]', sw.left - c / 2, sw.top + c / 2); await expect('verschmelzen');
  await tap('#modal [data-g="der"]');
  check((await ev(`document.querySelector('#modal .feedback')?.textContent || ''`)).includes('Das letzte Wort'), 'Erklärung nach falschem Artikel');
  await tap('#modal [data-g="das"]'); await tap('#modal [data-next]'); await expect('Siegel');
  let p = await freeNextTo('#grid-bag [data-tut="item-feuer+schwert"]');
  await drag('[data-tut="laden-siegel-das"]', p[0], p[1]); await expect('Rune');
  p = await freeNextTo('#grid-bag [data-tut="item-feuer+schwert"]');
  await drag('[data-tut="laden-rune-scharf"]', p[0], p[1]);
  for (let i = 0; i < 5 && !(await bubble()).includes('Zum Kampf'); i++) await tap('#grid-bag [data-tut="item-rune-scharf"]');
  await expect('Zum Kampf');
  await tap('#btn-fight'); await sleep(2400); await expect('kämpft von allein');
  await tap('#tut-next');
  for (let i = 0; i < 60 && (await ev('document.getElementById("modal").hidden')); i++) await sleep(500);
  await expect('Trophäe');
  await tap('#modal [data-act="next"]'); await expect('Am Morgen');
  await tap('#modal [data-go]'); await tap('#modal [data-i="2"]'); await tap('#modal [data-next]'); await tap('#modal [data-ok]');
  await sleep(600);
  check(!!(await rect('#tut-finale [data-go]')), 'Abschluss mit „Meinen ersten Lauf starten“');
  check(await ev('localStorage.getItem("runenrucksack.tutorial") === "fertig"'), 'Tutorial auf diesem Gerät als fertig gemerkt');
  check(await ev('localStorage.getItem("runenrucksack.lauf.v2") === null'), 'Tutorial-Lauf wurde nicht gespeichert');
  await tap('#tut-finale [data-go]');
  check(await ev('!document.getElementById("heroes").hidden && document.getElementById("tut-layer").hidden'), 'Figurenwahl ohne Tutorial-Overlay');
  await tap('.hero-card');
  const run = JSON.parse(await ev('localStorage.getItem("runenrucksack.lauf.v2")'));
  check(!run.tutorial && run.gold === 12 && run.shop.filter(Boolean).length >= 5, 'normaler Lauf ohne Tutorial-Reste');

  // Überspringen
  await send('Page.reload'); await sleep(1500);
  check(await ev('document.getElementById("btn-known").classList.contains("primary")'), '„Ich kenne das schon“ ist jetzt hervorgehoben');
  await tap('#btn-first'); await tap('#tut-skip'); await tap('#tut-confirm [data-skip]');
  check(await ev('document.getElementById("tut-layer").hidden && !document.getElementById("start-menu").hidden'), 'Überspringen führt ins Startmenü');
  check(await ev('!document.getElementById("btn-continue").hidden'), 'gespeicherter Lauf bleibt erhalten');
} catch (e) {
  ok = false;
  console.log('✗ Abbruch:', e.message);
}
check(errors.length === 0, `keine JS-Fehler${errors.length ? ': ' + errors[0] : ''}`);
console.log(ok ? '\nAlles in Ordnung.' : '\nEs gab Fehler.');
ws.close(); chrome.kill();
process.exit(ok ? 0 : 1);
