# Runenrucksack

Ein Fantasy-Backpack-Battler fürs iPad (Querformat) als Web-App, in dem Grammatik das Regelwerk der Kombos ist. Das vollständige Spielkonzept steht in [konzept.md](konzept.md).

**Stand: Etappe 3 – Pfad 1 vollständig, mit Tutorial, Sternstufen, Verben mit Subjekt und Bildern**

Spielen: <https://simfischer.github.io/Runenrucksack/> – auf dem iPad in Safari öffnen, **Teilen → Zum Home-Bildschirm**, dann startet es wie eine App im Vollbild und läuft auch offline.

## Der erste Tag (Tutorial)

Beim Öffnen fragt das Spiel: **„Ich bin zum ersten Mal hier“** (startet das Tutorial) oder **„Ich kenne das schon“** (Startmenü). Hat das Gerät das Tutorial schon einmal abgeschlossen, ist „Ich kenne das schon“ hervorgehoben – gefragt wird trotzdem, weil sich oft mehrere Kinder ein iPad teilen.

Meister Fenwick 🧙 führt in 3–4 Minuten durch einen echten, aber festgelegten Lauf: Schwert kaufen, Infos ansehen, drehen, Lager, Feuer-Kristall neben das Schwert legen (das Feuerschwert entsteht sofort, mit Artikelwahl), das-Siegel, Rune „scharf“, Kampf gegen den Strohpuppen-Ork, Sieg und Herzen, eine leichte Begegnung. Am zweiten Tag: Fenwick schenkt einen Dolch, der zweite aus dem Laden macht sofort einen ★★-Dolch; eine Verb-Rolle mit Subjekt; ein Fehler auf der Ork-Rüstung. Alles außer dem Ziel ist abgedunkelt, eine Hand zeigt Tippen und Ziehen, nach 8 Sekunden ohne Aktion kommt ein Zusatz-Tipp, 🔊 liest vor (wenn das Gerät eine deutsche Stimme hat). Falsche Aktionen werden freundlich zurückgesetzt. Der Tutorial-Lauf wird nicht gespeichert und zählt nicht.

Jederzeit: **„Tutorial überspringen“** oben rechts. Im Menü: **„Tutorial wiederholen“**, **„So geht's“** (Übersicht zum Nachschlagen) und **„Erste-Mal-Tipps“** an/aus (Fenwick meldet sich einmal pro Lauf beim ersten Boss, Gebietswechsel, der ersten Steigerung und der Unterklasse).

### Tutorial-Texte ändern und Schritte ergänzen

Alles steht in `tutorial.json`:

- **Texte ändern:** Bei einem Schritt `text` (höchstens zwei kurze Sätze), `tipp` (erscheint nach 8 Sekunden ohne Aktion) und die `falsch`-Hinweise anpassen. Die Karten für „So geht's“ stehen im Feld `hilfe` des jeweiligen Schritts, die Erste-Mal-Tipps unter `tipps`.
- **Neuer Schritt:** ein Objekt in `schritte` einfügen – an der Stelle, an der er im Ablauf kommen soll:

  ```json
  {
    "id": "taschen",
    "voraussetzung": "taschen",
    "text": "Taschen machen deinen Rucksack größer.",
    "ziel": ["rucksack"],
    "aktion": { "typ": "weiter" },
    "hilfe": { "titel": "Taschen", "emoji": "🧺", "animation": "pulsieren", "text": "Eine Tasche gibt dir zwei Felder mehr." }
  }
  ```

