/**
 * 3D views: they read the logic objects (buildings, spirits, workers,
 * ferries, restaurants) every frame and draw them in the World3D.
 * Fading in and out and burning in the sun happen only here.
 */
import * as THREE from 'three';
import { TILE } from '../config';
import { getBuilding } from '../data/buildings';
import type { Ferry } from '../entities/Ferry';
import type { Restaurant, StaffFigure } from '../entities/Restaurant';
import type { Spirit } from '../entities/Spirit';
import type { Worker } from '../entities/Worker';
import type { GameState, PlacedBuilding } from '../state/GameState';
import type { Label } from './labels';
import { boat, buildModel, doormat, ghostify, litter, pathTile, plate, slime, spiritFigure, workerFigure, type Figure, type LampSpot } from './models';
import type { World3D } from './World3D';

/** Model faces south; rot turns it so its front faces west, north or east. */
const TURN = [0, -Math.PI / 2, Math.PI, Math.PI / 2];
/** Feet of a figure: world pixels → units (figures stand a bit below the cell centre in 2D). */
const px = (v: number) => v / TILE;

/** Register a model's lamps with the world (in world coordinates). */
function addLamps(world: World3D, model: THREE.Object3D): Array<ReturnType<World3D['addLamp']>> {
  model.updateMatrixWorld(true);
  const spots = (model.userData.lamps ?? []) as LampSpot[];
  return spots.map((s) => world.addLamp(s.pos.clone().applyMatrix4(model.matrixWorld), s.color, s.power, s.distance));
}

// ---------------------------------------------------------------------------
// buildings
// ---------------------------------------------------------------------------

export class BuildingView3D {
  readonly model: THREE.Object3D;
  private mats: THREE.Mesh[] = [];
  private lamps: Array<ReturnType<World3D['addLamp']>>;
  readonly badge?: Label;
  /** Stalls: the worker figure behind the counter. */
  private clerk?: Figure;
  private grow = 0;

  constructor(
    private world: World3D,
    private state: GameState,
    readonly b: PlacedBuilding,
    animate: boolean,
  ) {
    const { def } = b;
    if (def.id === 'path') {
      this.model = pathTile();
      this.model.position.set(b.tx + 0.5, 0, b.ty + 0.5);
    } else {
      // Models are built in their base size and turned; restaurants keep their size and move their doors.
      const model = buildModel(def.restaurant || def.crossing ? def : getBuilding(def.id), b.rot);
      model.position.set(b.tx + def.w / 2, 0, b.ty + def.h / 2);
      if (!def.restaurant && !def.crossing) model.rotation.y = TURN[b.rot];
      this.model = model;
      if (def.style === 'stall' && def.staff?.[0]) {
        this.clerk = workerFigure(def.staff[0]);
        this.clerk.group.position.set(0, 0, 0);
        this.clerk.group.scale.setScalar(0.85);
        this.clerk.group.visible = false;
        model.add(this.clerk.group);
      }
    }
    this.model.userData.uid = b.uid;
    world.buildings.add(this.model);
    this.lamps = addLamps(world, this.model);

    for (const c of state.doorCells(b)) {
      const mat = doormat();
      mat.position.x = c.tx + 0.5;
      mat.position.z = c.ty + 0.5;
      world.scene.add(mat);
      this.mats.push(mat);
    }
    if (def.staff || def.provides) {
      this.badge = world.labels.add('badge');
      this.badge.pos.set(b.tx + def.w / 2, 1.9 + (def.restaurant ? 0.2 : 0), b.ty + def.h / 2);
    }
    if (animate && def.id !== 'path') {
      this.grow = 1;
      this.model.scale.set(1.08, 0.6, 1.08);
    }
  }

  update(dt: number): void {
    if (this.grow > 0) {
      this.grow = Math.max(0, this.grow - dt * 4);
      const t = 1 - this.grow;
      this.model.scale.set(1.08 - 0.08 * t, 0.6 + 0.4 * t, 1.08 - 0.08 * t);
    }
    if (this.clerk) {
      const role = this.b.def.staff?.[0];
      this.clerk.group.visible = !!role && this.state.onDutyCount(this.b.uid, role) > 0;
    }
  }

