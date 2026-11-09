import * as Phaser from 'phaser';
import { DEPTH, FONT_UI, SPIRIT_SPEED, VISIT_MS } from '../config';
import { NEEDS, type Need } from '../data/buildings';
import { ANGER_MOOD, SPIRIT_KINDS, STROLL_PAUSE, WISHES, type SpiritKind } from '../data/spirits';
import { DIRT, HOLD_MS } from '../data/staff';
import { STR } from '../data/strings';
import { TEX } from '../gfx/textures';
import type { GameState } from '../state/GameState';
import { cellsInRange, cheapest, costTo, pathTo, type Cell, type Field } from '../state/pathfinding';
import { Walker, type WalkerWorld } from './Walker';

export type { SpiritKind } from '../data/spirits';

/** Pick a guest type according to the weights in data/spirits.ts. */
export function randomKind(): SpiritKind {
  const kinds = Object.keys(SPIRIT_KINDS) as SpiritKind[];
  const total = kinds.reduce((sum, k) => sum + SPIRIT_KINDS[k].weight, 0);
  let r = Math.random() * total;
  for (const k of kinds) {
    r -= SPIRIT_KINDS[k].weight;
    if (r <= 0) return k;
  }
  return 'wisp';
}

/** A list of wishes for tonight. Wishes may repeat, but never twice in a row. */
function rollWishes(kind: SpiritKind): Need[] {
  const weights = SPIRIT_KINDS[kind].needs ?? {};
  const count = Phaser.Math.Between(WISHES.min, WISHES.max);
  const out: Need[] = [];
  while (out.length < count) {
    const options = NEEDS.filter((n) => n !== out[out.length - 1]);
    const total = options.reduce((sum, n) => sum + (weights[n] ?? 1), 0);
    let r = Math.random() * total;
    for (const n of options) {
      r -= weights[n] ?? 1;
      if (r <= 0) {
        out.push(n);
        break;
      }
    }
  }
  return out;
}

type Goal =
  | { kind: 'visit'; uid: number; need: Need }
  | { kind: 'hotel'; uid: number }
  | { kind: 'gate' }
  | { kind: 'wander' };

/**
 * waiting  – standing around before the next decision
 * walking  – on the way (also while riding a ferry)
 * queueing – in line at a stall
 * holding  – at a hotel whose host has not arrived yet
 * visiting – being served
 */
type Phase = 'waiting' | 'walking' | 'queueing' | 'holding' | 'visiting' | 'safe' | 'lost';

let nextSpiritId = 1;

/** How long the angry face stays visible (ms). */
const ANGRY_SHOW_MS = 3500;

/**
 * A spirit guest. At night it works through its wishes: walks to a stall,
 * queues, gets served and pays, strolls a bit, then goes for the next wish.
 * Waiting too long makes it angry. Afterwards it heads for a hotel bed or the
 * gate. At dawn it drops everything and hurries home; if the sun catches it
 * outside, it is lost. Dirty paths spoil its mood; slimy guests leave trails.
 */
export class Spirit extends Walker {
  readonly id = nextSpiritId++;
  readonly kind: SpiritKind;
  private body: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private aura: Phaser.GameObjects.Image;
  private bubble: Phaser.GameObjects.Text;

  private phase: Phase = 'waiting';
  private goal: Goal | null = null;
  private waitMs: number;
  /** Time spent in the current queue. */
  private waited = 0;
  /** Building we are being served at (needs endServe when done). */
  private servedAt: number | null = null;
  /** Building we are in line at. */
  private queuedAt: number | null = null;
  /** Remaining time the angry face is shown. */
  private angryMs = 0;

