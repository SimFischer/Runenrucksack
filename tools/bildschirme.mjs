// Bildschirmfotos und Layout-Prüfung in einem echten Browser (headless Chrome oder Edge).
// Für jede Größe (iPad quer) werden die wichtigsten Bildschirme aufgerufen, fotografiert und geprüft:
// - kein seitliches Scrollen (scrollWidth = innerWidth), auf Start, Figurenwahl, Spielfeld und Kampf auch kein senkrechtes;
// - keine Emojis im sichtbaren Text (Ausnahme: Ersatz für fehlende Item-Bilder, Klasse .emoji-ersatz);
// - wo angegeben (frei): Diese Elemente überlappen sich nicht (getBoundingClientRect);
// - Lerninhalte (Aufgaben, Quiz, Item-Infos, Buch, Regelkarten, Heldencode) stehen nie in der Titelschrift,
//   in Großbuchstaben (text-transform) oder in Kapitälchen.
//
//   node tools/serve.mjs                                        (in einem zweiten Fenster)
//   node tools/bildschirme.mjs [url] [ordner] [größen]
//   z. B. node tools/bildschirme.mjs http://localhost:8080/ docs/screenshots 1180x820
//
// Ohne Ordner werden keine Fotos gespeichert (nur Prüfung). Größen: Komma-Liste, Standard 1024x768,1180x820,1366x1024.
// Exit-Code 1, wenn eine Prüfung fehlschlägt.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL_ = process.argv[2] || 'http://localhost:8080/';
const ORDNER = process.argv[3] && process.argv[3] !== '-' ? process.argv[3] : null;
const GROESSEN = (process.argv[4] || '1024x768,1180x820,1366x1024').split(',').map((g) => g.split('x').map(Number));
const NUR = process.argv[5] ? process.argv[5].split(',') : null; // nur bestimmte Bildschirme

const CHROME = [process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
].find((p) => p && existsSync(p));
if (!CHROME) { console.error('Kein Chrome gefunden. Bitte CHROME=/pfad/zu/chrome setzen.'); process.exit(2); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const port = 9300 + Math.floor(Math.random() * 300);
const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, '--user-data-dir=' + mkdtempSync(join(tmpdir(), 'rr-fotos-')), '--window-size=1400,1100', 'about:blank']);
let list;
for (let i = 0; i < 50; i++) { try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (list.some((t) => t.type === 'page')) break; } catch { /* startet noch */ } await sleep(200); }
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = {}; const jsFehler = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending[d.id]) { pending[d.id](d); delete pending[d.id]; }
  if (d.method === 'Runtime.exceptionThrown') jsFehler.push(JSON.stringify(d.params.exceptionDetails).slice(0, 300));
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
  return r.result?.result?.value;
};
await send('Runtime.enable');
await send('Page.enable');

// Gemeinsame Hilfen in der Seite
const HILFEN = `
  window.__s = (ms) => new Promise((r) => setTimeout(r, ms));
  window.__klick = async (sel, warten = 350) => { const e = typeof sel === 'string' ? document.querySelector(sel) : sel; if (!e) throw new Error('fehlt: ' + sel); e.click(); await __s(warten); };
  window.__knopf = async (text, warten = 400) => { const b = [...document.querySelectorAll('button')].find((x) => x.offsetParent && x.textContent.includes(text)); if (!b) throw new Error('Knopf fehlt: ' + text); b.click(); await __s(warten); };
  window.__G = (await import(new URL('js/state.js', location.href).href)).G;
`;

async function laden(profil = null) {
  await send('Page.navigate', { url: URL_ });
  for (let i = 0; i < 50; i++) { await sleep(150); if (await ev(`return location.href.startsWith('http') && document.readyState !== 'loading';`)) break; }
  await ev(`localStorage.clear(); ${profil ? `localStorage.setItem('runenrucksack.profil.v1', ${JSON.stringify(JSON.stringify(profil))}); localStorage.setItem('runenrucksack.tutorial', 'fertig');` : ''} return 1;`);
  await send('Page.reload');
  for (let i = 0; i < 40; i++) { await sleep(150); if (await ev(`return !!document.querySelector('#btn-known, #btn-first');`)) break; }
  await sleep(400);
  await ev(HILFEN + 'return 1;');
}

const PROFIL = { v: 1, xp: 420, buch: ['komp:feuer+axt', 'stufe:axt:2'], erfolge: [], figuren: [], designs: [], design: 'leder', stats: { laeufe: 2, siege: 9 }, figurSiege: [], tutorial: true, lernstand: {}, regeln: [], klasse: null };

