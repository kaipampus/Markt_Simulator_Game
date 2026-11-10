/**
 * 2D (Phaser) views of the game's figures. Each view reads its logic object
 * every frame and draws it; animations (fading in and out, burning in the
 * sun) live only here. These views go away with the switch to 3D.
 */
import * as Phaser from 'phaser';
import { DEPTH, FONT_UI } from '../config';
import type { Ferry } from '../entities/Ferry';
import type { Restaurant, StaffFigure } from '../entities/Restaurant';
import type { Spirit } from '../entities/Spirit';
import type { Worker } from '../entities/Worker';
import { TEX } from '../gfx/textures';

function bubble(scene: Phaser.Scene, size: number, depth: number): Phaser.GameObjects.Text {
  return scene.add
    .text(0, 0, '', {
      fontFamily: FONT_UI,
      fontSize: `${size}px`,
      backgroundColor: 'rgba(16,18,32,0.7)',
      padding: { x: 3, y: 1 },
    })
    .setOrigin(0.5, 1)
    .setDepth(depth)
    .setVisible(false);
}

/** A guest: body, shadow, soft aura and the wish bubble. */
export class SpiritView {
  private body: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private aura: Phaser.GameObjects.Image;
  private bubble: Phaser.GameObjects.Text;
  private ending = false;
  /** The view has finished its last animation and can be dropped. */
  done = false;

  constructor(
    private scene: Phaser.Scene,
    readonly spirit: Spirit,
    glowLayer: Phaser.GameObjects.Layer,
  ) {
    const p = spirit.position;
    const k = spirit.scale;
    this.shadow = scene.add.image(p.x, p.y, TEX.shadow).setAlpha(0).setScale(k);
    this.body = scene.add.image(p.x, p.y, TEX.spirit).setOrigin(0.5, 1).setScale(k).setTint(spirit.tint).setAlpha(0);
    this.aura = scene.add
      .image(p.x, p.y, TEX.glow)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(spirit.slimy ? 0x9fffb0 : 0x9fc4ff)
      .setScale(0.32 * k)
      .setAlpha(0);
    glowLayer.add(this.aura);
    this.bubble = bubble(scene, 13, DEPTH.glow + 10);
    scene.tweens.add({ targets: this.body, alpha: spirit.alpha, duration: 700 });
    scene.tweens.add({ targets: this.shadow, alpha: 1, duration: 700 });
    // Faint aura: with many guests the glows add up.
    scene.tweens.add({ targets: this.aura, alpha: 0.35, duration: 700 });
  }

  update(time: number): void {
    if (this.ending) return;
    const s = this.spirit;
    const ended = s.ended;
    if (ended) {
      this.end(ended);
      return;
    }
    const bob = Math.sin(time / 320 + s.seed) * 3;
    const k = s.scale;
    const { x, y } = s.drawPos;
    this.body.setPosition(x, y - 4 + bob).setDepth(y).setFlipX(s.facingLeft);
    this.shadow
      .setPosition(x, y)
      .setScale(k * (1 - bob * 0.04))
      .setDepth(y - 0.5)
      .setVisible(!s.onBoat);
    this.aura.setPosition(x, y - 20 * k + bob);
    const icon = s.icon;
    if (this.bubble.text !== icon) this.bubble.setText(icon);
    this.bubble.setVisible(icon !== '').setPosition(x, y - 44 * k + bob);
  }

  private end(how: 'safe' | 'lost'): void {
    this.ending = true;
    this.bubble.setVisible(false);
    if (how === 'safe') {
      this.scene.tweens.add({ targets: [this.body, this.shadow, this.aura], alpha: 0, duration: 500, onComplete: () => this.destroy() });
      return;
    }
    // Caught by the sun: glows orange and fades upwards.
    this.body.setTint(0xffb070);
    this.aura.setTint(0xffa050);
    this.scene.tweens.add({ targets: [this.body, this.aura], y: '-=40', alpha: 0, duration: 1400, ease: 'Cubic.In' });
    this.scene.tweens.add({ targets: this.shadow, alpha: 0, duration: 1400, onComplete: () => this.destroy() });
  }

  destroy(): void {
    this.done = true;
    this.body.destroy();
    this.shadow.destroy();
    this.aura.destroy();
    this.bubble.destroy();
  }
}

