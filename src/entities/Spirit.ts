import * as Phaser from 'phaser';
import { DEPTH, FONT_UI, SPIRIT_SPEED, VISIT_MS } from '../config';
import { NEEDS, type Need } from '../data/buildings';
import { DIRT, HOLD_MS } from '../data/staff';
import { STR } from '../data/strings';
import { TEX } from '../gfx/textures';
import type { GameState } from '../state/GameState';
import { cellsInRange, cheapest, costTo, pathTo, type Cell, type Field } from '../state/pathfinding';
import { Walker, type WalkerWorld } from './Walker';

export type SpiritKind = 'wisp' | 'elder' | 'sprite' | 'ooze';

const KINDS: Record<SpiritKind, { speed: number; scale: number; alpha: number; tints: number[] }> = {
  wisp: { speed: 1, scale: 1, alpha: 0.92, tints: [0xffffff, 0xd8e6ff, 0xe6d8ff, 0xd8fff0, 0xffdbe8] },
  elder: { speed: 0.55, scale: 1.2, alpha: 0.92, tints: [0xb8c0d0, 0xc4bccb] },
  sprite: { speed: 1.35, scale: 0.8, alpha: 0.92, tints: [0xfff0c8, 0xd0fff4] },
  /** Slimy guest: leaves trails on the paths and does not mind dirt itself. */
  ooze: { speed: 0.8, scale: 1.05, alpha: 0.82, tints: [0x9fe8a0, 0xb8f0a0, 0x8fd8b8] },
};

export function randomKind(): SpiritKind {
  const r = Math.random();
  return r < 0.5 ? 'wisp' : r < 0.72 ? 'elder' : r < 0.87 ? 'sprite' : 'ooze';
}

type Goal =
  | { kind: 'visit'; uid: number; need: Need }
  | { kind: 'hotel'; uid: number }
  | { kind: 'gate' }
  | { kind: 'wander' };

/** 'holding' = standing at a staffed building whose worker has not arrived yet. */
type Phase = 'waiting' | 'walking' | 'holding' | 'visiting' | 'safe' | 'lost';

/**
 * A spirit guest. At night it works through its needs (visiting stalls and
 * paying), then heads for a hotel bed or the gate. At dawn it drops
 * everything and hurries home; if the sun catches it outside, it is lost.
 * Dirty paths spoil its mood; slimy guests leave trails, others drop litter.
 */
export class Spirit extends Walker {
  readonly kind: SpiritKind;
  private body: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private aura: Phaser.GameObjects.Image;
  private bubble: Phaser.GameObjects.Text;

  private phase: Phase = 'waiting';
  private goal: Goal | null = null;
  private waitMs: number;

  private needs: Need[];
  private readonly totalNeeds: number;
  private met = 0;
  /** Dirty cells walked over tonight. */
  private dirtSeen = 0;

  private readonly seed = Math.random() * 1000;

  constructor(
    scene: Phaser.Scene,
    state: GameState,
    world: WalkerWorld,
    start: Cell,
    kind: SpiritKind = randomKind(),
    delayMs = 600,
  ) {
    super(scene, state, world, start);
    this.kind = kind;
    const k = KINDS[kind];
    this.speed = SPIRIT_SPEED * k.speed * Phaser.Math.FloatBetween(0.9, 1.1);
    this.waitMs = delayMs;

    // 2–3 different needs for tonight.
    this.needs = Phaser.Utils.Array.Shuffle([...NEEDS]).slice(0, Phaser.Math.Between(2, 3));
    this.totalNeeds = this.needs.length;

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
      .setTint(kind === 'ooze' ? 0x9fffb0 : 0x9fc4ff)
      .setScale(0.32 * k.scale)
      .setAlpha(0);
    world.glowLayer.add(this.aura);
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

    scene.tweens.add({ targets: [this.body], alpha: k.alpha, duration: 700 });
    scene.tweens.add({ targets: [this.shadow, this.aura], alpha: 1, duration: 700 });
  }

  /** True once the spirit is home or lost; the scene can drop it. */
  get isDone(): boolean {
    return this.phase === 'safe' || this.phase === 'lost';
  }

  private get satisfaction(): number {
    const mood = Math.min(DIRT.moodMax, this.dirtSeen * DIRT.moodPerCell);
    return this.met / Math.max(1, this.totalNeeds) - mood;
  }

  private get headingHome(): boolean {
    return this.goal?.kind === 'hotel' || this.goal?.kind === 'gate';
  }

  protected face(left: boolean): void {
    this.body.setFlipX(left);
  }

  // ---------------------------------------------------------------------------

