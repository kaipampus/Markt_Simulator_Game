# Entscheidungen

Wichtige Entscheidungen mit Begründung. Neue Einträge **oben**.

Vorlage:
```
## JJJJ-MM-TT – Titel
**Status:** entschieden / vorgeschlagen / verworfen
**Entscheidung:** …
**Warum:** …
**Verworfen:** …
```

---

## 2026-11-10 – Speichern im Browser, nur bei Tag
**Status:** entschieden
**Entscheidung:** Der Spielstand liegt im `localStorage` des Browsers und wird jeden Morgen sowie nach Änderungen am Tag automatisch geschrieben. Gespeichert wird nur der Tageszustand (Gebäude, Personal, Geld, Level, Schmutz, schlafende Hotelgäste), nicht die laufende Nacht. Beim Start bietet ein Titelmenü „Weiterspielen“ oder „Neues Spiel“.
**Warum:** Tagsüber ist niemand unterwegs, der Zustand ist klein und eindeutig. Eine Nacht mitten im Ablauf zu speichern (Positionen, Schlangen, Fähren) wäre aufwendig und fehleranfällig.
**Verworfen:** Speichern jederzeit inklusive Nacht; Speicherdatei zum Herunterladen (später möglich).

## 2026-11-10 – Ausbaustufen für Gebäude
**Status:** entschieden (Wunsch des Nutzers)
**Entscheidung:** Restaurants, Stände und Hotels haben drei Stufen. Restaurants bekommen Tische und Personalplätze dazu und wachsen auf Stufe 3 um eine Reihe (wenn Platz ist). Ausbau nur tagsüber, ab einem Level und gegen Münzen. Ein ausgebautes Gebäude behält seine Bauart, nutzt aber eine verbesserte Definition (`data/upgrades.ts`).
**Warum:** Wachstum ohne immer neue Fläche; Platzmangel bleibt spürbar, weil Vergrößern freien Raum braucht.
**Verworfen:** Frei wählbare Vergrößerung in alle Richtungen (vorerst; die Grafik müsste dafür flexibler sein).

## 2026-11-09 – Feste Türen und Drehen
**Status:** entschieden (Wunsch des Nutzers)
**Entscheidung:** Gebäude mit Gästen oder Personal haben feste Türen: Restaurants zwei gegenüberliegende, alle anderen eine in der Mitte einer Seite. Nur über die Türen kommt man hinein; ein Weg, der irgendwo an der Seite vorbeiführt, reicht nicht. Mit R dreht man beim Bauen (oder tagsüber nachträglich) die Türen um 90°. Bei Restaurants ändert sich die Grafik (Türen vorn/hinten oder links/rechts), bei anderen Gebäuden zeigt eine Türmatte die Tür (echte Grafiken folgen in Phase 5).
**Warum:** Klare Eingänge machen Wege und Platz zur echten Planungsaufgabe.

## 2026-11-09 – Level statt Zeitalter umgesetzt, Gästezahl nach Kapazität
**Status:** entschieden (Wunsch des Nutzers)
**Entscheidung:** Das Zeitalter-Kaufen ist ersetzt durch ein Level mit Erfahrung (0,2 XP pro verdiente Münze, 2 XP pro zufriedenem Gast). Jedes Gebäude hat eine Freischalt-Stufe (Tabelle in `data/levels.ts`). Das Hotel-Viertel öffnet ab Level 6 für 2000 Münzen. Die Gästezahl richtet sich nach der Kapazität (Tische × 2,5, Bedienplätze × 2, Deko 0,5) plus 6 Grundgäste, mal Ruf-Faktor, gedeckelt (Markt 100, mit Hotel-Viertel 400). Damit wächst die Menge der Gäste mit dem, was man sich leisten kann, bleibt aber leicht fordernd.
**Verworfen:** Alle Restaurants von Anfang an; Gästezahl unabhängig von der Kapazität.

## 2026-11-09 – Restaurants mit Koch und Kellner, viele Küchen
**Status:** entschieden (Idee des Nutzers; Detailfragen mit den empfohlenen Varianten beantwortet)
**Entscheidung:** Neue Gebäudeart **Restaurant**: offener Raum mit Küche und Tischen, Gäste sichtbar am Tisch, Koch kocht, Kellner (neuer Job) serviert, Essen dauert ca. 15 s. Koch und Kellner sind Pflicht. Sieben Restaurants verschiedener asiatischer Küchen mit Zauber-Einschlag, dazu acht neue Stände und das neue Bedürfnis **Spaß**. Die Nudelbude bleibt als billiger Imbiss. Gäste haben oft **Gelüste** nach einer Küche. Platzmangel und ein chaotischer Markt sind gewollt.
**Warum:** Mehr Tiefe und Vielfalt, mehr zu verwalten in der Nacht, größere Gebäude für einen größeren Markt.
**Verworfen:** Geschlossene Restaurants mit Zahlenanzeige; Kellner nur als Beschleuniger; Essen nur noch im Restaurant.

