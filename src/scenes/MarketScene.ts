import * as Phaser from 'phaser';
import {
  ARRIVAL_WINDOW,
  BAR_HEIGHT,
  COLORS,
  DAWN_WARNING_MS,
  DEPTH,
  FONT_TITLE,
  FONT_UI,
  HUD_HEIGHT,
  NIGHT_MS,
  PAN_SPEED,
  RIVER_ROWS,
  RIVER_TOP,
  SPIRIT_HARD_CAP,
  TILE,
  WORLD_H,
  WORLD_PADDING,
  WORLD_W,
  ZOOM_MAX,
  ZOOM_MIN,
} from '../config';
import { GATE, getBuilding, type BuildingDef } from '../data/buildings';
import { STR } from '../data/strings';
import { Ferry } from '../entities/Ferry';
import { Spirit, type SpiritWorld } from '../entities/Spirit';
import { createTextures, TEX } from '../gfx/textures';
import { state, type PlacedBuilding } from '../state/GameState';
import type { UIScene } from './UIScene';
import type { Cell } from '../state/pathfinding';

interface BuildingView {
  image: Phaser.GameObjects.Image;
  glow?: Phaser.GameObjects.Image;
}

interface DragState {
  x: number;
  y: number;
  button: number;
  scrollX: number;
  scrollY: number;
  panning: boolean;
  /** Painting paths: the last cell painted, to avoid repeats and fill gaps. */
  painting: boolean;
  lastPaint?: Cell;
}

/** Lighting per phase. */
const LIGHT = {
  day: { night: 0, sun: 0.07, glow: 0.2 },
  night: { night: 0.4, sun: 0, glow: 1 },
  dawn: { night: 0.2, sun: 0.05, glow: 0.7 },
} as const;

/** The world: ground, buildings, spirits, lighting, camera and placing buildings. */
export class MarketScene extends Phaser.Scene {
  private views = new Map<number, BuildingView>();
  private spirits: Spirit[] = [];
  private ferries = new Map<number, Ferry>();
  private world!: SpiritWorld;
  private glowLayer!: Phaser.GameObjects.Layer;
  private nightOverlay!: Phaser.GameObjects.Rectangle;
  private sunOverlay!: Phaser.GameObjects.Rectangle;
  private ghost!: Phaser.GameObjects.Image;
  private footprint!: Phaser.GameObjects.Graphics;
  private hoveredUid: number | null = null;
  private drag: DragState | null = null;
  private arrivals?: Phaser.Time.TimerEvent;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  private unsubscribe: Array<() => void> = [];

  constructor() {
    super('MarketScene');
  }

  create(): void {
    createTextures(this);

    this.add.image(0, 0, TEX.ground).setOrigin(0).setDepth(DEPTH.ground);
    this.addZoneLabels();

    this.glowLayer = this.add.layer().setDepth(DEPTH.glow);
    this.world = { glowLayer: this.glowLayer, ferry: (uid) => this.ferries.get(uid) };
    const pad = WORLD_PADDING;
    this.nightOverlay = this.add
      .rectangle(-pad, -pad, WORLD_W + pad * 2, WORLD_H + pad * 2, COLORS.night)
      .setOrigin(0)
      .setDepth(DEPTH.nightOverlay);
    this.sunOverlay = this.add
      .rectangle(-pad, -pad, WORLD_W + pad * 2, WORLD_H + pad * 2, 0xffe2a8)
      .setOrigin(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.nightOverlay + 0.5);
    this.setLight(state.phase === 'night' ? 'night' : 'day', 0);

    this.addGate();
    for (const b of state.buildings.values()) this.addBuildingView(b, false);

    this.setupCamera();
    this.footprint = this.add.graphics().setDepth(DEPTH.preview);
    this.ghost = this.add.image(0, 0, TEX.building('lantern')).setOrigin(0, 1).setAlpha(0.7).setVisible(false).setDepth(DEPTH.preview + 1);
    this.setupInput();

    this.unsubscribe.push(
      state.on('placed', (b) => this.addBuildingView(b, true)),
      state.on('removed', (b) => this.removeBuildingView(b)),
      state.on('tool', () => this.refreshGhost()),
      state.on('phase', (p) => (p === 'night' ? this.onNightFalls() : this.setLight('day', 4000))),
      state.on('dawn', () => this.setLight('dawn', DAWN_WARNING_MS)),
      state.on('sunrise', () => this.onSunrise()),
      state.on('speed', (speed) => (this.time.timeScale = speed)),
      state.on('era', (era) => {
        for (const [uid, view] of this.views) {
          if (state.buildings.get(uid)?.def.id === 'path') view.image.setTexture(TEX.path(era));
        }
      }),
      state.on('earned', (amount, cell) =>
        this.floatText(cell.tx * TILE + TILE / 2, cell.ty * TILE - 6, STR.earn(amount), COLORS.uiGold, 12),
      ),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe.forEach((u) => u()));

    this.scene.launch('UIScene');
  }

