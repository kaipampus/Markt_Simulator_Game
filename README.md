# Spirit Night Market

A management game set in a world of spirits: run a hotel district and a lantern-lit night market. Each night spirit guests arrive, look for food, tea, warmth and luck, and pay for it. Before the sun rises every spirit should reach a hotel bed or the gate, or it fades away in the light. Spirits only walk on paths, bridges hold only a few at once, and as your reputation grows you can buy your way from the Lantern Age through the Steam Age into the Neon Age, with ferries, grand hotels and neon signs. A relaxed builder: no game over, and you control the time.

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
| Pick a building | Click in the bottom bar or press `1`–`9`; `Tab` switches the category |
| Build | Left-click on the map |
| Lay paths | Hold the left mouse button and drag |
| Demolish (50 % refund) | `X`, then click a building |
| Cancel | Right-click or `Esc` |
| Move the view | Drag with the mouse, or `WASD` / arrow keys |
| Zoom | Mouse wheel |
| Pause / resume | `Space` |
| Game speed 1× / 2× / 4× | `F` |
| Start the night / skip to morning (when all guests are gone) | `N` |
| Workers (hire, see who works where) | **Workers** tab in the bottom bar, or `P` |
| Finances (wages, sales, profit) | **Finances** button at the top, or `I` |
| Select a stall, hotel or worker | Left-click (no tool selected) |
| Move a worker / send a cleaner | Select the worker, then click a building or a path |

Build by day; at night you manage the market and your staff. Building at night is possible but costs three times as much and the noise lowers popularity.

## Build

```bash
npm run build
```

Produces static files in `dist/` that any web server (e.g. nginx) can serve.

## Project notes

Design notes, roadmap and decisions (in German) live in [`docs/`](docs/) and double as an Obsidian vault.
