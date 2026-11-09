# Changelog

Was sich am Spiel oder an der Projektstruktur geändert hat. Neue Einträge **oben**.

## 2026-11-09 – Türen, Drehen, Level statt Zeitalter, sichtbare Küche
- **Türen**: Gebäude mit Gästen oder Personal haben feste Türen (Matte vor der Tür). Restaurants haben zwei gegenüberliegende, alle anderen eine. Gäste und Arbeiter nutzen nur die Türen; die Tür muss an einem Weg liegen
- **Drehen** mit R beim Bauen (Vorschau zeigt die Türen grün/orange) oder tagsüber für ein ausgewähltes Gebäude (auch Knopf im Infofenster)
- **Level mit Erfahrungsbalken** oben links statt Zeitalter-Kauf; Erfahrung aus Einnahmen und zufriedenen Gästen; Gebäude werden nach und nach freigeschaltet (🔒 Lv)
- **Hotel-Viertel gesperrt** (abgedunkelt) bis Level 6, dann für 2000 Münzen zu öffnen; Startbrücke entfällt
- **Gästezahl folgt der Kapazität**: Tische und Bedienplätze bestimmen, wie viele Gäste kommen; Markt bis 100, mit Hotel-Viertel bis 400
- Restaurants größer (4 × 4, 5 × 5) mit **eigener Küche** (Fliesen, Herde, Ausgabe): Der Koch kocht am Herd und trägt das Essen zur Ausgabe, der Kellner bringt es zum Tisch
- An Ständen steht der Arbeiter **sichtbar hinter der Theke**
- Über Restaurants nachts **„🪑 belegt/Tische ⏳ Wartende“**
- Werte für Level und Freischaltungen in `src/data/levels.ts`

## 2026-11-09 – Restaurants, viele neue Stände, Geld-Wachstum
- **Restaurants** als offene Räume: Küche mit Koch, Tische, Kellner trägt das Essen, Gäste sitzen sichtbar und essen ca. 15 s
- Sieben Restaurants: Moonbroth Ramen, Mistleaf Pho, Floating Dumpling House, Firefly Curry House, Ember Grill, Starfish Sushi Bar, Bubbling Cauldron Hot Pot
- Neuer Job **Kellner** (Waiter); Gebäude können mehrere Jobs und Plätze haben
- Acht neue Stände: Firefly Skewers, Moon Mochi, Dream Floss, Cauldron Bubble Tea, Ghost Goldfish Scooping, Spirit Mask Stand, Lantern Ring Toss, Paper Crane Fortunes
- Neues Bedürfnis **Spaß** 🎏, neue Reiter **Food** und **Fun**
- **Gelüste**: Gäste wollen oft eine bestimmte Küche
- **Beliebtheit** (★ oben) bestimmt die Gästezahl; Startgeld 650 statt 2500
- Gäste-Laune: nur noch erfüllte gegen gescheiterte Wünsche; fehlende Angebote kosten Geld statt Ruf; Essen und Trinken sind häufigere Wünsche
- Gäste verteilen sich zufälliger auf mehrere Stände

## 2026-11-09 – Volle Nächte: Wellen, Schlangen, Geduld (Branch `feature/night-life`)
- Neues Konzept dokumentiert: Bereiche mit Level statt Zeitalter, Beliebtheit, Gästezahlen bis in die Tausende (Umsetzung folgt)
- **Gäste kommen in drei Wellen** über die ganze Nacht (Abendansturm, Mitternacht, Nachzügler) statt alle am Anfang
- Gäste haben **3–6 Wünsche**, Wünsche können sich wiederholen; zwischen den Käufen bummeln sie ein Stück
- **Warteschlangen**: Jeder Stand bedient nur wenige Gäste gleichzeitig (z. B. Nudelbude 1, Teehaus 2, Spielhalle 4) mit eigener Bedienzeit; Gäste stellen sich an und wählen Stände mit kürzerer Schlange
- **Geduld**: Wer zu lange wartet, wird ungeduldig (😤), dann wütend (😠), verlässt die Schlange und ist unzufriedener
- **Geistertypen** mit eigener Geduld und Vorlieben: Elder geduldig, muss oft aufs Klo; Sprite ungeduldig, mag Glück; neu der **Vielfraß** (Glutton), immer hungrig und schnell sauer
- Über Ständen mit langer Schlange steht 👥 und die Anzahl
- Knopf **„☀ Skip to morning“** (Taste N), sobald alle Gäste weg sind; Arbeiter gehen dabei sofort ins Bett
- Nacht dauert 4 Minuten, Startgeld 2500, Grundzahl der Gäste höher (20 + Ruf/2)
- Ruf ändert sich jetzt nach Anteilen statt pro Gast, damit er auch bei vielen Gästen sinnvoll bleibt
- Das Leuchten der Gäste ist schwächer, damit viele Gäste keinen weißen Fleck ergeben
- Daten der Geistertypen und Wellen in `src/data/spirits.ts`