## 2026-11-09 – Wenig Startgeld, Wachstum über Beliebtheit
**Status:** entschieden (Wunsch des Nutzers)
**Entscheidung:** Start mit 650 Münzen. Jedes Gebäude hat einen Beliebtheitswert; die Summe bestimmt die Gästezahl (mal Ruf-Faktor, gedeckelt je Bereich). Fehlende Angebote kosten Einnahmen, aber keinen Ruf. Gebäude-Stufen folgen später.
**Warum:** Man soll klein anfangen und spürbar schneller wachsen, statt am Anfang zu viel Geld zu haben.
**Verworfen (vorerst):** Jedes weitere gleiche Gebäude teurer; reichere Gäste bei hohem Ruf.

## 2026-11-09 – Bereiche mit Level statt Zeitalter
**Status:** entschieden (Idee des Nutzers), Umsetzung geplant
**Entscheidung:** Die Karte wird in Bereiche geteilt, die mit **Level + Münzen** freigeschaltet werden (wie in Hay Day): 1. Nachtmarkt (Start, ohne Hotel, bis 100 Gäste), 2. Hotel-Viertel jenseits des Flusses (Hotelgäste kommen in der nächsten Nacht dazu, bis ca. 500), 3. modernes Neon-Viertel rechts daneben (2000–3000 Gäste). Das Level ist **sichtbar mit Balken**. Die **Zeitalter entfallen**: Moderne Gebäude gibt es nur im Neon-Viertel, der alte Markt bleibt traditionell.
**Warum:** Das Alte bleibt erhalten statt ersetzt zu werden; Wachstum fühlt sich räumlich an; klares Ziel für jedes Level.
**Verworfen:** Zeitalter zusätzlich behalten; Bereich = Zeitalter; Level versteckt; Bereiche öffnen automatisch; Bereiche nebeneinander oder Moderne im Norden.
**Ersetzt (später):** „Zeitalter: Ruf schaltet frei, Münzen kaufen“.

## 2026-11-09 – Beliebtheit bestimmt die Gästezahl
**Status:** vorgeschlagen
**Entscheidung:** Stände und Dekoration haben einen Beliebtheitswert. Die Summe bestimmt, wie viele Gäste kommen, begrenzt durch die freigeschalteten Bereiche. Der Ruf (Zufriedenheit) wirkt als Verstärker. Erfahrung für das Level kommt aus zufriedenen Gästen und neuen Gebäuden.
**Warum:** Wunsch des Nutzers: Je mehr Stände und Deko, desto mehr Gäste.

## 2026-11-09 – Volle Nächte: Wellen, Schlangen, Geduld, Charaktere
**Status:** entschieden (Wunsch des Nutzers)
**Entscheidung:** Gäste kommen über die ganze Nacht in Wellen, bleiben länger und haben mehr Wünsche. Stände bedienen nur wenige Gäste gleichzeitig, dahinter bilden sich Schlangen. Jeder Gast hat eine Geduld; wird sie überschritten, wird er wütend (😠), verlässt die Schlange und ist unzufrieden. Geistertypen unterscheiden sich in Geduld und Vorlieben. Dazu: höheres Startgeld, längere Nacht, Knopf „Zum Morgen springen“.
**Warum:** Bisher war die Nacht nach einer halben Minute vorbei und der Rest leer.

## 2026-11-09 – Personal als Reiter in der Bauleiste, Finanzen als eigenes Fenster
**Status:** entschieden (Wunsch des Nutzers)
**Entscheidung:** Arbeiter werden über einen Reiter **Workers** in der Bauleiste eingestellt und ausgewählt, genauso wie Gebäude. Ein Klick auf eine Job-Karte stellt sofort ein (wie ein Gebäude kaufen); Entlassen geht über das Infofenster des Arbeiters. Ein Fenster **Finances** zeigt Lohnkosten, Verkäufe pro Gebäude, Zimmergeld und Gewinn.
**Warum:** Übersichtlicher: alles Kaufbare an einer Stelle, Geldfragen an einer anderen.
**Verworfen:** Schwebendes Personal-Fenster rechts oben (verdeckte die Karte und war vom Rest getrennt).

