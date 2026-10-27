// Zerlegt die Sprite-Sheets aus assets/roh/ anhand der transparenten Lücken in Einzelbilder,
// schneidet sie zu, bringt sie auf einheitliche Größe (1×1: 256 px, 1×2: 256×512 px, 2×2: 512 px)
// und speichert sie als WebP in assets/items/ bzw. assets/gegner/.
// Schreibt außerdem assets/zuordnung.json (Bild → id) und assets/vorschau.html zum Prüfen.
//
//   node tools/zerschneide.mjs        Items und Gegner
//   node tools/zerschneide.mjs ui     nur die Oberflächen-Bilder aus assets/roh/ui/ → assets/ui/
//
// Neue Bilder: Sheet (PNG oder WebP) in assets/roh/ legen und unten in SHEETS eintragen (Zeilen von oben nach unten,
// Objekte von links nach rechts). Braucht Chrome oder Edge (Umgebungsvariable CHROME, falls nicht gefunden).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { openChrome } from './chrome.mjs';
import { schreibeVorschau } from './vorschau.mjs';

const ROH = 'assets/roh/';
const SHEETS = [
  { datei: 'items-quadratisch.png', ziel: 'items', reihen: [
    ['dolch', 'helm', 'laterne', 'schild'],
    ['hammer', 'apfel', 'brot', 'heiltrank'],
    ['horn', 'runenstein', 'runenkrone', 'drachenschuppe'],
    ['kettenhemd', 'drachenfeuerschwert', 'gartentasche', 'satteltasche'],
  ] },
  { datei: 'items-hochkant.png', ziel: 'items', reihen: [
    ['schwert', 'axt', 'bogen', 'stab', 'speer', 'stiefel'],
    ['schlagen', 'schuetzen', 'heilen', 'stuermen', 'verb-rufen', 'verb-reiten'],
  ] },
  { datei: 'rollen-nachtrag.webp', ziel: 'items', reihen: [
    ['stechen', 'schiessen', 'brennen', 'leuchten'],
  ] },
  { datei: 'items-nachtrag.webp', ziel: 'items', reihen: [
    ['kuerbis', 'pfanne', 'honig'],
    ['karotte', 'hafer', 'zaumzeug'],
  ] },
  { datei: 'kristalle-siegel.png', ziel: 'items', reihen: [
    ['feuer', 'gift', 'eis', 'blitz'],
    ['stein', 'mond', 'gold', 'sturm'],
    ['siegel-der', 'siegel-die', 'siegel-das'],
  ] },
  { datei: 'runen.png', ziel: 'items', reihen: [
    ['rune-scharf', 'rune-schwer', 'rune-schnell', 'rune-edel'],
    ['rune-gut', 'rune-gross', 'rune-stark', 'rune-hell'],
  ] },
  { datei: 'gegner-orks.png', ziel: 'gegner', reihen: [
    ['spaeher', 'schildork'],
    ['schamane', 'wolfsreiter'],
  ] },
];
// Oberfläche (assets/roh/ui/): Sheets an den transparenten Lücken zerschneiden, jedes Teil behält sein
// Seitenverhältnis (max = längste Kante in px). Einzelbilder werden nur verkleinert (breite in px).
const UI_SHEETS = [
  { datei: 'ui-symbole.png', gruppe: 'symbole', max: 160, reihen: [
    ['gold', 'herz', 'herz-zerbrochen', 'pokal'],
    ['tag', 'nacht', 'sanduhr', 'schloss'],
    ['stern', 'buch', 'truhe', 'karte'],
    ['menue', 'wuerfel', 'kampf', 'eule'],
  ] },
  { datei: 'zustand-symbole.png', gruppe: 'zustand', max: 128, reihen: [
    ['brand', 'gift', 'kaelte', 'betaeubung'],
    ['block', 'heilung', 'tempo', 'glueck'],
  ] },
  { datei: 'banner.png', gruppe: 'banner', max: 900, reihen: [['sieg', 'niederlage'], ['namensband', 'holzschild']] },
  { datei: 'effekte.png', gruppe: 'effekte', max: 192, reihen: [
    ['treffer', 'pfeil', 'eis', 'feuer'],
    ['giftwolke', 'blitz', 'heilung', 'schildblitz'],
  ] },
  { datei: 'orks-besiegt.png', gruppe: 'besiegt', max: 512, reihen: [['spaeher', 'schildork'], ['schamane', 'wolfsreiter']] },
  { datei: 'fenwick-posen.png', gruppe: 'fenwick', max: 480, reihen: [['erklaert', 'tipp', 'jubelt']] },
];
const UI_EINZELN = [
  { datei: 'tafel-rahmen.png', id: 'tafel-rahmen', breite: 724, qualitaet: 0.9 },
  { datei: 'rucksack-flaeche.png', id: 'rucksack-flaeche', breite: 1024 },
  { datei: 'lager-truhe.png', id: 'lager-truhe', breite: 1024 },
  { datei: 'haendlerstand.png', id: 'haendlerstand', breite: 1280 },
];

