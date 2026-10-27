# Runenrucksack

Ein Fantasy-Backpack-Battler fürs iPad (Querformat) als Web-App, in dem Grammatik das Regelwerk der Kombos ist. Das vollständige Spielkonzept steht in [konzept.md](konzept.md).

**Stand: Aufgabensystem – großer Wortschatz, 15 Themen mit drei Stufen, elf Aufgabenformate, Lernstand, Bereich für Lehrkräfte**

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
| `voraussetzung` | Schritt nur, wenn es die Funktion gibt. Die vorhandenen Funktionen stehen in `FEATURES` in `js/tutorial-logic.js` (seit Etappe 4 auch `buch` und `heldencode`). |
| `kampfPause`, `zeigenBei` | Kampf kurz anhalten und erklären; Sprechblase erst bei einem Ereignis zeigen (z. B. `kampfEnde`) |

Der Übungsgegner (`uebungsgegner`) steht in `enemies.json` mit `"uebung": true` und festen Gegenständen (`ausruestung`). Ein Bild für Fenwick wird automatisch benutzt, sobald es unter `assets/figur-fenwick.webp` liegt.

Nach Änderungen: `node --test` prüft, dass jeder Schritt erreichbar ist und höchstens zwei Sätze hat; `node tools/tutorial-browsertest.mjs` spielt das Tutorial im Browser durch (siehe unten).

## So läuft ein Lauf

1. **Figur wählen:** Borga Eisenfaust (Komposita +20 %, Start mit Axt und Feuer) oder Eadrun die Reiterin (Schriftrollen 20 % schneller, Start mit Speer und „stürmen“). Später kommen Faelith, Theron und Ysolde dazu (siehe „Fortschritt zwischen den Läufen“).
2. **Schicksalsrune:** Eine von sechs zufälligen Regeln gilt für den ganzen Lauf, z. B. „Feuer-Komposita doppelt so stark“ oder „Laden hat 6 Plätze“.
3. **Zehn Tage, zwei Gebiete:** Kleinwurzel (Tag 1–5, Boss: Ork-Plünderer) und Hrossmark (Tag 6–10, Boss: Wolfsreiter-Häuptling). Beim Gebietswechsel gibt es einen Übergangsbildschirm, in Hrossmark wählt man eine **Unterklasse**.
4. **Jeder Tag:**
   - **Morgen:** Begegnung am Wegesrand (drei zur Wahl).
   - **Tag:** Laden mit 5 Items, Neu würfeln für 1 Gold, Reservieren, Verkaufen, Verschieben, Drehen. Alles Verbinden passiert sofort: zwei gleiche werden zur nächsten Sternstufe, ein Kristall neben einem Träger zum Kompositum. Das Abzeichen „1/2“ mit „= sofort ★★“ zeigt Items, von denen man schon eins hat.
   - **Nacht:** Automatischer Kampf. Vorher kann man den Fehler auf der Ork-Rüstung verbessern (ein Versuch, richtig: Ork startet mit 15 % weniger Leben).
5. **Ende:** nach dem 10. Kampf („Reise geschafft“, mit Sternen nach Siegen) oder wenn alle 5 Herzen weg sind. Danach: Lernbericht, Erfahrung und Rang, neue Freischaltungen und Erfolge, der Heldencode mit QR-Code.

Im Spielmenü kann man den **Lauf unterbrechen**: Das Spiel zeigt einen Reisecode, mit dem es später (auch auf einem anderen iPad) genau dort weitergeht.

## Fortschritt zwischen den Läufen

