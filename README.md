# Spirit Night Market

A cozy management game: run a lantern-lit night market in a world of spirits. Place stalls, tea houses and a bathhouse, keep the market running and watch spirit guests wander between your buildings.

Built with [Phaser 4](https://phaser.io), TypeScript and Vite. Runs in the browser, no server logic needed.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Controls

| Action | Input |
|---|---|
| Pick a building | Click in the bottom bar or press `1`–`6` |
| Build | Left-click on the market |
| Demolish (50 % refund) | `X`, then click a building |
| Cancel | Right-click or `Esc` |
| Move the view | Drag with the mouse, or `WASD` / arrow keys |
| Zoom | Mouse wheel |

## Build

```bash
npm run build
```

Produces static files in `dist/` that any web server (e.g. nginx) can serve.

## Project notes

Design notes, roadmap and decisions (in German) live in [`docs/`](docs/) and double as an Obsidian vault.
