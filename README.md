# Runenrucksack

Ein Fantasy-Backpack-Battler fürs iPad (Querformat) als Web-App, in dem Grammatik das Regelwerk der Kombos ist. Das vollständige Spielkonzept steht in [konzept.md](konzept.md).

**Stand: Etappe 3 – Pfad 1 vollständig**

Spielen: <https://simfischer.github.io/Runenrucksack/> – auf dem iPad in Safari öffnen, **Teilen → Zum Home-Bildschirm**, dann startet es wie eine App im Vollbild und läuft auch offline.

## So läuft ein Lauf

1. **Figur wählen:** Borga Eisenfaust (Komposita +20 %, Start mit Axt und Feuer) oder Eadrun die Reiterin (Schriftrollen 20 % schneller, Start mit Speer und „stürmen“).
2. **Schicksalsrune:** Eine von sechs zufälligen Regeln gilt für den ganzen Lauf, z. B. „Feuer-Komposita doppelt so stark“ oder „Laden hat 6 Plätze“.
3. **Zehn Tage, zwei Gebiete:** Kleinwurzel (Tag 1–5, Boss: Ork-Plünderer) und Hrossmark (Tag 6–10, Boss: Wolfsreiter-Häuptling). Beim Gebietswechsel gibt es einen Übergangsbildschirm, in Hrossmark wählt man eine **Unterklasse**.
4. **Jeder Tag:**
   - **Morgen:** Begegnung am Wegesrand (drei zur Wahl), danach verschmelzen Kristalle mit Trägern und gleiche Runen werden gesteigert.
   - **Tag:** Laden mit 5 Items, Neu würfeln für 1 Gold, Reservieren, Verkaufen, Verschieben, Drehen.
   - **Nacht:** Automatischer Kampf. Vorher kann man den Fehler auf der Ork-Rüstung verbessern (ein Versuch, richtig: Ork startet mit 15 % weniger Leben).
5. **Ende:** nach dem 10. Kampf („Reise geschafft“, mit Sternen nach Siegen) oder wenn alle 5 Herzen weg sind.

## Grammatik im Spiel

| Mechanik | Regel | Lernziel |
| --- | --- | --- |
| Komposita | Kraft-Kristall links neben oder über einem Träger → Artikel wählen: „Feuer + Schwert = ___ Feuerschwert“ | Das letzte Wort bestimmt den Artikel |
| Artikel-Siegel | der/die/das neben einem Nomen mit passendem Genus: +25 % | Genus der Nomen |
| Adjektiv-Runen | Pfeil zeigt auf ein passendes Nomen: „scharfes Schwert“ | Adjektiv vor dem Nomen, Endungen |
| Steigerung | Drei gleiche Runen in einer Reihe → Komparativ → Superlativ (+50 % je Stufe) | scharf – schärfer – am schärfsten, gut – besser – am besten |
| Begegnungen | Plural, Artikel, Rechtschreibung auf der Speisekarte, Personalformen, Fehler im Namen | Wiederholung Klasse 5 |
| Ork-Rüstung | Falsch geschriebenes Wort verbessern | Rechtschreibung |
| Wortfeld-Taschen | Gartentasche, Satteltasche: Items aus dem passenden Wortfeld +20 % | Wortfelder |

**Regel für alle Aufgaben:** Der erste Versuch ist kostenlos, jeder weitere kostet 1 Gold, bei Fehlern erscheint eine kurze Erklärzeile. **Eine grammatisch falsche Kombination ist nie stärker als eine richtige** – die Tests prüfen das.

## Inhalte ändern (ohne Programmieren)

Alle Inhalte stehen in JSON-Dateien. Jede Datei hat oben ein Feld `_hinweis`, das ihre Felder erklärt. Nach dem Ändern `CACHE` in `sw.js` um eins erhöhen, damit installierte Apps die neue Version laden.

| Datei | Inhalt |
| --- | --- |
| `items.json` | Alle Items im Laden: Wortart (`art`), Artikel, Wortfeld, Form, Seltenheit, Preis, Kampfwerte; Runen mit Steigerungsformen; Taschen |
| `recipes.json` | Welche Items Träger sind und was jede Kraft beim Verschmelzen dazugibt |
| `exercises.json` | **Die Wörter der Aufgaben:** Plural, Artikel, Speisekarten, Personalformen, Kobold-Namen |
| `encounters.json` | Die Begegnungen: Figur, Text, Aufgabentyp, Belohnung, Gebiet |
| `enemies.json` | Die Orks: Vorlieben beim Packen und die falschen Wörter auf ihren Rüstungen |
| `regions.json` | Die Gebiete: Tage, Farben, Wortfeld, Gegner, Boss |
| `heroes.json` | Startfiguren mit Bonus, Start-Items und Unterklassen; die sechs Schicksalsrunen |