| Was | So funktioniert es |
| --- | --- |
| **Buch der Wörter** (📚 im Spiel, Startmenü, Menü) | Seiten Komposita, Sternstufen, Steigerungen, Sätze, Schätze – 317 Einträge, automatisch aus `items.json` und `recipes.json`. Unentdeckt: dunkle Silhouette mit „???“; entdeckt: Bild, Name, Artikel, Wirkung, Lernhinweis. Fortschrittsbalken pro Seite, volle Seiten schalten Rucksack-Designs frei. Neue Entdeckungen werden kurz eingeblendet. |
| **Erfahrung und Ränge** | Am Ende jedes Laufs: 10 pro Sieg, 5 pro neuer Entdeckung, 2 pro Frage beim ersten Versuch richtig. Lehrling (0) → Wanderer (350) → Runenkundige (1200) → Wortmeister (2600) → Hüter der Sprache (4000). Laut Simulation Rang 2 nach 2 Läufen, Rang 5 nach etwa 26. |
| **Freischaltungen** | Faelith die Bogenschützin (Rang Wanderer; Bogen-Komposita +30 %, sieht mögliche Komposita im Laden von Weitem), Hauptmann Theron (3 gewonnene Läufe; +3 Startblock für Nomen mit passendem Siegel), Ritterin Ysolde (25 Einträge; Runen wirken auf zwei Nomen). Drachenfeuerschwert, Runenstein und Runenkrone erst nach Freischaltung im Laden. |
| **Rucksack-Designs** | Leder, Zwergenstahl (Seite Komposita), Elbenseide (Seite Steigerungen), Reiterleder (Seite Sätze), Silberbanner (Erfolg „Alle Helden“) – nur Optik, Auswahl in der **Sammlung** (Startmenü). |
| **Erfolge** | 18 Erfolge, z. B. „Erstes Kompositum“, „Erste ★★★★“, „Fehlerjäger“, „Satzbauer“, „Ohne Fehlversuch“, „Alle Helden“, „Feuermeister“. |
| **Lernbericht** | Nur für das Kind: Siege, neue Entdeckungen, Rangfortschritt, „Das sitzt schon“ und „Das üben wir noch“ mit Merkhilfe – ohne Noten und Prozentzahlen. |

Alle Werte stehen in `achievements.json` (Erfahrung, Ränge, Designs, Erfolge), `heroes.json` (Figuren mit `freischaltung`) und `items.json` (Items mit `freischaltung`).

## Heldencode und Reisecode

- **Heldencode:** gesamter Fortschritt (Rang, Erfahrung, Figuren, Designs, Erfolge, Buch der Wörter, Statistik, Tutorial, Lernstand je Thema, Regelkarten, Klassen-Einstellung). Erscheint am Ende jedes Laufs und im Menü – groß, mit QR-Code und Knopf „Kopieren“.
- **Reisecode:** Heldencode plus laufender Lauf (Menü → „Lauf unterbrechen“).
- **Eingeben:** Startmenü → „Heldencode eingeben“. Bindestriche sind optional, Kleinbuchstaben werden groß. Das Spiel erkennt selbst, ob es ein Helden-, Reise- oder Klassen-Code (`THEMEN-…`) ist, und meldet Tippfehler freundlich. Mit „📷 QR-Code scannen“ geht es auch über die iPad-Kamera.
- **Format:** Großbuchstaben und Ziffern ohne 0/O und 1/I/L, Fünfergruppen, Prüfzeichen am Ende. Länge: Anfänger 35, Mittelstand etwa 125, voller Fortschritt (mit allen Regelkarten und vollem Lernstand) etwa 190 Zeichen; ein Reisecode ist länger (120–400 Zeichen). Lernstand, Regelkarten und Klasse stehen nur dann am Ende, wenn es sie gibt – ältere Codes bleiben gültig.
- Der Browser merkt sich den letzten Stand zusätzlich (Komfort). „Neu beginnen“ im Menü löscht ihn nach einer Sicherheitsabfrage.

### Wichtige Regel: registry.json nur hinten ergänzen

Jeder Inhalt (Item, Figur, Erfolg, Buch-Eintrag …) hat in `registry.json` eine feste Nummer. Nach neuen Inhalten:

```bash
node tools/registry.mjs
```

