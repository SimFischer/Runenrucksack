# Runenrucksack

Ein Fantasy-Backpack-Battler fürs iPad (Querformat) als Web-App. Das vollständige Spielkonzept steht in [konzept.md](konzept.md).

**Stand: Etappe 1 – Kern-Prototyp**

- Rucksack-Raster 4×3, Items in den Formen 1×1, 1×2 und 2×2
- Verschieben per Finger, Drehen durch zweimal Antippen oder mit einem zweiten Finger beim Ziehen
- Lager neben dem Rucksack (Items dort wirken nicht); legt man ein Item auf belegte Felder im Rucksack, wandern die überdeckten Items ins Lager
- Laden mit 5 zufälligen Items, Neu-würfeln für 1 Gold, Reservieren mit 🔓, Verkaufen durch Ziehen in den Laden (halber Preis)
- Automatischer Kampf gegen einen Ork-Rucksack mit Abklingzeiten, Schaden, Block, Heilung, Gift, Brand und Kälte
- 5 Herzen, 10 Siege gewinnen den Lauf; jeder 5. Tag ein Anführer
- Grafik als Emojis, kein Server, keine Accounts, keine externen Dienste
- Offline spielbar (Service Worker) und als Symbol auf dem Home-Bildschirm installierbar

## Inhalte bearbeiten

- `items.json` – alle Items mit Form, Seltenheit, Preis und Kampfwerten. Neue Items einfach als weitere Zeile ergänzen.
- `enemies.json` – die Computer-Gegner und welche Wirkungen sie beim Packen bevorzugen.
- Balance-Werte (Startgold, Gold pro Tag, Leben pro Tag) stehen oben in `js/logic.js`.

## Lokal testen

Mit Node.js im Projektordner:

```bash
node tools/serve.mjs
```

Dann <http://localhost:8080> öffnen. (Einfach `index.html` doppelklicken geht nicht, weil der Browser die JSON-Dateien dann nicht laden darf.)

## Auf GitHub Pages veröffentlichen

1. Im Repository auf GitHub: **Settings → Pages**.
2. Unter „Build and deployment“: **Deploy from a branch**, Branch `main`, Ordner `/ (root)`.
3. Nach ein bis zwei Minuten läuft das Spiel unter `https://<benutzername>.github.io/Runenrucksack/`.

Auf dem iPad in Safari öffnen, **Teilen → Zum Home-Bildschirm**, dann startet es wie eine App im Vollbild.

Nach Änderungen an Dateien die Versionsnummer `CACHE` in `sw.js` erhöhen, damit installierte Apps die neue Version sicher bekommen.

## Aufbau

| Datei | Inhalt |
| --- | --- |
| `index.html`, `style.css` | Bildschirme und Aussehen |
| `js/main.js` | Oberfläche: Raster, Ziehen und Drehen, Laden, Kampfanzeige |
| `js/logic.js` | Regeln: Platzieren, Laden, Gold, Lauf, Gegner-Erzeugung |
| `js/battle.js` | Kampfsimulation |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA (offline, Home-Bildschirm) |
| `tools/serve.mjs` | lokaler Testserver |
| `tools/make-icons.mjs` | erzeugt die App-Symbole neu |
