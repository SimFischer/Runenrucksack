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
  await drag('[data-tut="laden-feuer"]', sw.left - c / 2, sw.top + c / 2); await expect('sofort zum Feuerschwert');
  check(await ev(`!!document.querySelector('#quick .quick-card') && document.getElementById('modal').hidden`), 'kleines Frage-Fenster am Schwert (kein großes Fenster)');
  await tap('#quick [data-k="0"]'); // „der“ – falsch
  check((await ev(`document.querySelector('#quick .quick-fb')?.textContent || ''`)).includes('Das letzte Wort'), 'Erklärung nach falschem Artikel');
  await tap('#quick [data-k="2"]'); await expect('Siegel'); // „das“
  check(await ev(`!!document.querySelector('#grid-bag [data-tut="item-feuer+schwert"]')`), 'Feuerschwert ist sofort entstanden');
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
  await tap('#kampf-ergebnis [data-weiter]'); await expect('Am Morgen');
  await tap('#modal [data-go]'); await tap('#modal [data-i="2"]'); await tap('#modal [data-next]'); await tap('#modal [data-ok]');

  // Der zweite Tag
  await expect('zweiten Tag');
  await tap('#tut-next'); await expect('Dolch');
  const bg2 = await rect('#grid-bag'), c2 = await cell();
  const frei = await ev(`(() => { const g = document.getElementById('grid-bag').getBoundingClientRect(); const c = ${c2};
    for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) { const px = g.left + 3 + (x + .5) * c, py = g.top + 3 + (y + .5) * c;
      if (!document.elementsFromPoint(px, py).some((e) => e.classList?.contains('item'))) return [px, py]; } return null; })()`);
  await drag('[data-tut="laden-dolch"]', frei[0], frei[1]); await expect('Mehrzahl');
  const optsD = await ev(`[...document.querySelectorAll('#quick [data-k]')].map((x) => x.textContent)`);
  await tap(`#quick [data-k="${optsD.indexOf('Dolche')}"]`); await sleep(1200);
  check(await ev(`!!document.querySelector('#grid-bag .item.s2')`), 'zwei Dolche werden sofort zu einem ★★-Dolch');
  await expect('1/2');
  check(await ev(`document.querySelector('[data-tut="sammeln-apfel"]')?.textContent === '1/2'`), 'Abzeichen 1/2 im Laden');
  await tap('#tut-next'); await expect('Verben');
  for (let i = 0; i < 6 && !(await ev('!!document.getElementById("quick")')); i++) await tap('#grid-bag [data-tut="item-schlagen"]');
  await expect('welche Form');
  const optsV = await ev(`[...document.querySelectorAll('#quick [data-k]')].map((x) => x.textContent)`);
  await tap(`#quick [data-k="${optsV.indexOf('schlägst')}"]`); await expect('schlägst du mit deinem Feuerschwert');
  check(await ev(`!!document.querySelector('#grid-bag .rune-lines line.verb')`), 'Leuchtlinie von der Rolle zum Feuerschwert');
  await tap('#tut-next'); await expect('zweiten Kampf');
  await tap('#btn-fight'); await expect('Rüstung des Orks');
  await tap('#armor-word');
  const optsR = await ev(`[...document.querySelectorAll('#modal [data-k]')].map((x) => x.textContent)`);
  await tap(`#modal [data-k="${optsR.indexOf('Schwert')}"]`); await tap('#modal [data-ok]'); await expect('geschwächt');
  await tap('#tut-next');
  for (let i = 0; i < 60 && (await ev('document.getElementById("modal").hidden')); i++) await sleep(500);
  await expect('zweiten Tag geschafft');
  await tap('#kampf-ergebnis [data-weiter]');
  // Buch der Wörter und Heldencode
  await expect('Buch der Wörter');
  await tap('#btn-buch-spiel'); await expect('Feuerschwert steht schon drin');
  check(await ev(`[...document.querySelectorAll('#buch-layer .buch-eintrag:not(.dunkel) b')].some((b) => b.textContent.includes('Feuerschwert'))`), 'Feuerschwert ist im Buch entdeckt');
  check(await ev(`document.querySelectorAll('#buch-layer .buch-eintrag.dunkel').length > 10`), 'unentdeckte Einträge als dunkle Silhouetten');
  await tap('#buch-layer [data-close]'); await expect('Heldencode');
  await tap('#btn-menu'); await tap('#modal [data-act="code"]'); await expect('Schreib den Code');
  check(await ev(`!!document.querySelector('#code-layer .code-qr svg') && /^[2-9A-Z]{5}/.test(document.querySelector('#code-layer [data-code]').innerText)`), 'Heldencode mit QR-Code');
  await tap('#code-layer [data-ok]');
  await sleep(600);
  check(!!(await rect('#tut-finale [data-go]')), 'Abschluss mit „Meinen ersten Lauf starten“');
  check(await ev('localStorage.getItem("runenrucksack.tutorial") === "fertig"'), 'Tutorial auf diesem Gerät als fertig gemerkt');
  check(await ev('localStorage.getItem("runenrucksack.lauf.v2") === null'), 'Tutorial-Lauf wurde nicht gespeichert');
  await tap('#tut-finale [data-go]');
  check(await ev('!document.getElementById("heroes").hidden && document.getElementById("tut-layer").hidden'), 'Figurenwahl ohne Tutorial-Overlay');
  await tap('.figur-karte'); await tap('#figur-detail [data-los]');
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
