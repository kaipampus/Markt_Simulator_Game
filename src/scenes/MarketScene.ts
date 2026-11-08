import * as Phaser from 'phaser';
import {
  BAR_HEIGHT,
  COLORS,
  FONT_UI,
  HUD_HEIGHT,
  PAN_SPEED,
  SPIRIT_MAX,
  SPIRIT_SPAWN_MS,
  TILE,
  WORLD_H,
  WORLD_PADDING,
  WORLD_W,
  ZOOM_MAX,
  ZOOM_MIN,
} from '../config';
import { GATE, getBuilding, type BuildingDef } from '../data/buildings';
import { STR } from '../data/strings';
import { Spirit } from '../entities/Spirit';
import { createTextures, TEX } from '../gfx/textures';
import { state, type PlacedBuilding } from '../state/GameState';

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
}

/** The market world: ground, buildings, spirits, camera and placing buildings. */
export class MarketScene extends Phaser.Scene {
  private views = new Map<number, BuildingView>();
  private spirits: Spirit[] = [];
  private ghost!: Phaser.GameObjects.Image;
  private footprint!: Phaser.GameObjects.Graphics;
  private hoveredUid: number | null = null;
  private drag: DragState | null = null;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  private unsubscribe: Array<() => void> = [];

  constructor() {
    super('MarketScene');
  }

  create(): void {
    createTextures(this);

    this.add.image(0, 0, TEX.ground).setOrigin(0).setDepth(-1000);
    this.addGate();

    const cam = this.cameras.main;
    cam.setBackgroundColor(COLORS.background);
    cam.setBounds(-WORLD_PADDING, -WORLD_PADDING, WORLD_W + WORLD_PADDING * 2, WORLD_H + WORLD_PADDING * 2);
    // Start a bit below the middle so the gate is visible above the build bar.
    cam.centerOn(WORLD_W / 2, WORLD_H * 0.74);
    // Keep the same spot in the middle of the screen when the window size changes.
    const onResize = (_g: unknown, _b: unknown, _d: unknown, prevW: number, prevH: number) => {
      const cx = cam.scrollX + prevW / 2;
      const cy = cam.scrollY + prevH / 2;
      cam.centerOn(cx, cy);
    };
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scale.off(Phaser.Scale.Events.RESIZE, onResize));

    this.footprint = this.add.graphics().setDepth(99_999);
    this.ghost = this.add.image(0, 0, TEX.building('lantern')).setOrigin(0, 1).setAlpha(0.7).setVisible(false).setDepth(100_000);

    this.setupInput();

    this.unsubscribe.push(
      state.on('placed', (b) => this.addBuildingView(b, true)),
      state.on('removed', (b) => this.removeBuildingView(b)),
      state.on('tool', () => this.refreshGhost()),
    );
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe.forEach((u) => u()));

    // Spirits: a few right away, then one every few seconds.
    for (let i = 0; i < 3; i++) this.time.delayedCall(400 + i * 700, () => this.spawnSpirit());
    this.time.addEvent({ delay: SPIRIT_SPAWN_MS, loop: true, callback: () => this.spawnSpirit() });

    this.scene.launch('UIScene');
  }

  update(time: number, delta: number): void {
    this.panWithKeys(delta);
    this.updateHover();

    for (const s of this.spirits) s.update(time, delta);
    this.spirits = this.spirits.filter((s) => !s.isGone);
    state.setSpiritCount(this.spirits.length);
  }

  // ---------------------------------------------------------------------------
  // world objects
  // ---------------------------------------------------------------------------

  private addGate(): void {
    const { tx, ty } = state.gate;
    const bottom = (ty + GATE.h) * TILE;
    this.add.image(tx * TILE, bottom, TEX.gate).setOrigin(0, 1).setDepth(bottom);
    const height = GATE.h * TILE + GATE.rise;
    for (const fx of [0.1, 0.9]) {
      this.addGlow(tx * TILE + GATE.w * TILE * fx, bottom - height + 0.2 * height + 36, 70, bottom + 0.5);
    }
  }

  private addGlow(x: number, y: number, radius: number, depth: number): Phaser.GameObjects.Image {
    const glow = this.add
      .image(x, y, TEX.glow)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale((radius * 2) / 256)
      .setDepth(depth)
      .setAlpha(0.85);
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
    const image = this.add.image(b.tx * TILE, bottom, TEX.building(def.id)).setOrigin(0, 1).setDepth(bottom);

    let glow: Phaser.GameObjects.Image | undefined;
    if (def.glow) {
      const texH = def.h * TILE + def.rise;
      glow = this.addGlow(b.tx * TILE + def.w * TILE * def.glow.x, bottom - texH + texH * def.glow.y, def.glow.radius, bottom + 0.5);
    }

    if (animate) {
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

  private spawnSpirit(): void {
    if (this.spirits.length >= SPIRIT_MAX) return;
    const start = Phaser.Utils.Array.GetRandom([...state.spawnCells]);
    this.spirits.push(new Spirit(this, state, start));
  }

  /** Short text that floats up and fades, in world space. */
  private floatText(x: number, y: number, text: string, color: string): void {
    const t = this.add
      .text(x, y, text, {
        fontFamily: FONT_UI,
        fontSize: '15px',
        fontStyle: 'bold',
        color,
        stroke: '#0b0f1a',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1)
      .setDepth(200_000);
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 1100, ease: 'Cubic.Out', onComplete: () => t.destroy() });
  }

  // ---------------------------------------------------------------------------
  // input
  // ---------------------------------------------------------------------------

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
      this.drag = { x: p.x, y: p.y, button: p.button, scrollX: cam.scrollX, scrollY: cam.scrollY, panning: false };
    });

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      if (!d || !p.isDown) return;
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
      if (!d || d.panning) return;
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
    const newZoom = Phaser.Math.Clamp(cam.zoom * factor, ZOOM_MIN, ZOOM_MAX);
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

  private handleClick(p: Phaser.Input.Pointer): void {
    const tool = state.tool;
    if (!tool) return;
    const w = this.screenToWorld(p.x, p.y);

    if (tool.kind === 'build') {
      const def = getBuilding(tool.id);
      const { tx, ty } = this.placementCell(def, w.x, w.y);
      const result = state.place(tool.id, tx, ty);
      const cx = (tx + def.w / 2) * TILE;
      const top = (ty + def.h) * TILE - def.h * TILE - def.rise;
      if (result === 'ok') this.floatText(cx, top, STR.cost(def.cost), COLORS.uiGold);
      else if (result === 'money') this.floatText(w.x, w.y, STR.notEnoughCoins, COLORS.uiRed);
      else this.floatText(w.x, w.y, STR.cantBuildHere, COLORS.uiRed);
      return;
    }

    const b = state.buildingAt(Math.floor(w.x / TILE), Math.floor(w.y / TILE));
    if (b) {
      const refund = state.demolish(b.uid);
      this.floatText((b.tx + b.def.w / 2) * TILE, (b.ty + b.def.h) * TILE - b.def.h * TILE - b.def.rise, STR.refund(refund), COLORS.uiGold);
    }
  }

  private refreshGhost(): void {
    const tool = state.tool;
    if (tool?.kind === 'build') this.ghost.setTexture(TEX.building(tool.id));
    this.ghost.setVisible(false);
    this.footprint.clear();
  }

  /** Ghost preview while building, red highlight while demolishing. */
  private updateHover(): void {
    const p = this.input.activePointer;
    const tool = state.tool;
    this.footprint.clear();

    // Clear old demolish highlight.
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
      const ok = state.canPlace(def, tx, ty) && state.canAfford(def.cost);
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