## 2026-11-09 – Übersichtlichere Oberfläche: Workers-Reiter und Finanzen
- Personal hat jetzt einen eigenen Reiter **Workers** in der Bauleiste (neben Decor) statt eines schwebenden Fensters: links eine Karte pro Job (Bild, Einstellungspreis, Lohn pro Nacht, Anzahl), Klick stellt ein; rechts alle Arbeiter als Namensschilder mit Statuspunkt, Klick wählt aus und zeigt sie auf der Karte
- Neues Fenster **Finances** (Knopf oben oder Taste I): Lohnkosten pro Job und Nacht, was Gäste heute Nacht und letzte Nacht bei welchem Gebäude gekauft haben, Zimmergeld, gezahlte Löhne und Gewinn
- Morgenbericht kürzer, mit Gewinn und Verweis auf die Finanzen
- Infofenster mit Schließen-Knopf, zeigt Preise von Ständen und Hotels
- Hinweistext bricht auf schmalen Bildschirmen um; Hinweise beim Darüberfahren bleiben beim Aktualisieren stabil

## 2026-11-09 – Tag bauen, Nacht verwalten: Personal und Sauberkeit (Branch `feature/staff`)
- **Bauen und Abreißen nur tagsüber**; nachts ist die Bauleiste gesperrt, man verwaltet den Markt
- **Personal**: Koch (Nudelbude, Teehaus, Café), Verkäufer (Glücksbringer-Stand, Spielhalle), Gastgeber (alle Hotels), Putzkraft; Einstellungsgebühr und Lohn pro Nacht
- Stände und Hotels sind **nur geöffnet, wenn ihr Arbeiter vor Ort ist**; Toilette, Feuerschale, Schrein und Getränkeautomat brauchen niemanden
- **Personalhaus** (Staff Lodge, 6 Betten; Staff Dormitory ab Dampfzeit, 14 Betten), nur auf der Marktseite; eine Lodge steht zu Beginn neben dem Weg
- Arbeiter laufen nachts zur Arbeit und bei Morgengrauen heim; wer bei Sonnenaufgang draußen ist, vergeht. Gastgeber bleiben im Hotel und schlafen dort
- **Müll und Schleim**: Gäste lassen nach Essen/Trinken Müll fallen, der neue Schleimgeist (Ooze) hinterlässt Spuren; schmutzige Wege verderben die Laune
- **Mülleimer** (20 Münzen) fangen Müll im Umkreis von 3 Feldern ab, Schleim nur die Putzkraft
- Putzkräfte suchen selbst Schmutz; per Klick schickt man sie an eine Stelle
- Neues **Personal-Fenster** (Taste P), **Infofenster** für angeklickte Gebäude und Arbeiter, Symbole über Ständen ohne Personal
- Morgenbericht mit Löhnen, verlorenen Arbeitern und Sauberkeit
- Technik: gemeinsame Laufklasse `Walker` für Geister und Arbeiter (Wege, Brücken, Fähren)

## 2026-11-08 – Entspannter Modus, Wege-Pflicht, Brücken, Fähren und Zeitalter
- **Kein Game Over** mehr: Ruf sinkt nur, dann kommen weniger Gäste
- **Zeitsteuerung**: Pause (Leertaste), Tempo 1×/2×/4× (Taste F), „Start night“ (Taste N); erster Tag 90 s, weitere 45 s
- **Geister laufen nur auf Wegen**, Wege sind nicht mehr schneller; Startweg vom Tor zur Holzbrücke
- **Brücken mit Kapazität**: Holz 3, Stein 6, Stahl 10 Geister gleichzeitig; Wartende stellen sich an, die Wegfindung weicht auf andere Übergänge aus
- **Fähren**: Dampffähre (12 pro Fahrt) und Motorfähre (20, schneller) pendeln zwischen den Ufern
- **Zeitalter**: Laternenzeit → Dampfzeit (Ruf 60, 1200) → Neon-Zeit (Ruf 75, 3000), Kaufknopf oben links
- Neue Gebäude: Steinbrücke, Stahlbrücke, Dampf- und Motorfähre, Grand Hotel (24 Betten), Sky Hotel (40), Café, Getränkeautomat, Spielhalle, Gaslaterne, Neonschild; Hotel heißt jetzt Inn
- Wege sehen je Zeitalter anders aus (Erde → Stein → Asphalt)
- Bauleiste mit Reitern (Transport, Market, Services, Hotels, Decor), Hinweistext beim Darüberfahren
- Fluss 3 Felder breit; Brücken und Fähren dürfen nicht direkt nebeneinander stehen

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
