// Erzeugt die App-Symbole (PNG) ohne Zusatzpakete: node tools/make-icons.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const BG = hex('#2b1d14'), BODY = hex('#a0622d'), FLAP = hex('#7a4520'),
  LINE = hex('#1a110b'), GOLD = hex('#e0a526'), RUNE = hex('#f5d27a');

// Abstand zu einem abgerundeten Rechteck (Koordinaten 0..1).
function rrect(x, y, cx, cy, hw, hh, r) {
  const qx = Math.abs(x - cx) - hw + r, qy = Math.abs(y - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}
function seg(x, y, ax, ay, bx, by) {
  const px = x - ax, py = y - ay, dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, (px * dx + py * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - t * dx, py - t * dy);
}

function shade(x, y) {
  let c = BG;
  const strap = Math.min(rrect(x, y, 0.5, 0.2, 0.14, 0.09, 0.07), 99);
  if (strap < 0.03 && strap > -0.012) c = LINE;
  const body = rrect(x, y, 0.5, 0.58, 0.28, 0.27, 0.08);
  if (body < 0.012) c = LINE;
  if (body < -0.006) c = BODY;
  const flap = rrect(x, y, 0.5, 0.42, 0.29, 0.12, 0.07);
  if (flap < 0.012 && y < 0.56) c = LINE;
  if (flap < -0.006 && y < 0.545) c = FLAP;
  // Rune ᚱ auf dem Rucksack
  const w = 0.022;
  const rune = Math.min(
    seg(x, y, 0.45, 0.6, 0.45, 0.8),
    seg(x, y, 0.45, 0.6, 0.56, 0.66),
    seg(x, y, 0.56, 0.66, 0.45, 0.71),
    seg(x, y, 0.45, 0.71, 0.57, 0.8),
  );
  if (rune < w) c = RUNE;
  const buckle = rrect(x, y, 0.5, 0.53, 0.05, 0.04, 0.012);
  if (buckle < 0.008) c = LINE;
  if (buckle < 0) c = GOLD;
  return c;
}

function png(size) {
  const ss = 4, raw = Buffer.alloc((size * 4 + 1) * size);
  for (let py = 0; py < size; py++) {
    raw[py * (size * 4 + 1)] = 0;
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < ss; sy++)
        for (let sx = 0; sx < ss; sx++) {
          const c = shade((px + (sx + 0.5) / ss) / size, (py + (sy + 0.5) / ss) / size);
          r += c[0]; g += c[1]; b += c[2];
        }
      const o = py * (size * 4 + 1) + 1 + px * 4, n = ss * ss;
      raw[o] = r / n; raw[o + 1] = g / n; raw[o + 2] = b / n; raw[o + 3] = 255;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

mkdirSync('icons', { recursive: true });
writeFileSync('icons/icon-192.png', png(192));
writeFileSync('icons/icon-512.png', png(512));
writeFileSync('icons/apple-touch-icon.png', png(180));
console.log('Symbole erstellt.');
