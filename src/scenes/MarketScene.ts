import * as Phaser from 'phaser';
import {
  ARRIVAL_END_MARGIN_MS,
  BAR_HEIGHT,
  COLORS,
  DAWN_WARNING_MS,
  DEPTH,
  FONT_TITLE,
  LIGHTS,
  NIGHT_DARKNESS,
  FONT_UI,
  GRID_W,
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
import { WAVES } from '../data/spirits';
import { STR } from '../data/strings';
import { Ferry } from '../entities/Ferry';
import { Restaurant } from '../entities/Restaurant';
import { Spirit } from '../entities/Spirit';
import type { WalkerWorld } from '../entities/Walker';
import { Worker } from '../entities/Worker';
import { createTextures, ensureBuildingTextures, TEX } from '../gfx/textures';
import { AREAS } from '../data/levels';
import { doorCellsFor, orient, state, unlockLevel, type PlacedBuilding } from '../state/GameState';
import { startAutosave } from '../state/storage';
import type { UIScene } from './UIScene';
import type { Cell } from '../state/pathfinding';

interface BuildingView {
  image: Phaser.GameObjects.Image;
  /** Front part in front of guests and workers (restaurant wall, stall counter). */
  front?: Phaser.GameObjects.Image;
  /** Stalls: the worker behind the counter. */
  clerk?: Phaser.GameObjects.Image;
  /** Mats in front of the doors. */
  mats: Phaser.GameObjects.Image[];
  glow?: Phaser.GameObjects.Image;
  /** Status icon above staffed buildings (no staff / staff on the way). */
  badge?: Phaser.GameObjects.Text;
}

interface DirtView {
  litter?: Phaser.GameObjects.Image;
  slime?: Phaser.GameObjects.Image;
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
  night: { night: 1, sun: 0, glow: 1 },
  dawn: { night: 0.55, sun: 0.05, glow: 0.7 },
} as const;

/** The world: ground, buildings, spirits, lighting, camera and placing buildings. */
export class MarketScene extends Phaser.Scene {
  private views = new Map<number, BuildingView>();
  private spirits: Spirit[] = [];
  private ferries = new Map<number, Ferry>();
  private restaurants = new Map<number, Restaurant>();
  private workers = new Map<number, Worker>();
  private dirtViews = new Map<number, DirtView>();
  private selectionGfx!: Phaser.GameObjects.Graphics;
  /** Dark cover over the closed hotel district. */
  private areaLock?: Phaser.GameObjects.Container;
  private world!: WalkerWorld;
  private glowLayer!: Phaser.GameObjects.Layer;
  /** Dark night layer with holes where lights are (redrawn when buildings change). */
  private nightOverlay!: Phaser.GameObjects.Image;
  private darkness!: Phaser.Textures.CanvasTexture;
  private darknessDirty = true;
  private sunOverlay!: Phaser.GameObjects.Rectangle;
  private ghost!: Phaser.GameObjects.Image;
  private footprint!: Phaser.GameObjects.Graphics;
  private hoveredUid: number | null = null;
  private drag: DragState | null = null;
  /** Night time (ms, game speed) at which each of tonight's new guests arrives, in order. */
  private arrivals: number[] = [];
  private nightClock = 0;
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
    this.world = {
      glowLayer: this.glowLayer,
      ferry: (uid) => this.ferries.get(uid),
      restaurant: (uid) => this.restaurants.get(uid),
    };
    const pad = WORLD_PADDING;
    this.darkness =
      this.textures.get('darkness') instanceof Phaser.Textures.CanvasTexture
        ? (this.textures.get('darkness') as Phaser.Textures.CanvasTexture)
        : this.textures.createCanvas('darkness', WORLD_W + pad * 2, WORLD_H + pad * 2)!;
    this.nightOverlay = this.add.image(-pad, -pad, 'darkness').setOrigin(0).setDepth(DEPTH.nightOverlay);
    this.sunOverlay = this.add
      .rectangle(-pad, -pad, WORLD_W + pad * 2, WORLD_H + pad * 2, 0xffe2a8)
      .setOrigin(0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.nightOverlay + 0.5);
    this.setLight(state.phase === 'night' ? 'night' : 'day', 0);

    this.addGate();
    if (!state.areas.has('hotel')) this.addAreaLock();
    for (const b of state.buildings.values()) this.addBuildingView(b, false);

    this.setupCamera();
    this.footprint = this.add.graphics().setDepth(DEPTH.preview);
    this.selectionGfx = this.add.graphics().setDepth(DEPTH.preview - 1);
    for (const m of state.staff.values()) this.workers.set(m.id, new Worker(this, state, this.world, m));
    this.ghost = this.add.image(0, 0, TEX.building('lantern')).setOrigin(0, 1).setAlpha(0.7).setVisible(false).setDepth(DEPTH.preview + 1);
    this.setupInput();

    this.unsubscribe.push(
      state.on('placed', (b) => {
        this.addBuildingView(b, true);
        this.darknessDirty = true;
      }),
      state.on('removed', (b) => {
        this.removeBuildingView(b);
        this.darknessDirty = true;
      }),
      state.on('tool', () => this.refreshGhost()),
      state.on('phase', (p) => (p === 'night' ? this.onNightFalls() : this.setLight('day', 4000))),
      state.on('dawn', () => this.setLight('dawn', DAWN_WARNING_MS)),
      state.on('sunrise', () => this.onSunrise()),
      state.on('speed', (speed) => (this.time.timeScale = speed)),
      state.on('hired', (m) => {
        this.workers.set(m.id, new Worker(this, state, this.world, m));
      }),
      state.on('fired', (m) => {
        this.workers.get(m.id)?.dismiss();
        this.workers.delete(m.id);
      }),
      state.on('staff', () => {
        for (const w of this.workers.values()) w.onStaffChanged();
      }),
      state.on('dirt', (cell) => this.refreshDirt(cell)),
      state.on('area', () => {
        const lock = this.areaLock;
        this.areaLock = undefined;
        if (lock) this.tweens.add({ targets: lock, alpha: 0, duration: 1200, onComplete: () => lock.destroy() });
      }),
      state.on('earned', (amount, cell) =>
        this.floatText(cell.tx * TILE + TILE / 2, cell.ty * TILE - 6, STR.earn(amount), COLORS.uiGold, 12),
      ),
    );
    this.unsubscribe.push(startAutosave(state));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe.forEach((u) => u()));
    // Litter and slime from a loaded game.
    for (const c of state.dirtyCells()) this.refreshDirt(c);

    this.scene.launch('UIScene');
  }

  update(time: number, delta: number): void {
    // Camera and building work in real time; the world runs at the game speed.
    this.panWithKeys(delta);
    this.updateHover();
    state.tick(delta);
    const worldDelta = delta * state.speed;

    for (const f of this.ferries.values()) f.update(worldDelta);
    for (const r of this.restaurants.values()) r.update(worldDelta, time);
    for (const s of this.spirits) s.update(time, worldDelta);
    this.spirits = this.spirits.filter((s) => !s.isDone);
    state.setSpiritCount(this.spirits.length);
    for (const w of this.workers.values()) w.update(time, worldDelta);
    this.letGuestsIn(worldDelta);
    this.updateBadges();
    this.drawSelection();
    if (this.darknessDirty) this.drawDarkness();
  }

  /**
   * Paint the night: a dark, cold layer over everything, with soft holes
   * where light falls. Lamps light a wide area, restaurants their room,
   * houses a little around their windows, stalls just their counter.
   */
  private drawDarkness(): void {
    this.darknessDirty = false;
    const ctx = this.darkness.getContext();
    const pad = WORLD_PADDING;
    const { width, height } = this.darkness;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = NIGHT_DARKNESS;
    ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'destination-out';
    const light = (x: number, y: number, radius: number, strength: number) => {
      const g = ctx.createRadialGradient(x + pad, y + pad, 0, x + pad, y + pad, radius);
      g.addColorStop(0, `rgba(0,0,0,${strength})`);
      g.addColorStop(0.55, `rgba(0,0,0,${strength * 0.6})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x + pad, y + pad, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    const g = state.gate;
    const gateY = (g.ty + GATE.h) * TILE - 30;
    for (const fx of [0.11, 0.89]) light(g.tx * TILE + GATE.w * TILE * fx, gateY, LIGHTS.gate.radius, LIGHTS.gate.strength);

    for (const b of state.buildings.values()) {
      const { def } = b;
      if (def.walkable) continue;
      const cx = (b.tx + def.w / 2) * TILE;
      const bottom = (b.ty + def.h) * TILE;
      const lamp = def.category === 'decor' || def.style === 'brazier';
      if (lamp && def.glow) {
        const texH = def.h * TILE + def.rise;
        const ly = bottom - texH + texH * def.glow.y;
        // Light falls on the ground below the lamp.
        light(cx, (ly + bottom) / 2, def.glow.radius * LIGHTS.lamp.radiusFactor, LIGHTS.lamp.strength);
      } else if (def.restaurant) {
        light(cx, (b.ty + def.h / 2) * TILE, Math.max(def.w, def.h) * TILE * LIGHTS.restaurant.radiusFactor, LIGHTS.restaurant.strength);
      } else if (def.glow) {
        light(cx, bottom - TILE * 0.4, def.glow.radius * LIGHTS.house.radiusFactor, LIGHTS.house.strength);
      } else if (def.provides || def.staffBeds || def.hotel) {
        light(cx, bottom - TILE * 0.4, LIGHTS.stall.radius, LIGHTS.stall.strength);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    this.darkness.refresh();
  }

  /** Icons above staffed buildings: nobody assigned, or the worker is still on the way. */
  private updateBadges(): void {
    for (const [uid, view] of this.views) {
      if (!view.badge) continue;
      const b = state.buildings.get(uid);
      if (!b) continue;
      let icon = '';
      const line = state.queueLength(uid);
      const night = state.phase === 'night';
      if (!state.isServed(b)) icon = STR.noStaffIcon;
      else if (night && !state.isOpen(b)) icon = STR.staffComingIcon;
      else if (night && b.def.restaurant) icon = STR.restaurantBadge(state.servingCount(uid), b.def.restaurant.tables, line);
      else if (line >= 3) icon = STR.queueBadge(line);
      // The stall worker shows behind the counter while on duty.
      const role = b.def.staff?.[0];
      view.clerk?.setVisible(!!role && state.onDutyCount(uid, role) > 0);
      if (view.badge.text !== icon) view.badge.setText(icon);
      view.badge.setVisible(icon !== '');
    }
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
    for (const w of this.workers.values()) w.wake();

    // Last night's hotel guests wake up first, spread over the early night.
    let woken = 0;
    for (const { hotel, count } of state.takeSleepers()) {
      for (let i = 0; i < count; i++) {
        const cells = state.entranceCells(hotel);
        const start = cells.length ? Phaser.Utils.Array.GetRandom(cells) : Phaser.Utils.Array.GetRandom([...state.gateCells]);
        this.spawnSpirit(start, 500 + Math.random() * 25_000);
        woken++;
      }
    }

    // New guests arrive at the gate in waves over the whole night.
    const count = Math.max(0, state.guestsTonight() - woken);
    const window = NIGHT_MS - DAWN_WARNING_MS - ARRIVAL_END_MARGIN_MS;
    this.arrivals = Array.from({ length: count }, () => this.arrivalTime(window)).sort((a, b) => a - b);
    this.nightClock = 0;
    state.pendingArrivals = this.arrivals.length;
  }

  /** A random arrival time following the waves in data/spirits.ts. */
  private arrivalTime(window: number): number {
    let r = Math.random();
    let wave: (typeof WAVES)[number] = WAVES[WAVES.length - 1];
    for (const w of WAVES) {
      r -= w.share;
      if (r <= 0) {
        wave = w;
        break;
      }
    }
    // Rough bell curve: average of three random numbers.
    const bell = (Math.random() + Math.random() + Math.random()) / 3 - 0.5;
    const t = wave.at + bell * wave.spread * 3.4;
    return Phaser.Math.Clamp(t, 0, 1) * window;
  }

  private letGuestsIn(worldDelta: number): void {
    if (state.phase !== 'night' || !this.arrivals.length) return;
    this.nightClock += worldDelta;
    while (this.arrivals.length && this.arrivals[0] <= this.nightClock) {
      this.arrivals.shift();
      if (!state.isDawn) this.spawnSpirit(Phaser.Utils.Array.GetRandom([...state.gateCells]), 200);
    }
    state.pendingArrivals = this.arrivals.length;
  }

  /** Everyone is gone: send the workers home and jump to the morning. */
  skipToMorning(): void {
    if (!state.canSkipNight) return;
    for (const w of this.workers.values()) w.goHomeNow();
    state.endNightNow();
  }

  private onSunrise(): void {
    this.arrivals = [];
    state.pendingArrivals = 0;
    for (const s of this.spirits) {
      if (s.isDone) continue;
      const p = s.position;
      s.burn();
      state.recordLost();
      this.floatText(p.x, p.y - 40, STR.lostSpirit, COLORS.uiRed, 12);
    }
    for (const [id, w] of [...this.workers]) {
      const p = w.position;
      if (w.sunrise()) continue;
      this.workers.delete(id);
      state.loseStaff(id);
      this.floatText(p.x, p.y - 40, STR.lostSpirit, COLORS.uiRed, 12);
    }
  }

  // ---------------------------------------------------------------------------
  // litter and slime
  // ---------------------------------------------------------------------------

  private refreshDirt(cell: Cell): void {
    const key = cell.ty * GRID_W + cell.tx;
    const d = state.dirtAt(cell.tx, cell.ty);
    const view = this.dirtViews.get(key) ?? {};
    const depth = DEPTH.flat + cell.ty + 0.5;
    const set = (img: Phaser.GameObjects.Image | undefined, amount: number, tex: string, flip: boolean) => {
      if (amount <= 0) {
        img?.destroy();
        return undefined;
      }
      const out = img ?? this.add.image(cell.tx * TILE, cell.ty * TILE, tex).setOrigin(0).setDepth(depth).setFlipX(flip);
      return out.setAlpha(0.45 + 0.55 * (amount / 3));
    };
    view.litter = set(view.litter, d.litter, TEX.litter, (cell.tx + cell.ty) % 2 === 0);
    view.slime = set(view.slime, d.slime, TEX.slime, cell.tx % 2 === 0);
    if (!view.litter && !view.slime) this.dirtViews.delete(key);
    else this.dirtViews.set(key, view);
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

  /** Darkened hotel district with a lock label until it is opened. */
  private addAreaLock(): void {
    const h = (RIVER_TOP + RIVER_ROWS) * TILE;
    const shade = this.add.rectangle(0, 0, WORLD_W, h, 0x05070f, 0.62).setOrigin(0);
    const a = AREAS.hotel;
    const label = this.add
      .text(WORLD_W / 2, h / 2, STR.areaLockLabel(a.level, a.cost), {
        fontFamily: FONT_TITLE,
        fontSize: '26px',
        color: '#f3e9d2',
        backgroundColor: 'rgba(11,15,26,0.7)',
        padding: { x: 14, y: 8 },
      })
      .setOrigin(0.5);
    this.areaLock = this.add.container(0, 0, [shade, label]).setDepth(DEPTH.nightOverlay - 1);
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
    ensureBuildingTextures(this, def, b.rot);
    const bottom = (b.ty + def.h) * TILE;
    // Paths and bridges lie flat on the ground, below everything that stands.
    // Restaurants are open rooms: floor at the top edge, front wall at the bottom.
    // Stalls: back part, worker, then the counter in front.
    // Stalls facing the camera are split so the worker stands behind the counter.
    const stall = def.style === 'stall';
    const split = stall && b.rot % 2 === 0;
    const depth = def.walkable ? DEPTH.flat + b.ty : def.restaurant ? b.ty * TILE + 1 : split ? bottom - 2 : bottom;
    const texture = def.id === 'path' ? TEX.path(0) : split ? TEX.back(def.id) : TEX.view(def, b.rot);
    const image = this.add.image(b.tx * TILE, bottom, texture).setOrigin(0, 1).setDepth(depth);
    if (def.crossing?.kind === 'boat') this.ferries.set(b.uid, new Ferry(this, b));
    let front: Phaser.GameObjects.Image | undefined;
    let clerk: Phaser.GameObjects.Image | undefined;
    if (def.restaurant) {
      this.restaurants.set(b.uid, new Restaurant(this, state, b));
      front = this.add.image(b.tx * TILE, bottom, TEX.front(def.id, b.rot % 2 === 1)).setOrigin(0, 1).setDepth(bottom + 1);
    }
    if (split) front = this.add.image(b.tx * TILE, bottom, TEX.front(def.id)).setOrigin(0, 1).setDepth(bottom);
    const role = stall ? def.staff?.[0] : undefined;
    if (role) {
      // Behind the counter (front view) or inside between the two open ends (side view).
      const front = b.rot % 2 === 0;
      clerk = this.add
        .image(b.tx * TILE + (def.w * TILE) / 2, bottom - (front ? 9 : 7), TEX.worker(role))
        .setOrigin(0.5, 1)
        .setScale(front ? 1 : 0.8)
        .setDepth(front ? bottom - 1 : bottom + 0.5)
        .setVisible(false);
    }
    const mats = state
      .doorCells(b)
      .map((c) => this.add.image(c.tx * TILE, c.ty * TILE, TEX.doormat).setOrigin(0).setDepth(DEPTH.flat + c.ty + 0.4));

    let glow: Phaser.GameObjects.Image | undefined;
    if (def.glow) {
      const texH = def.h * TILE + def.rise;
      glow = this.addGlow(b.tx * TILE + def.w * TILE * def.glow.x, bottom - texH + texH * def.glow.y, def.glow.radius);
      if (def.glow.color !== undefined) glow.setTint(def.glow.color);
    }

    let badge: Phaser.GameObjects.Text | undefined;
    if (def.staff || def.provides) {
      badge = this.add
        .text(b.tx * TILE + (def.w * TILE) / 2, bottom - def.h * TILE - def.rise + 4, '', {
          fontFamily: FONT_UI,
          fontSize: '14px',
          backgroundColor: 'rgba(16,18,32,0.75)',
          padding: { x: 3, y: 1 },
        })
        .setOrigin(0.5, 1)
        .setDepth(DEPTH.glow + 8)
        .setVisible(false);
    }

    if (animate && !def.walkable) {
      image.setScale(1.08, 0.8);
      this.tweens.add({ targets: image, scaleX: 1, scaleY: 1, duration: 260, ease: 'Back.Out' });
      this.puff(b.tx * TILE + (def.w * TILE) / 2, bottom - 6, def.w * 6);
    }

    this.views.set(b.uid, { image, front, clerk, mats, glow, badge });
    this.gridChanged();
  }

  private removeBuildingView(b: PlacedBuilding): void {
    const view = this.views.get(b.uid);
    if (!view) return;
    this.views.delete(b.uid);
    this.ferries.get(b.uid)?.destroy();
    this.ferries.delete(b.uid);
    this.restaurants.get(b.uid)?.destroy();
    this.restaurants.delete(b.uid);
    view.front?.destroy();
    view.clerk?.destroy();
    view.mats.forEach((m) => m.destroy());
    if (this.hoveredUid === b.uid) this.hoveredUid = null;
    view.glow?.destroy();
    view.badge?.destroy();
    this.tweens.add({
      targets: view.image,
      alpha: 0,
      scaleY: 0.6,
      duration: 200,
      onComplete: () => view.image.destroy(),
    });
    this.puff(b.tx * TILE + (b.def.w * TILE) / 2, (b.ty + b.def.h) * TILE - 6, b.def.w * 8);
    this.gridChanged();
  }

  private gridChanged(): void {
    for (const s of this.spirits) s.onGridChanged();
    for (const w of this.workers.values()) w.onGridChanged();
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
      if (d.button === 2) {
        state.setTool(null);
        state.select(null);
      }
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
      if (result === 'money' || result === 'night') {
        this.floatText(w.x, w.y, result === 'money' ? STR.notEnoughCoins : STR.nightNoBuild, COLORS.uiRed);
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
    const w = this.screenToWorld(p.x, p.y);
    if (!tool) {
      this.handleSelectClick(w.x, w.y);
      return;
    }

    if (tool.kind === 'build') {
      const def = orient(getBuilding(tool.id), state.buildRot);
      const { tx, ty } = this.placementCell(def, w.x, w.y);
      const price = state.buildCost(def);
      const result = state.place(tool.id, tx, ty, false, state.buildRot);
      const cx = (tx + def.w / 2) * TILE;
      const top = ty * TILE - def.rise;
      if (result === 'ok') this.floatText(cx, top, STR.cost(price), COLORS.uiGold);
      else if (result === 'money') this.floatText(w.x, w.y, STR.notEnoughCoins, COLORS.uiRed);
      else if (result === 'zone') this.floatText(w.x, w.y, STR.zoneOnly[def.zone], COLORS.uiRed);
      else if (result === 'adjacent') this.floatText(w.x, w.y, STR.tooClose, COLORS.uiRed);
      else if (result === 'night') this.floatText(w.x, w.y, STR.nightNoBuild, COLORS.uiRed);
      else if (result === 'area') this.floatText(w.x, w.y, STR.areaLocked, COLORS.uiRed);
      else if (result === 'locked') this.floatText(w.x, w.y, STR.lockedLevel(unlockLevel(def)), COLORS.uiRed);
      else this.floatText(w.x, w.y, STR.cantBuildHere, COLORS.uiRed);
      return;
    }

    const b = state.buildingAt(Math.floor(w.x / TILE), Math.floor(w.y / TILE));
    if (b) {
      const res = state.demolish(b.uid);
      const x = (b.tx + b.def.w / 2) * TILE;
      const y = b.ty * TILE - b.def.rise;
      if (res.result === 'ok') this.floatText(x, y, STR.refund(res.refund), COLORS.uiGold);
      else this.floatText(x, y, res.result === 'night' ? STR.nightNoBuild : STR.staffHomeNeeded, COLORS.uiRed);
    }
  }

  /** Front-most building whose picture covers the world point. */
  private buildingUnder(x: number, y: number): PlacedBuilding | undefined {
    let best: PlacedBuilding | undefined;
    for (const b of state.buildings.values()) {
      const { def } = b;
      if (def.walkable) continue;
      const bottom = (b.ty + def.h) * TILE;
      const top = bottom - def.h * TILE - def.rise;
      if (x < b.tx * TILE || x > (b.tx + def.w) * TILE || y < top || y > bottom) continue;
      if (!best || bottom > (best.ty + best.def.h) * TILE) best = b;
    }
    return best;
  }

  private workerUnder(x: number, y: number): Worker | undefined {
    let best: Worker | undefined;
    for (const w of this.workers.values()) {
      if (w.hitTest(x, y) && (!best || w.position.y > best.position.y)) best = w;
    }
    return best;
  }

  /**
   * Without a build tool, clicks select things. With a worker selected,
   * clicking a matching building moves them there; cleaners are sent to the
   * clicked path.
   */
  private handleSelectClick(x: number, y: number): void {
    const worker = this.workerUnder(x, y);
    const building = worker ? undefined : this.buildingUnder(x, y);
    const sel = state.selection;
    const member = sel?.kind === 'staff' ? state.staff.get(sel.id) : undefined;

    if (member && !worker) {
      if (member.role === 'cleaner') {
        const cell = { tx: Math.floor(x / TILE), ty: Math.floor(y / TILE) };
        if (state.isWalkable(cell.tx, cell.ty) && !building) {
          state.setFocus(member.id, cell);
          this.floatText(x, y, STR.cleanHere, COLORS.uiGreen, 13);
          return;
        }
      } else if (building?.def.staff?.includes(member.role)) {
        state.assign(member.id, building.uid);
        this.floatText(x, y, STR.assigned, COLORS.uiGreen, 13);
        return;
      }
    }

    if (worker) state.select({ kind: 'staff', id: worker.id });
    else if (building) state.select({ kind: 'building', uid: building.uid });
    else state.select(null);
  }

  /** Outline of the selected building, ring under the selected worker. */
  private drawSelection(): void {
    const g = this.selectionGfx;
    g.clear();
    const sel = state.selection;
    if (!sel) return;
    if (sel.kind === 'building') {
      const b = state.buildings.get(sel.uid);
      if (!b) return;
      g.lineStyle(2, COLORS.uiAccent, 0.95).strokeRect(b.tx * TILE, b.ty * TILE, b.def.w * TILE, b.def.h * TILE);
      return;
    }
    const m = state.staff.get(sel.id);
    const w = this.workers.get(sel.id);
    if (w?.isAwake) {
      const p = w.position;
      g.lineStyle(2, COLORS.uiAccent, 0.95).strokeEllipse(p.x, p.y, 34, 14);
    }
    // Show where the worker belongs.
    const post = m?.post != null ? state.buildings.get(m.post) : undefined;
    if (post) g.lineStyle(2, COLORS.valid, 0.7).strokeRect(post.tx * TILE, post.ty * TILE, post.def.w * TILE, post.def.h * TILE);
    if (m?.focus) {
      const r = 3;
      g.lineStyle(2, COLORS.valid, 0.6).strokeRect((m.focus.tx - r) * TILE, (m.focus.ty - r) * TILE, (2 * r + 1) * TILE, (2 * r + 1) * TILE);
    }
  }

  /** Centre the camera on a worker (used by the staff panel). */
  focusWorker(id: number): void {
    const w = this.workers.get(id);
    if (w?.isAwake) this.cameras.main.pan(w.position.x, w.position.y, 400, Phaser.Math.Easing.Sine.InOut);
  }

  private refreshGhost(): void {
    const tool = state.tool;
    if (tool?.kind === 'build') {
      const def = orient(getBuilding(tool.id), state.buildRot);
      if (tool.id !== 'path') ensureBuildingTextures(this, def, state.buildRot);
      this.ghost.setTexture(tool.id === 'path' ? TEX.path(0) : TEX.view(def, state.buildRot));
    }
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
      if (!tool && !this.isOverUI(p) && !this.drag?.panning) {
        // Hint at what can be clicked.
        const w = this.screenToWorld(p.x, p.y);
        const b = this.workerUnder(w.x, w.y) ? undefined : this.buildingUnder(w.x, w.y);
        if (b) this.footprint.lineStyle(1, COLORS.uiAccent, 0.5).strokeRect(b.tx * TILE, b.ty * TILE, b.def.w * TILE, b.def.h * TILE);
      }
      return;
    }
    const w = this.screenToWorld(p.x, p.y);

    if (tool.kind === 'build') {
      const def = orient(getBuilding(tool.id), state.buildRot);
      const { tx, ty } = this.placementCell(def, w.x, w.y);
      const ok = state.checkPlace(def, tx, ty) === 'ok' && state.canAfford(state.buildCost(def));
      const color = ok ? COLORS.valid : COLORS.invalid;
      this.footprint.fillStyle(color, 0.22).fillRect(tx * TILE, ty * TILE, def.w * TILE, def.h * TILE);
      this.footprint.lineStyle(2, color, 0.9).strokeRect(tx * TILE, ty * TILE, def.w * TILE, def.h * TILE);
      // Doors: green where a path is, orange where one is still missing.
      for (const d of doorCellsFor(def, tx, ty, state.buildRot)) {
        const walk = state.isWalkable(d.tx, d.ty);
        this.footprint.fillStyle(walk ? COLORS.valid : 0xf2b45a, 0.45).fillRect(d.tx * TILE + 10, d.ty * TILE + 10, TILE - 20, TILE - 20);
      }
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
