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
**Status:** entschieden
**Entscheidung:** Tag und Nacht wechseln in festem Takt (Werte in `src/config.ts`). Gebaut werden kann jederzeit.
**Verworfen:** Nacht per Knopf starten, automatisch mit Pause.

## 2026-11-08 – Wege beschleunigen, sind aber keine Pflicht
**Status:** entschieden
**Entscheidung:** Geister laufen überall, auf Wegen und Brücken doppelt so schnell. Die Wegfindung sucht den schnellsten, nicht den kürzesten Weg.
**Warum:** Einsteigerfreundlich, trotzdem sind Wege wegen der Sonnenaufgangs-Regel wichtig. Später auf „nur auf Wegen“ umstellbar.

## 2026-11-08 – Ruf mit Game Over bei 0
**Status:** entschieden
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