// Lauf starten (Figur Eadrun) bis zum Spielfeld
const LAUF = `
  await __klick('#btn-known'); await __klick('#btn-new', 500);
  // Figurenwahl abwarten (online laden die Bilder langsamer)
  let karte = null;
  for (let t = 0; t < 30 && !karte; t++) { karte = [...document.querySelectorAll('.hero-card, .figur-karte')].find((k) => k.textContent.includes('Eadrun')); if (!karte) await __s(100); }
  await __klick(karte, 500);
  for (let k = 0; k < 3; k++) {
    // Nach der Figur kommt die Begleiterwahl: den Igel antippen, dann aufbrechen
    const bk = document.querySelector('.begleiter-karte[data-begleiter="igel"]');
    if (bk && !document.querySelector('#figur-detail:not([hidden]) [data-los]')) { bk.click(); await __s(400); }
    const los = [...document.querySelectorAll('button')].find((b) => b.offsetParent && /aufbrechen/i.test(b.textContent));
    if (los) { los.click(); await __s(700); }
  }
  const offen = document.querySelector('#aufgabe [data-nein]'); if (offen) { offen.click(); await __s(400); }
  const go = [...document.querySelectorAll('button')].find((b) => b.offsetParent && /Los geht/.test(b.textContent));
  if (go) { go.click(); await __s(600); }
  const G = __G;
  G.run.items = [
    { uid: 801, id: 'feuer+schwert', area: 'bag', x: 0, y: 0, rot: 0, stern: 2 },
    { uid: 802, id: 'schild', area: 'bag', x: 1, y: 0, rot: 0 },
    { uid: 803, id: 'rune-scharf', area: 'bag', x: 1, y: 1, rot: 3 },
    { uid: 804, id: 'apfel', area: 'store', x: 0, y: 0, rot: 0 },
    { uid: 805, id: 'heiltrank', area: 'bag', x: 2, y: 0, rot: 0 },
  ];
  G.run.gold = 14;
  const lock = document.querySelector('.lock'); if (lock) { lock.click(); await __s(150); lock.click(); await __s(300); }
  await __s(400); for (const n of document.querySelectorAll('#aufgabe [data-nein]')) { n.click(); await __s(300); }
  document.getElementById('tip-bubble')?.remove();
`;

// Kampf bis zum Ende: Spieler stark oder schwach machen, dann „Überspringen“
const KAMPF = (sieg) => `${LAUF}
  ${sieg ? '' : "__G.run.items = [{ uid: 900, id: 'apfel', area: 'bag', x: 0, y: 0, rot: 0 }];"}
  await __klick('#btn-fight', 800);
  const ok = document.querySelector('#modal:not([hidden]) [data-ok]'); if (ok) { ok.click(); await __s(400); }
`;

