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
- [ ] Bedürfnisse der Geister und Gebäude, die sie erfüllen
- [ ] Einnahmen pro Besuch
- [ ] Wege: Geister laufen nur auf Wegen (Wegfindung)
- [ ] Tag/Nacht-Zyklus mit Bau- und Marktphase

## Phase 3 – Infrastruktur
- [ ] Laternen und Lichtradius
- [ ] Wasser und Feuer für Badehaus und Küchen
- [ ] Sauberkeit und Müll
- [ ] Personal einstellen und einteilen

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
- Geister zahlen beim Besuch eines Stands (gehört zu Phase 2, Wegfindung ist schon da)
- Mehrere Gebäude am Stück setzen, indem man die Maustaste gedrückt hält
- Gebäude drehen oder spiegeln
