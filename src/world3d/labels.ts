/**
 * Text above things in the 3D world (wish bubbles, job badges, building
 * signs, floating coins). Plain HTML elements on a layer between the 3D
 * canvas and the interface; positioned every frame from 3D points.
 */
import * as THREE from 'three';

export interface Label {
  el: HTMLDivElement;
  /** Point in 3D the label sits above. */
  pos: THREE.Vector3;
  visible: boolean;
}

const tmp = new THREE.Vector3();

export class LabelLayer {
  private labels = new Set<Label>();
  private floats: Array<{ el: HTMLDivElement; pos: THREE.Vector3; age: number }> = [];

  constructor(private root: HTMLElement) {}

  add(cls: string): Label {
    const el = document.createElement('div');
    el.className = `lbl ${cls}`;
    el.style.display = 'none';
    this.root.appendChild(el);
    const label: Label = { el, pos: new THREE.Vector3(), visible: false };
    this.labels.add(label);
    return label;
  }

  setText(l: Label, text: string): void {
    if (l.el.textContent !== text) l.el.textContent = text;
    l.visible = text !== '';
  }

  remove(l: Label): void {
    l.el.remove();
    this.labels.delete(l);
  }

  /** Short text that floats up and fades. */
  float(pos: THREE.Vector3, text: string, color: string, size = 15): void {
    const el = document.createElement('div');
    el.className = 'lbl float';
    el.textContent = text;
    el.style.color = color;
    el.style.fontSize = `${size}px`;
    this.root.appendChild(el);
    this.floats.push({ el, pos: pos.clone(), age: 0 });
  }

  /** Position every label on screen (called once per frame). */
  update(camera: THREE.Camera, width: number, height: number, dt: number): void {
    const place = (el: HTMLElement, pos: THREE.Vector3, lift: number): boolean => {
      tmp.copy(pos).project(camera);
      if (tmp.z > 1 || tmp.x < -1.2 || tmp.x > 1.2 || tmp.y < -1.2 || tmp.y > 1.2) return false;
      const x = (tmp.x * 0.5 + 0.5) * width;
      const y = (-tmp.y * 0.5 + 0.5) * height - lift;
      el.style.transform = `translate(-50%, -100%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      return true;
    };
    for (const l of this.labels) {
      const show = l.visible && place(l.el, l.pos, 0);
      const display = show ? '' : 'none';
      if (l.el.style.display !== display) l.el.style.display = display;
    }
    this.floats = this.floats.filter((f) => {
      f.age += dt;
      const t = f.age / 1.1;
      if (t >= 1) {
        f.el.remove();
        return false;
      }
      f.el.style.opacity = String(1 - t * t);
      if (!place(f.el, f.pos, t * 30)) f.el.style.opacity = '0';
      return true;
    });
  }

  clear(): void {
    for (const l of this.labels) l.el.remove();
    for (const f of this.floats) f.el.remove();
    this.labels.clear();
    this.floats = [];
  }
}