// Schriftrollen ohne passendes Verb im Spiel – für neue Verben vorgemerkt.
const VORGEMERKT = { 'verb-rufen': 'rufen (Horn)', 'verb-reiten': 'reiten (Hufeisen)' };

const items = JSON.parse(readFileSync('items.json', 'utf8')).items;
const defs = Object.fromEntries(items.map((d) => [d.id, d]));
// Zielgröße nach Form des Items; Gegner 512 × 512.
const groesse = (id, ziel) => {
  if (ziel === 'gegner') return [512, 512];
  const d = defs[id] || { w: 1, h: 2 }; // vorgemerkte Schriftrollen sind 1×2
  return [d.w * 256, d.h * 256];
};

// Läuft in der Seite: teilt das Sheet in Reihen und Spalten (an den leersten Linien zwischen den
// Objekten), schneidet jede Zelle eng auf ihr Objekt zu und passt es in die Zielgröße ein.
const SEITE = String.raw`async (b64, reihen, groessen, typ) => {
  const img = new Image(); img.src = 'data:' + typ + ';base64,' + b64; await img.decode();
  const W = img.width, H = img.height;
  const cv = new OffscreenCanvas(W, H), g = cv.getContext('2d'); g.drawImage(img, 0, 0);
  const a = g.getImageData(0, 0, W, H).data;
  const sicht = (x, y) => a[(y * W + x) * 4 + 3] > 40;
  // Bereich mit Inhalt (x0..x1, y0..y1)
  const box = (x0, y0, x1, y1) => {
    let bx0 = x1, by0 = y1, bx1 = x0, by1 = y0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (sicht(x, y)) {
      if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y;
    }
    return bx1 < bx0 ? null : [bx0, by0, bx1 + 1, by1 + 1];
  };
  // Teilungslinien: in jedem Suchfenster die Linie mit den wenigsten sichtbaren Pixeln (Mitte einer Lücke)
  const teile = (von, bis, n, zaehle) => {
    const grenzen = [von];
    const schritt = (bis - von) / n;
    for (let k = 1; k < n; k++) {
      const m = von + k * schritt, f = schritt * 0.38;
      let best = Infinity, lauf = [];
      for (let p = Math.round(m - f); p <= Math.round(m + f); p++) {
        const c = zaehle(p);
        if (c < best) { best = c; lauf = [p]; } else if (c === best) lauf.push(p);
      }
      grenzen.push(lauf[Math.floor(lauf.length / 2)]);
    }
    grenzen.push(bis);
    return grenzen;
  };
  const alles = box(0, 0, W, H);
  const zeile = (y, x0, x1) => { let c = 0; for (let x = x0; x < x1; x++) if (sicht(x, y)) c++; return c; };
  const spalte = (x, y0, y1) => { let c = 0; for (let y = y0; y < y1; y++) if (sicht(x, y)) c++; return c; };
  const ys = teile(alles[1], alles[3], reihen.length, (y) => zeile(y, alles[0], alles[2]));
  const out = [];
  let k = 0;
  reihen.forEach((r, ri) => {
    const y0 = ys[ri], y1 = ys[ri + 1];
    const rb = box(alles[0], y0, alles[2], y1);
    const xs = teile(rb[0], rb[2], r.length, (x) => spalte(x, y0, y1));
    for (let ci = 0; ci < r.length; ci++) {
      const c = box(xs[ci], y0, xs[ci + 1], y1);
      const pad = 6;
      const sx = Math.max(0, c[0] - pad), sy = Math.max(0, c[1] - pad);
      const sw = Math.min(W, c[2] + pad) - sx, sh = Math.min(H, c[3] + pad) - sy;
      const gr = groessen[k++];
      // { max }: Seitenverhältnis behalten, längste Kante höchstens max
      const nat = gr.max ? Math.min(1, gr.max / Math.max(sw, sh)) : 0;
      const [tw, th] = gr.max ? [Math.round(sw * nat), Math.round(sh * nat)] : gr;
      // nur die Zelle verwenden, damit nichts vom Nachbarn hereinragt
      const zelle = new OffscreenCanvas(sw, sh), zg = zelle.getContext('2d');
      zg.drawImage(cv, sx, sy, sw, sh, 0, 0, sw, sh);
      zg.globalCompositeOperation = 'destination-in';
      zg.fillRect(Math.max(0, xs[ci] - sx), Math.max(0, y0 - sy), xs[ci + 1] - xs[ci], y1 - y0);
      const rand = gr.max ? 0 : 0.04, f = Math.min(tw * (1 - 2 * rand) / sw, th * (1 - 2 * rand) / sh);
      const dw = Math.round(sw * f), dh = Math.round(sh * f);
      const o = document.createElement('canvas'); o.width = tw; o.height = th;
      const og = o.getContext('2d'); og.imageSmoothingQuality = 'high';
      og.drawImage(zelle, 0, 0, sw, sh, Math.round((tw - dw) / 2), Math.round((th - dh) / 2), dw, dh);
      out.push({ box: [sx, sy, sw, sh], webp: o.toDataURL('image/webp', 0.84) });
    }
  });
  return { gefunden: out.length, out };
}`;