  private needs: Need[];
  private readonly totalNeeds: number;
  private met = 0;
  private dirtSeen = 0;
  private angerCount = 0;

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
    const k = SPIRIT_KINDS[kind];
    this.speed = SPIRIT_SPEED * k.speed * Phaser.Math.FloatBetween(0.9, 1.1);
    this.waitMs = delayMs;
    this.needs = rollWishes(kind);
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
      .setTint(k.slimy ? 0x9fffb0 : 0x9fc4ff)
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
    scene.tweens.add({ targets: this.shadow, alpha: 1, duration: 700 });
    // Faint aura: with many guests the glows add up.
    scene.tweens.add({ targets: this.aura, alpha: 0.35, duration: 700 });
  }

  /** True once the spirit is home or lost; the scene can drop it. */
  get isDone(): boolean {
    return this.phase === 'safe' || this.phase === 'lost';
  }

  private get def() {
    return SPIRIT_KINDS[this.kind];
  }

  private get satisfaction(): number {
    const dirt = Math.min(DIRT.moodMax, this.dirtSeen * DIRT.moodPerCell);
    return this.met / Math.max(1, this.totalNeeds) - dirt - this.angerCount * ANGER_MOOD;
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
    if (this.angryMs > 0) this.angryMs -= delta;

    const busy = this.phase === 'visiting' || this.riding;
    if (this.state.isDawn && !this.headingHome && !busy) this.goHome();

    switch (this.phase) {
      case 'waiting':
        this.waitMs -= delta;
        if (this.waitMs <= 0) this.decide();
        break;
      case 'queueing':
        this.queue(delta);
        break;
      case 'holding':
        this.hold(delta);
        break;
      case 'visiting':
        this.waitMs -= delta;
        if (this.waitMs <= 0) this.finishVisit();
        break;
      case 'walking':
        this.walk(delta);
        break;
    }

    this.render(time);
  }

  private render(time: number): void {
    const bob = Math.sin(time / 320 + this.seed) * 3;
    const k = this.def.scale;
    // Guests in line stand a little apart instead of on top of each other.
    let ox = 0;
    let oy = 0;
    if (this.phase === 'queueing' && this.queuedAt !== null) {
      const pos = Math.max(0, this.state.queuePosition(this.queuedAt, this.id));
      ox = ((pos % 4) - 1.5) * 9;
      oy = Math.floor(pos / 4) * 6;
    }
    const x = this.x + ox;
    const y = this.y + oy;
    this.body.setPosition(x, y - 4 + bob).setDepth(y);
    this.shadow
      .setPosition(x, y)
      .setScale(k * (1 - bob * 0.04))
      .setDepth(y - 0.5)
      .setVisible(!this.boarded);
    this.aura.setPosition(x, y - 20 * k + bob);

    let icon = '';
    if (this.angryMs > 0) icon = STR.angryIcon;
    else if (this.phase === 'queueing') icon = this.waited > this.def.patience * 0.65 ? STR.impatientIcon : STR.waitIcon;
    else if (this.queueing || this.phase === 'holding') icon = STR.waitIcon;
    else if (this.headingHome) icon = STR.homeIcon;
    else if (this.needs.length > 0) icon = STR.needIcons[this.needs[0]];
    if (this.bubble.text !== icon) this.bubble.setText(icon);
    this.bubble.setVisible(icon !== '').setPosition(x, y - 44 * k + bob);
  }

  /** Called whenever buildings change, so spirits never walk through removed paths. */
  onGridChanged(): void {
    if (this.isDone || !this.goal || this.riding) return;
    const goal = this.goal;
    const targetGone = (goal.kind === 'visit' || goal.kind === 'hotel') && !this.state.buildings.has(goal.uid);
    if (this.phase === 'visiting' || this.phase === 'queueing' || this.phase === 'holding') {
      if (targetGone) this.replan();
      return;
    }
    if (targetGone || this.pathBlocked()) this.replan();
  }

  protected replan(): void {
    this.leaveLine();
    this.path = [];
    if (this.headingHome) this.goHome();
    else this.decide();
  }

  protected onEnterCell(c: Cell): void {
    if (this.def.slimy) {
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

  /** Leave the queue or the service place we are at. */
  private leaveLine(): void {
    if (this.queuedAt !== null) this.state.leaveQueue(this.queuedAt, this.id);
    if (this.servedAt !== null) this.state.endServe(this.servedAt);
    this.queuedAt = null;
    this.servedAt = null;
  }

  /** Pick the next wish and walk to the best building for it (short queues preferred). */
  private decide(): void {
    this.leaveLine();
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
      const slots = b.def.service?.slots ?? 1;
      const cost = costTo(field, cell) + (this.state.queueLength(b.uid) / slots) * 3;
      if (!best || cost < best.cost) best = { uid: b.uid, cell, cost };
    }

    if (best && this.walkTo({ kind: 'visit', uid: best.uid, need }, field, best.cell)) return;

    // Nothing reachable provides this wish: give up on it and stroll a bit.
    this.needs.shift();
    this.stroll(field);
  }

  /** Wander to a nearby spot, then think about the next wish. */
  private stroll(field = this.search()): void {
    const spots = cellsInRange(field, 2, 7);
    if (spots.length && this.walkTo({ kind: 'wander' }, field, Phaser.Utils.Array.GetRandom(spots))) return;
    this.wait(800);
  }

  /** Head for a free hotel bed or the gate, whichever makes sense. */
  private goHome(skipHotels = false): void {
    this.leaveLine();
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
  // arriving, queues, staffed buildings
  // ---------------------------------------------------------------------------

  protected arrive(): void {
    const goal = this.goal;
    if (!goal || goal.kind === 'wander') {
      this.wait(Phaser.Math.Between(STROLL_PAUSE.min, STROLL_PAUSE.max));
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
    if (goal.kind === 'visit') {
      this.state.joinQueue(b.uid, this.id);
      this.queuedAt = b.uid;
      this.waited = 0;
      this.phase = 'queueing';
      this.queue(0);
      return;
    }
    // Hotel: check in as soon as the host is there.
    if (this.state.isOpen(b)) this.checkIn(b.uid);
    else {
      this.phase = 'holding';
      this.waitMs = HOLD_MS;
    }
  }

  /** In line: get served when it is our turn, or give up when patience runs out. */
  private queue(delta: number): void {
    const goal = this.goal;
    const uid = this.queuedAt;
    const b = uid !== null ? this.state.buildings.get(uid) : undefined;
    if (goal?.kind !== 'visit' || !b || !this.state.isServed(b)) {
      this.replan();
      return;
    }
    if (this.state.tryServe(b.uid, this.id)) {
      this.queuedAt = null;
      this.servedAt = b.uid;
      this.phase = 'visiting';
      this.waitMs = b.def.service?.ms ?? VISIT_MS;
      return;
    }
    this.waited += delta;
    if (this.waited < this.def.patience) return;

    // Waited too long: leave angry and skip this wish.
    this.leaveLine();
    this.angerCount++;
    this.angryMs = ANGRY_SHOW_MS;
    this.state.recordAngry();
    this.needs.shift();
    this.goal = null;
    this.stroll();
  }

  private hold(delta: number): void {
    const goal = this.goal;
    const b = goal?.kind === 'hotel' ? this.state.buildings.get(goal.uid) : undefined;
    if (!b || !this.state.isServed(b)) {
      this.replan();
      return;
    }
    if (this.state.isOpen(b)) {
      this.checkIn(b.uid);
      return;
    }
    this.waitMs -= delta;
    if (this.waitMs <= 0) this.goHome(true);
  }

  private checkIn(uid: number): void {
    this.state.checkIn(uid);
    this.state.recordSafe(this.satisfaction);
    this.leave();
  }

  private finishVisit(): void {
    const goal = this.goal;
    const uid = this.servedAt;
    this.leaveLine();
    if (goal?.kind !== 'visit') {
      this.decide();
      return;
    }
    const b = uid !== null ? this.state.buildings.get(uid) : undefined;
    if (b?.def.provides) {
      this.state.earn(b.def.provides.price, this.cell, b.def.id);
      this.met++;
      this.needs.shift();
      // Food and drinks come with wrappers and cups.
      const messy = goal.need === 'hunger' || goal.need === 'thirst';
      if (messy && !this.state.nearBin(this.cell) && Math.random() < DIRT.litterChance) {
        this.state.addDirt(this.cell, 'litter');
      }
    }
    this.goal = null;
    this.stroll();
  }

  /** Fade out safely (into a hotel or through the gate). */
  private leave(): void {
    this.leaveLine();
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
    this.leaveLine();
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
