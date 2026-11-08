import * as Phaser from 'phaser';
import { SPIRIT_SPEED, TILE } from '../config';
import { TEX } from '../gfx/textures';
import type { GameState } from '../state/GameState';
import { cellsInRange, distanceTo, floodFrom, pathTo, type Cell } from '../state/pathfinding';

const TINTS = [0xffffff, 0xd8e6ff, 0xe6d8ff, 0xd8fff0, 0xfff0d8, 0xffdbe8];

type Phase = 'arriving' | 'walking' | 'idle' | 'leaving' | 'gone';

/** World position of a spirit's feet when standing on a cell. */
function cellToWorld(c: Cell): { x: number; y: number } {
  return { x: c.tx * TILE + TILE / 2, y: c.ty * TILE + TILE * 0.72 };
}

/**
 * A wandering spirit guest. For now it only strolls around the market,
 * pauses near buildings and eventually leaves through the gate again.
 */
export class Spirit {
  private body: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private x: number;
  private y: number;
  private path: Cell[] = [];
  private phase: Phase = 'arriving';
  private idleMs = 600;
  private legsLeft: number;
  private readonly seed = Math.random() * 1000;
  private readonly speed = SPIRIT_SPEED * Phaser.Math.FloatBetween(0.8, 1.2);

  constructor(
    private scene: Phaser.Scene,
    private state: GameState,
    start: Cell,
  ) {
    const p = cellToWorld(start);
    this.x = p.x;
    this.y = p.y;
    this.legsLeft = Phaser.Math.Between(3, 6);

    this.shadow = scene.add.image(this.x, this.y, TEX.shadow).setAlpha(0);
    this.body = scene.add
      .image(this.x, this.y, TEX.spirit)
      .setOrigin(0.5, 1)
      .setTint(Phaser.Utils.Array.GetRandom(TINTS))
      .setAlpha(0);

    scene.tweens.add({ targets: this.body, alpha: 0.9, duration: 700 });
    scene.tweens.add({ targets: this.shadow, alpha: 1, duration: 700 });
  }

  get isGone(): boolean {
    return this.phase === 'gone';
  }

  private get cell(): Cell {
    return { tx: Math.floor(this.x / TILE), ty: Math.floor(this.y / TILE) };
  }

  /** Called when buildings change, so the spirit never walks through a new one. */
  onGridChanged(): void {
    if (this.path.some((c) => !this.state.isWalkable(c.tx, c.ty))) {
      this.path = [];
      if (this.phase === 'walking' || this.phase === 'leaving') this.planNextLeg(this.phase === 'leaving');
    }
  }

  update(time: number, delta: number): void {
    if (this.phase === 'gone') return;

    if (this.phase === 'arriving' || this.phase === 'idle') {
      this.idleMs -= delta;
      if (this.idleMs <= 0) this.planNextLeg(false);
    } else {
      this.walk(delta);
    }

    // Gentle floating.
    const bob = Math.sin(time / 320 + this.seed) * 3;
    this.body.setPosition(this.x, this.y - 4 + bob);
    this.shadow.setPosition(this.x, this.y).setScale(1 - bob * 0.04);
    this.body.setDepth(this.y);
    this.shadow.setDepth(this.y - 0.5);
  }

  private walk(delta: number): void {
    const next = this.path[0];
    if (!next) {
      if (this.phase === 'leaving') this.vanish();
      else {
        this.phase = 'idle';
        this.idleMs = Phaser.Math.Between(1200, 3200);
      }
      return;
    }
    const target = cellToWorld(next);
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);
    const step = (this.speed * delta) / 1000;
    if (Math.abs(dx) > 0.5) this.body.setFlipX(dx < 0);
    if (dist <= step) {
      this.x = target.x;
      this.y = target.y;
      this.path.shift();
    } else {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    }
  }

  /** Pick where to go next: a building to look at, a random spot, or home. */
  private planNextLeg(forceLeave: boolean): void {
    const field = floodFrom(this.cell, (tx, ty) => this.state.isWalkable(tx, ty));

    const leaving = forceLeave || this.legsLeft <= 0;
    if (leaving) {
      const exits = this.state.spawnCells.filter((c) => distanceTo(field, c) >= 0);
      const exit = exits.length ? Phaser.Utils.Array.GetRandom(exits) : null;
      const path = exit ? pathTo(field, exit) : null;
      if (path) {
        this.phase = 'leaving';
        this.path = path;
      } else {
        // Trapped by buildings: wait and try again.
        this.phase = 'idle';
        this.idleMs = 1500;
      }
      return;
    }

    this.legsLeft--;
    const target = this.pickTarget(field);
    const path = target ? pathTo(field, target) : null;
    if (path && path.length > 0) {
      this.phase = 'walking';
      this.path = path;
    } else {
      this.phase = 'idle';
      this.idleMs = 1200;
    }
  }

  private pickTarget(field: ReturnType<typeof floodFrom>): Cell | null {
    // Prefer a free cell next to a random building.
    const buildings = [...this.state.buildings.values()];
    if (buildings.length && Math.random() < 0.65) {
      const b = Phaser.Utils.Array.GetRandom(buildings);
      const around: Cell[] = [];
      for (let x = b.tx - 1; x <= b.tx + b.def.w; x++) {
        around.push({ tx: x, ty: b.ty + b.def.h }, { tx: x, ty: b.ty - 1 });
      }
      for (let y = b.ty; y < b.ty + b.def.h; y++) {
        around.push({ tx: b.tx - 1, ty: y }, { tx: b.tx + b.def.w, ty: y });
      }
      const reachable = around.filter((c) => this.state.inBounds(c.tx, c.ty) && distanceTo(field, c) > 0);
      if (reachable.length) return Phaser.Utils.Array.GetRandom(reachable);
    }
    const cells = cellsInRange(field, 3, 14);
    return cells.length ? Phaser.Utils.Array.GetRandom(cells) : null;
  }

  private vanish(): void {
    this.phase = 'gone';
    this.scene.tweens.add({
      targets: [this.body, this.shadow],
      alpha: 0,
      duration: 600,
      onComplete: () => this.destroy(),
    });
  }

  destroy(): void {
    this.phase = 'gone';
    this.body.destroy();
    this.shadow.destroy();
  }
}