| Feld | Bedeutung |
| --- | --- |
| `ziel` | Namen aus `data-tut`-Attributen; nur diese Elemente sind hell und bedienbar. Fest im HTML: `gold`, `herzen`, `siege`, `laden`, `rucksack`, `lager`, `info`, `kampf`, `menue`, `tempo`, `kampf-rucksack`, `fenster` (das offene Fenster). Für Items: `item-<id>` im Rucksack, `laden-<id>` im Laden. |
| `aktion.typ` | `weiter` (Knopf), `kaufen`, `antippen`, `drehen`, `neben` (Kristall links neben Träger), `verschmelzen`, `siegel`, `rune`, `ereignis` (z. B. `kampfStart`, `nachKampf`, `begegnungFertig`), `abschluss` |
| `laden` | fester Laden-Inhalt ab diesem Schritt (Item-ids) |
| `hand` | `{ "typ": "tippen", "auf": "<ziel>" }` oder `{ "typ": "ziehen", "von": "<ziel>", "nach": "rucksack" | "links-von:<id>" | "neben:<id>" }` |
| `falsch` | Liste von `{ "wenn": { "item", "bereich" }, "text", "zuruecksetzen" }` – freundlicher Hinweis, bei `zuruecksetzen` wandert das Item zurück in den Laden |
| `voraussetzung` | Schritt nur, wenn es die Funktion gibt. Die vorhandenen Funktionen stehen in `FEATURES` in `js/tutorial-logic.js`; `buch` und `heldencode` fehlen noch, darum werden diese Schritte übersprungen. Etappe 4 trägt sie dort ein. |
| `kampfPause`, `zeigenBei` | Kampf kurz anhalten und erklären; Sprechblase erst bei einem Ereignis zeigen (z. B. `kampfEnde`) |

Der Übungsgegner (`uebungsgegner`) steht in `enemies.json` mit `"uebung": true` und festen Gegenständen (`ausruestung`). Ein Bild für Fenwick wird automatisch benutzt, sobald es unter `assets/figur-fenwick.webp` liegt.

Nach Änderungen: `node --test` prüft, dass jeder Schritt erreichbar ist und höchstens zwei Sätze hat; `node tools/tutorial-browsertest.mjs` spielt das Tutorial im Browser durch (siehe unten).

## So läuft ein Lauf

1. **Figur wählen:** Borga Eisenfaust (Komposita +20 %, Start mit Axt und Feuer) oder Eadrun die Reiterin (Schriftrollen 20 % schneller, Start mit Speer und „stürmen“).
2. **Schicksalsrune:** Eine von sechs zufälligen Regeln gilt für den ganzen Lauf, z. B. „Feuer-Komposita doppelt so stark“ oder „Laden hat 6 Plätze“.
3. **Zehn Tage, zwei Gebiete:** Kleinwurzel (Tag 1–5, Boss: Ork-Plünderer) und Hrossmark (Tag 6–10, Boss: Wolfsreiter-Häuptling). Beim Gebietswechsel gibt es einen Übergangsbildschirm, in Hrossmark wählt man eine **Unterklasse**.
4. **Jeder Tag:**
   - **Morgen:** Begegnung am Wegesrand (drei zur Wahl).
   - **Tag:** Laden mit 5 Items, Neu würfeln für 1 Gold, Reservieren, Verkaufen, Verschieben, Drehen. Alles Verbinden passiert sofort: zwei gleiche werden zur nächsten Sternstufe, ein Kristall neben einem Träger zum Kompositum. Das Abzeichen „1/2“ mit „= sofort ★★“ zeigt Items, von denen man schon eins hat.
   - **Nacht:** Automatischer Kampf. Vorher kann man den Fehler auf der Ork-Rüstung verbessern (ein Versuch, richtig: Ork startet mit 15 % weniger Leben).
5. **Ende:** nach dem 10. Kampf („Reise geschafft“, mit Sternen nach Siegen) oder wenn alle 5 Herzen weg sind.

## Grammatik im Spiel

| Mechanik | Regel | Lernziel |
| --- | --- | --- |
| Komposita | Kraft-Kristall links neben oder über einem Träger → sofort Artikel wählen: „Feuer + Schwert = ___ Feuerschwert“ | Das letzte Wort bestimmt den Artikel |
| Artikel-Siegel | der/die/das neben einem Nomen mit passendem Genus: +25 % | Genus der Nomen |
| Adjektiv-Runen | Pfeil zeigt auf ein passendes Nomen: „scharfes Schwert“ | Adjektiv vor dem Nomen, Endungen |
| Steigerung | Zwei gleiche Runen → Komparativ (★★) → Superlativ (★★★) → Superlativ mit Krone (★★★★), Werte wie die Sternstufen | scharf – schärfer – am schärfsten, gut – besser – am besten |
| Begegnungen | Plural, Artikel, Rechtschreibung auf der Speisekarte, Personalformen, Fehler im Namen | Wiederholung Klasse 5 |
| Ork-Rüstung | Falsch geschriebenes Wort verbessern | Rechtschreibung |
| Wortfeld-Taschen | Gartentasche, Satteltasche: Items aus dem passenden Wortfeld +20 % | Wortfelder |
| Sternstufen | Zwei gleiche Items (Rucksack + Lager) werden sofort zu ★★ (2,2-fach), ★★★ (5-fach), ★★★★ (11-fach, legendär); vorher Mehrzahl-, Präteritum- oder Steigerungsfrage | zwei Äxte, gestern schlug er |
| Verben mit Subjekt | Pfeil der Schriftrolle zeigt auf ein Nomen, Frage nach der Personalform; richtig: Rolle voll und das Subjekt schlägt mit, sonst nur halbe Wirkung | Das Feuerschwert schlägt. Die Speere schlagen. |

