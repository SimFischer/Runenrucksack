# Runenrucksack

Ein Fantasy-Backpack-Battler fürs iPad (Querformat) als Web-App, in dem Grammatik das Regelwerk der Kombos ist. Das vollständige Spielkonzept steht in [konzept.md](konzept.md).

**Stand: Neue Gestaltung – Szenen statt Kästen, eigene Schriften, Symbole statt Emojis, alles auf einen Bildschirm; Verb-Rollen mit natürlichen Sätzen; keine Töne**

Spielen: <https://simfischer.github.io/Runenrucksack/> – auf dem iPad in Safari öffnen, **Teilen → Zum Home-Bildschirm**, dann startet es wie eine App im Vollbild und läuft auch offline.

## Der erste Tag (Tutorial)

Beim Öffnen fragt das Spiel: **„Ich bin zum ersten Mal hier“** (startet das Tutorial) oder **„Ich kenne das schon“** (Startmenü). Hat das Gerät das Tutorial schon einmal abgeschlossen, ist „Ich kenne das schon“ hervorgehoben – gefragt wird trotzdem, weil sich oft mehrere Kinder ein iPad teilen.

Meister Fenwick 🧙 führt in 3–4 Minuten durch einen echten, aber festgelegten Lauf: Schwert kaufen, Infos ansehen, drehen, Lager, Feuer-Kristall neben das Schwert legen (das Feuerschwert entsteht sofort, mit Artikelwahl), das-Siegel, Rune „scharf“, Kampf gegen den Strohpuppen-Ork, Sieg und Herzen, eine leichte Begegnung. Am zweiten Tag: Fenwick schenkt einen Dolch, der zweite aus dem Laden macht sofort einen ★★-Dolch; eine Verb-Rolle mit Subjekt; ein Fehler auf der Ork-Rüstung. Alles außer dem Ziel ist abgedunkelt, eine Hand zeigt Tippen und Ziehen, nach 8 Sekunden ohne Aktion kommt ein Zusatz-Tipp. Falsche Aktionen werden freundlich zurückgesetzt. Der Tutorial-Lauf wird nicht gespeichert und zählt nicht.

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
   Danach wählt man ein **Begleiter-Tier** (siehe „Begleiter-Tiere“).
2. **Schicksalsrune:** Eine von sechs zufälligen Regeln gilt für den ganzen Lauf, z. B. „Feuer-Komposita doppelt so stark“ oder „Laden hat 6 Plätze“.
3. **Zehn Tage, zwei Gebiete:** Kleinwurzel (Tag 1–5, Boss: Ork-Plünderer) und Hrossmark (Tag 6–10, Boss: Wolfsreiter-Häuptling). Beim Gebietswechsel gibt es einen Übergangsbildschirm, in Hrossmark wählt man eine **Unterklasse**.
4. **Jeder Tag:**
   - **Morgen:** Begegnung am Wegesrand (drei zur Wahl) – ab Tag 2 manchmal stattdessen ein **Brief**. Danach hat ab Tag 2 die **Satzschmiede** geöffnet (freiwillig).
   - **Tag:** Laden mit 5 Items, Neu würfeln (3 Würfe am Tag zu 1 Gold, danach 2 Gold), Reservieren, Verkaufen, Verschieben, Drehen. **Händler-Vertrauen** (Laternen am Laden, 5 Stufen, 6/9/12/15 Gold, eine Stufe pro Tag) macht seltenere Gegenstände häufiger. **Schmied** (Amboss am Laden): einen Gegenstand für 3 × Grundpreis × Zielstufe um eine Sternstufe aufwerten, einmal am Tag, bis ★★★, nach einer Aufgabe; Abbrechen kostet nichts. Alles Verbinden passiert sofort: zwei gleiche werden zur nächsten Sternstufe, ein Kristall neben einem Träger zum Kompositum. Das Abzeichen „1/2“ mit „= sofort ★★“ zeigt Items, von denen man schon eins hat.
   - **Nacht:** Automatischer Kampf. Vorher kann man den Fehler auf der Ork-Rüstung verbessern (ein Versuch, richtig: Ork startet mit 15 % weniger Leben).