Das Werkzeug hängt neue Einträge **nur hinten an**. Nie Einträge umsortieren, umbenennen oder löschen – sonst passen alte Helden- und Reisecodes nicht mehr. Die Tests melden, wenn etwas in `registry.json` fehlt, und prüfen einen gespeicherten Code aus Version 1.

## Grammatik im Spiel

| Mechanik | Regel | Lernziel |
| --- | --- | --- |
| Komposita | Kraft-Kristall links neben oder über einem Träger → sofort Artikel wählen: „Feuer + Schwert = ___ Feuerschwert“ | Das letzte Wort bestimmt den Artikel |
| Artikel-Siegel | der/die/das neben einem Nomen mit passendem Genus: +25 % | Genus der Nomen |
| Adjektiv-Runen | Pfeil zeigt auf ein passendes Nomen: „scharfes Schwert“ | Adjektiv vor dem Nomen, Endungen |
| Steigerung | Zwei gleiche Runen → Komparativ (★★) → Superlativ (★★★) → Superlativ mit Krone (★★★★), Werte wie die Sternstufen | scharf – schärfer – am schärfsten, gut – besser – am besten |
| Begegnungen | Jede Gestalt mit eigenem Format: Eule sortiert, Zwerg baut Komposita, Wirtin verbessert die Speisekarte (2–3 Fehler), Hirtin ordnet Satzglieder, Händler fragt „Was passt nicht?“ (Rabatt), Kobold verdreht einen Namen | Wiederholung Klasse 5 |
| Ork-Rüstung | Satz mit einem Fehler: falsches Wort antippen und verbessern, nur ein Versuch | Rechtschreibung |
| Wortfeld-Taschen | Gartentasche, Satteltasche: Items aus dem passenden Wortfeld +20 % | Wortfelder |
| Sternstufen | Zwei gleiche Items (Rucksack + Lager) werden sofort zu ★★ (2,2-fach), ★★★ (5-fach), ★★★★ (11-fach, legendär); vorher eine Aufgabe zum Thema des Items (siehe unten) | zwei Äxte, gestern schlug er |
| Verben mit Subjekt | Pfeil der Schriftrolle zeigt auf ein Nomen, Frage nach der Personalform; richtig: Rolle voll und das Subjekt schlägt mit, sonst nur halbe Wirkung | Das Feuerschwert schlägt. Die Speere schlagen. |

**Regel für alle Aufgaben:** Der erste Versuch ist kostenlos, jeder weitere kostet 1 Gold; nach jeder Antwort erscheint eine kurze Erklärung mit Merkhilfe. **Eine grammatisch falsche Kombination ist nie stärker als eine richtige** – die Tests prüfen das.

**Verbinden ohne Bremse:** Kurze Aufgaben erscheinen als kleines Fenster direkt am Item, größere (Sortieren, Satz ordnen, Tastatur) in der Mitte. Mit „Nicht verbinden“ bleiben die Items getrennt. Im Menü lässt sich der Klang beim Verbinden ausschalten.

## Aufgaben und Lernstand

Die Aufgaben entstehen aus `wortschatz.json` (508 Nomen, 135 Verben, 93 Adjektive, 47 Komposita, 41 Wortfamilien, 44 Sätze, Wortfelder der Gebiete) und `themen.json` (15 Themen mit je drei Stufen und Regelkarten). Der Code dazu steht in `js/aufgaben/`.