const BILDSCHIRME = [
  { name: 'start-erstbesuch', profil: null, ohneScroll: true, schritte: '' },
  { name: 'start', profil: PROFIL, ohneScroll: true, schritte: `await __klick('#btn-known');` },
  { name: 'figurenwahl', profil: PROFIL, ohneScroll: true, schritte: `await __klick('#btn-known'); await __klick('#btn-new', 600);` },
  { name: 'begleiterwahl', profil: PROFIL, ohneScroll: true, schritte: `await __klick('#btn-known'); await __klick('#btn-new', 600);
      let karte = null;
      for (let t = 0; t < 30 && !karte; t++) { karte = [...document.querySelectorAll('.figur-karte')].find((k) => k.textContent.includes('Eadrun')); if (!karte) await __s(100); }
      await __klick(karte, 400);
      await __klick([...document.querySelectorAll('button')].find((b) => b.offsetParent && /aufbrechen/i.test(b.textContent)), 600);` },
  { name: 'begleiter-detail', profil: PROFIL, ohneScroll: true, schritte: `await __klick('#btn-known'); await __klick('#btn-new', 600);
      let karte = null;
      for (let t = 0; t < 30 && !karte; t++) { karte = [...document.querySelectorAll('.figur-karte')].find((k) => k.textContent.includes('Eadrun')); if (!karte) await __s(100); }
      await __klick(karte, 400);
      await __klick([...document.querySelectorAll('button')].find((b) => b.offsetParent && /aufbrechen/i.test(b.textContent)), 600);
      await __klick('.begleiter-karte[data-begleiter="pony"]', 500);` },
  { name: 'begleiter-gesperrt', profil: PROFIL, ohneScroll: true, schritte: `await __klick('#btn-known'); await __klick('#btn-new', 600);
      let karte = null;
      for (let t = 0; t < 30 && !karte; t++) { karte = [...document.querySelectorAll('.figur-karte')].find((k) => k.textContent.includes('Eadrun')); if (!karte) await __s(100); }
      await __klick(karte, 400);
      await __klick([...document.querySelectorAll('button')].find((b) => b.offsetParent && /aufbrechen/i.test(b.textContent)), 600);
      await __klick('.begleiter-karte[data-begleiter="falke"]', 500);` },
  { name: 'begleiter-sammlung', profil: PROFIL, ohneScroll: false, schritte: `await __klick('#btn-known'); await __klick('#btn-sammlung', 500);
      await __klick('#sammlung-layer [data-tab="begleiter"]', 400);` },
  { name: 'figur-detail', profil: PROFIL, ohneScroll: true, schritte: `await __klick('#btn-known'); await __klick('#btn-new', 600);
      const k = [...document.querySelectorAll('.hero-card, .figur-karte')].find((x) => x.textContent.includes('Borga')); await __klick(k, 600);` },
  { name: 'spielfeld', profil: PROFIL, ohneScroll: true, schritte: LAUF },
  { name: 'wuerfeln-teuer', profil: PROFIL, ohneScroll: true, schritte: `${LAUF}
      __G.run.gold = 30; for (let k = 0; k < 3; k++) await __klick('#btn-reroll', 250); await __s(300);` },
  { name: 'haendler-stufe', profil: PROFIL, ohneScroll: true, frei: ['.shop-head h2', '#haendler-stufe', '#amboss', '#shop-gold', '#btn-vertrauen', '#btn-reroll'], schritte: `${LAUF}
      __G.run.gold = 30; await __klick('#btn-vertrauen', 1500);` },
  { name: 'haendler-tafel', profil: PROFIL, ohneScroll: true, schritte: `${LAUF}
      __G.run.haendler = 3; __G.run.gold = 30; await __klick('#haendler-stufe', 500);` },
  { name: 'schmied-tafel', profil: PROFIL, ohneScroll: true, schritte: `${LAUF}
      __G.run.gold = 60; const it = document.querySelector('#grid-bag .item'), rr = it.getBoundingClientRect(); for (const t of ['pointerdown', 'pointerup']) it.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: rr.x + 12, clientY: rr.y + 12, pointerId: 1, isPrimary: true, pointerType: 'touch' })); await __s(300); await __klick('#amboss', 600);` },
  { name: 'schmied-aufgabe', profil: PROFIL, ohneScroll: true, schritte: `${LAUF}
      __G.run.gold = 120; const it = document.querySelector('#grid-bag .item'), rr = it.getBoundingClientRect(); for (const t of ['pointerdown', 'pointerup']) it.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: rr.x + 12, clientY: rr.y + 12, pointerId: 1, isPrimary: true, pointerType: 'touch' })); await __s(300); await __klick('#amboss', 600); await __klick('#modal [data-act="los"]', 900);` },
  { name: 'schmied-abbruch', profil: PROFIL, ohneScroll: true, schritte: `${LAUF}
      __G.run.gold = 120; const it = document.querySelector('#grid-bag .item'), rr = it.getBoundingClientRect(); for (const t of ['pointerdown', 'pointerup']) it.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: rr.x + 12, clientY: rr.y + 12, pointerId: 1, isPrimary: true, pointerType: 'touch' })); await __s(300); await __klick('#amboss', 600); await __klick('#modal [data-act="los"]', 900); await __klick('#aufgabe [data-nein]', 500);` },
  { name: 'schmied-wenig-gold', profil: PROFIL, ohneScroll: true, schritte: `${LAUF}
      __G.run.gold = 5; const it = document.querySelector('#grid-bag .item'), rr = it.getBoundingClientRect(); for (const t of ['pointerdown', 'pointerup']) it.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: rr.x + 12, clientY: rr.y + 12, pointerId: 1, isPrimary: true, pointerType: 'touch' })); await __s(300); await __klick('#amboss', 600);` },
  { name: 'hilfe', profil: PROFIL, ohneScroll: false, schritte: `${LAUF} await __klick('#btn-menu', 400); await __klick('#modal [data-act="help"]', 500);
      for (const e of document.querySelectorAll('#help-layer, #help-layer *')) if (e.scrollHeight > e.clientHeight + 4) e.scrollTop = e.scrollHeight;` },
  { name: 'begleiter-rucksack', profil: PROFIL, ohneScroll: true, schritte: `${LAUF}
      __G.run.begleiter = 'eule';
      __G.run.items.push({ uid: 990, id: 'begleiter-eule', area: 'bag', x: 2, y: 1, rot: 0 });
      await __klick('#btn-reroll', 300);
      const it = document.querySelector('#grid-bag .item[data-uid="990"]'), rr = it.getBoundingClientRect();
      for (const t of ['pointerdown', 'pointerup']) it.dispatchEvent(new PointerEvent(t, { bubbles: true, clientX: rr.x + 12, clientY: rr.y + 12, pointerId: 1, isPrimary: true, pointerType: 'touch' }));
      await __s(400);` },
  { name: 'kampf', profil: PROFIL, ohneScroll: true, frei: ['#btn-start-battle', '#armor-word', '#fighter-player .f-figur', '#fighter-enemy .f-figur', '#fighter-player .f-rucksack', '#fighter-enemy .f-rucksack', '#fighter-player .f-band', '#fighter-enemy .f-band', '#battle .vs'], schritte: `${KAMPF(true)} await __s(300);` },
  { name: 'kampf-gross', profil: PROFIL, ohneScroll: true, frei: ['#btn-start-battle', '#armor-word', '#fighter-player .f-figur', '#fighter-enemy .f-figur', '#fighter-player .f-rucksack', '#fighter-enemy .f-rucksack', '#fighter-player .f-band', '#fighter-enemy .f-band', '#battle .vs'], schritte: `${LAUF}
      // größter Rucksack: 5×4 und beide Taschen
      const L = await import(new URL('js/logic.js', location.href).href);
      while (L.growBag(__G.run)) {}
      for (const t of ['gartentasche', 'satteltasche']) L.attachTasche(__G.run, __G.DEFS[t]);
      __G.run.items = [
        { uid: 960, id: 'feuer+schwert', area: 'bag', x: 0, y: 0, rot: 0, stern: 2 }, { uid: 961, id: 'schild', area: 'bag', x: 1, y: 0, rot: 0 },
        { uid: 962, id: 'apfel', area: 'bag', x: 5, y: 0, rot: 0 }, { uid: 963, id: 'heiltrank', area: 'bag', x: 4, y: 3, rot: 0 },
        { uid: 964, id: 'bogen', area: 'bag', x: 0, y: 2, rot: 1 }];
      await __klick('#btn-fight', 800);
      const ok = document.querySelector('#modal:not([hidden]) [data-ok]'); if (ok) { ok.click(); await __s(400); }` },
  { name: 'kampf-laeuft', profil: PROFIL, ohneScroll: true, frei: ['#btn-start-battle', '#armor-word', '#fighter-player .f-figur', '#fighter-enemy .f-figur', '#fighter-player .f-rucksack', '#fighter-enemy .f-rucksack', '#fighter-player .f-band', '#fighter-enemy .f-band', '#battle .vs'], schritte: `${KAMPF(true)} await __klick('#btn-start-battle', 2600);` },
  { name: 'sieg', profil: PROFIL, ohneScroll: true, schritte: `${KAMPF(true)} await __klick('#btn-start-battle', 200); await __klick('#btn-skip', 3200);` },
  { name: 'niederlage', profil: PROFIL, ohneScroll: true, schritte: `${KAMPF(false)} await __klick('#btn-start-battle', 200); await __klick('#btn-skip', 3200);` },
  { name: 'buch', profil: PROFIL, ohneScroll: false, schritte: `await __klick('#btn-known'); await __klick('#btn-buch', 500);` },
  { name: 'heldencode', profil: PROFIL, ohneScroll: true, schritte: `${LAUF} await __klick('#btn-menu', 400); await __klick('#modal [data-act="code"]', 500);` },
  { name: 'code-eingabe', profil: PROFIL, ohneScroll: true, schritte: `await __klick('#btn-known'); await __klick('#btn-code-ein', 400);
      const i = document.querySelector('#code-layer .code-input'); i.value = 'k7q-m2x'; i.dispatchEvent(new Event('input')); await __klick('#code-layer [data-lesen]', 300);` },
  { name: 'lehrkraft', profil: PROFIL, ohneScroll: false, schritte: `await __klick('#btn-known'); await __klick('#btn-lehrkraft', 400);
      document.querySelector('#lk-layer .code-input').value = 'EULE-2026'; await __klick('#lk-layer [data-ok]', 500);` },
  { name: 'begegnung', profil: PROFIL, ohneScroll: false, schritte: `${LAUF}
      const { runEncounter } = await import(new URL('js/encounters.js', location.href).href);
      __G.run.begegnung = { tag: __G.run.day, ids: ['eule', 'zwerg', 'haendler'] };
      runEncounter(() => {}, () => {}); await __s(600);` },
  { name: 'begegnung-fenster', profil: PROFIL, ohneScroll: false, schritte: `${LAUF}
      const { runEncounter } = await import(new URL('js/encounters.js', location.href).href);
      __G.run.begegnung = { tag: __G.run.day, ids: ['hirtin', 'zwerg', 'haendler'] };
      runEncounter(() => {}, () => {}); await __s(500); await __klick('[data-id="hirtin"]', 500);` },
  { name: 'begegnung-aufgabe', profil: PROFIL, ohneScroll: false, schritte: `${LAUF}
      const { runEncounter } = await import(new URL('js/encounters.js', location.href).href);
      __G.run.begegnung = { tag: __G.run.day, ids: ['zwerg', 'eule', 'haendler'] };
      runEncounter(() => {}, () => {}); await __s(500); await __klick('[data-id="zwerg"]', 500); await __klick('#modal [data-go]', 800);` },
  { name: 'sieg-anfuehrer', profil: PROFIL, ohneScroll: true, schritte: `${LAUF}
      __G.run.day = 5;
      __G.run.items = [0, 1, 2].map((k) => ({ uid: 950 + k, id: 'feuer+schwert', area: 'bag', x: k, y: 0, rot: 0, stern: 4 }));
      await __klick('#btn-fight', 800);
      const ok = document.querySelector('#modal:not([hidden]) [data-ok]'); if (ok) { ok.click(); await __s(400); }
      await __klick('#btn-start-battle', 200); await __klick('#btn-skip', 3200);` },
  { name: 'aufgabe', profil: PROFIL, ohneScroll: false, schritte: `${LAUF}
      const { frageImSpiel } = await import(new URL('js/aufgaben/spiel.js', location.href).href);
      frageImSpiel({ format: 'sortieren', nein: 'Aufgeben' }); await __s(700);` },
  { name: 'aufgabe-neben', profil: PROFIL, ohneScroll: true, frei: ['#aufgabe .af-fenster', '#grid-bag'], schritte: `${LAUF}
      const { frageImSpiel } = await import(new URL('js/aufgaben/spiel.js', location.href).href);
      const items = [...document.querySelectorAll('#grid-bag .item')];
      frageImSpiel({ art: 'nomen', anker: items[0], beteiligt: items.slice(0, 2), nein: 'Nicht verbinden' }); await __s(700);` },
  { name: 'aufgabe-satz', profil: PROFIL, ohneScroll: true, frei: ['#aufgabe .af-fenster', '#grid-bag'], schritte: `${LAUF}
      const { frageImSpiel } = await import(new URL('js/aufgaben/spiel.js', location.href).href);
      const items = [...document.querySelectorAll('#grid-bag .item')];
      frageImSpiel({ art: 'verb', format: 'luecke', anker: items[0], beteiligt: items.slice(0, 2), nein: 'Nicht verbinden' }); await __s(700);` },
  { name: 'aufgabe-gross-neben', profil: PROFIL, ohneScroll: true, frei: ['#aufgabe .af-fenster', '#grid-bag'], schritte: `${LAUF}
      const { frageImSpiel } = await import(new URL('js/aufgaben/spiel.js', location.href).href);
      const items = [...document.querySelectorAll('#grid-bag .item')];
      frageImSpiel({ format: 'sortieren', anker: items[0], nein: 'Nicht verbinden' }); await __s(700);` },
  { name: 'aufgabe-luecke', profil: PROFIL, ohneScroll: false, schritte: `${LAUF}
      const { frageImSpiel } = await import(new URL('js/aufgaben/spiel.js', location.href).href);
      frageImSpiel({ format: 'luecke', nein: 'Aufgeben' }); await __s(700);` },
  { name: 'aufgabe-auswahl', profil: PROFIL, ohneScroll: false, schritte: `${LAUF}
      const { frageImSpiel } = await import(new URL('js/aufgaben/spiel.js', location.href).href);
      frageImSpiel({ format: 'auswahl', nein: 'Aufgeben' }); await __s(700);` },
  { name: 'tutorial', profil: null, ohneScroll: true, schritte: `await __klick('#btn-first', 1200); const n = document.querySelector('#tut-next'); if (n && !n.hidden) { n.click(); await __s(900); }` },
];