5. **Ende:** nach dem 10. Kampf („Reise geschafft“, mit Sternen nach Siegen) oder wenn alle 5 Herzen weg sind. Danach: Lernbericht, Erfahrung und Rang, neue Freischaltungen und Erfolge, der Heldencode (6 Zeichen) zum Abschreiben ins Heft.

Im Spielmenü kann man den **Lauf unterbrechen**: Der Lauf bleibt auf diesem iPad gespeichert und geht im Startmenü mit „Weiterspielen“ genau dort weiter.

## Begleiter-Tiere

Nach der Figur wählt das Kind ein Tier (`begleiter.json`, Bilder in `assets/ui/begleiter/`). Es liegt als 1×1-Gegenstand im Rucksack, lässt sich verschieben, aber nicht verkaufen, verschmelzen oder schmieden. Was es kann, steht in `wirkung`:

| Tier | Freischaltung | Wirkung |
| --- | --- | --- |
| Eule | von Anfang an | Regelkarte vorab bei Aufgaben („Eule fragen“), Nomen daneben +10 % |
| Igel | von Anfang an | Gegenstände daneben +3 Startblock |
| Pony | Rang 2 | Gegenstände daneben 10 % schneller |
| Fuchs | Rang 3 | einmal am Tag kostenlos neu würfeln |
| Rabe | Rang 4 | markiert das falsche Wort auf der Ork-Rüstung, +1 Gold je Sieg |
| Falke | Rang 5 | der erste Angriff im Kampf wirkt doppelt |

Kampf-Wirkungen gelten nur, wenn das Tier im Rucksack liegt (nicht im Lager). Logik: `js/begleiter.js`, Tests: `tests/begleiter.test.mjs`.

## Botschaften lesen (Leseverständnis)

Ab Tag 2 kommt am Morgen mit 50 % Wahrscheinlichkeit (nie zweimal hintereinander) statt der Begegnung ein Brief. Er öffnet sich auf einer Pergamenttafel: links der Text (60–120 Wörter), rechts nacheinander 1–2 Fragen (Information finden, Schlussfolgern, Wortbedeutung). Richtig: Gegenstand oder Gold aus dem Brief. Falsch: 1 Gold Trost, die Stelle im Text wird markiert („Hier steht es: …“).

- `botschaften.json`: 33 Briefe (Kleinwurzel und Hrossmark, Schwierigkeit 1–3) mit Absender, Text, Fragen, Antworten, Textstelle und Belohnung.
- Thema **Leseverständnis** (`lesen` in `themen.json`) mit eigenem Lernstand: zwei Briefe hintereinander ganz richtig → schwierigere Briefe. Die Lehrkraft kann das Thema ausschalten, dann kommt immer eine Begegnung.
- `node tools/pruefliste.mjs` listet alle Briefe mit Fragen zum Abhaken. Logik: `js/botschaften.js`, Darstellung: `js/brief-ui.js`.

## Rune der Woche

Im Startmenü startet **Rune der Woche** einen Lauf, der eine Woche lang für alle gleich ist: Figur, Begleiter, Schicksalsrune, Läden (auch beim Neu würfeln), Gegner, Begegnungen und Briefe hängen nur von der Kalenderwoche ab – mit Klassen-Code zusätzlich von dessen Themen. Am Ende gibt es Punkte (Siege × 100, übrige Herzen × 40, erreichter Tag × 20, Aufgaben gleich richtig × 5) und ein **Ergebnis-Siegel** aus 4 Zeichen, das Woche und Punkte enthält und jeden Tippfehler erkennt. Auf dem Gerät wird der beste Versuch der Woche gemerkt.

Die Lehrkraft tippt im Bereich „Für Lehrkräfte“ unter **Rune der Woche prüfen** Kürzel und Siegel ein und sieht die Rangliste (zum Zeigen am Beamer, nichts wird gespeichert). Logik: `js/wochenrune.js` (Kalenderwoche, Seed, Punkte, Siegel), fester Zufall: `laufRng` in `js/logic.js`.

## Satzschmiede (Satzglieder)