- **Das Item bestimmt das Thema, nicht das Wort:** Nomen → Mehrzahl oder Artikel, Komposita → Komposita, Verben → Personalformen oder Zeitformen, Runen → Steigerung, Ork-Rüstung → Rechtschreibung. Das Wort ist zufällig, bevorzugt aus dem Wortfeld des Gebiets.
- **Die Item-Stufe bestimmt den Bereich:** ★★ = Stufe 1–2, ★★★ = Stufe 2–3, ★★★★ = Stufe 3 (ist Stufe 3 nicht erlaubt: zwei Aufgaben).
- **Elf Formate:** Auswahl, Lückensatz, Buchstaben ergänzen (eigene Bildschirmtastatur), Eintippen (nur Stufe 3), Baukasten, Sortieren (Ziehen oder Antippen), Fehler finden, Satz ordnen, Passt nicht, Regel entdecken, Paare.
- **Lernstand je Thema:** zweimal gleich beim ersten Versuch richtig → nächste Stufe. Ein Fehler kommt als zweite bis vierte Aufgabe danach wieder – in anderer Form, mit anderem Wort. Jedes Wort höchstens einmal pro Thema und Lauf. Der Lernstand steht im Heldencode; der Lernbericht zeigt Sterne je Thema, keine Prozente.
- **Belohnungen:** gleich richtig auf Stufe 2 → +1 Gold, auf Stufe 3 → +2 Gold, und beim Verbinden glänzt das neue Item (+10 % im nächsten Kampf). Jede richtig angewendete Regel wird eine Regelkarte im Buch (Seite „Regeln“).
- **Für Lehrkräfte** (Startmenü, Code in `lehrkraft.json`): Themen an/aus und höchste Stufe je Thema. Daraus entsteht ein Klassen-Code wie `THEMEN-3DFTS-R8UD8`, den die Kinder bei „Heldencode eingeben“ eintippen; er wird im Heldencode gespeichert. Ohne Klassen-Code gelten alle Themen mit Stufe 1–2. Der Lehrkraft-Code liegt offen im Repository – er hält Kinder ab, ist aber kein echter Schutz.
- **Prüfliste für Lehrkräfte:** `node tools/pruefliste.mjs` erzeugt `wortschatz-pruefliste.html` (sortierbar, mit Häkchen-Spalte, unsichere Einträge markiert).

## Inhalte ändern (ohne Programmieren)

Alle Inhalte stehen in JSON-Dateien. Jede Datei hat oben ein Feld `_hinweis`, das ihre Felder erklärt. Nach dem Ändern `CACHE` in `sw.js` um eins erhöhen, damit installierte Apps die neue Version laden.

| Datei | Inhalt |
| --- | --- |
| `items.json` | Alle Items im Laden: Wortart (`art`), Artikel, Wortfeld, Form, Seltenheit, Preis, Kampfwerte; Mehrzahl mit zwei falschen Formen (`plural`), Verbformen (`formen`: er, sie, Präteritum), Extras für passende Subjekte (`subjektBonus`); Runen mit Steigerungsformen; Taschen |
| `recipes.json` | Welche Items Träger sind und was jede Kraft beim Verschmelzen dazugibt |
| `wortschatz.json` | **Die Wörter der Aufgaben:** Nomen mit Artikel, Mehrzahl, Pluralmuster, Silben, Wortfeld, Schwierigkeit und Rechtschreib-Phänomenen; Verben, Adjektive, Komposita, Wortfamilien, Sätze, Wortfelder der Gebiete |
| `themen.json` | Themen mit drei Stufen (Beschreibung, erlaubte Formate) und Regelkarten |
| `lehrkraft.json` | Code für den Bereich „Für Lehrkräfte“ |
| `exercises.json` | Verdrehte Namen für den Zwielichtigen Kobold |
| `encounters.json` | Die Begegnungen: Figur, Text, Aufgabenformat, Belohnung, Gebiet |
| `enemies.json` | Die Orks: Vorlieben beim Packen und die falschen Wörter auf ihren Rüstungen |
| `regions.json` | Die Gebiete: Tage, Farben, Wortfeld, Gegner, Boss |
| `heroes.json` | Startfiguren mit Bonus, Start-Items und Unterklassen; die sechs Schicksalsrunen |
| `tutorial.json` | Tutorial „Der erste Tag“: Schritte, Texte, Hilfe-Karten für „So geht's“, Erste-Mal-Tipps |
| `achievements.json` | Erfahrung, Ränge, Rucksack-Designs, Erfolge |
| `registry.json` | Feste Nummern für Helden- und Reisecodes (nur mit `node tools/registry.mjs` ergänzen) |