  update(time: number, delta: number): void {
    // Camera and building work in real time; the world runs at the game speed.
    this.panWithKeys(delta);
    this.updateHover();
    state.tick(delta);
    const worldDelta = delta * state.speed;

    for (const f of this.ferries.values()) f.update(worldDelta);
    for (const s of this.spirits) s.update(time, worldDelta);
    this.spirits = this.spirits.filter((s) => !s.isDone);
    state.setSpiritCount(this.spirits.length);
  }

  // ---------------------------------------------------------------------------
  // day and night
  // ---------------------------------------------------------------------------

  private setLight(kind: keyof typeof LIGHT, duration: number): void {
    const l = LIGHT[kind];
    const targets: Array<[{ setAlpha(alpha: number): unknown }, number]> = [
      [this.nightOverlay, l.night],
      [this.sunOverlay, l.sun],
      [this.glowLayer, l.glow],
    ];
    for (const [obj, alpha] of targets) {
      this.tweens.killTweensOf(obj);
      if (duration <= 0) obj.setAlpha(alpha);
      else this.tweens.add({ targets: obj, alpha, duration, ease: 'Sine.InOut' });
    }
  }

  private onNightFalls(): void {
    this.setLight('night', 4000);

    // Last night's hotel guests wake up first.
    let woken = 0;
    for (const { hotel, count } of state.takeSleepers()) {
      for (let i = 0; i < count; i++) {
        const cells = state.entranceCells(hotel);
        const start = cells.length ? Phaser.Utils.Array.GetRandom(cells) : Phaser.Utils.Array.GetRandom([...state.gateCells]);
        this.spawnSpirit(start, 500 + woken * 450);
        woken++;
      }
    }

    // Then new guests arrive at the gate during the first part of the night.
    const arrivals = Math.max(0, state.guestsTonight() - woken);
    this.arrivals?.remove();
    if (arrivals > 0) {
      const interval = (NIGHT_MS * ARRIVAL_WINDOW) / arrivals;
      this.arrivals = this.time.addEvent({
        delay: interval,
        repeat: arrivals - 1,
        startAt: interval - 800,
        callback: () => {
          if (!state.isDawn) this.spawnSpirit(Phaser.Utils.Array.GetRandom([...state.gateCells]), 300);
        },
      });
    }
  }

  private onSunrise(): void {
    this.arrivals?.remove();
    this.arrivals = undefined;
    for (const s of this.spirits) {
      if (s.isDone) continue;
      const p = s.position;
      s.burn();
      state.recordLost();
      this.floatText(p.x, p.y - 40, STR.lostSpirit, COLORS.uiRed, 12);
    }
  }

  private spawnSpirit(start: Cell, delayMs: number): void {
    if (this.spirits.length >= SPIRIT_HARD_CAP) return;
    this.spirits.push(new Spirit(this, state, this.world, start, undefined, delayMs));
  }

  // ---------------------------------------------------------------------------
  // world objects
  // ---------------------------------------------------------------------------

  private addZoneLabels(): void {
    const style = { fontFamily: FONT_TITLE, fontSize: '22px', color: '#f3e9d2' };
    this.add.text(20, 14, STR.zoneLabels.hotel, style).setAlpha(0.35).setDepth(DEPTH.ground + 1);
    this.add
      .text(20, (RIVER_TOP + RIVER_ROWS) * TILE + 14, STR.zoneLabels.market, style)
      .setAlpha(0.35)
      .setDepth(DEPTH.ground + 1);
  }

  private addGate(): void {
    const { tx, ty } = state.gate;
    const bottom = (ty + GATE.h) * TILE;
    this.add.image(tx * TILE, bottom, TEX.gate).setOrigin(0, 1).setDepth(bottom);
    const height = GATE.h * TILE + GATE.rise;
    for (const fx of [0.11, 0.89]) this.addGlow(tx * TILE + GATE.w * TILE * fx, bottom - height * 0.8 + 36, 70);
  }