Ab Tag 2 hat am Morgen (nach Begegnung oder Brief) die Satzschmiede geöffnet – freiwillig, höchstens eine Spruchrolle am Tag. Das Kind tippt Satzglied-Karten an oder zieht sie in die Satzleiste. Jede Satzglied-Art hat eine Farbe und ein Form-Zeichen: Subjekt (Kreis, blau), Prädikat (Balken, rot), Objekt (Dreieck, grün), Adverbiale der Zeit (Raute, lila), der Art und Weise (Fünfeck, orange), des Ortes (Quadrat, türkis). Dazu kommen falsche Karten: falsche Personalform („du schlägst“) und falscher Fall („der Ork“, „ich“ als Objekt).

- **Gültig** ist ein Aussagesatz mit dem Prädikat an zweiter Stelle, Subjekt und Prädikat passen zusammen, das Objekt steht im richtigen Fall – und Objekt und Adverbiale passen zum Verb (`satzschmiede.json`: „heilen“ geht mit „mich“ und „uns“, nicht mit „den Ork“). Ein falscher Satz ergibt eine freundliche Erklärung und keine Spruchrolle.
- **Spruchrolle** (2×1, Bild `assets/ui/satzschmiede/spruchrolle.webp`): Prädikat = Wirkung (Schaden, Block oder Heilung wie die Verb-Rolle – in deren Sternstufe im Rucksack, mindestens ★★ ab Tag 2 und ★★★ ab Tag 6, damit die Rolle bis zum Ende nützlich bleibt), Subjekt = Bonus (Figur +15 %, „wir“ schneller, Begleiter nach seiner Art), Objekt +10 %, Zeit = wann sie startet („sofort“, „in der dritten Runde“ etwas später +25 %, „am Ende des Kampfes“ spät +50 % – Kämpfe dauern nur etwa 10 Sekunden), Art und Weise = Stärke oder Tempo, Ort +10 %. Das Info-Feld zeigt den Satz und jede Zeile der Wirkung. Spruchrollen verschmelzen nicht.
- **Umstellprobe** (Stufe 3): Nach dem Schmieden kann das Kind den Satz umstellen („Sofort schlägt Borga den Ork.“). Bleibt das Prädikat an zweiter Stelle, bekommt die Rolle einen Stern mehr (höchstens ★★★★). Laut Simulation verändert die Satzschmiede die Siege kaum (`tests/balance.test.mjs`).
- **Verben:** die Verb-Rollen im Rucksack, die zu einer Person passen (schlagen, stechen, schießen, stürmen, schützen, heilen), höchstens zwei; ohne solche Rolle die Grundverben schlagen und schützen.
- **Stufen** im Thema **Satzglieder** (der Lernstand ist derselbe wie bei den Satzglied-Aufgaben): 1 Subjekt und Prädikat, 2 dazu Objekte, 3 dazu Adverbiale und Umstellprobe. Zweimal gleich ein richtiger Satz → nächste Stufe. Ohne Klassen-Code gilt wie bei allen Themen höchstens Stufe 2; die Lehrkraft kann Stufe 3 freigeben oder das Thema ausschalten (dann bleibt die Schmiede zu).
- Alle geschmiedeten Sätze stehen im Buch der Wörter auf der Seite **Sprüche** (nur auf dem Gerät). Logik: `js/satzschmiede.js`, Darstellung: `js/satzschmiede-ui.js`, Tests: `tests/satzschmiede.test.mjs` (alle Kartenfolgen bis 4 Karten).

## Fortschritt zwischen den Läufen