### Beispiele

- **Neues Nomen:** in `wortschatz.json` unter `nomen` eine Zeile mit allen Feldern ergänzen (siehe `_hinweis`); falsche Mehrzahlformen entstehen automatisch aus dem Pluralmuster. Ist ein Wort nicht eindeutig (z. B. „der/das Teil“), `"mehrdeutig": true` setzen – dann kommt es in keiner Aufgabe vor. Danach `node tools/pruefliste.mjs` und die Tests laufen lassen.
- **Thema anpassen:** in `themen.json` Text oder Formate einer Stufe ändern, Regelkarten ergänzen (neue Regeln brauchen danach `node tools/registry.mjs`).
- **Neuer Fehler auf einer Ork-Rüstung:** in `enemies.json` beim Gegner unter `fehler`; `optionen` enthält genau eine richtige Schreibung.
- **Neuer Träger** (z. B. ein Besen): Item in `items.json` mit `"art": "traeger"` anlegen und die id in `recipes.json` unter `traeger` eintragen – alle acht Komposita entstehen automatisch.

Die Tests (siehe unten) melden, wenn eine Aufgabe nicht genau eine richtige Lösung hat oder eine falsche Antwort zufällig ein echtes Wort ist.

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
| `tests/begegnungen.test.mjs` | Begegnungen mit eigenem Format, Speisekarte mit 2–3 Fehlern, Kobold-Lücke am Fehler, Rabatt, Rucksack-Wachstum, Kobold-Fluch |
| `tests/wortschatz.test.mjs` | Wortschatz: Pflichtfelder, keine Dubletten, Mehrzahl und Artikel passend, falsche Formen nie echte Wörter |
| `tests/themen.test.mjs` | Alle Themen auf allen Stufen in allen Formaten erzeugbar, genau eine richtige Lösung |
| `tests/formate.test.mjs` | Jedes Format: genau eine richtige Antwort, falsche nie richtig, alle Stufen erzeugbar |
| `tests/wahl.test.mjs` | Item → Thema, Stufen-Bereich, Lehrkraft-Grenzen, Aufstieg, Wiederholung nach Fehlern, Simulation (30 Aufgaben: ≥ 6 Formate, kein Wort doppelt), Lernbericht, Gold |
| `tests/offline.test.mjs` | Alle Skripte und Daten stehen in der Liste des Service Workers |
| `tests/ablauf.test.mjs` | Gebiete, Bosse, Figuren, Schicksalsrunen, Unterklassen, Taschen, Ork-Rüstungen |
| `tests/balance.test.mjs` | 200 simulierte Läufe: Siegquote pro Tag, Siege und Spielzeit; Sternstufen der Gegner; Rang-Aufstieg über viele Läufe |
| `tests/sterne.test.mjs` | Mehrzahl- und Verbformen aller Items, Verbinden beim Kaufen, beim Ziehen auf ein gleiches Item, bei Belohnungen und als Kette, „Nicht verbinden“, Laden-Gewichtung |
| `tests/komposita.test.mjs` | Komposita entstehen sofort beim Ablegen und Drehen, Stufe vom Träger, Feueraxt ★ + ★ → ★★, falsch nie stärker |
| `tests/verben.test.mjs` | Pfeil, Personalform, Verb mit und ohne Subjekt (falsch nie stärker) |
| `tests/tutorial.test.mjs` | Tutorial komplett durchspielen, Zurücksetzen, Überspringen fehlender Funktionen, danach normaler Lauf |
| `tests/buch.test.mjs` | Buch der Wörter: alle Einträge aus den Daten, Entdeckungen aus dem Lauf, Seitenstand |
| `tests/fortschritt.test.mjs` | Erfahrung, Ränge, Freischaltungen, Fähigkeiten der neuen Figuren, Erfolge, Lernbericht |
| `tests/code.test.mjs` | Helden-, Reise- und Klassen-Code: exakt derselbe Stand (auch voll, mit Lernstand und Regelkarten), Tippfehler und Dreher, angehängte Inhalte, gespeicherter Code aus Version 1; nennt die Codelängen |

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
| `js/aufgaben/` | Aufgaben: Wortschatz-Hilfen (`wortschatz.js`), Themen-Generatoren (`themen.js`), Auswahl und Lernstand (`wahl.js`), Fenster (`host.js`), Anbindung ans Spiel (`spiel.js`), elf Formate in `formate/` |
| `js/lehrkraft-ui.js` | Bereich „Für Lehrkräfte“ mit Klassen-Code |
| `js/tutorial.js` | Tutorial: Spotlight, Sprechblase, Hand, Vorlesen, „So geht's“, Erste-Mal-Tipps |
| `js/tutorial-logic.js` | Tutorial ohne Darstellung: aktive Schritte, Prüfen, Zurücksetzen (testbar) |
| `js/battle-ui.js` | Kampfanzeige und Fehler auf der Ork-Rüstung |
| `js/ui.js` | Gemeinsame Bausteine: Fenster, Frage-Fenster am Item, Item-Kacheln, Raster, Verbinden-Animation und Klang |
| `js/state.js` | Geladene Inhalte und Speichern im Browser |
| `js/logic.js` | Regeln: Raster, Laden, Gold, Gebiete, Lauf, Gegner, Begegnungen |
| `js/grammar.js` | Grammatik-Regeln: Komposita, Siegel, Runen, Steigerung, Verben mit Subjekt, Mehrzahl |
| `js/sterne.js` | Sofortiges Verbinden: zwei gleiche und Kristall + Träger finden, Frage bauen, verbinden (auch als Kette) |
| `js/mods.js` | Boni von Figur, Unterklasse, Schicksalsrune, Begegnungen und Taschen |
| `js/battle.js` | Kampfsimulation |
| `js/sim.js` | Simulation ganzer Läufe (und vieler Läufe hintereinander) für die Balance |
| `js/buch.js`, `js/buch-ui.js` | Buch der Wörter: Einträge erzeugen, Entdeckungen finden; Bildschirm und Einblendung |
| `js/fortschritt.js` | Fortschritt ohne Darstellung: Antworten merken, Erfahrung, Rang, Freischaltungen, Erfolge, Lernbericht |
| `js/ende-ui.js` | Ende eines Laufs: Lernbericht, Erfahrung, Rang-Feier, Freischaltungen, Heldencode |
| `js/sammlung-ui.js` | Sammlung: Figuren, Rucksack-Designs, Erfolge |
| `js/code.js`, `js/code-ui.js` | Helden- und Reisecode: kodieren, prüfen, lesen; anzeigen mit QR-Code, eingeben, Kamera |
| `js/vendor/qrcode.js` | QR-Code-Erzeugung (qrcode-generator von Kazuhiko Arase, MIT-Lizenz) |
| `js/vendor/jsQR.js` | QR-Code lesen mit der Kamera (jsQR, Apache-2.0, siehe `js/vendor/jsQR-LICENSE.txt`) |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA (offline, Home-Bildschirm) |
| `tools/serve.mjs` | lokaler Testserver |
| `tools/zerschneide.mjs` | zerlegt Sprite-Sheets in Einzelbilder (WebP), schreibt Zuordnung und Vorschau |
| `tools/bilder.mjs` | verkleinert Figuren, Bosse, Hintergründe, Titelbild; erzeugt die App-Symbole |
| `tools/chrome.mjs`, `tools/vorschau.mjs` | Hilfen für die Bild-Werkzeuge |
| `tools/tutorial-browsertest.mjs` | spielt das Tutorial im Browser per Touch durch |
| `tools/registry.mjs` | hängt neue Inhalte hinten an `registry.json` an |

Kein Server, keine Accounts, keine externen Dienste. Fortschritt und laufender Lauf werden nur im Browser gemerkt; maßgeblich sind Helden- und Reisecode.