## 2026-11-09 – Tagsüber bauen, nachts verwalten
**Status:** entschieden (Wunsch des Nutzers)
**Entscheidung:** Bauen und Abreißen gehen nur am Tag. Nachts ist die Bauleiste gesperrt; man kümmert sich um Personal und Sauberkeit (Arbeiter umsetzen, Putzkräfte schicken, einstellen, entlassen).
**Warum:** Beide Tageshälften haben eine eigene Aufgabe, so hat man immer etwas zu tun.
**Verworfen:** Bauen nachts nur teurer; nachts nur kleine Bauten erlaubt.

## 2026-11-09 – Personal: Stände und Hotels brauchen Arbeiter
**Status:** entschieden (Wunsch des Nutzers)
**Entscheidung:** Jobs Koch, Verkäufer, Gastgeber und Putzkraft. Nudelbude, Teehaus und Café brauchen einen Koch, Glücksbringer-Stand und Spielhalle einen Verkäufer, Hotels einen Gastgeber. Ein Gebäude ist nur geöffnet, solange sein Arbeiter davor steht; Gäste warten kurz (⏳) und geben dann auf. Toilette, Feuerschale, Schrein, Getränkeautomat und Mülleimer brauchen niemanden. Je Gebäude ein Arbeiter. Neue Arbeiter und neue Gebäude werden automatisch zugeteilt, umsetzen geht per Klick. Einstellungsgebühr plus Lohn jeden Morgen (Geld darf ins Minus).
**Warum:** Arbeiter sind die Aufgabe für die Nacht und machen jeden neuen Stand zu einer kleinen Entscheidung.
**Verworfen:** Personal nur als Bonus (Stände laufen auch ohne).

## 2026-11-09 – Personalhaus auf der Marktseite, Sonnenregel auch für Arbeiter
**Status:** entschieden (Wunsch des Nutzers)
**Entscheidung:** Arbeiter wohnen im Personalhaus (Staff Lodge 6 Betten, Staff Dormitory 14 Betten ab Dampfzeit), das nur auf den Markt darf. Die Bettenzahl begrenzt, wie viele man einstellen kann. Bei Morgengrauen gehen Arbeiter ins nächste Personalhaus; wer bei Sonnenaufgang draußen ist, vergeht und fehlt dann. Gastgeber bleiben im Hotel und schlafen dort. Eine Lodge steht zu Beginn neben dem Startweg.
**Warum:** Kurze Wege zu den Ständen; gleiche Regel wie für Gäste, damit Infrastruktur auch für das Personal zählt.
**Verworfen:** Personalhaus im Hotel-Viertel; Arbeiter ohne Sonnenregel.

## 2026-11-09 – Sauberkeit: Müll, Schleim, Mülleimer, Putzkräfte
**Status:** entschieden (Idee des Nutzers)
**Entscheidung:** Gäste lassen nach Essen oder Trinken manchmal Müll fallen, außer ein Mülleimer steht in der Nähe (3 Felder). Der neue Schleimgeist (Ooze) hinterlässt Schleimspuren, gegen die nur Putzkräfte helfen. Jedes schmutzige Feld, über das ein Gast läuft, senkt seine Zufriedenheit (bis höchstens −30 %). Putzkräfte suchen selbst den nächsten Schmutz; schickt man sie per Klick an eine Stelle, putzen sie dort zuerst. Schmutz bleibt über den Tag liegen.
**Warum:** Gibt Putzkräften und Mülleimern einen klaren Zweck und der Nacht etwas zu tun.
**Verworfen:** Putzen nur per Klick (zu viel Klickarbeit); feste Putzbereiche.

## 2026-11-09 – Gemeinsame Laufklasse für Geister und Arbeiter
**Status:** entschieden
**Entscheidung:** Laufen auf Wegen, Anstehen an Brücken und Fährfahren stecken in einer Basisklasse `Walker` (`src/entities/Walker.ts`), von der `Spirit` und `Worker` erben.
**Warum:** Arbeiter müssen dieselben Regeln einhalten wie Gäste; doppelter Code würde schnell auseinanderlaufen.

## 2026-11-08 – Entspannt statt stressig: kein Game Over, Zeitsteuerung
**Status:** entschieden (Wunsch des Nutzers)
**Entscheidung:** Kein Game Over mehr. Vom Sonnenaufgang erwischte Geister vergehen weiterhin, das kostet aber nur Ruf (weniger Gäste). Die Zeit läuft automatisch, der Spieler hat Pause, Tempo 1×/2×/4× und „Nacht jetzt starten“.
**Warum:** Es soll ein entspanntes Indie-Spiel sein, ohne Zeitdruck.
**Ersetzt:** „Ruf mit Game Over bei 0“ und „Zeit läuft automatisch“ (ohne Steuerung).