| Was | So funktioniert es |
| --- | --- |
| **Buch der Wörter** (📚 im Spiel, Startmenü, Menü) | Seiten Komposita, Sternstufen, Steigerungen, Sätze, Schätze – 317 Einträge, automatisch aus `items.json` und `recipes.json`. Unentdeckt: dunkle Silhouette mit „???“; entdeckt: Bild, Name, Artikel, Wirkung, Lernhinweis. Fortschrittsbalken pro Seite. Neue Entdeckungen werden kurz eingeblendet. Dazu die Seiten „Regeln“ (Regelkarten) und „Sprüche“ (alle Sätze aus der Satzschmiede). Das Buch bleibt auf dem iPad. |
| **Erfahrung und Ränge** | Am Ende jedes Laufs: 10 pro Sieg, 5 pro neuer Entdeckung, 2 pro Frage beim ersten Versuch richtig. Lehrling (0) → Wanderer (350) → Runenkundige (1200) → Wortmeister (2600) → Hüter der Sprache (4000). Laut Simulation Rang 2 nach 2 Läufen, Rang 5 nach etwa 26. |
| **Freischaltungen** (nur über den Rang, damit sie im Heldencode stecken) | Faelith die Bogenschützin (Wanderer; Bogen-Komposita +30 %, sieht mögliche Komposita im Laden von Weitem), Hauptmann Theron (Runenkundige; +3 Startblock für Nomen mit passendem Siegel), Ritterin Ysolde (Wortmeister; Runen wirken auf zwei Nomen). Drachenfeuerschwert und Runenstein ab Runenkundige, Runenkrone ab Wortmeister. |
| **Rucksack-Designs** | Leder, Zwergenstahl (Wanderer), Elbenseide (Runenkundige), Reiterleder (Wortmeister), Silberbanner (Hüter der Sprache) – nur Optik, Auswahl in der **Sammlung** (Startmenü). |
| **Erfolge** | 18 Erfolge, z. B. „Erstes Kompositum“, „Erste ★★★★“, „Fehlerjäger“, „Satzbauer“, „Ohne Fehlversuch“, „Alle Helden“, „Feuermeister“. |
| **Lernbericht** | Nur für das Kind: Siege, neue Entdeckungen, Rangfortschritt, „Das sitzt schon“ und „Das üben wir noch“ mit Merkhilfe – ohne Noten und Prozentzahlen. |

Alle Werte stehen in `achievements.json` (Erfahrung, Ränge, Designs, Erfolge), `heroes.json` (Figuren mit `freischaltung`) und `items.json` (Items mit `freischaltung`).

## Heldencode

- **Heldencode:** genau 6 Zeichen in zwei Dreiergruppen, z. B. `K7Q-M2X`. Er enthält Erfahrung und „Tutorial geschafft“; Rang, Figuren und Rucksack-Designs ergeben sich daraus. Er erscheint am Ende jedes Laufs und im Menü – groß in der Leseschrift, mit „Schreib ihn in dein Heft“ und Knopf „Kopieren“, ohne QR-Code.
- **Prüfzeichen:** Das 6. Zeichen erkennt jeden einzelnen Tippfehler und jeden Dreher zweier Nachbarzeichen (die Tests prüfen das für Tausende Codes).
- **Nur auf dem iPad** (localStorage): Buch der Wörter, Erfolge, Regelkarten, Statistik, Lernstand, Klassen-Einstellung und ein unterbrochener Lauf (Menü → „Lauf unterbrechen“, im Startmenü „Weiterspielen“). Nach dem Heldencode auf einem neuen iPad wird der Lernstand beim Laufstart kurz neu eingeschätzt.
- **Eingeben:** Startmenü → „Heldencode“. Der Bindestrich ist optional, Kleinbuchstaben werden groß. Das Spiel erkennt auch den Klassen-Code (`THEMEN-…`) und meldet Tippfehler freundlich.
- **Alte, lange Codes** (Helden- und Reisecodes der ersten Version) werden weiter gelesen und umgerechnet: Erfahrung und Tutorial werden übernommen.
- „Neu beginnen“ im Menü löscht den Stand auf dem iPad nach einer Sicherheitsabfrage.

### Wichtige Regel: registry.json nur hinten ergänzen

Jeder Inhalt (Item, Figur, Erfolg, Buch-Eintrag …) hat in `registry.json` eine feste Nummer. Nach neuen Inhalten:

```bash
node tools/registry.mjs
```

Das Werkzeug hängt neue Einträge **nur hinten an**. Nie Einträge umsortieren, umbenennen oder löschen – sonst lassen sich alte, lange Codes nicht mehr umrechnen und Klassen-Codes passen nicht mehr. Die Tests melden, wenn etwas in `registry.json` fehlt, und prüfen einen gespeicherten Code aus Version 1.

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

**Verbinden ohne Bremse:** Die Aufgabe erscheint neben dem Rucksack (über Lager und Infobereich), nie über den Rucksack-Feldern; die beteiligten Items leuchten und sind mit einer dünnen Linie mit dem Fenster verbunden. Mit „Nicht verbinden“ bleiben die Items getrennt.

