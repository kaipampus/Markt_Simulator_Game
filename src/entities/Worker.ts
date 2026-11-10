import * as Phaser from 'phaser';
import { DEPTH, FONT_UI, SPIRIT_SPEED } from '../config';
import { DIRT, STAFF, type Role } from '../data/staff';
import { STR } from '../data/strings';
import { TEX } from '../gfx/textures';
import type { GameState, PlacedBuilding, StaffMember, StaffStatus } from '../state/GameState';
import { cheapest, costTo, pathTo, type Cell } from '../state/pathfinding';
import { cellToWorld, Walker, type WalkerWorld } from './Walker';

/**
 * asleep   – inside a staff house (or the hotel for hosts), invisible
 * toPost   – walking to the building they work at
 * onDuty   – standing at the post: the building is open
 * toHome   – walking back to a staff house
 * roam     – cleaner walking to dirt (or to the spot the player chose)
 * cleaning – cleaner at work
 * idle     – nothing to do right now, or no path: tries again shortly
 */
type Mode = 'asleep' | 'toPost' | 'onDuty' | 'toHome' | 'roam' | 'cleaning' | 'idle' | 'gone' | 'lost';

const RETRY_MS = 1500;

function sameCell(a: Cell | null, b: Cell | null): boolean {
  return a === b || (!!a && !!b && a.tx === b.tx && a.ty === b.ty);
}

/**
 * A worker. Sleeps by day, walks to work when night falls and hurries back to
 * a staff house at dawn. Hosts stay in their hotel and sleep there. Cleaners
 * look for litter and slime on their own, or clean around a spot the player
 * sent them to. The sun is as dangerous for workers as for guests.
 */
export class Worker extends Walker {
  readonly id: number;
  readonly role: Role;
  private body: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private badge: Phaser.GameObjects.Text;

  private mode: Mode = 'asleep';
  private waitMs = 0;
  /** Building we are heading to or working at. */
  private postUid: number | null = null;
  /** Staff house we are walking to. */
  private homeUid: number | null = null;
  /** Cleaners: the dirty cell we are going to clean. */
  private target: Cell | null = null;
  /** Cleaners: the focus we last reacted to. */
  private knownFocus: Cell | null;

  private readonly seed = Math.random() * 1000;

