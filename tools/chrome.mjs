// Kleine Hilfe für die Bild-Werkzeuge: startet headless Chrome (oder Edge) und führt Code in einer Seite aus.
// So brauchen die Werkzeuge keine zusätzlichen Pakete – Canvas kann PNG lesen und WebP schreiben.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function openChrome() {
  const exe = [process.env.CHROME,
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ].find((p) => p && existsSync(p));
  if (!exe) throw new Error('Kein Chrome gefunden. Bitte CHROME=/pfad/zu/chrome setzen.');
  const port = 9600 + Math.floor(Math.random() * 300);
  const proc = spawn(exe, ['--headless=new', `--remote-debugging-port=${port}`, '--user-data-dir=' + mkdtempSync(join(tmpdir(), 'rr-bild-')), 'about:blank']);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let list;
  for (let i = 0; i < 50; i++) {
    try { list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json(); if (list.some((t) => t.type === 'page')) break; } catch { /* startet noch */ }
    await sleep(200);
  }
  const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = {};
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending[d.id]) { pending[d.id](d); delete pending[d.id]; } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  // Führt einen Ausdruck aus und gibt den Wert zurück (Fehler werden geworfen).
  const run = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 500));
    return r.result?.result?.value;
  };
  return { run, close: () => { ws.close(); proc.kill(); } };
}
