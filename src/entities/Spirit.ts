import * as Phaser from 'phaser';
import { DEPTH, FONT_UI, SPIRIT_SPEED, TILE, VISIT_MS } from '../config';
import { NEEDS, type Need } from '../data/buildings';
import { STR } from '../data/strings';
import { TEX } from '../gfx/textures';
import type { GameState } from '../state/GameState';
import { cellsInRange, cheapest, costTo, pathTo, searchFrom, type Cell, type Field } from '../state/pathfinding';

export type SpiritKind = 'wisp' | 'elder' | 'sprite';

const KINDS: Record<SpiritKind, { speed: number; scale: number; tints: number[] }> = {
  wisp: { speed: 1, scale: 1, tints: [0xffffff, 0xd8e6ff, 0xe6d8ff, 0xd8fff0, 0xffdbe8] },
  elder: { speed: 0.55, scale: 1.2, tints: [0xb8c0d0, 0xc4bccb] },
  sprite: { speed: 1.35, scale: 0.8, tints: [0xfff0c8, 0xd0fff4] },
};

export function randomKind(): SpiritKind {
  const r = Math.random();
  return r < 0.6 ? 'wisp' : r < 0.85 ? 'elder' : 'sprite';
}

type Goal =
  | { kind: 'visit'; uid: number; need: Need }
  | { kind: 'hotel'; uid: number }
  | { kind: 'gate' }
  | { kind: 'wander' };

type Phase = 'waiting' | 'walking' | 'visiting' | 'safe' | 'lost';

/** World position of a spirit's feet when standing on a cell. */
function cellToWorld(c: Cell): { x: number; y: number } {
  return { x: c.tx * TILE + TILE / 2, y: c.ty * TILE + TILE * 0.72 };
}

/**
 * A spirit guest. At night it works through its needs (visiting stalls and
 * paying), then heads for a hotel bed or the gate. At dawn it drops
 * everything and hurries home; if the sun catches it outside, it is lost.
 */
export class Spirit {
  readonly kind: SpiritKind;
  private body: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private aura: Phaser.GameObjects.Image;
  private bubble: Phaser.GameObjects.Text;

  private x: number;
  private y: number;
  private path: Cell[] = [];
  private phase: Phase = 'waiting';
  private goal: Goal | null = null;
  private waitMs: number;

  private needs: Need[];
  private readonly totalNeeds: number;
  private met = 0;

  private readonly seed = Math.random() * 1000;
  private readonly speed: number;

