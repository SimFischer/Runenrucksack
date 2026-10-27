// Sätze für Verb-Rollen (ohne Darstellung, testbar): Eine Person handelt, der Gegenstand ist das Werkzeug.
// „Eadrun stürmt mit dem Eisspeer auf die Orks zu.“ / „Wir stürmen mit den Speeren los.“
// Vorlagen stehen in wortschatz.json bei den Verben (vorlagen: {S} Subjekt, ___ Personalform, {D} Gegenstand im Dativ).
import { pluralOf } from '../grammar.js';
import { falscheFormen } from './wortschatz.js';

// Reihenfolge der Personen: Jede neue Rolle nimmt die nächste, so kommen alle Personalformen dran.
export const PERSONEN_FOLGE = ['er', 'ich', 'wir', 'du', 'sie', 'ihr'];
const PRONOMEN = { ich: 'Ich', du: 'Du', wir: 'Wir', ihr: 'Ihr' };
const DATIV_ARTIKEL = { der: 'dem', das: 'dem', die: 'der' };

// Kurzer Name der Figur: „Borga Eisenfaust“ → „Borga“
export const kurzName = (name) => String(name || 'Eadrun').split(' ')[0];

// Subjekt für eine Person: ich, du, die Figur (er/sie), wir, ihr, zwei Figuren (sie)
export function subjektFuer(person, figur = 'Eadrun') {
  if (PRONOMEN[person]) return PRONOMEN[person];
  if (person === 'sie') return figur === 'Borga' ? 'Borga und Eadrun' : `${figur} und Borga`;
  return figur;
}

// Dativ-Plural: -n anhängen, außer das Wort endet schon auf -n oder -s (den Speeren, den Äxten, den Bögen)
export const dativPlural = (wort) => (/[ns]$/.test(wort) ? wort : wort + 'n');

// „mit dem Eisspeer“, „mit der Axt“, „mit den Speeren“ (★★ und mehr = Mehrzahl, wie bisher)
export function mitDativ(def, stern, defs) {
  const pl = stern > 1 ? pluralOf(def, defs) : null;
  if (pl) return `den ${dativPlural(pl.richtig)}`;
  return `${DATIV_ARTIKEL[def.artikel] || 'dem'} ${def.name}`;
}

export const verbVon = (ws, verbDef) => ws?.verben?.find((v) => v.infinitiv === verbDef.name) || null;
export const vorlagenFuer = (ws, verbDef) => verbVon(ws, verbDef)?.vorlagen || [];

// Personalform aus dem Wortschatz; ohne Eintrag nur er/sie aus items.json.
function form(ws, verbDef, person) {
  const v = verbVon(ws, verbDef);
  if (v) return v.praesens[person];
  return ['sie', 'wir'].includes(person) ? verbDef.formen.sie : verbDef.formen.er;
}

// Ein Satz: { luecke: „Eadrun ___ mit dem Eisspeer los.“, form: „stürmt“, satz: „Eadrun stürmt mit dem Eisspeer los.“ }
export function verbSatz({ verbDef, subjDef, stern = 1, defs, ws, person = 'er', figur = 'Eadrun', vorlage = 0 }) {
  const vorlagen = vorlagenFuer(ws, verbDef);
  const f = form(ws, verbDef, person);
  // Ohne Wortschatz (Simulation, einzelne Tests) gibt es keinen Satz – nur Person, Form und Gegenstand
  if (!vorlagen.length) {
    const kurz = `${subjektFuer(person, figur)}: ___ (mit ${mitDativ(subjDef, stern, defs)})`;
    return { luecke: kurz, form: f, satz: kurz.replace('___', f), person };
  }
  const v = vorlagen[vorlage % vorlagen.length];
  const luecke = v.replace('{S}', subjektFuer(person, figur)).replace('{D}', mitDativ(subjDef, stern, defs));
  return { luecke, form: f, satz: luecke.replace('___', f), person };
}

// Aufgabe fürs Aufgabensystem (Thema Personalformen): Stufe 1–2 Lückensatz mit Auswahl, Stufe 3 Eintippen.
export function verbSatzInhalt({ verbDef, subjDef, stern, defs, ws, person, figur, vorlage, stufe = 1, rng = Math.random }) {
  const s = verbSatz({ verbDef, subjDef, stern, defs, ws, person, figur, vorlage });
  const v = verbVon(ws, verbDef);
  const vokal = v && v.praesens.du.slice(0, 3) !== v.infinitiv.slice(0, 3);
  const regel = vokal && ['du', 'er'].includes(person) ? 'person-vokal' : 'person-endung';
  const wer = { ich: 'ich', du: 'du', er: 'er/sie', wir: 'wir', ihr: 'ihr', sie: 'sie (mehrere)' }[person];
  const basis = {
    thema: 'personalformen', stufe, regel, wort: `rolle:${verbDef.id}:${person}`,
    merke: `${ws?.regelText ? ws.regelText(regel) + ' ' : ''}Hier: ${wer} ${s.form}. „${s.satz}“`,
    satzVoll: s.satz,
  };
  if (stufe >= 3) return { ...basis, format: 'eintippen', frage: `Schreibe die passende Form von „${verbDef.name}“: ${s.luecke}`, loesung: s.form };
  const falsch = v ? falscheFormen(v, person) : [...(verbDef.formen.falschEr || []), ...(verbDef.formen.falschSie || [])].filter((x) => x !== s.form);
  const anzahl = stufe === 1 ? 2 : 3;
  const auswahl = [];
  for (const f of falsch) if (f !== s.form && !auswahl.includes(f) && auswahl.length < anzahl) auswahl.push(f);
  const optionen = [s.form, ...auswahl].sort(() => rng() - 0.5);
  return { ...basis, format: 'luecke', frage: `Welche Form von „${verbDef.name}“ passt?`, satz: s.luecke, optionen, richtig: s.form };
}
