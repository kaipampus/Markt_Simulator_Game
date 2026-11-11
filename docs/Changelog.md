# Changelog

Was sich am Spiel oder an der Projektstruktur geändert hat. Neue Einträge **oben**.

## 2026-11-11 – Umstieg auf 3D, Schritt C: Oberfläche als HTML/CSS (Branch `feature/html-ui`)
- Die ganze Oberfläche ist jetzt HTML/CSS über dem 3D-Bild (`src/ui/`), Phaser zeichnet nichts mehr; es treibt nur noch Spielschleife, Maus und Tasten auf der Karte
- **Aussehen asiatisch-warm**: Leisten aus dunklem Holz mit roter Kante, Fenster als Papier mit Holzrahmen, Laternenrot und Gold als Akzente, Überschriften in der Schrift Kaisei Decol (SIL OFL, mitgeliefert, offline)
- Anordnung wie bisher: obere Leiste (Titel, Finanzen, Geister, Beliebtheit, Geld), Level-Feld links, Uhr und Tempo in der Mitte, Bauleiste mit Reitern unten, Info-Fenster rechts unten, Finanzen rechts oben, Morgenbericht, Hinweiszeile, große Meldungen (Level, Hotel-Viertel)
- **Bildchen in der Bauleiste aus den 3D-Modellen**: jedes Gebäude und jeder Beruf wird beim Start einmal klein abfotografiert (`src/world3d/thumbnails.ts`)
- **Einstellungen** über das Zahnrad oben rechts (auch im Titelmenü): Grafik Hoch/Niedrig; Taste G bleibt
- Titelmenü als HTML mit Nachthimmel und Laternen; Enter = Weiterspielen
- Tastenkürzel unverändert (Space, F, N, P, I, R, X, Esc, Tab, G, 1–9); neu: Shift+Tab blättert die Reiter rückwärts
- Kleinere Fenster: Uhr rückt neben bzw. unter das Level-Feld, Bauleisten-Karten werden schmaler
- Entfernt: `UIScene`, `StaffUI`, `FinanceUI`, `MenuScene` und die alten 2D-Platzhalter-Grafiken (`src/gfx/textures.ts`)

## 2026-11-10 – Schnelleres Wachstum, Restaurants bis Stufe 5, bessere Leistung (Branch `feature/balance-tiers`)
- **Balancing**: Restaurants kosten pro Gericht 2–3 Münzen mehr (Ramen 14 statt 12), Stände 1 Münze mehr; Löhne niedriger (Koch 10, Kellner 8, Verkäufer 8, Gastgeber 14, Putzkraft 7)
- Erfahrung pro eingenommener Münze 0,3 statt 0,4, damit die Level trotz höherer Einnahmen etwa im alten Tempo kommen (Level 6 etwa nach Nacht 6, Level 8 nach Nacht 8)
- **Beliebtheit wächst schneller**: jeder neue Stand oder jedes neue Restaurant bringt 1,5 neugierige Gäste (höchstens 5 pro Nacht), Zufriedenheit bis +16 % (vorher 12 %), Schmutz kostet weniger (höchstens −6 %)
- Gemessen mit einem Test-Bot (baut Wege, kauft nach fester Wunschliste, stellt Personal ein, 4× Tempo), Nacht 1–6:
  - vorher: Gäste 15 → 14 → 15 → 16 → 17 → 18 → 19 (+1 pro Nacht), Gewinn 194 / 248 / 226 / 131 / 197 / 200
  - jetzt: Gäste 15 → 16 → 21 → 26 → 30 → 37 → 43 (+4 bis +7 bei guten Nächten), Gewinn 262 / 214 / 365 / 491 / 511 / 658, Nacht 7–8: +6 / +8 Gäste, Gewinn je 964; ab Nacht 2 reicht es für 2–4 Stände samt Personal pro Tag
- **Restaurants bis Stufe 5**: Stufe 2 +2 Tische und zweiter Kellner, Stufe 3 Raum +1 Reihe, +2 Tische, zweiter Koch, **Stufe 4 zweite Etage** über der Küche mit Treppe, Geländer und Laternen (4 Tische oben, schnellere Herde), Stufe 5 8 Tische oben. Kleines Restaurant 4 → 6 → 8 → 12 → 16 Tische, höchstens 2 Köche und 2 Kellner. Stufe 4 ab Level 6, Stufe 5 ab Level 8
- Gäste, Köche und Kellner laufen über die Treppe nach oben (Höhe in der Spiellogik, `src/entities/layout.ts`); Infotext zum Ausbau zeigt, was die nächste Stufe bringt
- Ältere Spielstände: Arbeiter über der neuen Höchstzahl eines Restaurants verlieren beim Laden ihren Platz
- **Leistung**: Pixel-Ratio höchstens 1,5, 10 statt 24 Nachtlichter (nur 4× pro Sekunde neu verteilt), Schattenkarte 1024 statt 2048 mit einfacherer Filterung, nachts kein Schatten-Neuzeichnen, kein Shader-Neubau mehr bei Dämmerung. GPU-Zeit pro Bild (1440 × 900, gleicher Markt): Nacht 14,4 → 4,0 ms, Tag 6,7 → 3,6 ms
- **Taste G**: Grafik Hoch/Niedrig (Niedrig: Pixel-Ratio 1, 4 Lichter, keine Schatten, ohne Kantenglättung nach Neuladen; Nacht 2,8 ms, Tag 1,2 ms); wird im Browser gemerkt