  constructor(
    private scene: Phaser.Scene,
    private state: GameState,
    glowLayer: Phaser.GameObjects.Layer,
    start: Cell,
    kind: SpiritKind = randomKind(),
    delayMs = 600,
  ) {
    this.kind = kind;
    const k = KINDS[kind];
    this.speed = SPIRIT_SPEED * k.speed * Phaser.Math.FloatBetween(0.9, 1.1);
    this.waitMs = delayMs;

    // 2–3 different needs for tonight.
    this.needs = Phaser.Utils.Array.Shuffle([...NEEDS]).slice(0, Phaser.Math.Between(2, 3));
    this.totalNeeds = this.needs.length;

    const p = cellToWorld(start);
    this.x = p.x;
    this.y = p.y;

    this.shadow = scene.add.image(this.x, this.y, TEX.shadow).setAlpha(0).setScale(k.scale);
    this.body = scene.add
      .image(this.x, this.y, TEX.spirit)
      .setOrigin(0.5, 1)
      .setScale(k.scale)
      .setTint(Phaser.Utils.Array.GetRandom(k.tints))
      .setAlpha(0);
    this.aura = scene.add
      .image(this.x, this.y, TEX.glow)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(0x9fc4ff)
      .setScale(0.32 * k.scale)
      .setAlpha(0);
    glowLayer.add(this.aura);
    this.bubble = scene.add
      .text(this.x, this.y, '', {
        fontFamily: FONT_UI,
        fontSize: '13px',
        backgroundColor: 'rgba(16,18,32,0.7)',
        padding: { x: 3, y: 1 },
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.glow + 10)
      .setVisible(false);

    scene.tweens.add({ targets: [this.body], alpha: 0.92, duration: 700 });
    scene.tweens.add({ targets: [this.shadow, this.aura], alpha: 1, duration: 700 });
  }

  /** True once the spirit is home or lost; the scene can drop it. */
  get isDone(): boolean {
    return this.phase === 'safe' || this.phase === 'lost';
  }

  private get cell(): Cell {
    return { tx: Math.floor(this.x / TILE), ty: Math.floor(this.y / TILE) };
  }

  private get satisfaction(): number {
    return this.met / Math.max(1, this.totalNeeds);
  }

  private get headingHome(): boolean {
    return this.goal?.kind === 'hotel' || this.goal?.kind === 'gate';
  }

  // ---------------------------------------------------------------------------

  update(time: number, delta: number): void {
    if (this.isDone) return;

    if (this.state.isDawn && !this.headingHome && this.phase !== 'visiting') this.goHome();

    if (this.phase === 'waiting') {
      this.waitMs -= delta;
      if (this.waitMs <= 0) this.decide();
    } else if (this.phase === 'visiting') {
      this.waitMs -= delta;
      if (this.waitMs <= 0) this.finishVisit();
    } else if (this.phase === 'walking') {
      this.walk(delta);
    }

    this.render(time);
  }

  private render(time: number): void {
    const bob = Math.sin(time / 320 + this.seed) * 3;
    const k = KINDS[this.kind].scale;
    this.body.setPosition(this.x, this.y - 4 + bob).setDepth(this.y);
    this.shadow.setPosition(this.x, this.y).setScale(k * (1 - bob * 0.04)).setDepth(this.y - 0.5);
    this.aura.setPosition(this.x, this.y - 20 * k + bob);

    let icon = '';
    if (this.headingHome) icon = STR.homeIcon;
    else if (this.needs.length > 0) icon = STR.needIcons[this.needs[0]];
    this.bubble.setText(icon).setVisible(icon !== '').setPosition(this.x, this.y - 44 * k + bob);
  }

  /** Called whenever buildings change, so spirits never walk through new ones. */
  onGridChanged(): void {
    if (this.isDone || !this.goal) return;
    const goal = this.goal;
    const targetGone = (goal.kind === 'visit' || goal.kind === 'hotel') && !this.state.buildings.has(goal.uid);
    const blocked = this.path.some((c) => !this.state.isWalkable(c.tx, c.ty));
    if (!targetGone && !blocked) return;

    if (this.phase === 'visiting' && !targetGone) return;
    this.path = [];
    if (goal.kind === 'hotel' || goal.kind === 'gate') this.goHome();
    else this.decide();
  }

  // ---------------------------------------------------------------------------
  // decisions
  // ---------------------------------------------------------------------------

  private search(): Field {
    return searchFrom(this.cell, this.state.travelCost);
  }

  private wait(ms: number): void {
    this.phase = 'waiting';
    this.waitMs = ms;
  }

  private walkTo(goal: Goal, field: Field, target: Cell): boolean {
    const path = pathTo(field, target);
    if (!path) return false;
    this.goal = goal;
    this.path = path;
    this.phase = 'walking';
    return true;
  }

  /** Pick the next need and walk to the cheapest building that satisfies it. */
  private decide(): void {
    if (this.state.isDawn || this.needs.length === 0) {
      this.goHome();
      return;
    }
    const need = this.needs[0];
    const field = this.search();

    let best: { uid: number; cell: Cell; cost: number } | null = null;
    for (const b of this.state.providersOf(need)) {
      const cell = cheapest(field, this.state.entranceCells(b));
      if (!cell) continue;
      const cost = costTo(field, cell);
      if (!best || cost < best.cost) best = { uid: b.uid, cell, cost };
    }

    if (best && this.walkTo({ kind: 'visit', uid: best.uid, need }, field, best.cell)) return;

    // Nothing reachable provides this need: give up on it and stroll a bit.
    this.needs.shift();
    const spots = cellsInRange(field, 2, 6);
    if (spots.length && this.walkTo({ kind: 'wander' }, field, Phaser.Utils.Array.GetRandom(spots))) return;
    this.wait(800);
  }

  /** Head for a free hotel bed or the gate, whichever makes sense. */
  private goHome(): void {
    if (this.goal?.kind === 'hotel') this.state.releaseBed(this.goal.uid);
    this.goal = null;
    const field = this.search();

    let hotel: { uid: number; cell: Cell; cost: number } | null = null;
    for (const h of this.state.hotels()) {
      if (this.state.freeBeds(h.uid) <= 0) continue;
      const cell = cheapest(field, this.state.entranceCells(h));
      if (!cell) continue;
      const cost = costTo(field, cell);
      if (!hotel || cost < hotel.cost) hotel = { uid: h.uid, cell, cost };
    }
    const gateCell = cheapest(field, this.state.gateCells);
    const gateCost = gateCell ? costTo(field, gateCell) : Infinity;

    // Prefer sleeping in a hotel; at dawn take whatever is closer.
    const useHotel = hotel !== null && (!this.state.isDawn || hotel.cost <= gateCost);
    if (useHotel && hotel && this.state.reserveBed(hotel.uid)) {
      if (this.walkTo({ kind: 'hotel', uid: hotel.uid }, field, hotel.cell)) return;
      this.state.releaseBed(hotel.uid);
    }
    if (gateCell && this.walkTo({ kind: 'gate' }, field, gateCell)) return;

    // Trapped: try again soon.
    this.wait(1000);
  }

  // ---------------------------------------------------------------------------
  // movement and arrival
  // ---------------------------------------------------------------------------

  private walk(delta: number): void {
    const next = this.path[0];
    if (!next) {
      this.arrive();
      return;
    }
    const target = cellToWorld(next);
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);
    const here = this.cell;
    const step = (this.speed * this.state.speedAt(here.tx, here.ty) * delta) / 1000;
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

  private arrive(): void {
    const goal = this.goal;
    if (!goal || goal.kind === 'wander') {
      this.wait(Phaser.Math.Between(300, 900));
      return;
    }
    if (goal.kind === 'visit') {
      if (this.state.buildings.has(goal.uid)) {
        this.phase = 'visiting';
        this.waitMs = VISIT_MS;
      } else this.decide();
      return;
    }
    if (goal.kind === 'hotel') {
      if (!this.state.buildings.has(goal.uid)) {
        this.goHome();
        return;
      }
      this.state.checkIn(goal.uid);
    }
    this.state.recordSafe(this.satisfaction);
    this.leave();
  }

  private finishVisit(): void {
    const goal = this.goal;
    if (goal?.kind !== 'visit') {
      this.decide();
      return;
    }
    const b = this.state.buildings.get(goal.uid);
    if (b?.def.provides) {
      this.state.earn(b.def.provides.price, this.cell);
      this.met++;
      this.needs = this.needs.filter((n) => n !== goal.need);
    }
    this.goal = null;
    this.wait(250);
  }

  /** Fade out safely (into a hotel or through the gate). */
  private leave(): void {
    this.phase = 'safe';
    this.bubble.setVisible(false);
    this.scene.tweens.add({
      targets: [this.body, this.shadow, this.aura],
      alpha: 0,
      duration: 500,
      onComplete: () => this.destroy(),
    });
  }

  /** Caught by the sun. */
  burn(): void {
    if (this.isDone) return;
    if (this.goal?.kind === 'hotel') this.state.releaseBed(this.goal.uid);
    this.phase = 'lost';
    this.bubble.setVisible(false);
    this.body.setTint(0xffb070);
    this.aura.setTint(0xffa050);
    this.scene.tweens.add({
      targets: [this.body, this.aura],
      y: '-=40',
      alpha: 0,
      duration: 1400,
      ease: 'Cubic.In',
    });
    this.scene.tweens.add({
      targets: this.shadow,
      alpha: 0,
      duration: 1400,
      onComplete: () => this.destroy(),
    });
  }

  /** World position, e.g. for floating texts. */
  get position(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  destroy(): void {
    this.body.destroy();
    this.shadow.destroy();
    this.aura.destroy();
    this.bubble.destroy();
  }
}