  setBadge(text: string): void {
    if (this.badge) this.world.labels.setText(this.badge, text);
  }

  destroy(): void {
    this.world.buildings.remove(this.model);
    for (const m of this.mats) this.world.scene.remove(m);
    for (const l of this.lamps) this.world.removeLamp(l);
    if (this.badge) this.world.labels.remove(this.badge);
  }
}

// ---------------------------------------------------------------------------
// figures
// ---------------------------------------------------------------------------

/** Turns a figure smoothly towards where it moves. */
function face(g: THREE.Object3D, x: number, z: number, last: THREE.Vector2, fallbackLeft: boolean): void {
  const dx = x - last.x;
  const dz = z - last.y;
  if (dx * dx + dz * dz > 1e-6) {
    const target = Math.atan2(dx, dz);
    let d = target - g.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    g.rotation.y += d * 0.25;
  } else if (last.x === 0 && last.y === 0) g.rotation.y = fallbackLeft ? -Math.PI / 2 : 0;
  last.set(x, z);
}

export class SpiritView3D {
  private fig: Figure;
  private bubble: Label;
  private last = new THREE.Vector2();
  private fade = 0;
  private ending: 'safe' | 'lost' | null = null;
  private endT = 0;
  done = false;

  constructor(
    private world: World3D,
    readonly spirit: Spirit,
  ) {
    this.fig = spiritFigure(spirit.tint, spirit.scale, spirit.alpha);
    if (spirit.slimy) this.fig.mats[0].emissive.set('#7fe08a');
    for (const m of this.fig.mats) {
      m.transparent = true;
      m.opacity = 0;
    }
    world.scene.add(this.fig.group);
    this.bubble = world.labels.add('bubble');
  }

  update(dt: number, time: number): void {
    const s = this.spirit;
    if (!this.ending && s.ended) {
      this.ending = s.ended;
      this.world.labels.setText(this.bubble, '');
      if (this.ending === 'lost') {
        for (const m of this.fig.mats) {
          m.color.set('#ffb070');
          m.emissive.set('#ff7a2c');
          m.emissiveIntensity = 1;
        }
      }
    }
    if (this.ending) {
      this.endT += dt;
      const dur = this.ending === 'safe' ? 0.5 : 1.4;
      const t = Math.min(1, this.endT / dur);
      for (const m of this.fig.mats) m.opacity = s.alpha * (1 - t);
      if (this.ending === 'lost') this.fig.group.position.y += dt * 0.6 * (1 + t * 3);
      if (t >= 1) this.destroy();
      return;
    }
    this.fade = Math.min(1, this.fade + dt / 0.7);
    for (const m of this.fig.mats) m.opacity = s.alpha * this.fade;
    const p = s.drawPos;
    const x = px(p.x);
    const z = px(p.y) + 0.1;
    const bob = Math.sin(time / 320 + s.seed) * 0.05;
    this.fig.group.position.set(x, 0.02 + bob + (s.onBoat ? 0.15 : 0), z);
    face(this.fig.group, x, z, this.last, s.facingLeft);
    this.world.labels.setText(this.bubble, s.icon);
    this.bubble.pos.set(x, 1.05 * s.scale + bob, z);
  }

  destroy(): void {
    this.done = true;
    this.world.scene.remove(this.fig.group);
    this.world.labels.remove(this.bubble);
  }
}

export class WorkerView3D {
  private fig: Figure;
  private badge: Label;
  private last = new THREE.Vector2();
  private appearances: number;
  private fade = 1;
  private ending: 'lost' | 'gone' | null = null;
  private endT = 0;
  done = false;

  constructor(
    private world: World3D,
    readonly worker: Worker,
  ) {
    this.fig = workerFigure(worker.role);
    for (const m of this.fig.mats) m.transparent = true;
    this.fig.group.userData.workerId = worker.id;
    this.fig.group.visible = false;
    world.workers.add(this.fig.group);
    this.badge = world.labels.add('badge small');
    this.appearances = worker.appearances;
  }