const PRUEFEN = (ohneScroll, frei = []) => `
  const emojiRe = /\\p{Extended_Pictographic}/u;
  const emojis = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!el || el.closest('.emoji-ersatz, [hidden], script, style')) continue;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if (getComputedStyle(el).visibility === 'hidden') continue;
    const m = n.textContent.match(emojiRe); if (m) emojis.push(n.textContent.trim().slice(0, 40));
  }
  const de = document.documentElement;
  return {
    breit: de.scrollWidth - innerWidth, hoch: ${ohneScroll} ? Math.max(de.scrollHeight, document.body.scrollHeight) - innerHeight : 0,
    emojis: [...new Set(emojis)].slice(0, 12),
    titelschrift: (() => {
      const LERN = '#aufgabe *, #quick *, #info *, .code-kasten *, .buch-neu *, .buch-card *, .lern, .lern *, .opt-btn, .genus-btn, .enc-q, .enc-hint, .bad-word';
      const out = [];
      for (const e of document.querySelectorAll(LERN)) {
        if (e.closest('h2:not(.lern, .enc-q)')) continue; // Überschriften ohne Lerninhalt dürfen die Titelschrift tragen
        const text = [...e.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
        if (!text || !e.getClientRects().length) continue;
        const c = getComputedStyle(e);
        if (/cinzel/i.test(c.fontFamily) || c.textTransform !== 'none' || c.fontVariantCaps !== 'normal') out.push(text.slice(0, 30));
      }
      return [...new Set(out)].slice(0, 10);
    })(),
    ueberlappt: (() => {
      const teile = ${JSON.stringify(frei)}.flatMap((sel) => [...document.querySelectorAll(sel)].filter((e) => e.offsetParent || e.getClientRects().length).map((e, k) => ({ name: sel + (k ? '#' + k : ''), r: e.getBoundingClientRect() })));
      const out = [];
      for (let a = 0; a < teile.length; a++) for (let b = a + 1; b < teile.length; b++) {
        const p = teile[a].r, q = teile[b].r;
        const x = Math.min(p.right, q.right) - Math.max(p.left, q.left), y = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
        if (x > 2 && y > 2) out.push(teile[a].name + ' ∩ ' + teile[b].name);
      }
      return out;
    })(),
  };`;

