// Schreibt assets/vorschau.html: jedes Item mit seinem Bild (oder „fehlt“), Gegner, Figuren und Hintergründe.
import { readFileSync, writeFileSync } from 'node:fs';

const items = JSON.parse(readFileSync('items.json', 'utf8')).items;

// Vorschau: jedes Item mit Bild (oder „fehlt“), damit man die Zuordnung prüfen kann.
export function schreibeVorschau(z) {
  const zeile = (d) => {
    const bild = z.items[d.id];
    return `<div class="karte${bild ? '' : ' fehlt'}">${bild ? `<img src="${bild}" alt="">` : `<span class="emoji">${d.emoji || ''}</span>`}
      <b>${d.artikel ? d.artikel + ' ' : ''}${d.name}</b><small>${d.id} · ${d.w}×${d.h}${bild ? '' : ' · kein Bild (Emoji)'}</small></div>`;
  };
  const gruppen = {};
  for (const d of items) (gruppen[d.art] ||= []).push(d);
  const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Bilder-Vorschau</title>
<style>body{font-family:system-ui,sans-serif;background:#2b1d14;color:#f3e6c8;margin:20px}h2{margin:24px 0 8px}
.raster{display:flex;flex-wrap:wrap;gap:12px}.karte{background:#f3e6c8;color:#2a1e14;border-radius:12px;padding:10px;width:150px;display:flex;flex-direction:column;align-items:center;gap:4px;text-align:center}
.karte img{max-width:130px;max-height:200px;background:repeating-conic-gradient(#ddd 0 25%,#fff 0 50%) 0/16px 16px;border-radius:8px}
.karte.breit{width:330px}.karte.breit img{max-width:310px}.karte.fehlt{opacity:.75;outline:2px dashed #c8423a}.emoji{font-size:64px}small{color:#6b5843}</style></head><body>
<h1>Runenrucksack – Bilder-Vorschau</h1><p>Erzeugt von tools/zerschneide.mjs. Rot gestrichelt: kein eigenes Bild, im Spiel steht das Emoji (Komposita zeigen das Bild ihres Trägers).</p>
${Object.entries(gruppen).map(([art, list]) => `<h2>${art}</h2><div class="raster">${list.map(zeile).join('')}</div>`).join('')}
<h2>Gegner</h2><div class="raster">${Object.entries(z.gegner).map(([id, b]) => `<div class="karte"><img src="${b}"><b>${id}</b></div>`).join('')}</div>
<h2>Vorgemerkt für neue Verben</h2><div class="raster">${Object.entries(z.vorgemerkt).map(([id, v]) => `<div class="karte"><img src="${v.bild}"><b>${v.verb}</b><small>${id}</small></div>`).join('')}</div>
${z.figuren ? `<h2>Figuren, Bosse, Hintergründe</h2><div class="raster">${Object.entries({ ...z.figuren, ...z.bosse, ...z.hintergruende }).map(([id, b]) => `<div class="karte"><img src="${b}"><b>${id}</b></div>`).join('')}</div>` : ''}
${z.ui ? Object.entries(z.ui).map(([gruppe, bilder]) => `<h2>Oberfläche: ${gruppe}</h2><div class="raster">${Object.entries(bilder).map(([id, b]) => `<div class="karte${gruppe === 'flaechen' ? ' breit' : ''}"><img src="${b}"><b>${id}</b></div>`).join('')}</div>`).join('') : ''}
</body></html>`;
  writeFileSync('assets/vorschau.html', html);
  console.log('assets/vorschau.html geschrieben');
}