## 2026-11-08 – Geister laufen nur auf Wegen
**Status:** entschieden (Wunsch des Nutzers)
**Entscheidung:** Geister bewegen sich nur auf Wegen, Brücken und Fähren. Wege sind nicht schneller. Zum Start liegt ein kurzer Weg vom Tor zur ersten Brücke.
**Ersetzt:** „Wege beschleunigen, sind aber keine Pflicht“.

## 2026-11-08 – Brücken mit Kapazität, Fähren als Massentransport
**Status:** entschieden
**Entscheidung:** Brücken lassen nur eine begrenzte Zahl Geister gleichzeitig darauf (Holz 3, Stein 6, Stahl 10), der Rest wartet. Fähren pendeln und nehmen viele Geister auf einmal mit (12 bzw. 20). Die Wegfindung rechnet Wartende als Zusatzkosten ein. Der Fluss ist 3 Felder breit.
**Verworfen:** Begrenzung pro Nacht statt gleichzeitig.

## 2026-11-08 – Zeitalter: Ruf schaltet frei, Münzen kaufen
**Status:** wird ersetzt durch „Bereiche mit Level statt Zeitalter“ (2026-11-09)
**Entscheidung:** Drei Zeitalter: Laternenzeit → Dampfzeit (Ruf 60, 1200 Münzen) → Neon-Zeit (Ruf 75, 3000 Münzen). Jedes bringt neue, teurere Gebäude, vor allem größere Hotels und bessere Übergänge. Wege ändern mit dem Zeitalter ihr Aussehen.
**Warum:** Langfristiges Ziel und das Gefühl, dass sich die Welt von altmodisch zu modern entwickelt.
**Verworfen:** Fortschritt nur nach Anzahl der Nächte, Fortschritt bis in die Gegenwart.

## 2026-11-08 – Baumenü mit Kategorien
**Status:** entschieden
**Entscheidung:** Die Bauleiste hat Reiter (Transport, Market, Services, Hotels, Decor). Gebäude späterer Zeitalter sind gesperrt sichtbar.
**Warum:** Mit den Zeitaltern gibt es zu viele Gebäude für eine Reihe.

## 2026-11-08 – Kernregel: vor Sonnenaufgang in Sicherheit
**Status:** entschieden (Idee des Nutzers)
**Entscheidung:** Geister müssen vor Sonnenaufgang ein Hotel mit freiem Bett oder das Tor erreichen, sonst vergehen sie. Die Infrastruktur (Wege, Brücken, später Transport) dient vor allem diesem Ziel.
**Warum:** Gibt dem Aufbau ein klares Ziel und echten Zeitdruck. Unterscheidet das Spiel deutlich von der Vorlage.

## 2026-11-08 – Hotel statt Badehaus
**Status:** entschieden (Idee des Nutzers)
**Entscheidung:** Das Badehaus entfällt. Zentrales Großgebäude ist ein Hotel, in dem Geister den Tag verschlafen und morgens Zimmergeld zahlen. Wärme kommt von Feuerschalen (Brazier).
**Warum:** Eigenständiger als ein Badehaus und direkt mit der Sonnenaufgangs-Regel verknüpft.

## 2026-11-08 – Karte mit Hotel-Viertel, Fluss und Markt
**Status:** entschieden
**Entscheidung:** Feste Bereiche: oben Hotel-Viertel, in der Mitte ein Fluss, unten der Marktplatz mit Tor. Hotels nur im Hotel-Viertel, Stände nur auf dem Markt, Brücken nur auf dem Fluss. Zu Beginn steht eine Brücke.
**Verworfen:** Zonen ohne Fluss, völlig freies Bauen.

## 2026-11-08 – Zeit läuft automatisch
**Status:** ersetzt (siehe „Entspannt statt stressig“)
**Entscheidung:** Tag und Nacht wechseln in festem Takt (Werte in `src/config.ts`). Gebaut werden kann jederzeit.
**Verworfen:** Nacht per Knopf starten, automatisch mit Pause.

## 2026-11-08 – Wege beschleunigen, sind aber keine Pflicht
**Status:** ersetzt (siehe „Geister laufen nur auf Wegen“)
**Entscheidung:** Geister laufen überall, auf Wegen und Brücken doppelt so schnell. Die Wegfindung sucht den schnellsten, nicht den kürzesten Weg.
**Warum:** Einsteigerfreundlich, trotzdem sind Wege wegen der Sonnenaufgangs-Regel wichtig. Später auf „nur auf Wegen“ umstellbar.