  update(dt: number, time: number): void {
    const w = this.worker;
    if (!this.ending && w.ended) {
      this.ending = w.ended;
      this.world.labels.setText(this.badge, '');
      if (this.ending === 'gone' && !w.fadesOut) {
        this.destroy();
        return;
      }
      if (this.ending === 'lost') for (const m of this.fig.mats) m.color.set('#ffb070');
    }
    if (this.ending) {
      this.endT += dt;
      const dur = this.ending === 'gone' ? 0.5 : 1.4;
      const t = Math.min(1, this.endT / dur);
      for (const m of this.fig.mats) m.opacity = 1 - t;
      if (this.ending === 'lost') this.fig.group.position.y += dt * 0.6 * (1 + t * 3);
      if (t >= 1) this.destroy();
      return;
    }
    if (w.appearances !== this.appearances) {
      this.appearances = w.appearances;
      this.fade = 0;
    }
    this.fade = Math.min(1, this.fade + dt / 0.5);
    for (const m of this.fig.mats) m.opacity = this.fade;
    const visible = w.visible;
    this.fig.group.visible = visible;
    if (!visible) {
      this.world.labels.setText(this.badge, '');
      return;
    }
    const p = w.position;
    const x = px(p.x);
    const z = px(p.y) + 0.1;
    const bob = Math.sin(time / (w.moving ? 160 : 400) + w.seed) * (w.moving ? 0.04 : 0.02);
    this.fig.group.position.set(x, bob + (w.onBoat ? 0.15 : 0), z);
    face(this.fig.group, x, z, this.last, w.facingLeft);
    this.world.labels.setText(this.badge, w.icon);
    this.badge.pos.set(x, 1.05 + bob, z);
  }

  /** World position of the figure (for the selection ring). */
  get groundPos(): THREE.Vector3 {
    return this.fig.group.position;
  }

  destroy(): void {
    this.done = true;
    this.world.workers.remove(this.fig.group);
    this.world.labels.remove(this.badge);
  }
}

export class FerryView3D {
  private boat: THREE.Group;
  private lamps: Array<ReturnType<World3D['addLamp']>> = [];

  constructor(
    private world: World3D,
    readonly ferry: Ferry,
  ) {
    this.boat = boat(ferry.building.def);
    world.scene.add(this.boat);
    this.update();
  }

  update(): void {
    this.boat.position.set(px(this.ferry.boatX), 0, px(this.ferry.boatY));
  }

  destroy(): void {
    this.world.scene.remove(this.boat);
    for (const l of this.lamps) this.world.removeLamp(l);
  }
}

/** Cooks and waiters inside a restaurant, with the dishes they carry. */
export class RestaurantStaffView3D {
  private figures = new Map<StaffFigure, { fig: Figure; plate: THREE.Mesh; last: THREE.Vector2 }>();

  constructor(
    private world: World3D,
    readonly restaurant: Restaurant,
  ) {}

  update(time: number): void {
    const now = new Set(this.restaurant.figures);
    for (const [f, v] of this.figures) {
      if (now.has(f)) continue;
      this.world.scene.remove(v.fig.group);
      this.figures.delete(f);
    }
    for (const f of now) {
      let v = this.figures.get(f);
      if (!v) {
        const fig = workerFigure(f.role);
        fig.group.scale.setScalar(0.9);
        const p = plate();
        p.position.set(0.18, 0.62, 0.1);
        fig.group.add(p);
        this.world.scene.add(fig.group);
        v = { fig, plate: p, last: new THREE.Vector2() };
        this.figures.set(f, v);
      }
      const x = px(f.x);
      const z = px(f.y);
      const bob = Math.sin(time / (f.busy ? 120 : 300) + f.x) * 0.03;
      v.fig.group.position.set(x, bob, z);
      face(v.fig.group, x, z, v.last, f.facingLeft);
      v.plate.visible = f.plate;
    }
  }

  destroy(): void {
    for (const v of this.figures.values()) this.world.scene.remove(v.fig.group);
    this.figures.clear();
  }
}

/** Litter and slime on one path cell. */
export class DirtView3D {
  private litter?: THREE.Group;
  private slime?: THREE.Group;

  constructor(
    private world: World3D,
    private tx: number,
    private ty: number,
  ) {}