**Regel für alle Aufgaben:** Der erste Versuch ist kostenlos, jeder weitere kostet 1 Gold, bei Fehlern erscheint eine kurze Erklärzeile. **Eine grammatisch falsche Kombination ist nie stärker als eine richtige** – die Tests prüfen das.

**Verbinden ohne Bremse:** Die Fragen zum Verbinden erscheinen als kleines Fenster direkt am Item. Wer dieselbe Frage (gleiches Wort, gleiche Art) in einem Lauf dreimal gleich richtig beantwortet hat, bekommt sie nicht mehr – das Verbinden passiert dann direkt mit einem Hinweis wie „die Äxte ✓“. Mit „Nicht verbinden“ bleiben die Items getrennt. Im Menü lässt sich der Klang beim Verbinden ausschalten.

## Inhalte ändern (ohne Programmieren)

Alle Inhalte stehen in JSON-Dateien. Jede Datei hat oben ein Feld `_hinweis`, das ihre Felder erklärt. Nach dem Ändern `CACHE` in `sw.js` um eins erhöhen, damit installierte Apps die neue Version laden.

| Datei | Inhalt |
| --- | --- |
| `items.json` | Alle Items im Laden: Wortart (`art`), Artikel, Wortfeld, Form, Seltenheit, Preis, Kampfwerte; Mehrzahl mit zwei falschen Formen (`plural`), Verbformen (`formen`: er, sie, Präteritum), Extras für passende Subjekte (`subjektBonus`); Runen mit Steigerungsformen; Taschen |
| `recipes.json` | Welche Items Träger sind und was jede Kraft beim Verschmelzen dazugibt |
| `exercises.json` | **Die Wörter der Aufgaben:** Plural, Artikel, Speisekarten, Personalformen, Kobold-Namen |
| `encounters.json` | Die Begegnungen: Figur, Text, Aufgabentyp, Belohnung, Gebiet |
| `enemies.json` | Die Orks: Vorlieben beim Packen und die falschen Wörter auf ihren Rüstungen |
| `regions.json` | Die Gebiete: Tage, Farben, Wortfeld, Gegner, Boss |
| `heroes.json` | Startfiguren mit Bonus, Start-Items und Unterklassen; die sechs Schicksalsrunen |
| `tutorial.json` | Tutorial „Der erste Tag“: Schritte, Texte, Hilfe-Karten für „So geht's“, Erste-Mal-Tipps |

### Beispiele

- **Neues Plural-Wort:** in `exercises.json` unter `plural` eine Zeile ergänzen:
  `{ "wort": "das Kind", "richtig": "die Kinder", "falsch": ["die Kinds", "die Kinde"], "regel": "Kind → Kinder: dazu kommt -er." }`
- **Neues Artikel-Rätsel:** unter `artikel`: `{ "wort": "Schüssel", "artikel": "die" }`
- **Neue Speisekarte:** unter `speisekarten`; das falsch geschriebene Wort als `falsch|richtig`:
  `{ "zeilen": ["Tomatensuppe", "Reis mit Gemüse", "Kirschen mit Sahne|Sahne"], "erklaerung": "…" }` – genau ein Wort pro Karte mit `|`.
- **Neuer Fehler auf einer Ork-Rüstung:** in `enemies.json` beim Gegner unter `fehler`; `optionen` enthält genau eine richtige Schreibung.
- **Neuer Träger** (z. B. ein Besen): Item in `items.json` mit `"art": "traeger"` anlegen und die id in `recipes.json` unter `traeger` eintragen – alle acht Komposita entstehen automatisch.

