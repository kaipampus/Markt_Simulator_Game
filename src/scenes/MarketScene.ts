import * as Phaser from 'phaser';
import * as THREE from 'three';
import {
  ARRIVAL_END_MARGIN_MS,
  COLORS,
  DAWN_WARNING_MS,
  GRID_W,
  NIGHT_MS,
  PAN_SPEED,
  RIVER_ROWS,
  RIVER_TOP,
  SPIRIT_HARD_CAP,
  TILE,
} from '../config';
import { GATE, getBuilding, type BuildingDef } from '../data/buildings';
import { AREAS } from '../data/levels';
import { WAVES } from '../data/spirits';
import { STR } from '../data/strings';
import { Ferry } from '../entities/Ferry';
import { Restaurant } from '../entities/Restaurant';
import { Spirit } from '../entities/Spirit';
import type { WalkerWorld } from '../entities/Walker';
import { Worker } from '../entities/Worker';
import { doorCellsFor, orient, state, unlockLevel, type PlacedBuilding, type StaffMember } from '../state/GameState';
import type { Cell } from '../state/pathfinding';
import { pick } from '../state/random';
import { startAutosave } from '../state/storage';
import { gate } from '../world3d/models';
import {
  BuildingView3D,
  DirtView3D,
  FerryView3D,
  Ghost,
  GroundRect,
  RestaurantStaffView3D,
  SpiritView3D,
  WorkerView3D,
} from '../world3d/views';
import { World3D } from '../world3d/World3D';
import { GameUI } from '../ui/GameUI';

interface DragState {
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  button: number;
  moved: boolean;
  /** Painting paths: the last cell painted, to avoid repeats and fill gaps. */
  painting: boolean;
  lastPaint?: Cell;
}

/**
 * The game world: runs the game logic (clock, spirits, workers, ferries,
 * restaurants), handles the mouse and keys on the map and draws everything
 * in 3D (World3D). The interface is HTML on top (GameUI); Phaser only runs
 * the loop and the mouse and keys on the map.
 */
export class MarketScene extends Phaser.Scene {
  private world3d!: World3D;
  private ui!: GameUI;
  private world!: WalkerWorld;

  // logic
  private spirits: Spirit[] = [];
  private workers = new Map<number, Worker>();
  private ferries = new Map<number, Ferry>();
  private restaurants = new Map<number, Restaurant>();
  /** Night time (ms, game speed) at which each of tonight's new guests arrives, in order. */
  private arrivals: number[] = [];
  private nightClock = 0;

  // 3D views
  private views = new Map<number, BuildingView3D>();
  private spiritViews: SpiritView3D[] = [];
  private workerViews: WorkerView3D[] = [];
  private ferryViews = new Map<number, FerryView3D>();
  private staffViews = new Map<number, RestaurantStaffView3D>();
  private dirtViews = new Map<number, DirtView3D>();
  private ghost!: Ghost;
  private hoverRect!: GroundRect;
  private selRect!: GroundRect;
  private postRect!: GroundRect;
  private focusRect!: GroundRect;
  private areaLabel?: ReturnType<World3D['labels']['add']>;

  private drag: DragState | null = null;
  private keys!: Record<'up' | 'down' | 'left' | 'right' | 'w' | 'a' | 's' | 'd', Phaser.Input.Keyboard.Key>;
  private unsubscribe: Array<() => void> = [];

  constructor() {
    super('MarketScene');
  }

