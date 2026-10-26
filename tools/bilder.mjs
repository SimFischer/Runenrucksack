// Verkleinert Figuren, Bosse, Hintergründe und Titelbild aus assets/roh/ und speichert sie als WebP in assets/.
// Rechnet außerdem das App-Symbol in alle nötigen Größen um (icons/).
//
//   node tools/bilder.mjs
//
// Neue Figur oder neuer Hintergrund: Bild in assets/roh/ legen und unten in BILDER eintragen.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { openChrome } from './chrome.mjs';
import { schreibeVorschau } from './vorschau.mjs';

const ROH = 'assets/roh/';
// art: figuren/bosse → 512 px hoch, hintergruende → 1536 px breit
const BILDER = [
  { datei: 'figur-borga.png', id: 'borga', art: 'figuren' },
  { datei: 'figur-eadrun.png', id: 'eadrun', art: 'figuren' },
  { datei: 'figur-faelith.png', id: 'faelith', art: 'figuren' },
  { datei: 'figur-theron.png', id: 'theron', art: 'figuren' },
  { datei: 'figur-ysolde.png', id: 'ysolde', art: 'figuren' },
  { datei: 'figur-fenwick.png', id: 'fenwick', art: 'figuren' },
  { datei: 'boss-pluenderer.png', id: 'pluenderer', art: 'bosse' },
  { datei: 'boss-wolfsreiter.png', id: 'haeuptling', art: 'bosse' },
  { datei: 'hintergrund-kleinwurzel.png', id: 'kleinwurzel', art: 'hintergruende' },
  { datei: 'hintergrund-hrossmark.png', id: 'hrossmark', art: 'hintergruende' },
  { datei: 'titelbild.png', id: 'titelbild', art: 'hintergruende' },
];
const SYMBOLE = [['icons/icon-192.png', 192], ['icons/icon-512.png', 512], ['icons/apple-touch-icon.png', 180]];

// Läuft in der Seite: verkleinert auf feste Höhe oder Breite (Figuren werden eng zugeschnitten).
const SEITE = String.raw`async (b64, hoch, breit, eng, typ, q) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (eng) {
    const c = new OffscreenCanvas(sw, sh), g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const a = g.getImageData(0, 0, sw, sh).data;
    let x0 = sw, y0 = sh, x1 = 0, y1 = 0;
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) if (a[(y * sw + x) * 4 + 3] > 30) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    sx = Math.max(0, x0 - 4); sy = Math.max(0, y0 - 4); sw = Math.min(img.width, x1 + 5) - sx; sh = Math.min(img.height, y1 + 5) - sy;
  }
  const f = hoch ? hoch / sh : breit / sw;
  const o = document.createElement('canvas'); o.width = Math.round(sw * f); o.height = Math.round(sh * f);
  const og = o.getContext('2d'); og.imageSmoothingQuality = 'high';
  og.drawImage(img, sx, sy, sw, sh, 0, 0, o.width, o.height);
  return { b: o.width, h: o.height, data: o.toDataURL(typ, q) };
}`;

const chrome = await openChrome();
const z = existsSync('assets/zuordnung.json') ? JSON.parse(readFileSync('assets/zuordnung.json', 'utf8')) : { items: {}, gegner: {}, vorgemerkt: {} };
z.figuren = {}; z.bosse = {}; z.hintergruende = {};
let bytes = 0;
const rechne = async (datei, hoch, breit, eng, typ = 'image/webp', q = 0.8) => {
  const b64 = readFileSync(ROH + datei).toString('base64');
  return chrome.run(`(${SEITE})(${JSON.stringify(b64)}, ${hoch || 0}, ${breit || 0}, ${eng}, '${typ}', ${q})`);
};
for (const b of BILDER) {
  const flach = b.art === 'hintergruende';
  const r = await rechne(b.datei, flach ? 0 : 512, flach ? 1536 : 0, !flach, 'image/webp', flach ? 0.72 : 0.82);
  const ziel = `${b.datei.replace('.png', '.webp')}`;
  const buf = Buffer.from(r.data.split(',')[1], 'base64');
  writeFileSync('assets/' + ziel, buf);
  bytes += buf.length;
  z[b.art][b.id] = ziel;
  console.log(`assets/${ziel}`.padEnd(40), `${r.b}×${r.h}`, `${Math.round(buf.length / 1024)} KB`);
}
for (const [pfad, px] of SYMBOLE) {
  const r = await rechne('app-symbol.png', px, 0, false, 'image/png', 1);
  writeFileSync(pfad, Buffer.from(r.data.split(',')[1], 'base64'));
  console.log(pfad.padEnd(40), `${r.b}×${r.h}`);
}
chrome.close();
writeFileSync('assets/zuordnung.json', JSON.stringify(z, null, 2) + '\n');
console.log(`Figuren, Bosse, Hintergründe zusammen ${Math.round(bytes / 1024)} KB`);
schreibeVorschau(z);