  private addGlow(x: number, y: number, radius: number): Phaser.GameObjects.Image {
    const glow = this.add
      .image(x, y, TEX.glow)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale((radius * 2) / 256)
      .setAlpha(0.85);
    this.glowLayer.add(glow);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.7, to: 0.95 },
      duration: Phaser.Math.Between(900, 1600),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
    return glow;
  }

  private addBuildingView(b: PlacedBuilding, animate: boolean): void {
    const { def } = b;
    const bottom = (b.ty + def.h) * TILE;
    // Paths and bridges lie flat on the ground, below everything that stands.
    const depth = def.walkable ? DEPTH.flat + b.ty : bottom;
    const texture = def.id === 'path' ? TEX.path(state.era) : TEX.building(def.id);
    const image = this.add.image(b.tx * TILE, bottom, texture).setOrigin(0, 1).setDepth(depth);
    if (def.crossing?.kind === 'boat') this.ferries.set(b.uid, new Ferry(this, b));

    let glow: Phaser.GameObjects.Image | undefined;
    if (def.glow) {
      const texH = def.h * TILE + def.rise;
      glow = this.addGlow(b.tx * TILE + def.w * TILE * def.glow.x, bottom - texH + texH * def.glow.y, def.glow.radius);
      if (def.glow.color !== undefined) glow.setTint(def.glow.color);
    }

    if (animate && !def.walkable) {
      image.setScale(1.08, 0.8);
      this.tweens.add({ targets: image, scaleX: 1, scaleY: 1, duration: 260, ease: 'Back.Out' });
      this.puff(b.tx * TILE + (def.w * TILE) / 2, bottom - 6, def.w * 6);
    }

    this.views.set(b.uid, { image, glow });
    for (const s of this.spirits) s.onGridChanged();
  }

  private removeBuildingView(b: PlacedBuilding): void {
    const view = this.views.get(b.uid);
    if (!view) return;
    this.views.delete(b.uid);
    this.ferries.get(b.uid)?.destroy();
    this.ferries.delete(b.uid);
    if (this.hoveredUid === b.uid) this.hoveredUid = null;
    view.glow?.destroy();
    this.tweens.add({
      targets: view.image,
      alpha: 0,
      scaleY: 0.6,
      duration: 200,
      onComplete: () => view.image.destroy(),
    });
    this.puff(b.tx * TILE + (b.def.w * TILE) / 2, (b.ty + b.def.h) * TILE - 6, b.def.w * 8);
    for (const s of this.spirits) s.onGridChanged();
  }

  /** Little dust cloud when building or demolishing. */
  private puff(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      const p = this.add
        .image(x + Phaser.Math.Between(-20, 20), y, TEX.dust)
        .setDepth(y + 1)
        .setScale(Phaser.Math.FloatBetween(0.8, 1.6));
      this.tweens.add({
        targets: p,
        x: p.x + Phaser.Math.Between(-28, 28),
        y: y - Phaser.Math.Between(4, 22),
        alpha: 0,
        scale: p.scale * 1.8,
        duration: Phaser.Math.Between(400, 700),
        onComplete: () => p.destroy(),
      });
    }
  }

  /** Short text that floats up and fades, in world space. */
  private floatText(x: number, y: number, text: string, color: string, size = 15): void {
    const t = this.add
      .text(x, y, text, {
        fontFamily: FONT_UI,
        fontSize: `${size}px`,
        fontStyle: 'bold',
        color,
        stroke: '#0b0f1a',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.floatText);
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 1100, ease: 'Cubic.Out', onComplete: () => t.destroy() });
  }

  // ---------------------------------------------------------------------------
  // camera and input
  // ---------------------------------------------------------------------------

  private setupCamera(): void {
    const cam = this.cameras.main;
    cam.setBackgroundColor(COLORS.background);
    cam.setBounds(-WORLD_PADDING, -WORLD_PADDING, WORLD_W + WORLD_PADDING * 2, WORLD_H + WORLD_PADDING * 2);
    // Start zoomed out a little, looking at the river and the market with the gate.
    cam.setZoom(0.8);
    cam.centerOn(WORLD_W / 2, WORLD_H * 0.7);
    // Keep the same spot in the middle of the screen when the window size changes.
    const onResize = (_g: unknown, _b: unknown, _d: unknown, prevW: number, prevH: number) => {
      cam.centerOn(cam.scrollX + prevW / 2, cam.scrollY + prevH / 2);
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, onResize));
  }

  private setupInput(): void {
    this.input.mouse?.disableContextMenu();
    const kb = this.input.keyboard!;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      up: kb.addKey(K.UP),
      down: kb.addKey(K.DOWN),
      left: kb.addKey(K.LEFT),
      right: kb.addKey(K.RIGHT),
      w: kb.addKey(K.W),
      a: kb.addKey(K.A),
      s: kb.addKey(K.S),
      d: kb.addKey(K.D),
    };

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (this.isOverUI(p)) return;
      const cam = this.cameras.main;
      const tool = state.tool;
      const painting = p.button === 0 && tool?.kind === 'build' && !!getBuilding(tool.id).dragPlace;
      this.drag = { x: p.x, y: p.y, button: p.button, scrollX: cam.scrollX, scrollY: cam.scrollY, panning: false, painting };
      if (painting) this.paintAt(p);
    });

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      if (!d || !p.isDown) return;
      if (d.painting) {
        this.paintAt(p);
        return;
      }
      const dx = p.x - d.x;
      const dy = p.y - d.y;
      const canPan = d.button !== 0 || state.tool === null;
      if (!d.panning && canPan && Math.hypot(dx, dy) > 5) d.panning = true;
      if (d.panning) {
        const cam = this.cameras.main;
        cam.setScroll(d.scrollX - dx / cam.zoom, d.scrollY - dy / cam.zoom);
      }
    });

    const onUp = (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      this.drag = null;
      if (!d || d.panning || d.painting) return;
      if (d.button === 2) state.setTool(null);
      else if (d.button === 0) this.handleClick(p);
    };
    this.input.on(Phaser.Input.Events.POINTER_UP, onUp);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, () => (this.drag = null));

    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (p: Phaser.Input.Pointer, _objs: unknown, _dx: number, dy: number) => {
      if (this.isOverUI(p)) return;
      this.zoomAt(p.x, p.y, dy > 0 ? 0.9 : 1 / 0.9);
    });
  }

  private isOverUI(p: Phaser.Input.Pointer): boolean {
    const ui = this.scene.get('UIScene') as UIScene | null;
    if (ui?.sys.isActive()) return ui.isOverUI(p.x, p.y);
    return p.y < HUD_HEIGHT || p.y > this.scale.height - BAR_HEIGHT;
  }

  /** Screen pixel → world pixel for the main camera (independent of render timing). */
  private screenToWorld(sx: number, sy: number, zoom = this.cameras.main.zoom): { x: number; y: number } {
    const cam = this.cameras.main;
    const ox = cam.width * cam.originX;
    const oy = cam.height * cam.originY;
    return {
      x: (sx - cam.x - ox) / zoom + ox + cam.scrollX,
      y: (sy - cam.y - oy) / zoom + oy + cam.scrollY,
    };
  }

  /** Zoom while keeping the point under the cursor in place. */
  private zoomAt(sx: number, sy: number, factor: number): void {
    const cam = this.cameras.main;
    // Never zoom out further than the map (plus padding) can fill the screen.
    const fill = Math.max(cam.width / (WORLD_W + WORLD_PADDING * 2), cam.height / (WORLD_H + WORLD_PADDING * 2));
    const minZoom = Math.max(ZOOM_MIN, Math.min(1, fill));
    const newZoom = Phaser.Math.Clamp(cam.zoom * factor, minZoom, ZOOM_MAX);
    if (newZoom === cam.zoom) return;
    const before = this.screenToWorld(sx, sy);
    const ox = cam.width * cam.originX;
    const oy = cam.height * cam.originY;
    cam.setZoom(newZoom);
    cam.setScroll(before.x - (sx - cam.x - ox) / newZoom - ox, before.y - (sy - cam.y - oy) / newZoom - oy);
  }

  private panWithKeys(delta: number): void {
    const k = this.keys;
    const dx = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
    const dy = (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0);
    if (!dx && !dy) return;
    const cam = this.cameras.main;
    const step = (PAN_SPEED * delta) / 1000 / cam.zoom;
    cam.setScroll(cam.scrollX + dx * step, cam.scrollY + dy * step);
  }

  /** Top-left cell for placing `def` centred under the pointer. */
  private placementCell(def: BuildingDef, wx: number, wy: number): { tx: number; ty: number } {
    return {
      tx: Math.floor(wx / TILE - def.w / 2 + 0.5),
      ty: Math.floor(wy / TILE - def.h / 2 + 0.5),
    };
  }

  /**
   * Paint path cells under the pointer while dragging. Fills every cell
   * between the previous and the current pointer position, so fast mouse
   * moves leave no gaps. Occupied cells are skipped silently.
   */
  private paintAt(p: Phaser.Input.Pointer): void {
    const tool = state.tool;
    const d = this.drag;
    if (tool?.kind !== 'build' || !d || this.isOverUI(p)) return;
    const def = getBuilding(tool.id);
    const w = this.screenToWorld(p.x, p.y);
    const to = this.placementCell(def, w.x, w.y);
    const from = d.lastPaint ?? to;
    if (d.lastPaint && from.tx === to.tx && from.ty === to.ty) return;
    d.lastPaint = to;

    // Walk the grid line from `from` to `to` (Bresenham).
    let { tx, ty } = from;
    const sx = Math.sign(to.tx - tx);
    const sy = Math.sign(to.ty - ty);
    const dx = Math.abs(to.tx - tx);
    const dy = -Math.abs(to.ty - ty);
    let err = dx + dy;
    for (;;) {
      const result = state.place(tool.id, tx, ty);
      if (result === 'money') {
        this.floatText(w.x, w.y, STR.notEnoughCoins, COLORS.uiRed);
        return;
      }
      if (tx === to.tx && ty === to.ty) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        tx += sx;
      }
      if (e2 <= dx) {
        err += dx;
        ty += sy;
      }
    }
  }

  private handleClick(p: Phaser.Input.Pointer): void {
    const tool = state.tool;
    if (!tool) return;
    const w = this.screenToWorld(p.x, p.y);

    if (tool.kind === 'build') {
      const def = getBuilding(tool.id);
      const { tx, ty } = this.placementCell(def, w.x, w.y);
      const result = state.place(tool.id, tx, ty);
      const cx = (tx + def.w / 2) * TILE;
      const top = ty * TILE - def.rise;
      if (result === 'ok') this.floatText(cx, top, STR.cost(def.cost), COLORS.uiGold);
      else if (result === 'money') this.floatText(w.x, w.y, STR.notEnoughCoins, COLORS.uiRed);
      else if (result === 'zone') this.floatText(w.x, w.y, STR.zoneOnly[def.zone], COLORS.uiRed);
      else if (result === 'adjacent') this.floatText(w.x, w.y, STR.tooClose, COLORS.uiRed);
      else this.floatText(w.x, w.y, STR.cantBuildHere, COLORS.uiRed);
      return;
    }

    const b = state.buildingAt(Math.floor(w.x / TILE), Math.floor(w.y / TILE));
    if (b) {
      const refund = state.demolish(b.uid);
      this.floatText((b.tx + b.def.w / 2) * TILE, b.ty * TILE - b.def.rise, STR.refund(refund), COLORS.uiGold);
    }
  }

  private refreshGhost(): void {
    const tool = state.tool;
    if (tool?.kind === 'build') this.ghost.setTexture(tool.id === 'path' ? TEX.path(state.era) : TEX.building(tool.id));
    this.ghost.setVisible(false);
    this.footprint.clear();
  }

  /** Ghost preview while building, red highlight while demolishing. */
  private updateHover(): void {
    const p = this.input.activePointer;
    const tool = state.tool;
    this.footprint.clear();

    const hovered = this.hoveredUid !== null ? this.views.get(this.hoveredUid) : undefined;
    hovered?.image.clearTint();
    this.hoveredUid = null;

    if (!tool || this.isOverUI(p) || this.drag?.panning) {
      this.ghost.setVisible(false);
      return;
    }
    const w = this.screenToWorld(p.x, p.y);

    if (tool.kind === 'build') {
      const def = getBuilding(tool.id);
      const { tx, ty } = this.placementCell(def, w.x, w.y);
      const ok = state.checkPlace(def, tx, ty) === 'ok' && state.canAfford(def.cost);
      const color = ok ? COLORS.valid : COLORS.invalid;
      this.footprint.fillStyle(color, 0.22).fillRect(tx * TILE, ty * TILE, def.w * TILE, def.h * TILE);
      this.footprint.lineStyle(2, color, 0.9).strokeRect(tx * TILE, ty * TILE, def.w * TILE, def.h * TILE);
      this.ghost.setPosition(tx * TILE, (ty + def.h) * TILE).setVisible(true);
      if (ok) this.ghost.clearTint();
      else this.ghost.setTint(COLORS.invalid);
      return;
    }

    this.ghost.setVisible(false);
    const b = state.buildingAt(Math.floor(w.x / TILE), Math.floor(w.y / TILE));
    if (b) {
      this.hoveredUid = b.uid;
      this.views.get(b.uid)?.image.setTint(COLORS.invalid);
      this.footprint.lineStyle(2, COLORS.invalid, 0.9).strokeRect(b.tx * TILE, b.ty * TILE, b.def.w * TILE, b.def.h * TILE);
    }
  }
}