Die Tests (siehe unten) melden, wenn eine Aufgabe nicht genau eine richtige Lösung hat.

## Bilder

Alle Bilder liegen in `assets/`. Die Originale (große PNGs) stehen in `assets/roh/` und werden nur von den Werkzeugen gelesen – sie kommen nicht in den Service Worker. Das Spiel lädt kleine WebP-Bilder:

| Ordner/Datei | Inhalt |
| --- | --- |
| `assets/items/` | ein Bild pro Item (1×1: 256 px, 1×2: 256×512 px, 2×2: 512 px), Name = Item-id |
| `assets/gegner/` | die vier Orks (512 px) |
| `assets/figur-*.webp`, `assets/boss-*.webp` | Figuren und Bosse, 512 px hoch |
| `assets/hintergrund-*.webp`, `assets/titelbild.webp` | Gebiets-Hintergründe und Titelbild, 1536 px breit |
| `assets/zuordnung.json` | welches Bild zu welcher id gehört (wird von den Werkzeugen geschrieben) |
| `assets/vorschau.html` | Übersicht aller Items mit Bild zum Prüfen (im Browser öffnen, z. B. http://localhost:8080/assets/vorschau.html) |

Fehlt zu einem Item ein Bild, zeigt das Spiel automatisch das Emoji aus `items.json`. Komposita (z. B. Feuerschwert) zeigen das Bild ihres Trägers mit dem Kraft-Leuchten darüber, gesteigerte Runen das Bild ihrer Grundrune. Sternstufen und Kraft-Effekte werden im Code darübergelegt.

### Neue Bilder hinzufügen

1. **Sprite-Sheet mit mehreren Items** (transparenter Hintergrund, Objekte in Reihen): Datei nach `assets/roh/` legen und in `tools/zerschneide.mjs` unter `SHEETS` eintragen – Reihen von oben nach unten, in jeder Reihe die Item-ids von links nach rechts. Dann:

   ```bash
   node tools/zerschneide.mjs
   ```

   Danach `assets/vorschau.html` öffnen und prüfen, ob jedes Item das richtige Bild hat. Das Werkzeug schneidet an den leersten Linien zwischen den Objekten; liegen Objekte sehr dicht beieinander, hilft ein etwas größerer Abstand im Sheet.
2. **Einzelbild** (Figur, Boss, Hintergrund): Datei nach `assets/roh/` legen, in `tools/bilder.mjs` unter `BILDER` eintragen (`figuren`/`bosse` werden 512 px hoch, `hintergruende` 1536 px breit) und `node tools/bilder.mjs` ausführen. Figuren und Gegner werden über ihre id gefunden (Figur = id aus `heroes.json`, Boss/Gegner = id aus `enemies.json`, Hintergrund = Gebiets-id aus `regions.json`).
3. **App-Symbol:** `assets/roh/app-symbol.png` ersetzen und `node tools/bilder.mjs` ausführen – das erzeugt `icons/icon-192.png`, `icons/icon-512.png` und `icons/apple-touch-icon.png`.
4. Neue Bilddateien in `sw.js` in die Liste `FILES` eintragen und `CACHE` um eins erhöhen, damit sie auch offline da sind.

Beide Werkzeuge rechnen mit einem unsichtbar gestarteten Chrome oder Edge (keine zusätzlichen Pakete nötig). Wird kein Browser gefunden, den Pfad in der Umgebungsvariable `CHROME` angeben.

Die Schriftrollen „rufen“ (Horn) und „reiten“ (Hufeisen) sind schon zugeschnitten und für spätere Verben vorgemerkt (`assets/items/verb-rufen.webp`, `verb-reiten.webp`). Für die Figuren Faelith, Theron und Ysolde liegen die Bilder bereit, sie werden mit den Figuren selbst eingebaut.

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
| `tests/balance.test.mjs` | 200 simulierte Läufe: Siegquote pro Tag, Siege und Spielzeit; Sternstufen der Gegner |
| `tests/sterne.test.mjs` | Mehrzahl- und Verbformen aller Items, Verbinden beim Kaufen, beim Ziehen auf ein gleiches Item, bei Belohnungen und als Kette, „Nicht verbinden“, gekonnte Fragen, Laden-Gewichtung |
| `tests/komposita.test.mjs` | Komposita entstehen sofort beim Ablegen und Drehen, Stufe vom Träger, Feueraxt ★ + ★ → ★★, falsch nie stärker |
| `tests/verben.test.mjs` | Pfeil, Personalform, Verb mit und ohne Subjekt (falsch nie stärker) |
| `tests/tutorial.test.mjs` | Tutorial komplett durchspielen, Zurücksetzen, Überspringen fehlender Funktionen, danach normaler Lauf |

Das Tutorial in einem echten Browser per Touch durchspielen (braucht Chrome oder Edge; Server vorher mit `node tools/serve.mjs` starten):

```bash
node tools/tutorial-browsertest.mjs http://localhost:8080/ 1180 820
```

Breite und Höhe lassen sich ändern, z. B. `1024 768` für kleinere iPads.

Aktuelle Balance (200 Läufe, einfache Kaufstrategie, Aufgaben zu 75 % richtig): Tag 1 etwa 85 % Siegchance, im Schnitt 7,8 Siege, geschätzt 14 Minuten pro Lauf, Kämpfe etwa 10 Sekunden. Die Stellschrauben stehen oben in `js/logic.js` (Startgold, Gold pro Tag, Leben pro Tag, `STERN_FAKTOR`, `SAMMEL_GEWICHT`) und im Abschnitt „Gegner“ (Gegnerbudget, `GEGNER_STERNE_AB`: ★★ ab Tag 3, ★★★ ab Tag 6; `GEGNER_LEGENDAER_TAG`: Boss mit ★★★★).

## Auf GitHub Pages veröffentlichen

1. Im Repository auf GitHub: **Settings → Pages**.
2. Unter „Build and deployment“: **Deploy from a branch**, Branch `main`, Ordner `/ (root)`.
3. Nach ein bis zwei Minuten läuft das Spiel unter `https://<benutzername>.github.io/Runenrucksack/`.

## Aufbau des Codes

| Datei | Inhalt |
| --- | --- |
| `index.html`, `style.css` | Bildschirme und Aussehen |
| `js/main.js` | Ablauf eines Laufs, Laden, Rucksack (Ziehen und Drehen), Info-Feld, Verbinden mit Frage-Fenster am Item |
| `js/encounters.js` | Begegnungen am Morgen mit ihren Aufgaben |
| `js/tutorial.js` | Tutorial: Spotlight, Sprechblase, Hand, Vorlesen, „So geht's“, Erste-Mal-Tipps |
| `js/tutorial-logic.js` | Tutorial ohne Darstellung: aktive Schritte, Prüfen, Zurücksetzen (testbar) |
| `js/battle-ui.js` | Kampfanzeige und Fehler auf der Ork-Rüstung |
| `js/ui.js` | Gemeinsame Bausteine: Fenster, Frage-Fenster am Item, Item-Kacheln, Raster, Verbinden-Animation und Klang |
| `js/state.js` | Geladene Inhalte und Speichern im Browser |
| `js/logic.js` | Regeln: Raster, Laden, Gold, Gebiete, Lauf, Gegner, Begegnungen |
| `js/grammar.js` | Grammatik-Regeln: Komposita, Siegel, Runen, Steigerung, Verben mit Subjekt, Mehrzahl |
| `js/sterne.js` | Sofortiges Verbinden: zwei gleiche und Kristall + Träger finden, Frage bauen, verbinden (auch als Kette), gekonnte Fragen |
| `js/mods.js` | Boni von Figur, Unterklasse, Schicksalsrune, Begegnungen und Taschen |
| `js/battle.js` | Kampfsimulation |
| `js/sim.js` | Simulation ganzer Läufe für die Balance |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA (offline, Home-Bildschirm) |
| `tools/serve.mjs` | lokaler Testserver |
| `tools/zerschneide.mjs` | zerlegt Sprite-Sheets in Einzelbilder (WebP), schreibt Zuordnung und Vorschau |
| `tools/bilder.mjs` | verkleinert Figuren, Bosse, Hintergründe, Titelbild; erzeugt die App-Symbole |
| `tools/chrome.mjs`, `tools/vorschau.mjs` | Hilfen für die Bild-Werkzeuge |
| `tools/tutorial-browsertest.mjs` | spielt das Tutorial im Browser per Touch durch |

Kein Server, keine Accounts, keine externen Dienste. Der laufende Lauf wird nur im Browser gemerkt.
