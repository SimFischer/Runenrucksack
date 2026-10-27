// Prüfliste für Lehrkräfte: alle Wörter aus wortschatz.json als sortierbare Tabellen mit Häkchen-Spalte.
// Einträge mit „unsicher“ sind gelb markiert, ebenso unsichere Sätze (⚠). Die Häkchen merkt sich der Browser.
//
//   node tools/pruefliste.mjs      → wortschatz-pruefliste.html (im Browser öffnen)
import { readFileSync, writeFileSync } from 'node:fs';
import { rahmenSatz } from '../js/aufgaben/saetze.js';

const ws = JSON.parse(readFileSync('wortschatz.json', 'utf8'));
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;');
// Sätze eines Eintrags, unsichere mit ⚠ davor; dazu der Hinweis für die Zeile
const saetze = (liste, e) => liste.map((s) => (e.satzUnsicher?.includes(s) ? '⚠ ' + s : s)).join(' / ');
const hinweis = (e, extra = '') => [extra, e.satzUnsicher ? `Satz unsicher (⚠)` : ''].filter(Boolean).join(' · ');
// Verben: jeder Rahmen im Präsens, der erste auch im Präteritum und Perfekt, dazu der Satz mit dem Verb als Nomen
const verbSaetze = (v) => [...v.rahmen.map((r) => rahmenSatz(v, r).satz), rahmenSatz(v, v.rahmen[0], 'praeteritum').satz,
  ...(v.hilfsverb === 'beide' ? [] : [rahmenSatz(v, v.rahmen[0], 'perfekt').satz]), ...(v.nominal ? [v.nominal] : [])];

function tabelle(id, titel, kopf, zeilen) {
  return `<h2 id="${id}">${titel} <small>(${zeilen.length})</small></h2>
<table class="sort" data-id="${id}"><thead><tr><th>✓</th>${kopf.map((k) => `<th>${k}</th>`).join('')}<th>Hinweis</th></tr></thead><tbody>
${zeilen.map(({ key, zellen, unsicher }) => `<tr class="${unsicher ? 'unsicher' : ''}"><td><input type="checkbox" data-key="${esc(id + ':' + key)}"></td>${zellen.map((z) => `<td>${esc(z)}</td>`).join('')}<td>${esc(unsicher || '')}</td></tr>`).join('\n')}
</tbody></table>`;
}

const teile = [
  tabelle('nomen', 'Nomen', ['Artikel', 'Wort', 'Mehrzahl', 'Muster', 'Silben', 'Wortfeld', 'Bedeutungsgruppe', 'Stufe', 'Rechtschreibung', 'Ableitung / Grundwort', 'Sätze (zuletzt Mehrzahl)'],
    ws.nomen.map((n) => ({ key: n.wort, unsicher: hinweis(n, n.unsicher || (n.mehrdeutig ? 'mehrdeutig – nie für Artikel/Mehrzahl' : '')),
      zellen: [n.artikel, n.wort, n.plural, n.pluralmuster, n.silben.join('-'), ws.wortfelder[n.wortfeld]?.name || n.wortfeld, n.gruppe, n.schwierigkeit, n.phaenomene.join(', '), n.ableitung || n.grundwort || '',
        saetze([...n.saetze, n.mehrzahlSatz], n)] }))),
  tabelle('verben', 'Verben', ['Infinitiv', 'ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie', 'Präteritum', 'Perfekt', 'unregelmäßig', 'Stufe', 'Sätze'],
    ws.verben.map((v) => ({ key: v.infinitiv, unsicher: hinweis(v, v.unsicher),
      zellen: [v.infinitiv, ...Object.values(v.praesens), v.praeteritum, `${{ haben: 'hat', sein: 'ist', beide: 'hat/ist' }[v.hilfsverb]} ${v.partizip}`, v.unregelmaessig ? 'ja' : 'nein', v.schwierigkeit, saetze(verbSaetze(v), v)] }))),
  tabelle('adjektive', 'Adjektive', ['Positiv', 'Komparativ', 'Superlativ', 'Gegenteil', 'unregelmäßig', 'Umlaut', 'Stufe', 'Sätze'],
    ws.adjektive.map((a) => ({ key: a.positiv, unsicher: hinweis(a, a.unsicher),
      zellen: [a.positiv, a.komparativ, a.superlativ, a.gegenteil, a.unregelmaessig ? 'ja' : 'nein', a.umlaut ? 'ja' : 'nein', a.schwierigkeit, saetze(Object.values(a.saetze), a)] }))),
  tabelle('komposita', 'Komposita', ['Bestimmungswort', 'Fuge', 'Grundwort', 'Kompositum', 'Artikel'],
    ws.komposita.map((k) => ({ key: k.wort, zellen: [k.bestimmungswort, k.fuge || '–', k.grundwort, k.wort, k.artikel] }))),
  tabelle('familien', 'Wortfamilien', ['Wörter', 'Falle (gehört nicht dazu)'],
    ws.wortfamilien.map((f) => ({ key: f.wort, zellen: [f.woerter.join(' – '), f.falle] }))),
  tabelle('saetze', 'Sätze', ['Satz', 'Satzglieder'],
    ws.saetze.map((s, i) => ({ key: String(i), zellen: [s.glieder.map((g) => g.woerter.map((w) => w.wort).join(' ')).join(' ') + '.', s.glieder.map((g) => `${g.woerter.map((w) => w.wort).join(' ')} (${g.rolle})`).join(' | ')] }))),
];