## 2026-11-10 – Umstieg auf 3D, Schritt B: das Spiel läuft in 3D (Branch `feature/3d-migration`)
- Die Spielwelt wird jetzt mit Three.js in 3D gezeichnet (`src/world3d/`); die Oberfläche (noch Phaser) liegt durchsichtig darüber
- **Kamera**: rechte Maustaste ziehen = drehen und neigen (fast senkrecht bis fast seitlich), linke Maustaste ziehen = verschieben, Mausrad = zoomen, **Q/E** = 45° drehen, WASD/Pfeile = verschieben
- Bauen, Abreißen, Auswählen und Wege ziehen per Mausklick in 3D (Klick trifft Boden oder Gebäude); Vorschau als durchsichtiges Modell mit Fläche und Türen
- Weicher Toon-Look (dreistufige Schattierung); Tag mit Sonne und Schatten, Nacht dunkel mit echten Lichtern an den Laternen nahe der Kamera (24 Lichter wandern mit), Fenster, Laternen und Feuer leuchten
- Modelle aus Code für Stände, Restaurants (offen, mit Küche), Häuser und Hotels, Laternen, Gaslampen, Neon, Feuerschalen, Mülleimer, Schrein, Automaten, Brücken, Fähren mit Boot, Tor
- Geister, Arbeiter, Köche und Kellner als 3D-Figuren; Sprechblasen, Schilder und schwebende Zahlen als HTML über dem Bild
- Müll und Schleim, Türmatten, abgedunkeltes Hotel-Viertel mit Schild
- Testseite `prototype-3d.html` und die alte 2D-Figurendarstellung entfernt

## 2026-11-10 – Umstieg auf 3D, Schritt A: Logik von der Grafik getrennt (Branch `feature/3d-migration`)
- Geister, Arbeiter, Fähren und Restaurants sind jetzt reine Spiellogik ohne Phaser (`src/entities/`); sie liefern Position, Blickrichtung, Symbol und Zustand
- Die 2D-Darstellung liegt in `src/view2d/views.ts` (Ein- und Ausblenden, Verglühen in der Sonne nur dort)
- Zufallshilfen ohne Phaser (`src/state/random.ts`), Restaurant-Grundriss in `src/entities/layout.ts`
- Spielerisch keine Änderung; Grundlage für die 3D-Darstellung in Schritt B

