# Spirit Night Market

A management game set in a world of spirits: run a hotel district and a lantern-lit night market. Each night spirit guests arrive, look for food, tea, warmth and luck, and pay for it. Before the sun rises every spirit must reach a hotel bed or the gate, or it fades away in the light. Build paths, bridges and stalls so that everyone gets home in time.

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
| Pick a building | Click in the bottom bar or press `1`–`9`, `0` |
| Build | Left-click on the map |
| Lay paths | Hold the left mouse button and drag |
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