const ergebnisse = [];
let fehler = 0;
if (ORDNER) mkdirSync(ORDNER, { recursive: true });
for (const [w, h] of GROESSEN) {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  for (const b of BILDSCHIRME) {
    if (NUR && !NUR.includes(b.name)) continue;
    let r;
    try {
      await laden(b.profil);
      await ev(b.schritte + ' return 1;');
      await sleep(500);
      r = await ev(PRUEFEN(b.ohneScroll, b.frei));
    } catch (e) { r = { fehler: String(e.message).slice(0, 200) }; }
    const ok = !r.fehler && r.breit <= 0 && r.hoch <= 0 && !r.emojis.length && !r.ueberlappt?.length && !r.titelschrift?.length;
    if (!ok) fehler++;
    ergebnisse.push({ groesse: `${w}x${h}`, bildschirm: b.name, ...r, ok });
    console.log(`${ok ? '✓' : '✗'} ${w}x${h} ${b.name}${r.fehler ? ' – ' + r.fehler : ''}${r.breit > 0 ? ` – ${r.breit}px zu breit` : ''}${r.hoch > 0 ? ` – ${r.hoch}px zu hoch` : ''}${r.emojis?.length ? ' – Emojis: ' + r.emojis.join(' | ') : ''}${r.ueberlappt?.length ? ' – überlappt: ' + r.ueberlappt.join(', ') : ''}${r.titelschrift?.length ? ' – Titelschrift/Großbuchstaben: ' + r.titelschrift.join(' | ') : ''}`);
    if (ORDNER) {
      const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 72 });
      writeFileSync(join(ORDNER, `${b.name}-${w}x${h}.jpg`), Buffer.from(shot.result.data, 'base64'));
    }
  }
}
if (jsFehler.length) { console.log('JS-Fehler:\n' + jsFehler.slice(0, 5).join('\n')); fehler++; }
ws.close(); chrome.kill();
console.log(fehler ? `\n${fehler} Prüfung(en) fehlgeschlagen.` : '\nAlles in Ordnung.');
process.exit(fehler ? 1 : 0);
