// Botschaften lesen: Briefe mit Fragen zum Leseverständnis. Jede Frage hat genau eine richtige Antwort, die im Text
// belegt ist (textstelle), die Texte haben die richtige Länge und alle Belohnungen gibt es wirklich.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const json = (f) => JSON.parse(readFileSync(new URL('../' + f, import.meta.url)));
const B = json('botschaften.json').briefe;
const ITEMS = new Set(json('items.json').items.map((d) => d.id));
const GEBIETE = json('regions.json').gebiete.map((g) => g.id);
const woerter = (t) => t.split(/\s+/).filter((w) => /[A-Za-zÄÖÜäöüß0-9]/.test(w)).length;

test('Mindestens 30 Briefe, verteilt auf alle Gebiete und Schwierigkeiten 1–3', () => {
  assert.ok(B.length >= 30, `${B.length} Briefe`);
  assert.equal(new Set(B.map((b) => b.id)).size, B.length, 'ids eindeutig');
  for (const g of GEBIETE) for (const s of [1, 2, 3]) {
    assert.ok(B.some((b) => b.gebiet === g && b.schwierigkeit === s), `${g}, Schwierigkeit ${s}`);
  }
  for (const b of B) assert.ok(GEBIETE.includes(b.gebiet), b.id);
});

test('Texte: 60–120 Wörter, kurze Sätze, mit Absender', () => {
  for (const b of B) {
    const n = woerter(b.text);
    assert.ok(n >= 60 && n <= 120, `${b.id}: ${n} Wörter`);
    assert.ok(b.absender, b.id);
    const saetze = b.text.split(/[.!?]+\s/).filter(Boolean);
    const laengster = Math.max(...saetze.map(woerter));
    assert.ok(laengster <= 22, `${b.id}: ein Satz mit ${laengster} Wörtern ist zu lang`);
  }
});

test('Brief statt Begegnung: frühestens ab Tag 2, nie zwei Tage hintereinander, etwa jeden dritten Tag', async () => {
  const { newRun, finishBattle, seededRng } = await import('../js/logic.js');
  const items = json('items.json').items, regions = json('regions.json').gebiete;
  let briefe = 0, tage = 0;
  for (let s = 1; s <= 300; s++) {
    const rng = seededRng(s);
    const run = newRun(items, regions, { rng });
    let gestern = false;
    while (!run.over) {
      finishBattle(run, items, regions, true, 'Ork', rng);
      if (run.over) break;
      const heute = run.queue.includes('brief');
      assert.ok(!(heute && run.queue.includes('begegnung')), 'Brief statt, nicht zusätzlich zur Begegnung');
      assert.ok(!(heute && gestern), `Seed ${s}, Tag ${run.day}: zwei Briefe hintereinander`);
      briefe += heute ? 1 : 0; tage++;
      gestern = heute;
    }
  }
  const anteil = briefe / tage;
  assert.ok(anteil > 0.25 && anteil < 0.42, `Anteil Brief-Tage: ${anteil.toFixed(2)}`);
});

test('Briefwahl nach Gebiet und Lernstand; Auswertung mit Belohnung, Trost und markierter Textstelle', async () => {
  const { waehleBrief, werteAus, verbucheBrief } = await import('../js/botschaften.js');
  const b = waehleBrief(B, { gebiet: 'hrossmark', stufe: 3, gelesen: [], rng: () => 0 });
  assert.equal(b.gebiet, 'hrossmark');
  assert.equal(b.schwierigkeit, 3);
  const gelesen = B.filter((x) => x.gebiet === 'hrossmark' && x.schwierigkeit === 3).map((x) => x.id);
  assert.equal(waehleBrief(B, { gebiet: 'hrossmark', stufe: 3, gelesen, rng: () => 0 }).gebiet, 'hrossmark', 'alle gelesen: andere Schwierigkeit');
  const mila = B.find((x) => x.id === 'kw-mila-eis');
  const richtig = werteAus(mila, mila.fragen.map((f) => f.richtig));
  assert.deepEqual(richtig.belohnungen, mila.fragen.map((f) => f.belohnung));
  assert.deepEqual(richtig.belohnungen[0], { typ: 'item', id: 'eis' }, 'Orks fürchten Eis → Eis-Kristall');
  const falsch = werteAus(mila, ['Feuer und Rauch', mila.fragen[1].richtig]);
  assert.deepEqual(falsch.falsch.map((x) => x.textstelle), [mila.fragen[0].textstelle]);
  assert.ok(falsch.belohnungen.includes(mila.trost) && !falsch.belohnungen.includes(mila.fragen[0].belohnung));
  const profil = { lernstand: {} };
  verbucheBrief(profil, true);
  assert.equal(verbucheBrief(profil, true).stufe, 2, 'zwei Briefe ganz richtig → nächste Stufe');
  verbucheBrief(profil, false);
  assert.equal(profil.lernstand.lesen.sicher, 0);
});