## 2026-11-10 – 3D-Test (Branch `feature/3d-prototype`)
- Eigene Testseite `prototype-3d.html` (im Entwicklungsserver: http://127.0.0.1:5173/prototype-3d.html), das Spiel selbst bleibt unverändert
- Ein Stück Markt in echtem 3D mit Three.js: Restaurant mit offener Küche und Tischen, Stände (offen auf zwei Seiten, einer quer gedreht), Teehaus, Personal-Lodge, Toilette, Laternen, Feuerschale, Tor, schwebende Geister
- Die Gebäude stammen aus dem echten Spielzustand (`GameState`), nur die Darstellung ist neu
- Kamera frei: linke Maustaste drehen und neigen (fast senkrecht bis fast seitlich), rechte verschieben, Mausrad zoomen; Taste T wechselt zwischen Tag (Sonne mit Schatten) und Nacht (Laternen, Fenster und Feuer leuchten)
- Neue Abhängigkeit: `three` (Three.js 0.170)

## 2026-11-10 – Stände auf beiden Seiten offen
- Stände haben jetzt zwei gegenüberliegende offene Seiten mit Theke (wie Restaurants zwei Türen); Gäste kommen von beiden Seiten
- Man schaut nie mehr auf eine Rückwand: vorn/hinten zeigt die offene Theke, quer gedreht sieht man von der Seite in den Stand hinein (Theken an beiden Enden, Arbeiter dazwischen)

## 2026-11-10 – Gebäude drehen sich ganz, dunkle Nächte, längere Tage (Branch `feature/turn-buildings`)
- **Drehen (R)** dreht jetzt das ganze Gebäude: Tür nach vorn = Vorderansicht, nach hinten = Rückansicht, zur Seite = Seitenansicht. Längliche Gebäude drehen ihre Grundfläche mit (2 × 1 wird 1 × 2); Drehen prüft, ob dafür Platz ist. Restaurants behalten ihre Größe und wechseln zwischen Türen vorn/hinten und links/rechts
- Seiten- und Rückansichten als einfache Platzhalter-Grafik; der Arbeiter steht bei Seitenansicht neben der Theke
- **Nacht deutlich dunkler und kühl-blau**: Laternen, Gaslampen, Neonschilder und Feuerschalen erhellen einen großen Bereich, Restaurants ihren Raum, Häuser etwas, Stände nur ihre Theke
- **Tage länger**: erster Tag 3 Minuten, danach 2 Minuten (vorher 90 und 45 Sekunden)
- Bei Tagesbeginn springt das Tempo automatisch auf 1× zurück

## 2026-11-10 – Beliebtheit = Gäste, langsameres Geld
- **Beliebtheit ist jetzt genau die Zahl der Gäste pro Nacht** (Start 15, mindestens 8). Ein neuer Bereich hebt nur die Obergrenze (Markt 100, mit Hotel-Viertel 400), die Gästezahl springt dadurch nicht mehr
- Änderung pro Nacht in **Prozent** (mindestens ±1 Gast): Laune bis ±12 %, Wut und Warten, Schmutz bis −8 %, verlorene Gäste bis −40 %, zu wenig Angebot bis −8 %, Neues +2 % je Stand (bis +8 %), Nachtbau −1 % je Aktion; die Gewöhnung entfällt, damit es bei gutem Betrieb stetig wächst
- **Wirtschaft gebremst**: Preise pro Besuch etwa 45 % niedriger, Löhne verdoppelt, Gasthaus 600, Grand Hotel 1800, Sky Hotel 5000, Hotel-Viertel 4000 Münzen; Erfahrung 0,4 XP pro Münze, damit Level gleich schnell kommen
- Test: Nacht 1 etwa 190 Münzen Gewinn (vorher 450), Beliebtheit 15 → 16 → 18

## 2026-11-10 – Bauen auch nachts (teuer)
- Bauen und Abreißen gehen jetzt auch nachts, kosten dann aber das **Dreifache**; jede Aktion in der Nacht kostet 1 Beliebtheit (höchstens 5 pro Nacht, im Bericht „🚧 night work“)
- Preise in der Bauleiste zeigen nachts den dreifachen Preis; eigener Hinweistext beim Bauen in der Nacht
- Drehen und Ausbauen bleiben tagsüber; bei Einbruch der Nacht wird das Bauwerkzeug weiter abgewählt, damit man nicht versehentlich teuer baut

## 2026-11-10 – Fix: Putzkräfte teilen sich auf
- Putzkräfte reservieren die verschmutzte Stelle, zu der sie gehen; andere Putzkräfte suchen sich eine andere. Vorher liefen mehrere zum selben Fleck

## 2026-11-10 – Beliebtheits-Skala (Branch `feature/popularity`)
- Neue **Beliebtheit** (0–100, Start 10) ersetzt den Ruf und bestimmt die Gästezahl: 6 + Beliebtheit × 0,94 (nur Markt, bis 100 Gäste) bzw. × 3,94 (mit Hotel-Viertel, bis 400)
- Jeden Morgen neu berechnet aus: Zufriedenheit, Wartezeit und Wut, Sauberkeit, vom Sonnenaufgang erwischten Gästen, Angebot im Vergleich zur (jede Nacht steigenden) Erwartung, Bonus für neue Stände, kleine Gewöhnung
- Anzeige oben „★ Popularity 14 · 19 guests“; Mauszeiger darauf erklärt die Skala und zeigt die Anteile der letzten Nacht
- Morgenbericht zeigt die Änderung und ihre Anteile (😊 Laune, ⏳ Warten, 🧹 Schmutz, ☀ verloren, 🛍 Angebot, ✨ Neues, 💤 Gewöhnung)
- Schmutz zählt pro Gast jede verschmutzte Stelle nur einmal
- Werte in `src/data/popularity.ts`; alte Spielstände übernehmen den Ruf als Beliebtheit

## 2026-11-10 – Speichern und Laden, Ausbaustufen (Branch `feature/save-and-upgrades`)
- **Speichern**: automatisch jeden Morgen und nach Änderungen am Tag im Browser (localStorage). Die Nacht selbst wird nicht gespeichert; wer nachts neu lädt, macht am Morgen davor weiter
- **Titelmenü** mit „Continue“ (Tag, Level, Münzen des Spielstands) und „New game“ (zweiter Klick bestätigt das Löschen)
- **Ausbaustufen** (Stufe 1–3) über das Infofenster, nur tagsüber:
  - Restaurants: Stufe 2 (ab Level 3, 80 % des Baupreises) +2 Tische, Platz für einen zweiten Kellner, Preise +20 %; Stufe 3 (ab Level 5, 150 %) der Raum wächst um eine Reihe nach unten (muss frei sein), +2 Tische, ein weiterer Koch, Preise +40 %; Sterne auf dem Schild
  - Stände: pro Stufe ein Bedienplatz mehr, höhere Preise
  - Hotels: 1,5- bzw. 2-fache Betten
- Infofenster zeigt Stufe, Ausbau-Kosten und was der Ausbau bringt; Knöpfe in zwei Reihen
- Zeitalter-Code entfernt (Level-Panel, Daten, Texte)

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
