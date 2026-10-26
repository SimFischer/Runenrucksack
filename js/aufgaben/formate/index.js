// Alle Aufgabenformate. Jedes Format: erzeuge(inhalt, rng) → Aufgabe, darstelle(el, aufgabe, melde, vorher),
// pruefe(aufgabe, antwort) → { richtig, falsch? }, loesung(aufgabe) (für Tests), gross(aufgabe) → großes Fenster?
import auswahl from './auswahl.js';
import luecke from './luecke.js';
import buchstaben from './buchstaben.js';
import eintippen from './eintippen.js';
import baukasten from './baukasten.js';
import sortieren from './sortieren.js';
import fehler from './fehler.js';
import ordnen from './ordnen.js';
import passtnicht from './passtnicht.js';
import regel from './regel.js';
import paare from './paare.js';

export const FORMATE = { auswahl, luecke, buchstaben, eintippen, baukasten, sortieren, fehler, ordnen, passtnicht, regel, paare };

export const FORMAT_NAMEN = {
  auswahl: 'Auswahl', luecke: 'Lückensatz', buchstaben: 'Buchstaben ergänzen', eintippen: 'Wort eintippen', baukasten: 'Baukasten',
  sortieren: 'Sortieren', fehler: 'Fehler finden', ordnen: 'Satz ordnen', passtnicht: 'Passt nicht dazu', regel: 'Regel entdecken', paare: 'Paare finden',
};
