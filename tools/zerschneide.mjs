// Zerlegt die Sprite-Sheets aus assets/roh/ anhand der transparenten Lücken in Einzelbilder,
// schneidet sie zu, bringt sie auf einheitliche Größe (1×1: 256 px, 1×2: 256×512 px, 2×2: 512 px)
// und speichert sie als WebP in assets/items/ bzw. assets/gegner/.
// Schreibt außerdem assets/zuordnung.json (Bild → id) und assets/vorschau.html zum Prüfen.
//
//   node tools/zerschneide.mjs
//
// Neue Bilder: Sheet in assets/roh/ legen und unten in SHEETS eintragen (Zeilen von oben nach unten,
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
const SEITE = String.raw`async (b64, reihen, groessen) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
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
      const [tw, th] = groessen[k++];
      // nur die Zelle verwenden, damit nichts vom Nachbarn hereinragt
      const zelle = new OffscreenCanvas(sw, sh), zg = zelle.getContext('2d');
      zg.drawImage(cv, sx, sy, sw, sh, 0, 0, sw, sh);
      zg.globalCompositeOperation = 'destination-in';
      zg.fillRect(Math.max(0, xs[ci] - sx), Math.max(0, y0 - sy), xs[ci + 1] - xs[ci], y1 - y0);
      const rand = 0.04, f = Math.min(tw * (1 - 2 * rand) / sw, th * (1 - 2 * rand) / sh);
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
const zuordnung = { _hinweis: 'Welches Bild gehört zu welcher id. Erzeugt von tools/zerschneide.mjs und tools/bilder.mjs.', items: {}, gegner: {}, vorgemerkt: {}, quelle: {} };
if (existsSync('assets/zuordnung.json')) Object.assign(zuordnung, JSON.parse(readFileSync('assets/zuordnung.json', 'utf8')), { items: {}, gegner: {}, vorgemerkt: {} });
let bytes = 0;
for (const sheet of SHEETS) {
  const ids = sheet.reihen.flat();
  const b64 = readFileSync(ROH + sheet.datei).toString('base64');
  const r = await chrome.run(`(${SEITE})(${JSON.stringify(b64)}, ${JSON.stringify(sheet.reihen)}, ${JSON.stringify(ids.map((id) => groesse(id, sheet.ziel)))})`);
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