## Aufgaben und Lernstand

Die Aufgaben entstehen aus `wortschatz.json` (508 Nomen, 137 Verben, 93 Adjektive, 47 Komposita, 41 Wortfamilien, 44 Sätze, Wortfelder der Gebiete) und `themen.json` (15 Themen mit je drei Stufen und Regelkarten). Der Code dazu steht in `js/aufgaben/`.

- **Das Item bestimmt das Thema, nicht das Wort:** Nomen → Mehrzahl oder Artikel, Komposita → Komposita, Verben → Personalformen oder Zeitformen, Runen → Steigerung, Ork-Rüstung → Rechtschreibung. Das Wort ist zufällig, bevorzugt aus dem Wortfeld des Gebiets.
- **Die Item-Stufe bestimmt den Bereich:** ★★ = Stufe 1–2, ★★★ = Stufe 2–3, ★★★★ = Stufe 3 (ist Stufe 3 nicht erlaubt: zwei Aufgaben).
- **Sinnvolle Sätze:** Jedes Wort hat eigene Sätze – Nomen eine Bedeutungsgruppe, zwei Sätze und einen Mehrzahl-Satz; Verben drei Satzrahmen mit wechselnden Personen (daraus Präsens, Präteritum, Perfekt) und einen Satz mit dem Verb als Nomen; Adjektive Sätze mit Grundform, Komparativ und Superlativ. Keine Schablonen mit beliebigen Wörtern; ohne passenden Satz (z. B. für eine Artikel-Lücke) kommt die Aufgabe ohne Satz. Die Sätze stehen in `tools/saetze/*.txt` (ein „?“ markiert unsichere); `node tools/saetze.mjs` prüft sie und trägt sie in `wortschatz.json` ein.
- **Elf Formate:** Auswahl, Lückensatz, Buchstaben ergänzen (eigene Bildschirmtastatur), Eintippen (nur Stufe 3), Baukasten, Sortieren (Ziehen oder Antippen), Fehler finden, Satz ordnen, Passt nicht, Regel entdecken, Paare.
- **Lernstand je Thema:** zweimal gleich beim ersten Versuch richtig → nächste Stufe. Ein Fehler kommt als zweite bis vierte Aufgabe danach wieder – in anderer Form, mit anderem Wort. Jedes Wort höchstens einmal pro Thema und Lauf. Der Lernstand bleibt auf dem iPad (auf einem neuen iPad: Startstufe nach Rang, der erste Fehler senkt sie, der erste Treffer bestätigt sie); der Lernbericht zeigt Sterne je Thema, keine Prozente.
- **Belohnungen:** gleich richtig auf Stufe 2 → +1 Gold, auf Stufe 3 → +2 Gold, und beim Verbinden glänzt das neue Item (+10 % im nächsten Kampf). Jede richtig angewendete Regel wird eine Regelkarte im Buch (Seite „Regeln“).
- **Für Lehrkräfte** (Startmenü, Code in `lehrkraft.json`): Themen an/aus und höchste Stufe je Thema. Daraus entsteht ein Klassen-Code wie `THEMEN-3DFTS-R8UD8`, den die Kinder bei „Heldencode“ eintippen; er wird auf dem iPad gespeichert (nicht im Heldencode). Ohne Klassen-Code gelten alle Themen mit Stufe 1–2. Der Lehrkraft-Code liegt offen im Repository – er hält Kinder ab, ist aber kein echter Schutz.
- **Prüfliste für Lehrkräfte:** `node tools/pruefliste.mjs` erzeugt `wortschatz-pruefliste.html` (sortierbar, mit Häkchen-Spalte, Bedeutungsgruppen und allen Sätzen, unsichere Einträge und Sätze markiert).

## Inhalte ändern (ohne Programmieren)