const html = `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wortschatz – Prüfliste</title>
<style>
body{font-family:system-ui,sans-serif;margin:16px;color:#222;background:#faf7f0}
h1{margin:0 0 4px} h2{margin:28px 0 6px} small{color:#777;font-weight:400}
nav a{margin-right:12px}
table{border-collapse:collapse;width:100%;background:#fff;font-size:14px}
th,td{border:1px solid #ddd;padding:4px 6px;text-align:left;vertical-align:top}
th{background:#efe6d2;cursor:pointer;position:sticky;top:0} th:first-child{cursor:default}
tr.unsicher td{background:#fff3c4} tr.ok td{background:#e8f5e4}
.legende span{display:inline-block;padding:2px 8px;margin-right:8px;border:1px solid #ddd}
</style></head><body>
<h1>Wortschatz – Prüfliste</h1>
<p>Erzeugt mit <code>node tools/pruefliste.mjs</code> aus <code>wortschatz.json</code>. Klick auf eine Spaltenüberschrift sortiert. Häkchen merkt sich dieser Browser.
Fehler bitte direkt in <code>wortschatz.json</code> korrigieren und danach <code>node --test</code> ausführen.</p>
<p class="legende"><span style="background:#fff3c4">gelb: bitte besonders prüfen</span><span style="background:#e8f5e4">grün: abgehakt</span> <b id="stand"></b></p>
<nav>${['nomen', 'verben', 'adjektive', 'komposita', 'familien', 'saetze'].map((id) => `<a href="#${id}">${id}</a>`).join('')}</nav>
${teile.join('\n')}
<script>
const KEY = 'wortschatz-pruefliste';
let haken = {}; try { haken = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}
const stand = () => { const alle = document.querySelectorAll('[data-key]'); const n = [...alle].filter((c) => c.checked).length; document.getElementById('stand').textContent = n + ' von ' + alle.length + ' geprüft'; };
document.querySelectorAll('[data-key]').forEach((c) => {
  c.checked = !!haken[c.dataset.key];
  c.closest('tr').classList.toggle('ok', c.checked);
  c.onchange = () => { haken[c.dataset.key] = c.checked; c.closest('tr').classList.toggle('ok', c.checked); try { localStorage.setItem(KEY, JSON.stringify(haken)); } catch {} stand(); };
});
document.querySelectorAll('table.sort th').forEach((th, i) => {
  if (!i) return;
  th.onclick = () => {
    const tb = th.closest('table').tBodies[0];
    const auf = th.dataset.auf !== '1'; th.dataset.auf = auf ? '1' : '0';
    [...tb.rows].sort((a, b) => a.cells[i].textContent.localeCompare(b.cells[i].textContent, 'de', { numeric: true }) * (auf ? 1 : -1)).forEach((r) => tb.append(r));
  };
});
stand();
</script></body></html>`;
writeFileSync('wortschatz-pruefliste.html', html);
console.log(`wortschatz-pruefliste.html: ${ws.nomen.length} Nomen, ${ws.verben.length} Verben, ${ws.adjektive.length} Adjektive, ${ws.komposita.length} Komposita, ${ws.wortfamilien.length} Wortfamilien, ${ws.saetze.length} Sätze`);