/** A worker: body, shadow and job badge. */
export class WorkerView {
  private body: Phaser.GameObjects.Image;
  private shadow: Phaser.GameObjects.Image;
  private badge: Phaser.GameObjects.Text;
  private appearances: number;
  private ending = false;
  done = false;

  constructor(
    private scene: Phaser.Scene,
    readonly worker: Worker,
  ) {
    this.shadow = scene.add.image(0, 0, TEX.shadow).setVisible(false);
    this.body = scene.add.image(0, 0, TEX.worker(worker.role)).setOrigin(0.5, 1).setVisible(false);
    this.badge = bubble(scene, 11, DEPTH.glow + 9);
    this.appearances = worker.appearances;
  }

  update(time: number): void {
    if (this.ending) return;
    const w = this.worker;
    const ended = w.ended;
    if (ended) {
      this.end(ended);
      return;
    }
    // Fade in whenever the worker comes out of a building.
    if (w.appearances !== this.appearances) {
      this.appearances = w.appearances;
      for (const o of [this.body, this.shadow]) o.setAlpha(0);
      this.scene.tweens.add({ targets: [this.body, this.shadow], alpha: 1, duration: 500 });
    }
    const visible = w.visible;
    for (const o of [this.body, this.shadow, this.badge]) o.setVisible(visible);
    if (!visible) return;
    const bob = Math.sin(time / (w.moving ? 160 : 400) + w.seed) * (w.moving ? 2 : 1);
    const { x, y } = w.position;
    this.body.setPosition(x, y - 3 + bob).setDepth(y).setFlipX(w.facingLeft);
    this.shadow.setPosition(x, y).setDepth(y - 0.5).setVisible(!w.onBoat);
    this.badge.setText(w.icon).setPosition(x, y - 44 + bob);
  }

  private end(how: 'lost' | 'gone'): void {
    this.ending = true;
    this.badge.setVisible(false);
    if (how === 'lost') {
      this.body.setTint(0xffb070);
      this.scene.tweens.add({ targets: this.body, y: '-=40', alpha: 0, duration: 1400, ease: 'Cubic.In' });
      this.scene.tweens.add({ targets: this.shadow, alpha: 0, duration: 1400, onComplete: () => this.destroy() });
    } else if (this.worker.fadesOut) {
      this.scene.tweens.add({ targets: [this.body, this.shadow], alpha: 0, duration: 500, onComplete: () => this.destroy() });
    } else {
      this.destroy();
    }
  }

  destroy(): void {
    this.done = true;
    this.body.destroy();
    this.shadow.destroy();
    this.badge.destroy();
  }
}

/** The boat of a ferry. */
export class FerryView {
  private boat: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    readonly ferry: Ferry,
  ) {
    this.boat = scene.add.image(ferry.boatX, ferry.boatY, TEX.boat(ferry.building.def.id)).setDepth(DEPTH.boat);
  }

  update(): void {
    this.boat.setPosition(this.ferry.boatX, this.ferry.boatY);
  }

  destroy(): void {
    this.boat.destroy();
  }
}

/** The cooks and waiters inside a restaurant, with the dishes they carry. */
export class RestaurantView {
  private figures = new Map<StaffFigure, { img: Phaser.GameObjects.Image; plate: Phaser.GameObjects.Image }>();

  constructor(
    private scene: Phaser.Scene,
    readonly restaurant: Restaurant,
  ) {}

  update(time: number): void {
    const now = new Set(this.restaurant.figures);
    for (const [f, v] of this.figures) {
      if (now.has(f)) continue;
      v.img.destroy();
      v.plate.destroy();
      this.figures.delete(f);
    }
    for (const f of now) {
      let v = this.figures.get(f);
      if (!v) {
        v = {
          img: this.scene.add.image(f.x, f.y, TEX.worker(f.role)).setOrigin(0.5, 1).setScale(0.9),
          plate: this.scene.add.image(f.x, f.y, TEX.plate).setVisible(false),
        };
        this.figures.set(f, v);
      }
      const bob = Math.sin(time / (f.busy ? 120 : 300) + f.x) * (f.busy ? 1.5 : 1);
      v.img.setPosition(f.x, f.y - 3 + bob).setDepth(f.y).setFlipX(f.facingLeft);
      v.plate.setPosition(f.x + 9, f.y - 24 + bob).setDepth(f.y + 0.1).setVisible(f.plate);
    }
  }

  destroy(): void {
    for (const v of this.figures.values()) {
      v.img.destroy();
      v.plate.destroy();
    }
    this.figures.clear();
  }
}
