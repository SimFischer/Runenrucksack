// Symbole statt Emojis: Bilder aus assets/ui/ (ui-symbole, zustand-symbole, banner, effekte, Fenwick, besiegte Orks).
// sym('gold') → <img class="sym" …>; Zustände (Brand, Gift …) haben ihre eigenen runden Plaketten.
const PFADE = {
  gold: 'symbole/gold', herz: 'symbole/herz', herzZerbrochen: 'symbole/herz-zerbrochen', pokal: 'symbole/pokal',
  tag: 'symbole/tag', nacht: 'symbole/nacht', sanduhr: 'symbole/sanduhr', schloss: 'symbole/schloss',
  stern: 'symbole/stern', buch: 'symbole/buch', truhe: 'symbole/truhe', karte: 'symbole/karte',
  menue: 'symbole/menue', wuerfel: 'symbole/wuerfel', kampf: 'symbole/kampf', eule: 'symbole/eule',
  brand: 'zustand/brand', gift: 'zustand/gift', kaelte: 'zustand/kaelte', betaeubung: 'zustand/betaeubung',
  block: 'zustand/block', heilung: 'zustand/heilung', tempo: 'zustand/tempo', glueck: 'zustand/glueck',
};
export const symbolPfad = (name) => `assets/ui/${PFADE[name] || name}.webp`;
export const sym = (name, cls = '') => `<img class="sym${cls ? ' ' + cls : ''}" src="${symbolPfad(name)}" alt="" draggable="false">`;

// Kampfwerte → Zustandssymbol (Info-Feld, Kampf)
export const WERT_SYMBOL = {
  schaden: 'kampf', block: 'block', startblock: 'block', heilung: 'heilung', regeneration: 'heilung', leben: 'herz',
  gift: 'gift', brand: 'brand', kaelte: 'kaelte', betaeubung: 'betaeubung', tempo: 'tempo', glueck: 'glueck', abklingzeit: 'sanduhr',
};

// Banner, Effekte, Fenwick, besiegte Orks
export const bild = (gruppe, id) => `assets/ui/${gruppe}/${id}.webp`;
export const FENWICK = { erklaert: bild('fenwick', 'erklaert'), tipp: bild('fenwick', 'tipp'), jubelt: bild('fenwick', 'jubelt') };
