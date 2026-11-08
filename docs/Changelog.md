# Changelog

Was sich am Spiel oder an der Projektstruktur geändert hat. Neue Einträge **oben**.

## 2026-11-08 – Phase 2: Hotel, Tag/Nacht und Sonnenaufgang (Branch `feature/core-loop`)
- Neue Karte (32 × 24): Hotel-Viertel oben, Fluss in der Mitte, Markt unten mit Tor; Bauregeln je Bereich
- Badehaus entfernt, dafür **Hotel** (4 × 3, 12 Betten, 8 Münzen pro Nacht)
- Neue Gebäude: Path (5), Bridge (60), Brazier (40), Restroom (50); Wege lassen sich per Ziehen bauen
- Tag/Nacht läuft automatisch mit Lichtwechsel; Uhr oben in der Leiste
- Geister haben 2–3 Bedürfnisse, besuchen passende Gebäude und bezahlen; Symbol über dem Kopf zeigt den Wunsch
- Morgengrauen-Warnung: alle eilen zum Hotel oder Tor; wer bei Sonnenaufgang draußen ist, vergeht
- Ruf (Start 50) bestimmt die Gästezahl; Morgenbericht; Game Over bei Ruf 0
- Wegfindung sucht jetzt den schnellsten Weg (Wege und Brücken doppelt so schnell)
- Geistertypen: Wisp (normal), Elder (langsam), Sprite (schnell)
- Oberfläche passt sich schmalen Fenstern an; Herauszoomen begrenzt, damit die Karte den Bildschirm füllt

## 2026-11-08 – Phase 1: spielbarer Prototyp
- Projektgerüst mit Phaser 4.2, TypeScript 7 und Vite 8 (`npm run dev`, `npm run build`)
- Nachtmarkt mit 28 × 20 Feldern in 3/4-Ansicht, Tor als Eingang
- Kamera: ziehen, WASD/Pfeiltasten, Mausrad-Zoom (0,5×–2×)
- Baumenü mit 6 Gebäuden: Paper Lantern (15), Noodle Stall (80), Charm Stand (60), Tea House (150), Moon Shrine (120), Bathhouse (400)
- Vorschau beim Bauen (grün = passt, rot = belegt oder zu teuer), Abreißen mit 50 % Erstattung
- Startgeld 800 Münzen
- Geister erscheinen am Tor, laufen per Wegfindung um Gebäude herum, besuchen sie und gehen wieder (max. 14)
- Platzhalter-Grafiken komplett per Code gezeichnet (keine fremden Assets), Laternen mit Leuchteffekt
- Entscheidungen: Phaser statt Godot, 3/4-Ansicht, nur PC/Mac, Spieltexte Englisch

## 2026-11-08
- Projekt angelegt: GitHub-Repo geklont, Ordner als Obsidian-Vault eingerichtet
- `CLAUDE.md` mit Projektregeln, `.gitignore`
- Erste Doku: [[Spielkonzept]], [[Roadmap]], [[Entscheidungen]], [[Assets]]
