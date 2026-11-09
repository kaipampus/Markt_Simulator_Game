---
aktualisiert: 2026-11-09
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
- [x] Sauberkeit und Müll (siehe Phase 3b)
- [x] Personal einstellen und einteilen (siehe Phase 3b)
- [ ] Marktstände sehen je Zeitalter moderner aus

## Phase 3b – Tag bauen, Nacht verwalten
- [x] Bauen und Abreißen nur tagsüber
- [x] Personal: Koch, Verkäufer, Gastgeber, Putzkraft; einstellen, entlassen, Lohn pro Nacht
- [x] Stände und Hotels nur offen, wenn ihr Arbeiter da ist
- [x] Personalhaus (Lodge, Dormitory) auf der Marktseite; Sonnenaufgangs-Regel auch für Arbeiter
- [x] Arbeiter per Klick umsetzen, Putzkräfte an eine Stelle schicken
- [x] Müll (nach Essen/Trinken), Schleimspuren (Ooze), Mülleimer
- [x] Workers-Reiter in der Bauleiste, Finanz-Fenster mit Verkäufen, Löhnen und Gewinn
- [ ] Balancing: Löhne, Müllmenge, Zahl der nötigen Putzkräfte
- [ ] Mehr zu tun in der Nacht: Arbeiter werden müde und brauchen Pausen
- [ ] Mülleimer laufen voll und müssen geleert werden
- [ ] Fährleute für Fähren, Personalhaus der Neon-Zeit

## Phase 3c – Volle Nächte, Bereiche und große Gästezahlen
Schritt 1 – Nachtleben:
- [x] Gäste kommen in Wellen über die ganze Nacht, bleiben länger, mehr Wünsche
- [x] Warteschlangen an Ständen (begrenzte Plätze), Geduld, wütende Gäste (😠)
- [x] Geistertypen mit eigener Geduld und Vorlieben (neu: Vielfraß)
- [x] Knopf „Zum Morgen springen“, höheres Startgeld, längere Nacht
- [ ] Balancing: Einnahmen sind mit längeren Nächten deutlich höher, Preise und Kosten anpassen

Schritt 1b – Restaurants, Vielfalt, Geld:
- [x] Restaurants mit Küche, Tischen, Koch und Kellner (Gäste sichtbar am Tisch)
- [x] Sieben Küchen (japanisch, vietnamesisch, chinesisch, thailändisch, koreanisch, Hexenküche), Gelüste der Gäste
- [x] Acht neue Stände, neues Bedürfnis Spaß, Reiter Food und Fun
- [x] Gebäude mit mehreren Jobs (z. B. 2 Köche + 2 Kellner)
- [x] Beliebtheit bestimmt die Gästezahl, Startgeld 650
- [ ] Gebäude-Stufen (mehr Tische, höhere Preise)
- [ ] Noch mehr Stände und Küchen (z. B. indisch, Street-Food-Wagen, Zauberbuden)
- [ ] Eigene Grafiken statt Platzhaltern für Restaurants

Schritt 2 – Level und Bereiche:
- [ ] Level mit Balken, Erfahrung aus zufriedenen Gästen und Gebäuden
- [x] Beliebtheitswert für Stände und Deko bestimmt die Gästezahl (vorgezogen)
- [ ] Bereich 1 Nachtmarkt (ohne Hotel), Bereich 2 Hotel-Viertel gesperrt bis Level + Münzen
- [ ] Zeitalter entfernen, Gebäude neu auf die Bereiche verteilen

Schritt 3 – Neon-Viertel und Größe:
- [ ] Karte nach rechts erweitern, Bereich 3 Neon-Viertel mit modernen Gebäuden
- [ ] Größere Hotels und Übergänge für hunderte Gäste
- [ ] Technik für tausende Gäste: Belastungstest, gemeinsame Wegkarten, vereinfachte Darstellung

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
- Preise pro Stand nachts anpassen
- Arbeiter mit Erfahrung oder Eigenschaften (schnell, freundlich, schläfrig)
