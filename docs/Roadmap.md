---
aktualisiert: 2026-11-08
---

# Roadmap

Konzept: [[Spielkonzept]] · Entscheidungen: [[Entscheidungen]] · Verlauf: [[Changelog]]

## Phase 0 – Setup
- [x] GitHub-Repo anlegen und auf den Mac klonen
- [x] Obsidian-Vault, `CLAUDE.md`, `docs/`, `.gitignore`
- [x] Ansicht festlegen: schräg von oben (3/4)
- [x] Projektgerüst: Phaser 4 + TypeScript + Vite
- [x] Erster Commit und Push
- [ ] (später) Server: nginx, HTTPS, Deploy per GitHub Actions

## Phase 1 – Prototyp (Platzhalter-Grafik)
- [x] Spielfeld-Raster (28 × 20 Felder) und Kamera (ziehen, WASD/Pfeiltasten, Mausrad-Zoom)
- [x] Gebäude auswählen (Leiste oder Tasten 1–6) und setzen, mit Vorschau grün/rot
- [x] Geld anzeigen, Baukosten abziehen, Abreißen mit 50 % Erstattung (Taste X)
- [x] Geister erscheinen am Tor, laufen per Wegfindung zu Gebäuden und gehen wieder

## Phase 2 – Kern-Spielschleife
- [x] Karte mit Hotel-Viertel, Fluss und Markt; Bauregeln je Bereich; Startbrücke
- [x] Tag/Nacht läuft automatisch (Tag 35 s, erster Tag 45 s, Nacht 150 s)
- [x] Hotel mit 12 Betten und Zimmergeld; Gäste schlafen tagsüber und wachen nachts auf
- [x] Kernregel: Morgengrauen-Warnung, danach vergehen Geister, die noch draußen sind
- [x] Bedürfnisse (Hunger, Durst, Glück, Wärme, Toilette) mit passenden Gebäuden; Bezahlen pro Besuch
- [x] Zufriedenheit und Ruf, Gästezahl hängt vom Ruf ab, Game Over bei Ruf 0
- [x] Wege und Brücken: doppelt so schnell; Wegfindung sucht den schnellsten Weg; Wege per Ziehen bauen
- [x] Geistertypen: normal, langsam (Elder), schnell (Sprite)
- [x] Morgenbericht und Game-Over-Bildschirm
- [ ] Balancing im echten Spiel testen (Preise, Tageslängen, Gästezahl)

## Phase 3 – Infrastruktur und Transport
- [ ] **Geister-Bus**: zwei Haltestellen, der Bus pendelt und nimmt langsame Geister mit
- [ ] Laternen mit Wirkung (z. B. Geister meiden dunkle Wege)
- [ ] Sauberkeit und Müll
- [ ] Personal einstellen und einteilen
- [ ] Hotel ausbauen (mehr Betten)

## Phase 4 – Magie
- [ ] Mana und Schreine
- [ ] Zauber-Leiste mit ersten Zaubern
- [ ] Zufällige Ereignisse

## Phase 5 – Grafik und Sound
- [ ] Grafik-Stil festlegen, Assets beschaffen (siehe [[Assets]])
- [ ] Licht, Dampf, Glühwürmchen-Partikel
- [ ] Musik und Geräusche

## Phase 6 – Feinschliff
- [ ] Hauptmenü, Einstellungen
- [ ] Speichern und Laden
- [ ] Tutorial
- [ ] PWA: offline installierbar
- [ ] Version 1.0 auf dem Server

## Ideen-Parkplatz
- Option „Geister laufen nur auf Wegen“ als schwerer Modus
- Pause- oder Zeitraffer-Taste
- Gebäude drehen oder spiegeln