## 2026-11-08 – Ruf mit Game Over bei 0
**Status:** ersetzt (siehe „Entspannt statt stressig“)
**Entscheidung:** Ruf 0–100 (Start 50). Zufriedene sichere Geister +1, unzufriedene −1, vom Sonnenaufgang erwischte −5. Der Ruf bestimmt die Gästezahl. Bei 0 ist das Spiel verloren.

## 2026-11-08 – Ansicht: schräg von oben (3/4)
**Status:** entschieden
**Entscheidung:** Quadratisches Raster, Gebäude werden leicht von vorn gezeigt und ragen nach oben über ihr Feld hinaus. Was weiter unten steht, wird davor gezeichnet (Tiefe nach y-Position).
**Warum:** Wirkt räumlicher als reine Draufsicht, ist aber einfacher zu bauen und zu zeichnen als isometrisch.
**Verworfen:** Isometrisch (aufwendigere Grafik und Klick-Erkennung), direkt von oben (zu flach für die Stimmung).

## 2026-11-08 – Plattform: nur PC/Mac
**Status:** entschieden
**Entscheidung:** Steuerung mit Maus und Tastatur, ausgelegt für Desktop-Bildschirme. Keine Touch- oder Handy-Bedienung.
**Warum:** Einfachste Bedienung für ein Aufbauspiel, weniger Aufwand bei der Oberfläche.

## 2026-11-08 – Spielsprache: Englisch
**Status:** entschieden
**Entscheidung:** Alle Texte im Spiel sind Englisch und stehen gesammelt in `src/data/strings.ts`. Doku und Absprachen bleiben Deutsch.
**Warum:** Erreicht mehr Spieler. Durch die zentrale Textdatei wäre eine Übersetzung später trotzdem möglich.

## 2026-11-08 – Doku im Repo als Obsidian-Vault
**Status:** entschieden
**Entscheidung:** Der Repo-Ordner ist zugleich Obsidian-Vault. Notizen liegen in `docs/`, Projektregeln für Claude in `CLAUDE.md`.
**Warum:** Doku und Code bleiben zusammen und sind gemeinsam versioniert.
**Hinweis:** Wechselnde Obsidian-Dateien (`workspace.json`, Cache) stehen in `.gitignore`.

## 2026-11-08 – Kein Skill zum Start
**Status:** entschieden
**Entscheidung:** Für den Anfang reicht `CLAUDE.md`. Ein Claude-Skill wird erst gebaut, wenn sich ein Ablauf mehrfach wiederholt (z. B. „neues Gebäude anlegen“, „Deploy“).
**Warum:** Ohne erprobten Ablauf wäre ein Skill nur geraten.

## 2026-11-08 – Git-Ablauf: lokal entwickeln, Nutzer pusht
**Status:** entschieden
**Entscheidung:** Entwickelt wird auf dem Mac. Claude committet lokal nach Zustimmung, der Nutzer pusht in VS Code (HTTPS, VS-Code-GitHub-Anmeldung).
**Warum:** Volle Kontrolle darüber, was auf GitHub landet. Kein SSH-Schlüssel für GitHub nötig.
**Verworfen:** Direkt auf dem Server arbeiten (unsicher, kein Testen vor Veröffentlichung).
**Später:** Für den Server-Deploy wird ein eigener SSH-Schlüssel für GitHub Actions angelegt.

## 2026-11-08 – Eigene Welt statt Ghibli-Inhalte
**Status:** entschieden
**Entscheidung:** Die Stimmung ist an Chihiro angelehnt, alle Figuren, Namen, Orte, Grafiken und Musik sind eigene Inhalte.
**Warum:** Urheberrecht. Außerdem wird es so ein eigenständiges Spiel.

## 2026-11-08 – Technik: Phaser 4 + TypeScript + Vite
**Status:** entschieden
**Entscheidung:** Browser-Spiel mit Phaser 4 (4.2.1), TypeScript 7 und Vite 8. Kein Backend, Spielstand im Browser, später PWA.
**Warum:** Läuft im Browser, lässt sich als statische Dateien auf dem eigenen Server hosten und ist komplett in Code beschreibbar. Claude kann das Spiel selbst im Browser starten, testen und Fehler finden. Phaser 4 statt 3, weil es die aktuelle stabile Version ist und das Projekt neu beginnt.
**Verworfen:** Godot. Nach einem Vergleich kurz gewählt, dann verworfen: Es hätte starke Licht- und Effektwerkzeuge und echte Mac-Programme gebracht, aber Claude kann das laufende Spiel und den Editor kaum bedienen, sodass der Nutzer deutlich mehr selbst testen müsste.