  constructor(scene: Phaser.Scene, state: GameState, world: WalkerWorld, member: StaffMember) {
    super(scene, state, world, { tx: 0, ty: 0 });
    this.id = member.id;
    this.role = member.role;
    this.knownFocus = member.focus;
    this.speed = SPIRIT_SPEED * STAFF[member.role].speed * Phaser.Math.FloatBetween(0.95, 1.05);

    this.shadow = scene.add.image(0, 0, TEX.shadow).setVisible(false);
    this.body = scene.add.image(0, 0, TEX.worker(member.role)).setOrigin(0.5, 1).setVisible(false);
    this.badge = scene.add
      .text(0, 0, '', {
        fontFamily: FONT_UI,
        fontSize: '11px',
        backgroundColor: 'rgba(16,18,32,0.7)',
        padding: { x: 2, y: 1 },
      })
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.glow + 9)
      .setVisible(false);
  }

  private get member(): StaffMember | undefined {
    return this.state.staff.get(this.id);
  }

  get isDone(): boolean {
    return this.mode === 'gone' || this.mode === 'lost';
  }

  /** Out on the map (not sleeping, not gone). */
  get isAwake(): boolean {
    return this.mode !== 'asleep' && !this.isDone;
  }

  /** Is the world point (x, y) on this worker? */
  hitTest(x: number, y: number): boolean {
    return this.isAwake && this.body.visible && Math.abs(x - this.x) <= 14 && y >= this.y - 42 && y <= this.y + 6;
  }

  protected face(left: boolean): void {
    this.body.setFlipX(left);
  }

  private setStatus(status: StaffStatus): void {
    this.state.setStatus(this.id, status);
  }

  /** Hosts working in a hotel stay inside at dawn. */
  private get staysAtPost(): boolean {
    const m = this.member;
    if (!m || m.role !== 'host' || m.post === null) return false;
    return this.mode === 'onDuty' || this.mode === 'toPost';
  }

  // ---------------------------------------------------------------------------
  // showing and hiding
  // ---------------------------------------------------------------------------

  private show(start: Cell): void {
    const p = cellToWorld(start);
    this.x = p.x;
    this.y = p.y;
    this.path = [];
    for (const o of [this.body, this.shadow]) o.setVisible(true).setAlpha(0);
    this.scene.tweens.add({ targets: [this.body, this.shadow], alpha: 1, duration: 500 });
  }

  private hide(): void {
    for (const o of [this.body, this.shadow, this.badge]) o.setVisible(false);
  }

  // ---------------------------------------------------------------------------
  // the night
  // ---------------------------------------------------------------------------

  /** Night falls (or the worker got a job during the night): come out and go to work. */
  wake(): void {
    const m = this.member;
    if (!m || this.mode !== 'asleep') return;
    if (this.state.phase !== 'night' || this.state.isDawn) return;
    if (m.role !== 'cleaner' && m.post === null) {
      this.setStatus('off');
      return;
    }
    let home: PlacedBuilding | undefined = m.restAt !== null ? this.state.buildings.get(m.restAt) : undefined;
    if (!home) {
      home = this.state.staffHouses()[0];
      this.state.setRestAt(this.id, home?.uid ?? null);
    }
    const doors = home ? this.state.entranceCells(home) : [];
    if (!doors.length) {
      this.setStatus('stuck');
      return;
    }
    this.show(Phaser.Utils.Array.GetRandom(doors));
    this.mode = 'idle';
    this.goToWork();
  }

  private goToWork(): void {
    const m = this.member;
    if (!m) return;
    if (m.role === 'cleaner') {
      this.findDirt();
      return;
    }
    const b = m.post !== null ? this.state.buildings.get(m.post) : undefined;
    if (!b) {
      this.goHome();
      return;
    }
    this.postUid = b.uid;
    const doors = this.state.entranceCells(b);
    const here = this.cell;
    if (doors.some((c) => c.tx === here.tx && c.ty === here.ty)) {
      this.startDuty();
      return;
    }
    const field = this.search();
    const cell = cheapest(field, doors);
    const path = cell ? pathTo(field, cell) : null;
    if (!path) {
      this.idle('stuck');
      return;
    }
    this.setPath(path);
    this.mode = 'toPost';
    this.setStatus('toPost');
  }

  private startDuty(): void {
    this.path = [];
    this.mode = 'onDuty';
    this.state.setOnDuty(this.id, true);
    this.setStatus('onDuty');
  }

  private goHome(): void {
    this.state.releaseDirt(this.id);
    this.state.setOnDuty(this.id, false);
    this.target = null;
    const field = this.search();
    let best: { uid: number; cell: Cell; cost: number } | null = null;
    for (const h of this.state.staffHouses()) {
      const cell = cheapest(field, this.state.entranceCells(h));
      if (!cell) continue;
      const cost = costTo(field, cell);
      if (!best || cost < best.cost) best = { uid: h.uid, cell, cost };
    }
    if (!best) {
      this.idle('stuck');
      return;
    }
    if (best.cost === 0) {
      this.sleep(best.uid);
      return;
    }
    const path = pathTo(field, best.cell);
    if (!path) {
      this.idle('stuck');
      return;
    }
    this.setPath(path);
    this.homeUid = best.uid;
    this.mode = 'toHome';
    this.setStatus('toHome');
  }

  /** Cleaners: go to the nearest dirt (around the focus spot first). */
  private findDirt(): void {
    const m = this.member;
    if (!m) return;
    const field = this.search();
    this.state.releaseDirt(this.id);
    // Leave spots that another cleaner is already heading for.
    let pool = this.state.dirtyCells().filter((c) => !this.state.isDirtClaimed(c, this.id));
    const f = m.focus;
    if (f) {
      const r = DIRT.focusRadius;
      const near = pool.filter((c) => Math.abs(c.tx - f.tx) <= r && Math.abs(c.ty - f.ty) <= r);
      const here = this.cell;
      const atSpot = Math.abs(here.tx - f.tx) <= r && Math.abs(here.ty - f.ty) <= r;
      if (near.some((c) => costTo(field, c) < Infinity)) pool = near;
      else if (!atSpot && pathTo(field, f)) {
        // Nothing dirty there (yet): walk over anyway and look around.
        this.target = null;
        this.setPath(pathTo(field, f)!);
        this.mode = 'roam';
        this.setStatus('roam');
        return;
      } else {
        this.clearFocus();
      }
    }
    const cell = cheapest(field, pool);
    if (!cell) {
      this.idle('idle');
      return;
    }
    this.state.claimDirt(this.id, cell);
    if (costTo(field, cell) === 0) {
      this.startCleaning(cell);
      return;
    }
    this.target = cell;
    this.setPath(pathTo(field, cell) ?? []);
    this.mode = 'roam';
    this.setStatus('roam');
  }

  private clearFocus(): void {
    this.knownFocus = null;
    this.state.setFocus(this.id, null);
  }

  private startCleaning(cell: Cell): void {
    this.target = cell;
    this.path = [];
    this.mode = 'cleaning';
    this.waitMs = DIRT.cleanMs;
    this.setStatus('cleaning');
  }

  private idle(status: StaffStatus): void {
    this.path = [];
    this.mode = 'idle';
    this.waitMs = RETRY_MS;
    this.setStatus(status);
  }

  private sleep(uid: number): void {
    this.state.releaseDirt(this.id);
    this.releaseCrossings();
    this.state.setRestAt(this.id, uid);
    this.state.setOnDuty(this.id, false);
    this.mode = 'asleep';
    this.path = [];
    this.setStatus('asleep');
    this.hide();
  }

  protected arrive(): void {
    const m = this.member;
    if (!m) return;
    if (this.mode === 'toPost') {
      if (m.post === this.postUid) this.startDuty();
      else this.goToWork();
    } else if (this.mode === 'toHome' && this.homeUid !== null && this.state.buildings.has(this.homeUid)) {
      this.sleep(this.homeUid);
    } else if (this.mode === 'roam') {
      if (this.target && this.state.isDirty(this.target.tx, this.target.ty)) this.startCleaning(this.target);
      else this.findDirt();
    } else {
      this.replan();
    }
  }

  protected replan(): void {
    if (!this.isAwake) return;
    this.path = [];
    if (this.mode === 'toHome' || (this.state.isDawn && !this.staysAtPost)) this.goHome();
    else this.goToWork();
  }

  /** `delta` is already scaled by the game speed. */
  update(time: number, delta: number): void {
    if (!this.isAwake) return;
    if (!this.member) return;

    const busy = this.mode === 'toHome' || this.mode === 'idle' || this.riding || this.staysAtPost;
    if (this.state.isDawn && !busy) this.goHome();

    switch (this.mode) {
      case 'toPost':
      case 'toHome':
      case 'roam':
        this.walk(delta);
        break;
      case 'cleaning':
        this.waitMs -= delta;
        if (this.waitMs <= 0) {
          if (this.target) this.state.clean(this.target);
          this.state.releaseDirt(this.id);
          this.target = null;
          if (this.state.isDawn) this.goHome();
          else this.findDirt();
        }
        break;
      case 'idle':
        this.waitMs -= delta;
        if (this.waitMs <= 0) this.replan();
        break;
    }
    this.render(time);
  }

  private render(time: number): void {
    if (!this.isAwake) return;
    // Inside a restaurant the restaurant draws its own cook and waiter figures.
    const m0 = this.member;
    const postDef = m0?.post != null ? this.state.buildings.get(m0.post)?.def : undefined;
    const inside = this.mode === 'onDuty' && !!postDef && (!!postDef.restaurant || postDef.style === 'stall');
    for (const o of [this.body, this.shadow, this.badge]) o.setVisible(!inside);
    if (inside) return;
    const moving = this.mode === 'toPost' || this.mode === 'toHome' || this.mode === 'roam';
    const bob = Math.sin(time / (moving ? 160 : 400) + this.seed) * (moving ? 2 : 1);
    this.body.setPosition(this.x, this.y - 3 + bob).setDepth(this.y);
    this.shadow.setPosition(this.x, this.y).setDepth(this.y - 0.5).setVisible(!this.boarded);
    const m = this.member;
    const icon = m?.status === 'stuck' ? STR.stuckIcon : this.queueing ? STR.waitIcon : STR.roleIcons[this.role];
    this.badge.setText(icon).setVisible(true).setPosition(this.x, this.y - 44 + bob);
  }

  // ---------------------------------------------------------------------------
  // reacting to the player and the world
  // ---------------------------------------------------------------------------

  /** Job or focus changed. */
  onStaffChanged(): void {
    const m = this.member;
    if (!m || this.isDone) return;
    if (this.mode === 'asleep') {
      this.wake();
      return;
    }
    if (this.riding || this.state.isDawn) return;
    if (m.role === 'cleaner') {
      if (sameCell(m.focus, this.knownFocus)) return;
      this.knownFocus = m.focus;
      if (this.mode !== 'cleaning') this.findDirt();
      return;
    }
    if (m.post !== this.postUid) {
      this.state.setOnDuty(this.id, false);
      this.postUid = null;
      this.goToWork();
    }
  }

  /** Buildings changed: find a new way if ours is blocked. */
  onGridChanged(): void {
    const m = this.member;
    if (!m || this.isDone) return;
    if (this.mode === 'asleep') {
      if (m.status === 'stuck') this.wake();
      return;
    }
    if (this.riding) return;
    if (this.mode === 'idle' && m.status === 'stuck') {
      this.waitMs = 0;
      return;
    }
    const homeGone = this.mode === 'toHome' && (this.homeUid === null || !this.state.buildings.has(this.homeUid));
    const moving = this.mode === 'toPost' || this.mode === 'toHome' || this.mode === 'roam';
    if (homeGone || (moving && this.pathBlocked())) this.replan();
  }

  /** Skipping to the morning: go to bed right away (hosts sleep in their hotel). */
  goHomeNow(): void {
    if (!this.isAwake) return;
    const m = this.member;
    if (m && m.role === 'host' && this.mode === 'onDuty' && m.post !== null) {
      this.sleep(m.post);
      return;
    }
    const home = (m?.restAt != null ? this.state.buildings.get(m.restAt) : undefined) ?? this.state.staffHouses()[0];
    if (home) this.sleep(home.uid);
  }

  /** The sun rises. Returns false if the worker was caught outside. */
  sunrise(): boolean {
    if (!this.isAwake) return true;
    const m = this.member;
    if (m && m.role === 'host' && this.mode === 'onDuty' && m.post !== null) {
      this.sleep(m.post);
      return true;
    }
    this.burn();
    return false;
  }

  private burn(): void {
    this.state.releaseDirt(this.id);
    this.releaseCrossings();
    this.state.setOnDuty(this.id, false);
    this.mode = 'lost';
    this.badge.setVisible(false);
    this.body.setTint(0xffb070);
    this.scene.tweens.add({ targets: this.body, y: '-=40', alpha: 0, duration: 1400, ease: 'Cubic.In' });
    this.scene.tweens.add({ targets: this.shadow, alpha: 0, duration: 1400, onComplete: () => this.destroy() });
  }

  /** Dismissed by the player. */
  dismiss(): void {
    this.state.releaseDirt(this.id);
    const wasAwake = this.isAwake;
    this.releaseCrossings();
    this.mode = 'gone';
    this.badge.setVisible(false);
    if (!wasAwake) {
      this.destroy();
      return;
    }
    this.scene.tweens.add({ targets: [this.body, this.shadow], alpha: 0, duration: 500, onComplete: () => this.destroy() });
  }

  destroy(): void {
    this.body.destroy();
    this.shadow.destroy();
    this.badge.destroy();
  }
}