**Werte für Gold und Laden** stehen zentral in `js/logic.js`: `income` (Gold pro Tag), `WUERFEL` (Würfelpreise), `HAENDLER` (Kosten, Gewichte und Texte der Vertrauens-Stufen), `SCHMIED` (Faktor, höchste Zielstufe), `GEGNER_HAENDLER_PRO_TAG` (Händler-Stufe der Gegner). `node --test tests/balance.test.mjs` zeigt danach pro Tag Siegquote, Gold am Tagesende, Händler-Stufe, Schmied-Nutzung und Würfe.

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
| `begleiter.json` | Begleiter-Tiere: Name, Artikel, Rolle, Text, Freischaltung (Rang), Wirkung |
| `botschaften.json` | Briefe: Gebiet, Schwierigkeit, Absender, Text, Fragen mit Antworten, Textstelle und Belohnung |
| `satzschmiede.json` | Satzschmiede: Verben mit passenden Objekten und Adverbialen, falsche Fälle, Wirkung jedes Satzglieds, Stufen |
| `tutorial.json` | Tutorial „Der erste Tag“: Schritte, Texte, Hilfe-Karten für „So geht's“, Erste-Mal-Tipps |
| `achievements.json` | Erfahrung, Ränge, Rucksack-Designs, Erfolge |
| `registry.json` | Feste Nummern für alte, lange Codes und Klassen-Codes (nur mit `node tools/registry.mjs` ergänzen) |

### Beispiele

- **Neues Nomen:** in `wortschatz.json` unter `nomen` eine Zeile mit allen Feldern ergänzen (siehe `_hinweis`); falsche Mehrzahlformen entstehen automatisch aus dem Pluralmuster. Ist ein Wort nicht eindeutig (z. B. „der/das Teil“), `"mehrdeutig": true` setzen – dann kommt es in keiner Aufgabe vor. Danach `node tools/pruefliste.mjs` und die Tests laufen lassen.
- **Thema anpassen:** in `themen.json` Text oder Formate einer Stufe ändern, Regelkarten ergänzen (neue Regeln brauchen danach `node tools/registry.mjs`).
- **Neuer Fehler auf einer Ork-Rüstung:** in `enemies.json` beim Gegner unter `fehler`; `optionen` enthält genau eine richtige Schreibung.
- **Neuer Träger** (z. B. ein Besen): Item in `items.json` mit `"art": "traeger"` anlegen und die id in `recipes.json` unter `traeger` eintragen – alle acht Komposita entstehen automatisch.

Die Tests (siehe unten) melden, wenn eine Aufgabe nicht genau eine richtige Lösung hat oder eine falsche Antwort zufällig ein echtes Wort ist.

## Gestaltung

Vorbild ist die Haltung des Lernspiels Zwergeninsel: Das Bild ist der Bildschirm, eigene Schriften, keine Emojis, Materialien statt Flächen, wenig Text (mehr in `konzept.md`, Abschnitt „Grafikstil“).

- `gestaltung.css` (nach `style.css` geladen): Farben nach Materialien, Knöpfe, Tafeln mit Holzrahmen, Kopfleiste, Startbildschirm, Figurenwahl, Spielfeld, Kampfszene, Sieg und Niederlage.
- `schrift/`: Andika und Cinzel als WOFF2 mit Lizenztexten (SIL Open Font License) – nichts wird von fremden Servern geladen.
- Keine Töne: kein Klang, keine Sprachausgabe (`tests/stille.test.mjs`).
- Bildschirmfotos und Layout-Prüfung (kein seitliches Scrollen, kein Scrollen auf Start, Figurenwahl, Spielfeld und Kampf, keine Emojis) bei 1024×768, 1180×820 und 1366×1024:

```bash
node tools/bildschirme.mjs http://localhost:8080/ docs/screenshots
```

  Ohne Ordner (`-`) wird nur geprüft. Die Übersicht bei 1180×820 liegt in `docs/screenshots/`.

## Bilder

Alle Bilder liegen in `assets/`. Die Originale (große PNGs) stehen in `assets/roh/` und werden nur von den Werkzeugen gelesen – sie kommen nicht in den Service Worker. Das Spiel lädt kleine WebP-Bilder:

| Ordner/Datei | Inhalt |
| --- | --- |
| `assets/items/` | ein Bild pro Item (1×1: 256 px, 1×2: 256×512 px, 2×2: 512 px), Name = Item-id |
| `assets/gegner/` | die vier Orks (512 px) |
| `assets/figur-*.webp`, `assets/boss-*.webp` | Figuren und Bosse, 512 px hoch |
| `assets/hintergrund-*.webp`, `assets/titelbild.webp` | Gebiets-Hintergründe und Titelbild, 1536 px breit |
| `assets/ui/` | Oberfläche: Symbole (`symbole/`), Zustände (`zustand/`), Banner, Kampfeffekte, besiegte Orks, Fenwick-Posen, Flächen (Tafelrahmen, Rucksack aus Leder, Lager-Truhe, Händlerstand) – mit `node tools/zerschneide.mjs ui` aus `assets/roh/ui/` |
| `assets/zuordnung.json` | welches Bild zu welcher id gehört (wird von den Werkzeugen geschrieben) |
| `assets/vorschau.html` | Übersicht aller Items mit Bild zum Prüfen (im Browser öffnen, z. B. http://localhost:8080/assets/vorschau.html) |

Fehlt zu einem Item ein Bild, zeigt das Spiel automatisch das Emoji aus `items.json` – das ist die einzige Stelle mit Emojis; sonst sind alle Symbole Bilder (`js/symbole.js`). Fehlende Oberflächen-Bilder stehen in `BILDER-OFFEN.md`. Komposita (z. B. Feuerschwert) zeigen das Bild ihres Trägers mit dem Kraft-Leuchten darüber, gesteigerte Runen das Bild ihrer Grundrune. Sternstufen und Kraft-Effekte werden im Code darübergelegt.

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
| `tests/offline.test.mjs` | Alle Skripte, Daten, Oberflächen-Bilder, Schriften und Stylesheets stehen in der Liste des Service Workers (Rohbilder nicht) |
| `tests/oberflaeche.test.mjs` | Keine Emojis in Oberfläche und Texten, Symbole und Schriften liegen im Projekt |
| `tests/stille.test.mjs` | Keine Töne im Code |
| `tests/verbsatz.test.mjs` | Verb-Rollen: natürliche Sätze für alle Vorlagen, Gegenstände und Personen (Dativ nach „mit“), Aufgabe aus dem Aufgabensystem |
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
| `js/symbole.js` | Symbole, Fenwick-Posen, Banner und Effekte als Bilder statt Emojis |
| `js/lehrkraft-ui.js` | Bereich „Für Lehrkräfte“ mit Klassen-Code |
| `js/tutorial.js` | Tutorial: Spotlight, Sprechblase, Hand, „So geht's“, Erste-Mal-Tipps |
| `js/tutorial-logic.js` | Tutorial ohne Darstellung: aktive Schritte, Prüfen, Zurücksetzen (testbar) |
| `js/battle-ui.js` | Kampfanzeige und Fehler auf der Ork-Rüstung |
| `js/ui.js` | Gemeinsame Bausteine: Fenster, Frage-Fenster am Item, Item-Kacheln, Raster, Verbinden-Animation |
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
| `js/code.js`, `js/code-ui.js` | Heldencode (6 Zeichen) und Klassen-Code: kodieren, prüfen, lesen, alte lange Codes umrechnen; anzeigen und eingeben |
| `js/aufgaben/saetze.js` | Sätze je Wort: Lücken, Satzrahmen der Verben in Präsens, Präteritum und Perfekt |
| `tools/saetze.mjs`, `tools/saetze/*.txt` | Sätze zu allen Wörtern: prüfen und in `wortschatz.json` eintragen |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA (offline, Home-Bildschirm) |
| `tools/serve.mjs` | lokaler Testserver |
| `tools/zerschneide.mjs` | zerlegt Sprite-Sheets in Einzelbilder (WebP), schreibt Zuordnung und Vorschau |
| `tools/bilder.mjs` | verkleinert Figuren, Bosse, Hintergründe, Titelbild; erzeugt die App-Symbole |
| `tools/chrome.mjs`, `tools/vorschau.mjs` | Hilfen für die Bild-Werkzeuge |
| `tools/tutorial-browsertest.mjs` | spielt das Tutorial im Browser per Touch durch |
| `tools/registry.mjs` | hängt neue Inhalte hinten an `registry.json` an |

Kein Server, keine Accounts, keine externen Dienste. Fortschritt und laufender Lauf werden im Browser gemerkt; der 6-stellige Heldencode bringt Rang, Figuren und Designs auf ein anderes iPad.
