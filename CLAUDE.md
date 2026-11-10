# Markt Simulator Game – Projektregeln

Ein 2D-Aufbau- und Verwaltungsspiel: Der Spieler besitzt einen **asiatischen Geister-Nachtmarkt** in einer Zauberwelt (Stimmung inspiriert von Ghibli-Filmen wie Chihiro), baut Stände und Infrastruktur und hält den Markt am Laufen. Einzelspieler, offline spielbar im Browser.

Details: [[docs/Spielkonzept]] · Fahrplan: [[docs/Roadmap]] · Entscheidungen: [[docs/Entscheidungen]]

## Sprache
- Mit dem Nutzer und in `docs/` immer **Deutsch**.
- **Texte im Spiel: Englisch**, gesammelt in `src/data/strings.ts` (keine Texte verstreut im Code).
- Code, Bezeichner, Commit-Messages: **Englisch** (Commit-Text kurz, im Imperativ, z. B. `Add building placement grid`).

## Technik
- **TypeScript + Vite**, reines Frontend, kein Backend. Darstellung bisher **Phaser 4** (2D); **Umstieg auf Three.js (3D) läuft** (siehe [[docs/Entscheidungen]] „Umstieg auf echte 3D-Darstellung“). Neue Darstellungs-Arbeit nur noch für 3D.
- **Ansicht:** quadratisches Raster (1 Feld = 1 Einheit in 3D), frei dreh- und neigbare Kamera. Spiellogik bleibt unabhängig von der Darstellung; Oberfläche künftig als HTML/CSS über dem 3D-Bild.
- **Nur PC/Mac:** Maus und Tastatur, keine Touch-Bedienung nötig.
- Spielstände im Browser (`localStorage`/IndexedDB), später als **PWA** offline installierbar.
- Hosting: statische Dateien (`dist/`) per nginx auf dem eigenen Linux-Server, Deploy später über GitHub Actions.
- Spielwerte (Gebäude, Geister, Zauber, Preise) als **Daten** in `src/data/` getrennt von der Logik halten, damit Balancing ohne Code-Umbau geht.

## Befehle
- `npm run dev`: lokaler Entwicklungsserver (http://localhost:5173)
- `npm run build`: Typprüfung + Produktions-Build nach `dist/`
- `npm run typecheck`: nur Typprüfung

## Aufbau von `src/`
- `main.ts`: Phaser-Konfiguration und Start
- `config.ts`: feste Werte (Feldgröße, Kartengröße, Farben)
- `data/`: Spielwerte und Texte (Gebäude, Personal und Sauberkeit, Zeitalter, Strings)
- `state/`: Spielzustand (Geld, belegte Felder), unabhängig von der Darstellung
- `scenes/`: `MarketScene` (Spiellogik antreiben, Maus und Tasten auf der Karte, zeichnet über `world3d/`) und `UIScene` (Oberfläche, noch Phaser, liegt durchsichtig über dem 3D-Bild)
- `entities/`: Spielfiguren als reine Logik ohne Grafik (Geister, Arbeiter, Fähren, Restaurants); `Walker` ist die gemeinsame Laufklasse
- `world3d/`: 3D-Darstellung mit Three.js: `World3D` (Kamera, Licht, Boden, Mausauswahl), `models` (Modelle aus Code, Toon-Look), `views` (zeichnen Gebäude und Figuren), `labels` (Sprechblasen als HTML), `quality` (Grafikstufe Hoch/Niedrig, Taste G)
- `gfx/`: Platzhalter-Grafiken, die per Code erzeugt werden

## Arbeitsablauf
- Entwickelt wird **lokal auf dem Mac** in diesem Ordner. Auf dem Server wird nicht entwickelt.
- Claude bearbeitet Dateien und **committet lokal nur nach Zustimmung des Nutzers**.
- **Gepusht wird vom Nutzer in VS Code** (Remote läuft über HTTPS mit der VS-Code-GitHub-Anmeldung). Claude pusht nur, wenn der Nutzer es ausdrücklich verlangt.
- Größere Features in eigenen Branches (`feature/<name>`), Merge nach `main` über Pull Request.
- Vor jedem Commit: `npm run build` muss fehlerfrei durchlaufen (sobald das Gerüst steht).

## Dokumentation (Obsidian-Vault)
Dieser Ordner ist gleichzeitig ein Obsidian-Vault. Notizen liegen in `docs/`, Links als Wikilinks (`[[Name]]`).
- **[[docs/Entscheidungen]]**: jede Entscheidung, die Architektur, Technik, Spielprinzip oder Ablauf betrifft, mit Datum, Begründung und verworfenen Alternativen. Neue Einträge oben.
- **[[docs/Changelog]]**: kurz festhalten, was sich spielbar oder strukturell geändert hat (nicht jeder Tippfehler). Neue Einträge oben, Datum im Format JJJJ-MM-TT.
- **[[docs/Roadmap]]**: Häkchen setzen, wenn ein Punkt erledigt ist. Neue Ideen unten unter „Ideen-Parkplatz“.
- Neue Anweisungen des Nutzers, die dauerhaft gelten sollen, hier in die CLAUDE.md übernehmen.

## Inhalt und Urheberrecht
- Stimmung der Vorlage ja (Laternen, Badehaus, Brücken, Dampf, Geister, Magie), **aber nichts Geschütztes übernehmen**: keine Figuren, Namen, Orte, Bilder, Musik oder Zitate aus Ghibli-Filmen. Alle Geister, Figuren und Orte sind eigene Erfindungen.
- Fremde Grafiken und Sounds nur mit passender Lizenz (bevorzugt CC0). Herkunft und Lizenz jedes Assets in `docs/Assets.md` festhalten.

## Grenzen
- Keine Passwörter, Tokens oder Server-Zugangsdaten ins Repo. Geheimnisse gehören in GitHub Secrets oder lokale `.env`-Dateien (die ignoriert werden).