  /** Returns false once the cell is clean (the view can be dropped). */
  set(litterAmount: number, slimeAmount: number): boolean {
    const place = (g: THREE.Group | undefined, amount: number, make: () => THREE.Group) => {
      if (amount <= 0) {
        if (g) this.world.scene.remove(g);
        return undefined;
      }
      const out = g ?? make();
      out.position.set(this.tx + 0.5, 0, this.ty + 0.5);
      out.scale.setScalar(0.6 + 0.2 * amount);
      if (!g) this.world.scene.add(out);
      return out;
    };
    this.litter = place(this.litter, litterAmount, litter);
    this.slime = place(this.slime, slimeAmount, slime);
    return !!(this.litter || this.slime);
  }
}

// ---------------------------------------------------------------------------
// placement preview and selection
// ---------------------------------------------------------------------------

/** A flat rectangle outline on the ground. */
export class GroundRect {
  readonly group = new THREE.Group();
  private mat: THREE.MeshBasicMaterial;

  constructor(world: World3D, color: number, private thickness = 0.06) {
    this.mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false });
    for (let i = 0; i < 4; i++) this.group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 0.03, 1), this.mat));
    this.group.visible = false;
    world.scene.add(this.group);
  }

  show(x: number, z: number, w: number, d: number, color?: number): void {
    if (color !== undefined) this.mat.color.setHex(color);
    const t = this.thickness;
    const [top, bottom, left, right] = this.group.children as THREE.Mesh[];
    top.scale.set(w, 1, t);
    top.position.set(x + w / 2, 0.06, z);
    bottom.scale.set(w, 1, t);
    bottom.position.set(x + w / 2, 0.06, z + d);
    left.scale.set(t, 1, d);
    left.position.set(x, 0.06, z + d / 2);
    right.scale.set(t, 1, d);
    right.position.set(x + w, 0.06, z + d / 2);
    this.group.visible = true;
  }

  hide(): void {
    this.group.visible = false;
  }
}

/** See-through model, footprint and door markers while placing a building. */
export class Ghost {
  private model?: THREE.Object3D;
  private key = '';
  private area: THREE.Mesh;
  private areaMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.25, depthWrite: false });
  private doors: THREE.Mesh[] = [];
  private doorGeo = new THREE.PlaneGeometry(0.5, 0.5);

  constructor(private world: World3D) {
    this.area = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.areaMat);
    this.area.rotation.x = -Math.PI / 2;
    this.area.visible = false;
    world.scene.add(this.area);
  }

  show(def: import('../data/buildings').BuildingDef, rot: number, tx: number, ty: number, ok: boolean, doors: Array<{ tx: number; ty: number; walkable: boolean }>): void {
    const color = ok ? 0x8fe3a8 : 0xff6b6b;
    const key = `${def.id}|${rot}|${ok}`;
    if (key !== this.key) {
      if (this.model) this.world.scene.remove(this.model);
      const base = def.restaurant || def.crossing ? def : getBuilding(def.id);
      this.model = def.id === 'path' ? pathTile() : buildModel(base, rot);
      if (!def.restaurant && !def.crossing && def.id !== 'path') this.model.rotation.y = TURN[rot];
      ghostify(this.model, color);
      this.world.scene.add(this.model);
      this.key = key;
    }
    this.model!.position.set(tx + def.w / 2, 0.02, ty + def.h / 2);
    if (def.id === 'path') this.model!.position.set(tx + 0.5, 0.02, ty + 0.5);
    this.model!.visible = true;
    this.areaMat.color.setHex(color);
    this.area.scale.set(def.w, def.h, 1);
    this.area.position.set(tx + def.w / 2, 0.05, ty + def.h / 2);
    this.area.visible = true;
    while (this.doors.length < doors.length) {
      const m = new THREE.Mesh(this.doorGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.6, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      this.world.scene.add(m);
      this.doors.push(m);
    }
    this.doors.forEach((m, i) => {
      const d = doors[i];
      m.visible = !!d;
      if (!d) return;
      (m.material as THREE.MeshBasicMaterial).color.setHex(d.walkable ? 0x8fe3a8 : 0xf2b45a);
      m.position.set(d.tx + 0.5, 0.07, d.ty + 0.5);
    });
  }

  hide(): void {
    if (this.model) this.model.visible = false;
    this.area.visible = false;
    for (const d of this.doors) d.visible = false;
  }
}
