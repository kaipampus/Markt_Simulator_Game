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

## 2026-11-08 – Technik: Phaser 3 + TypeScript + Vite
**Status:** vorgeschlagen (bisher kein Widerspruch)
**Entscheidung:** Browser-Spiel mit Phaser 3, TypeScript und Vite. Kein Backend, Spielstand im Browser, später PWA.
**Warum:** Läuft überall im Browser, lässt sich als statische Dateien auf dem eigenen Server hosten, ist komplett in Code beschreibbar (kein grafischer Editor nötig).
**Verworfen:** Godot (stärker für große Spiele, aber stark editorgebunden).

## Offen
- Ansicht: isometrisch oder direkt von oben