  create(): void {
    this.world3d = new World3D(document.getElementById('world')!, document.getElementById('labels')!);
    this.world = {
      ferry: (uid) => this.ferries.get(uid),
      restaurant: (uid) => this.restaurants.get(uid),
    };
    this.world3d.setLight(state.phase === 'night' ? 'night' : 'day', 0);

    const g = gate();
    g.position.set(state.gate.tx + GATE.w / 2, 0, state.gate.ty + 0.5);
    this.world3d.scene.add(g);
    g.updateMatrixWorld(true);
    for (const s of g.userData.lamps ?? []) this.world3d.addLamp(s.pos.clone().applyMatrix4(g.matrixWorld), s.color, s.power, s.distance);

    if (!state.areas.has('hotel')) this.lockArea();
    for (const b of state.buildings.values()) this.addBuildingView(b, false);
    for (const m of state.staff.values()) this.addWorker(m);
    for (const c of state.dirtyCells()) this.refreshDirt(c);

    this.ghost = new Ghost(this.world3d);
    this.hoverRect = new GroundRect(this.world3d, 0xf2b45a, 0.04);
    this.selRect = new GroundRect(this.world3d, 0xf2b45a);
    this.postRect = new GroundRect(this.world3d, 0x8fe3a8);
    this.focusRect = new GroundRect(this.world3d, 0x8fe3a8, 0.04);
    this.setupInput();

    this.unsubscribe.push(
      state.on('placed', (b) => this.addBuildingView(b, true)),
      state.on('removed', (b) => this.removeBuildingView(b)),
      state.on('phase', (p) => {
        if (p === 'night') this.onNightFalls();
        else this.world3d.setLight('day', 4000);
      }),
      state.on('dawn', () => this.world3d.setLight('dawn', DAWN_WARNING_MS)),
      state.on('sunrise', () => this.onSunrise()),
      state.on('speed', (speed) => (this.time.timeScale = speed)),
      state.on('hired', (m) => this.addWorker(m)),
      state.on('fired', (m) => {
        this.workers.get(m.id)?.dismiss();
        this.workers.delete(m.id);
      }),
      state.on('staff', () => {
        for (const w of this.workers.values()) w.onStaffChanged();
      }),
      state.on('dirt', (cell) => this.refreshDirt(cell)),
      state.on('area', () => {
        this.world3d.setAreaLocked(false);
        if (this.areaLabel) this.world3d.labels.remove(this.areaLabel);
        this.areaLabel = undefined;
      }),
      state.on('earned', (amount, cell) => this.floatText(cell.tx * TILE + TILE / 2, cell.ty * TILE, STR.earn(amount), COLORS.uiGold, 12)),
    );
    this.unsubscribe.push(startAutosave(state));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe.forEach((u) => u());
      this.ui.dispose();
      this.world3d.dispose();
    });

    this.ui = new GameUI(document.body, {
      focusWorker: (id) => this.focusWorker(id),
      skipToMorning: () => this.skipToMorning(),
    });
  }

  update(time: number, delta: number): void {
    // Camera and building work in real time; the world runs at the game speed.
    this.panWithKeys(delta);
    this.updateHover();
    state.tick(delta);
    const worldDelta = delta * state.speed;

    // Logic first (at game speed)...
    for (const f of this.ferries.values()) f.update(worldDelta);
    for (const r of this.restaurants.values()) r.update(worldDelta);
    for (const s of this.spirits) s.update(worldDelta);
    this.spirits = this.spirits.filter((s) => !s.isDone);
    state.setSpiritCount(this.spirits.length);
    for (const w of this.workers.values()) w.update(worldDelta);
    this.letGuestsIn(worldDelta);

    // ...then the 3D views (in real time).
    const dt = delta / 1000;
    for (const v of this.views.values()) v.update(dt);
    for (const v of this.ferryViews.values()) v.update();
    for (const v of this.staffViews.values()) v.update(time);
    for (const v of this.spiritViews) v.update(dt, time);
    this.spiritViews = this.spiritViews.filter((v) => !v.done);
    for (const v of this.workerViews) v.update(dt, time);
    this.workerViews = this.workerViews.filter((v) => !v.done);
    this.updateBadges();
    this.drawSelection();
    this.world3d.render(delta);
    this.ui.update();
  }

  /** Icons above buildings: no staff, staff on the way, tables taken, queue. */
  private updateBadges(): void {
    const night = state.phase === 'night';
    for (const [uid, view] of this.views) {
      if (!view.badge) continue;
      const b = state.buildings.get(uid);
      if (!b) continue;
      let icon = '';
      const line = state.queueLength(uid);
      if (!state.isServed(b)) icon = STR.noStaffIcon;
      else if (night && !state.isOpen(b)) icon = STR.staffComingIcon;
      else if (night && b.def.restaurant) icon = STR.restaurantBadge(state.servingCount(uid), b.def.restaurant.tables, line);
      else if (line >= 3) icon = STR.queueBadge(line);
      view.setBadge(icon);
    }
  }

  // ---------------------------------------------------------------------------
  // day and night
  // ---------------------------------------------------------------------------

  private onNightFalls(): void {
    this.world3d.setLight('night', 4000);
    for (const w of this.workers.values()) w.wake();

    // Last night's hotel guests wake up first, spread over the early night.
    let woken = 0;
    for (const { hotel, count } of state.takeSleepers()) {
      for (let i = 0; i < count; i++) {
        const cells = state.entranceCells(hotel);
        const start = cells.length ? pick(cells) : pick([...state.gateCells]);
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
      if (!state.isDawn) this.spawnSpirit(pick([...state.gateCells]), 200);
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
      this.floatText(p.x, p.y, STR.lostSpirit, COLORS.uiRed, 12, 1.4);
    }
    for (const [id, w] of [...this.workers]) {
      const p = w.position;
      if (w.sunrise()) continue;
      this.workers.delete(id);
      state.loseStaff(id);
      this.floatText(p.x, p.y, STR.lostSpirit, COLORS.uiRed, 12, 1.4);
    }
  }

  // ---------------------------------------------------------------------------
  // world objects
  // ---------------------------------------------------------------------------

  private lockArea(): void {
    this.world3d.setAreaLocked(true);
    const a = AREAS.hotel;
    this.areaLabel = this.world3d.labels.add('area');
    this.areaLabel.pos.set(GRID_W / 2, 0.8, (RIVER_TOP + RIVER_ROWS) / 2);
    this.world3d.labels.setText(this.areaLabel, STR.areaLockLabel(a.level, a.cost));
  }

  private refreshDirt(cell: Cell): void {
    const key = cell.ty * GRID_W + cell.tx;
    const d = state.dirtAt(cell.tx, cell.ty);
    const view = this.dirtViews.get(key) ?? new DirtView3D(this.world3d, cell.tx, cell.ty);
    if (view.set(d.litter, d.slime)) this.dirtViews.set(key, view);
    else this.dirtViews.delete(key);
  }

  private spawnSpirit(start: Cell, delayMs: number): void {
    if (this.spirits.length >= SPIRIT_HARD_CAP) return;
    const spirit = new Spirit(state, this.world, start, undefined, delayMs);
    this.spirits.push(spirit);
    this.spiritViews.push(new SpiritView3D(this.world3d, spirit));
  }

  private addWorker(m: StaffMember): void {
    const worker = new Worker(state, this.world, m);
    this.workers.set(m.id, worker);
    this.workerViews.push(new WorkerView3D(this.world3d, worker));
  }

  private addBuildingView(b: PlacedBuilding, animate: boolean): void {
    const { def } = b;
    if (def.crossing?.kind === 'boat') {
      const ferry = new Ferry(b);
      this.ferries.set(b.uid, ferry);
      this.ferryViews.set(b.uid, new FerryView3D(this.world3d, ferry));
    }
    if (def.restaurant) {
      const restaurant = new Restaurant(state, b);
      this.restaurants.set(b.uid, restaurant);
      this.staffViews.set(b.uid, new RestaurantStaffView3D(this.world3d, restaurant));
    }
    this.views.set(b.uid, new BuildingView3D(this.world3d, state, b, animate));
    if (animate && !def.walkable) this.floatText((b.tx + def.w / 2) * TILE, (b.ty + def.h / 2) * TILE, '✨', COLORS.uiGold, 16, 1.6);
    this.gridChanged();
  }

  private removeBuildingView(b: PlacedBuilding): void {
    this.views.get(b.uid)?.destroy();
    this.views.delete(b.uid);
    this.ferries.get(b.uid)?.destroy();
    this.ferries.delete(b.uid);
    this.ferryViews.get(b.uid)?.destroy();
    this.ferryViews.delete(b.uid);
    this.restaurants.delete(b.uid);
    this.staffViews.get(b.uid)?.destroy();
    this.staffViews.delete(b.uid);
    this.gridChanged();
  }

  private gridChanged(): void {
    for (const s of this.spirits) s.onGridChanged();
    for (const w of this.workers.values()) w.onGridChanged();
  }

  /** Short text that floats up and fades, at a world-pixel point (`height` in cells above the ground). */
  private floatText(x: number, y: number, text: string, color: string, size = 15, height = 1.2): void {
    this.world3d.labels.float(new THREE.Vector3(x / TILE, height, y / TILE), text, color, size);
  }

  // ---------------------------------------------------------------------------
  // camera and input
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
    kb.on('keydown-Q', () => this.world3d.turnStep(-1));
    kb.on('keydown-E', () => this.world3d.turnStep(1));

    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer) => {
      if (this.isOverUI(p)) return;
      const tool = state.tool;
      const painting = p.button === 0 && tool?.kind === 'build' && !!getBuilding(tool.id).dragPlace;
      this.drag = { x: p.x, y: p.y, lastX: p.x, lastY: p.y, button: p.button, moved: false, painting };
      if (painting) this.paintAt(p);
    });

    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      if (!d || !p.isDown) return;
      if (d.painting) {
        this.paintAt(p);
        return;
      }
      if (!d.moved && Math.hypot(p.x - d.x, p.y - d.y) > 5) d.moved = true;
      const dx = p.x - d.lastX;
      const dy = p.y - d.lastY;
      d.lastX = p.x;
      d.lastY = p.y;
      if (!d.moved) return;
      // Right or middle drag turns and tilts; left drag (without a tool) moves the view.
      if (d.button !== 0) this.world3d.orbit(dx, dy);
      else if (state.tool === null) this.world3d.pan(dx, dy);
    });

    const onUp = (p: Phaser.Input.Pointer) => {
      const d = this.drag;
      this.drag = null;
      if (!d || d.moved || d.painting) return;
      if (d.button === 2) {
        state.setTool(null);
        state.select(null);
      } else if (d.button === 0) this.handleClick(p);
    };
    this.input.on(Phaser.Input.Events.POINTER_UP, onUp);
    this.input.on(Phaser.Input.Events.POINTER_UP_OUTSIDE, () => (this.drag = null));

    this.input.on(Phaser.Input.Events.POINTER_WHEEL, (p: Phaser.Input.Pointer, _objs: unknown, _dx: number, dy: number) => {
      if (this.isOverUI(p)) return;
      this.world3d.zoom(dy > 0 ? 1.1 : 1 / 1.1);
    });
  }

  private isOverUI(p: Phaser.Input.Pointer): boolean {
    return this.ui.isOverUI(p.x, p.y);
  }

  private panWithKeys(delta: number): void {
    const k = this.keys;
    const dx = (k.right.isDown || k.d.isDown ? 1 : 0) - (k.left.isDown || k.a.isDown ? 1 : 0);
    const dy = (k.down.isDown || k.s.isDown ? 1 : 0) - (k.up.isDown || k.w.isDown ? 1 : 0);
    if (!dx && !dy) return;
    const step = (PAN_SPEED * delta) / 1000;
    this.world3d.pan(-dx * step, -dy * step);
  }

  /** Ground point under the pointer in world pixels. */
  private groundAt(p: Phaser.Input.Pointer): { x: number; y: number } | null {
    return this.world3d.groundAt(p.x, p.y);
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
    const w = this.groundAt(p);
    if (!w) return;
    const def = getBuilding(tool.id);
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
    const w = this.groundAt(p);
    if (!tool) {
      this.handleSelectClick(p, w);
      return;
    }
    if (!w) return;

    if (tool.kind === 'build') {
      const def = orient(getBuilding(tool.id), state.buildRot);
      const { tx, ty } = this.placementCell(def, w.x, w.y);
      const price = state.buildCost(def);
      const result = state.place(tool.id, tx, ty, false, state.buildRot);
      const cx = (tx + def.w / 2) * TILE;
      const cy = (ty + def.h / 2) * TILE;
      if (result === 'ok') this.floatText(cx, cy, STR.cost(price), COLORS.uiGold, 15, 2);
      else if (result === 'money') this.floatText(w.x, w.y, STR.notEnoughCoins, COLORS.uiRed);
      else if (result === 'zone') this.floatText(w.x, w.y, STR.zoneOnly[def.zone], COLORS.uiRed);
      else if (result === 'adjacent') this.floatText(w.x, w.y, STR.tooClose, COLORS.uiRed);
      else if (result === 'area') this.floatText(w.x, w.y, STR.areaLocked, COLORS.uiRed);
      else if (result === 'locked') this.floatText(w.x, w.y, STR.lockedLevel(unlockLevel(def)), COLORS.uiRed);
      else this.floatText(w.x, w.y, STR.cantBuildHere, COLORS.uiRed);
      return;
    }

    const b = this.buildingUnder(p, w);
    if (b) {
      const res = state.demolish(b.uid);
      const x = (b.tx + b.def.w / 2) * TILE;
      const y = (b.ty + b.def.h / 2) * TILE;
      if (res.result === 'ok') this.floatText(x, y, STR.refund(res.refund), COLORS.uiGold, 15, 2);
      else this.floatText(x, y, res.result === 'night' ? STR.nightNoBuild : STR.staffHomeNeeded, COLORS.uiRed, 15, 2);
    }
  }

  /** Building under the pointer: its 3D model, or the cell on the ground. */
  private buildingUnder(p: Phaser.Input.Pointer, w: { x: number; y: number } | null): PlacedBuilding | undefined {
    const uid = this.world3d.objectAt(this.world3d.buildings, 'uid', p.x, p.y);
    if (uid !== undefined) return state.buildings.get(uid);
    return w ? state.buildingAt(Math.floor(w.x / TILE), Math.floor(w.y / TILE)) : undefined;
  }

  private workerUnder(p: Phaser.Input.Pointer): Worker | undefined {
    const id = this.world3d.objectAt(this.world3d.workers, 'workerId', p.x, p.y);
    return id !== undefined ? this.workers.get(id) : undefined;
  }

  /**
   * Without a build tool, clicks select things. With a worker selected,
   * clicking a matching building moves them there; cleaners are sent to the
   * clicked path.
   */
  private handleSelectClick(p: Phaser.Input.Pointer, w: { x: number; y: number } | null): void {
    const worker = this.workerUnder(p);
    const hit = worker ? undefined : this.buildingUnder(p, w);
    // Paths are ground, not something to select.
    const building = hit?.def.walkable ? undefined : hit;
    const sel = state.selection;
    const member = sel?.kind === 'staff' ? state.staff.get(sel.id) : undefined;

    if (member && !worker && w) {
      if (member.role === 'cleaner') {
        const cell = { tx: Math.floor(w.x / TILE), ty: Math.floor(w.y / TILE) };
        if (state.isWalkable(cell.tx, cell.ty) && !building) {
          state.setFocus(member.id, cell);
          this.floatText(w.x, w.y, STR.cleanHere, COLORS.uiGreen, 13);
          return;
        }
      } else if (building?.def.staff?.includes(member.role)) {
        state.assign(member.id, building.uid);
        this.floatText(w.x, w.y, STR.assigned, COLORS.uiGreen, 13);
        return;
      }
    }

    if (worker) state.select({ kind: 'staff', id: worker.id });
    else if (building) state.select({ kind: 'building', uid: building.uid });
    else state.select(null);
  }

  /** Outline of the selected building; square around the selected worker, its post and its cleaning area. */
  private drawSelection(): void {
    const sel = state.selection;
    this.selRect.hide();
    this.postRect.hide();
    this.focusRect.hide();
    if (!sel) return;
    if (sel.kind === 'building') {
      const b = state.buildings.get(sel.uid);
      if (b) this.selRect.show(b.tx, b.ty, b.def.w, b.def.h);
      return;
    }
    const m = state.staff.get(sel.id);
    const view = this.workerViews.find((v) => v.worker.id === sel.id && !v.done);
    if (view && view.worker.visible) {
      const g = view.groundPos;
      this.selRect.show(g.x - 0.35, g.z - 0.35, 0.7, 0.7);
    }
    const post = m?.post != null ? state.buildings.get(m.post) : undefined;
    if (post) this.postRect.show(post.tx, post.ty, post.def.w, post.def.h);
    if (m?.focus) {
      const r = 3;
      this.focusRect.show(m.focus.tx - r, m.focus.ty - r, 2 * r + 1, 2 * r + 1);
    }
  }

  /** Centre the camera on a worker (used by the workers tab). */
  focusWorker(id: number): void {
    const w = this.workers.get(id);
    if (w?.isAwake) this.world3d.lookAt(w.position.x, w.position.y);
  }

  /** Preview while building, red outline while demolishing, soft outline on hover. */
  private updateHover(): void {
    const p = this.input.activePointer;
    const tool = state.tool;
    this.hoverRect.hide();
    const blocked = this.isOverUI(p) || (this.drag?.moved && !this.drag.painting);
    const w = blocked ? null : this.groundAt(p);
    if (!tool || !w) {
      this.ghost.hide();
      if (!tool && w) {
        const b = this.workerUnder(p) ? undefined : this.buildingUnder(p, w);
        if (b && !b.def.walkable) this.hoverRect.show(b.tx, b.ty, b.def.w, b.def.h, 0xf2b45a);
      }
      return;
    }

    if (tool.kind === 'build') {
      const def = orient(getBuilding(tool.id), state.buildRot);
      const { tx, ty } = this.placementCell(def, w.x, w.y);
      const ok = state.checkPlace(def, tx, ty) === 'ok' && state.canAfford(state.buildCost(def));
      const doors = doorCellsFor(def, tx, ty, state.buildRot).map((d) => ({ ...d, walkable: state.isWalkable(d.tx, d.ty) }));
      this.ghost.show(def, state.buildRot, tx, ty, ok, doors);
      return;
    }

    this.ghost.hide();
    const b = this.buildingUnder(p, w);
    if (b) this.hoverRect.show(b.tx, b.ty, b.def.w, b.def.h, 0xff6b6b);
  }
}
