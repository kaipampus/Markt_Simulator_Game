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
- [x] Karte mit Hotel-Viertel, Fluss (3 Felder) und Markt; Bauregeln je Bereich
- [x] Tag/Nacht mit Zeitsteuerung: Pause, 1×/2×/4×, „Nacht jetzt starten“
- [x] Hotels mit Betten und Zimmergeld; Gäste schlafen tagsüber und wachen nachts auf
- [x] Morgengrauen-Warnung; wer bei Sonnenaufgang draußen ist, vergeht (nur Ruf-Verlust, kein Game Over)
- [x] Bedürfnisse (Hunger, Durst, Glück, Wärme, Toilette) mit passenden Gebäuden; Bezahlen pro Besuch
- [x] Zufriedenheit und Ruf, Gästezahl hängt vom Ruf ab
- [x] Geister laufen nur auf Wegen; Wege per Ziehen bauen; Startweg vom Tor zur Brücke
- [x] Geistertypen: normal, langsam (Elder), schnell (Sprite)
- [x] Morgenbericht
- [ ] Balancing im echten Spiel testen (Preise, Tageslängen, Gästezahl, Zeitalter-Kosten)

## Phase 3 – Infrastruktur, Transport und Zeitalter
- [x] Brücken mit Kapazität (Holz 3, Stein 6, Stahl 10) und Warteschlange
- [x] Fähren: Dampffähre (12 pro Fahrt), Motorfähre (20, schneller)
- [x] Zeitalter Laternenzeit → Dampfzeit → Neon-Zeit (Ruf schaltet frei, Münzen kaufen)
- [x] Größere Hotels: Grand Hotel (24 Betten), Sky Hotel (40 Betten)
- [x] Neue Gebäude: Café, Getränkeautomat, Spielhalle, Gaslaterne, Neonschild
- [x] Wege ändern ihr Aussehen je Zeitalter (Erde → Stein → Asphalt)
- [x] Bauleiste mit Reitern, gesperrte Gebäude sichtbar
- [ ] Straßenbahn oder Bus in der Neon-Zeit
- [ ] Laternen mit Wirkung (z. B. Geister meiden dunkle Wege)
- [ ] Sauberkeit und Müll
- [ ] Personal einstellen und einteilen
- [ ] Marktstände sehen je Zeitalter moderner aus

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
- Gebäude drehen oder spiegeln