const chrome = await openChrome();
if (process.argv[2] === 'ui') {
  await zerschneideUi();
  chrome.close();
  process.exit(0);
}
const zuordnung = { _hinweis: 'Welches Bild gehört zu welcher id. Erzeugt von tools/zerschneide.mjs und tools/bilder.mjs.', items: {}, gegner: {}, vorgemerkt: {}, quelle: {} };
if (existsSync('assets/zuordnung.json')) Object.assign(zuordnung, JSON.parse(readFileSync('assets/zuordnung.json', 'utf8')), { items: {}, gegner: {}, vorgemerkt: {} });
let bytes = 0;
for (const sheet of SHEETS) {
  const ids = sheet.reihen.flat();
  const b64 = readFileSync(ROH + sheet.datei).toString('base64');
  const typ = sheet.datei.endsWith('.webp') ? 'image/webp' : 'image/png';
  const r = await chrome.run(`(${SEITE})(${JSON.stringify(b64)}, ${JSON.stringify(sheet.reihen)}, ${JSON.stringify(ids.map((id) => groesse(id, sheet.ziel)))}, '${typ}')`);
  if (r.out.length !== ids.length) throw new Error(`${sheet.datei}: ${r.out.length} Objekte gefunden, ${ids.length} erwartet`);
  mkdirSync(`assets/${sheet.ziel}`, { recursive: true });
  ids.forEach((id, k) => {
    const buf = Buffer.from(r.out[k].webp.split(',')[1], 'base64');
    const pfad = `${sheet.ziel}/${id}.webp`;
    writeFileSync(`assets/${pfad}`, buf);
    bytes += buf.length;
    if (VORGEMERKT[id]) zuordnung.vorgemerkt[id] = { bild: pfad, verb: VORGEMERKT[id] };
    else zuordnung[sheet.ziel][id] = pfad;
    zuordnung.quelle[pfad] = { sheet: sheet.datei, ausschnitt: r.out[k].box };
  });
  console.log(`${sheet.datei}: ${ids.length} Bilder`);
}
chrome.close();
writeFileSync('assets/zuordnung.json', JSON.stringify(zuordnung, null, 2) + '\n');
console.log(`Zusammen ${(bytes / 1024).toFixed(0)} KB`);
schreibeVorschau(zuordnung);


// ---------- Oberfläche ----------
async function zerschneideUi() {
  const z = JSON.parse(readFileSync('assets/zuordnung.json', 'utf8'));
  z.ui = { flaechen: {} };
  let summe = 0;
  for (const sheet of UI_SHEETS) {
    const ids = sheet.reihen.flat();
    const b64 = readFileSync(ROH + 'ui/' + sheet.datei).toString('base64');
    const r = await chrome.run(`(${SEITE})(${JSON.stringify(b64)}, ${JSON.stringify(sheet.reihen)}, ${JSON.stringify(ids.map(() => ({ max: sheet.max })))}, 'image/png')`);
    if (r.out.length !== ids.length) throw new Error(`${sheet.datei}: ${r.out.length} Teile gefunden, ${ids.length} erwartet`);
    mkdirSync(`assets/ui/${sheet.gruppe}`, { recursive: true });
    z.ui[sheet.gruppe] = {};
    ids.forEach((id, k) => {
      const buf = Buffer.from(r.out[k].webp.split(',')[1], 'base64');
      const pfad = `ui/${sheet.gruppe}/${id}.webp`;
      writeFileSync(`assets/${pfad}`, buf);
      summe += buf.length;
      z.ui[sheet.gruppe][id] = pfad;
      z.quelle[pfad] = { sheet: 'ui/' + sheet.datei, ausschnitt: r.out[k].box };
    });
    console.log(`${sheet.datei}: ${ids.length} Teile`);
  }
  for (const e of UI_EINZELN) {
    const b64 = readFileSync(ROH + 'ui/' + e.datei).toString('base64');
    const r = await chrome.run(`(async () => { const img = new Image(); img.src = 'data:image/png;base64,${b64}'; await img.decode();
      const f = Math.min(1, ${e.breite} / img.width), o = document.createElement('canvas');
      o.width = Math.round(img.width * f); o.height = Math.round(img.height * f);
      const g = o.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, o.width, o.height);
      return { w: o.width, h: o.height, webp: o.toDataURL('image/webp', ${e.qualitaet || 0.82}) }; })()`);
    const buf = Buffer.from(r.webp.split(',')[1], 'base64');
    const pfad = `ui/${e.id}.webp`;
    writeFileSync(`assets/${pfad}`, buf);
    summe += buf.length;
    z.ui.flaechen[e.id] = pfad;
    console.log(`${e.datei}: ${r.w}×${r.h}`);
  }
  writeFileSync('assets/zuordnung.json', JSON.stringify(z, null, 2) + '\n');
  console.log(`Oberfläche zusammen ${(summe / 1024).toFixed(0)} KB`);
  schreibeVorschau(z);
}