### Beispiele

- **Neues Plural-Wort:** in `exercises.json` unter `plural` eine Zeile ergänzen:
  `{ "wort": "das Kind", "richtig": "die Kinder", "falsch": ["die Kinds", "die Kinde"], "regel": "Kind → Kinder: dazu kommt -er." }`
- **Neues Artikel-Rätsel:** unter `artikel`: `{ "wort": "Schüssel", "artikel": "die" }`
- **Neue Speisekarte:** unter `speisekarten`; das falsch geschriebene Wort als `falsch|richtig`:
  `{ "zeilen": ["Tomatensuppe", "Reis mit Gemüse", "Kirschen mit Sahne|Sahne"], "erklaerung": "…" }` – genau ein Wort pro Karte mit `|`.
- **Neuer Fehler auf einer Ork-Rüstung:** in `enemies.json` beim Gegner unter `fehler`; `optionen` enthält genau eine richtige Schreibung.
- **Neuer Träger** (z. B. ein Besen): Item in `items.json` mit `"art": "traeger"` anlegen und die id in `recipes.json` unter `traeger` eintragen – alle acht Komposita entstehen automatisch.

Die Tests (siehe unten) melden, wenn eine Aufgabe nicht genau eine richtige Lösung hat.

## Lokal testen

Mit Node.js im Projektordner:

```bash
node tools/serve.mjs
```

Dann <http://localhost:8080> öffnen. (Einfach `index.html` doppelklicken geht nicht, weil der Browser die JSON-Dateien dann nicht laden darf.)

Alle Tests ausführen (Node.js findet die Dateien in `tests/` selbst):

```bash
node --test
```

| Test | prüft |
| --- | --- |
| `tests/regeln.test.mjs` | Komposita, Siegel, Runen; falsch nie stärker als richtig |
| `tests/steigerung.test.mjs` | Steigerungsformen, Deklination, Erkennung von drei Runen, +50 % je Stufe |
| `tests/begegnungen.test.mjs` | Begegnungen, Aufgaben (genau eine Lösung), Rucksack-Wachstum, Kobold-Fluch |
| `tests/ablauf.test.mjs` | Gebiete, Bosse, Figuren, Schicksalsrunen, Unterklassen, Taschen, Ork-Rüstungen |
| `tests/balance.test.mjs` | 200 simulierte Läufe: Siegquote pro Tag, Siege und Spielzeit |

Aktuelle Balance (200 Läufe, einfache Kaufstrategie, Aufgaben zu 75 % richtig): Tag 1 etwa 82 % Siegchance, im Schnitt 6,8 Siege, geschätzt 13–14 Minuten pro Lauf, Kämpfe etwa 12 Sekunden. Die Stellschrauben (Startgold, Gold pro Tag, Leben pro Tag, Gegnerbudget) stehen oben und im Abschnitt „Gegner“ in `js/logic.js`.

## Auf GitHub Pages veröffentlichen

1. Im Repository auf GitHub: **Settings → Pages**.
2. Unter „Build and deployment“: **Deploy from a branch**, Branch `main`, Ordner `/ (root)`.
3. Nach ein bis zwei Minuten läuft das Spiel unter `https://<benutzername>.github.io/Runenrucksack/`.

## Aufbau des Codes

| Datei | Inhalt |
| --- | --- |
| `index.html`, `style.css` | Bildschirme und Aussehen |
| `js/main.js` | Ablauf eines Laufs, Laden, Rucksack (Ziehen und Drehen), Info-Feld, Verschmelzen und Steigern |
| `js/encounters.js` | Begegnungen am Morgen mit ihren Aufgaben |
| `js/battle-ui.js` | Kampfanzeige und Fehler auf der Ork-Rüstung |
| `js/ui.js` | Gemeinsame Bausteine: Fenster, Item-Kacheln, Raster |
| `js/state.js` | Geladene Inhalte und Speichern im Browser |
| `js/logic.js` | Regeln: Raster, Laden, Gold, Gebiete, Lauf, Gegner, Begegnungen |
| `js/grammar.js` | Grammatik-Regeln: Komposita, Siegel, Runen, Steigerung |
| `js/mods.js` | Boni von Figur, Unterklasse, Schicksalsrune, Begegnungen und Taschen |
| `js/battle.js` | Kampfsimulation |
| `js/sim.js` | Simulation ganzer Läufe für die Balance |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA (offline, Home-Bildschirm) |
| `tools/serve.mjs` | lokaler Testserver |
| `tools/make-icons.mjs` | erzeugt die App-Symbole neu |

Kein Server, keine Accounts, keine externen Dienste. Der laufende Lauf wird nur im Browser gemerkt.