  /** `delta` is already scaled by the game speed. */
  update(time: number, delta: number): void {
    if (this.isDone) return;

    const busy = this.phase === 'visiting' || this.riding;
    if (this.state.isDawn && !this.headingHome && !busy) this.goHome();

    if (this.phase === 'waiting') {
      this.waitMs -= delta;
      if (this.waitMs <= 0) this.decide();
    } else if (this.phase === 'holding') {
      this.hold(delta);
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
    this.shadow
      .setPosition(this.x, this.y)
      .setScale(k * (1 - bob * 0.04))
      .setDepth(this.y - 0.5)
      .setVisible(!this.boarded);
    this.aura.setPosition(this.x, this.y - 20 * k + bob);

    let icon = '';
    if (this.queueing || this.phase === 'holding') icon = STR.waitIcon;
    else if (this.headingHome) icon = STR.homeIcon;
    else if (this.needs.length > 0) icon = STR.needIcons[this.needs[0]];
    this.bubble.setText(icon).setVisible(icon !== '').setPosition(this.x, this.y - 44 * k + bob);
  }

  /** Called whenever buildings change, so spirits never walk through removed paths. */
  onGridChanged(): void {
    if (this.isDone || !this.goal || this.riding) return;
    const goal = this.goal;
    const targetGone = (goal.kind === 'visit' || goal.kind === 'hotel') && !this.state.buildings.has(goal.uid);
    if (!targetGone && !this.pathBlocked()) return;
    if (this.phase === 'visiting' && !targetGone) return;
    this.replan();
  }

  protected replan(): void {
    this.path = [];
    if (this.headingHome) this.goHome();
    else this.decide();
  }

  protected onEnterCell(c: Cell): void {
    if (this.kind === 'ooze') {
      if (Math.random() < DIRT.slimeChance) this.state.addDirt(c, 'slime');
      return;
    }
    if (this.state.isDirty(c.tx, c.ty)) this.dirtSeen++;
  }

  // ---------------------------------------------------------------------------
  // decisions
  // ---------------------------------------------------------------------------

  private wait(ms: number): void {
    this.phase = 'waiting';
    this.waitMs = ms;
  }

  private walkTo(goal: Goal, field: Field, target: Cell): boolean {
    const path = pathTo(field, target);
    if (!path) return false;
    this.setPath(path);
    this.goal = goal;
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
  private goHome(skipHotels = false): void {
    if (this.goal?.kind === 'hotel') this.state.releaseBed(this.goal.uid);
    this.goal = null;
    const field = this.search();

    let hotel: { uid: number; cell: Cell; cost: number } | null = null;
    for (const h of skipHotels ? [] : this.state.hotels()) {
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

    // No way home right now (e.g. a path was removed): try again soon.
    this.goal = { kind: 'gate' };
    this.wait(1000);
  }

  // ---------------------------------------------------------------------------
  // arriving, staffed buildings
  // ---------------------------------------------------------------------------

  protected arrive(): void {
    const goal = this.goal;
    if (!goal || goal.kind === 'wander') {
      this.wait(Phaser.Math.Between(300, 900));
      return;
    }
    if (goal.kind === 'gate') {
      this.state.recordSafe(this.satisfaction);
      this.leave();
      return;
    }
    const b = this.state.buildings.get(goal.uid);
    if (!b) {
      this.replan();
      return;
    }
    if (this.state.isOpen(b)) this.enter();
    else {
      // The worker is still on the way: wait in front of the building.
      this.phase = 'holding';
      this.waitMs = HOLD_MS;
    }
  }

  private hold(delta: number): void {
    const goal = this.goal;
    const b = goal && (goal.kind === 'visit' || goal.kind === 'hotel') ? this.state.buildings.get(goal.uid) : undefined;
    if (!b || !this.state.isServed(b)) {
      this.replan();
      return;
    }
    if (this.state.isOpen(b)) {
      this.enter();
      return;
    }
    this.waitMs -= delta;
    if (this.waitMs > 0) return;
    // Waited long enough.
    if (goal?.kind === 'hotel') this.goHome(true);
    else {
      this.needs.shift();
      this.goal = null;
      this.decide();
    }
  }

  /** At an open building: start the visit, or check into the hotel. */
  private enter(): void {
    const goal = this.goal;
    if (goal?.kind === 'visit') {
      this.phase = 'visiting';
      this.waitMs = VISIT_MS;
    } else if (goal?.kind === 'hotel') {
      this.state.checkIn(goal.uid);
      this.state.recordSafe(this.satisfaction);
      this.leave();
    }
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
      // Food and drinks come with wrappers and cups.
      const messy = goal.need === 'hunger' || goal.need === 'thirst';
      if (messy && !this.state.nearBin(this.cell) && Math.random() < DIRT.litterChance) {
        this.state.addDirt(this.cell, 'litter');
      }
    }
    this.goal = null;
    this.wait(250);
  }

  /** Fade out safely (into a hotel or through the gate). */
  private leave(): void {
    this.releaseCrossings();
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
    this.releaseCrossings();
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

  destroy(): void {
    this.body.destroy();
    this.shadow.destroy();
    this.aura.destroy();
    this.bubble.destroy();
  }
}
