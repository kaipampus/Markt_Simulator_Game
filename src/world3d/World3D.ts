/**
 * The 3D world: renderer, camera rig, ground, day and night light, the
 * pool of real lights near the camera, picking with the mouse and the
 * label layer. Game objects are added by the views in views.ts.
 * Coordinates: 1 grid cell = 1 unit, x = column, z = row, y = up.
 */
import * as THREE from 'three';
import { GRID_H, GRID_W, RIVER_ROWS, RIVER_TOP, TILE } from '../config';
import { LabelLayer } from './labels';
import { glowing } from './models';

/** Lighting presets. */
export type Light = 'day' | 'dawn' | 'night';
const NIGHT_MIX: Record<Light, number> = { day: 0, dawn: 0.55, night: 1 };

/** Camera limits. */
const PITCH_MIN = 0.12; // almost straight down
const PITCH_MAX = 1.38; // almost from the side
const DIST_MIN = 5;
const DIST_MAX = 46;
/** How many real lights exist; they move to the lamps nearest the camera. */
const LIGHT_POOL = 24;

interface Lamp {
  pos: THREE.Vector3;
  color: number;
  power: number;
  distance: number;
}

/** World pixels (game logic) to 3D units. */
export function toWorld(px: number, py: number, y = 0): THREE.Vector3 {
  return new THREE.Vector3(px / TILE, y, py / TILE);
}

export class World3D {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly labels: LabelLayer;
  /** Building models (for picking). */
  readonly buildings = new THREE.Group();
  /** Worker figures (for picking). */
  readonly workers = new THREE.Group();

  // camera rig
  private target = new THREE.Vector3(GRID_W / 2, 0, GRID_H * 0.68);
  private yaw = 0;
  private yawTo = 0;
  private pitch = 0.95;
  private dist = 22;

  // light
  private hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 1);
  private sun = new THREE.DirectionalLight(0xffe8c0, 2.2);
  private moon = new THREE.AmbientLight(0x2a3a70, 0);
  private mix = 0;
  private mixFrom = 0;
  private mixTo = 0;
  private mixT = 1;
  private mixMs = 1;
  private pool: THREE.PointLight[] = [];
  private lamps = new Set<Lamp>();
  private time = 0;

  private raycaster = new THREE.Raycaster();
  private groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private areaLock?: THREE.Mesh;

  constructor(private container: HTMLElement, labelRoot: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    container.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 250);
    this.labels = new LabelLayer(labelRoot);

    this.scene.add(this.buildings, this.workers);
    this.addGround();
    this.addLights();
    this.resize();
    window.addEventListener('resize', this.onResize);
  }

  private onResize = () => this.resize();

  resize(): void {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------------------
  // ground and areas
  // ---------------------------------------------------------------------------

  private addGround(): void {
    const plane = (z0: number, rows: number, color: string, y = 0) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(GRID_W, rows), new THREE.MeshToonMaterial({ color }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(GRID_W / 2, y, z0 + rows / 2);
      m.receiveShadow = true;
      this.scene.add(m);
    };
    plane(0, RIVER_TOP, '#3a2f2c');
    plane(RIVER_TOP, RIVER_ROWS, '#1d3d5c', -0.15);
    plane(RIVER_TOP + RIVER_ROWS, GRID_H - RIVER_TOP - RIVER_ROWS, '#2b3640');
    // River banks.
    for (const z of [RIVER_TOP, RIVER_TOP + RIVER_ROWS]) {
      const bank = new THREE.Mesh(new THREE.BoxGeometry(GRID_W, 0.2, 0.12), new THREE.MeshToonMaterial({ color: '#4b4a55' }));
      bank.position.set(GRID_W / 2, -0.05, z);
      this.scene.add(bank);
    }
    // A faint grid helps placing buildings.
    const grid = new THREE.GridHelper(GRID_W, GRID_W, 0x1b222a, 0x1b222a);
    grid.position.set(GRID_W / 2, 0.005, GRID_W / 2);
    grid.scale.z = GRID_H / GRID_W;
    (grid.material as THREE.Material).opacity = 0.35;
    (grid.material as THREE.Material).transparent = true;
    this.scene.add(grid);
  }

  /** Dark cover over the closed hotel district (and the river). */
  setAreaLocked(locked: boolean): void {
    if (locked && !this.areaLock) {
      const rows = RIVER_TOP + RIVER_ROWS;
      this.areaLock = new THREE.Mesh(
        new THREE.BoxGeometry(GRID_W, 0.6, rows),
        new THREE.MeshBasicMaterial({ color: 0x05070f, transparent: true, opacity: 0.6, depthWrite: false }),
      );
      this.areaLock.position.set(GRID_W / 2, 0.3, rows / 2);
      this.scene.add(this.areaLock);
    } else if (!locked && this.areaLock) {
      this.scene.remove(this.areaLock);
      this.areaLock = undefined;
    }
  }

  // ---------------------------------------------------------------------------
  // light
  // ---------------------------------------------------------------------------

  private addLights(): void {
    this.sun.position.set(GRID_W / 2 + 18, 30, GRID_H / 2 + 18);
    this.sun.target.position.set(GRID_W / 2, 0, GRID_H / 2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -24, right: 24, top: 24, bottom: -24, near: 1, far: 120 });
    this.scene.add(this.hemi, this.sun, this.sun.target, this.moon);
    for (let i = 0; i < LIGHT_POOL; i++) {
      const l = new THREE.PointLight(0xffb060, 0, 7, 1.6);
      l.visible = true;
      this.pool.push(l);
      this.scene.add(l);
    }
    this.scene.fog = new THREE.FogExp2(0x9fc4e8, 0.004);
  }

  /** Change the light over `ms` (day, dawn or night). */
  setLight(kind: Light, ms: number): void {
    this.mixFrom = this.mix;
    this.mixTo = NIGHT_MIX[kind];
    this.mixT = ms <= 0 ? 1 : 0;
    this.mixMs = Math.max(1, ms);
    if (ms <= 0) this.mix = this.mixTo;
  }

  addLamp(pos: THREE.Vector3, color: number, power: number, distance: number): Lamp {
    const lamp = { pos, color, power, distance };
    this.lamps.add(lamp);
    return lamp;
  }

  removeLamp(lamp: Lamp): void {
    this.lamps.delete(lamp);
  }

  private applyLight(): void {
    const k = this.mix;
    const day = new THREE.Color('#9fc4e8');
    const night = new THREE.Color('#05070f');
    const bg = day.lerp(night, k);
    this.scene.background = bg;
    const fog = this.scene.fog as THREE.FogExp2;
    fog.color.copy(bg);
    fog.density = THREE.MathUtils.lerp(0.004, 0.018, k);
    this.hemi.intensity = THREE.MathUtils.lerp(1.15, 0.07, k);
    this.sun.intensity = THREE.MathUtils.lerp(2.3, 0, k);
    this.sun.castShadow = k < 0.8;
    this.moon.intensity = THREE.MathUtils.lerp(0, 0.6, k);
    for (const m of glowing) m.emissiveIntensity = 1.6 * k;

    // Real lights go to the lamps closest to where the camera looks.
    const near = [...this.lamps]
      .map((l) => ({ l, d: l.pos.distanceToSquared(this.target) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, LIGHT_POOL);
    this.pool.forEach((p, i) => {
      const lamp = near[i]?.l;
      if (!lamp || k < 0.05) {
        p.intensity = 0;
        return;
      }
      p.position.copy(lamp.pos);
      p.color.setHex(lamp.color);
      p.distance = lamp.distance;
      p.intensity = lamp.power * k * (0.92 + Math.sin(this.time * 9 + lamp.pos.x * 3) * 0.08);
    });
  }

  // ---------------------------------------------------------------------------
  // camera
  // ---------------------------------------------------------------------------

  /** Move the view by screen pixels (drag or keys). */
  pan(dx: number, dy: number): void {
    const s = this.dist * 0.0017;
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    this.target.addScaledVector(right, -dx * s).addScaledVector(forward, -dy * s);
    this.target.x = THREE.MathUtils.clamp(this.target.x, -2, GRID_W + 2);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -2, GRID_H + 2);
  }

  /** Turn and tilt by screen pixels (right drag). */
  orbit(dx: number, dy: number): void {
    this.yaw -= dx * 0.006;
    this.yawTo = this.yaw;
    this.pitch = THREE.MathUtils.clamp(this.pitch - dy * 0.005, PITCH_MIN, PITCH_MAX);
  }

  /** Turn in 45° steps (Q / E). */
  turnStep(dir: 1 | -1): void {
    this.yawTo = Math.round(this.yawTo / (Math.PI / 4)) * (Math.PI / 4) + dir * (Math.PI / 4);
  }

  zoom(factor: number): void {
    this.dist = THREE.MathUtils.clamp(this.dist * factor, DIST_MIN, DIST_MAX);
  }

  /** Centre the view on a world-pixel point. */
  lookAt(px: number, py: number): void {
    this.target.set(px / TILE, 0, py / TILE);
  }

  private placeCamera(): void {
    const sp = Math.sin(this.pitch);
    this.camera.position.set(
      this.target.x + sp * Math.sin(this.yaw) * this.dist,
      Math.cos(this.pitch) * this.dist,
      this.target.z + sp * Math.cos(this.yaw) * this.dist,
    );
    this.camera.lookAt(this.target);
  }

  // ---------------------------------------------------------------------------
  // picking
  // ---------------------------------------------------------------------------

  private ndc(sx: number, sy: number): THREE.Vector2 {
    const r = this.renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2((sx / r.width) * 2 - 1, -(sy / r.height) * 2 + 1);
  }

  /** The ground point under the screen point, in world pixels (game coordinates). */
  groundAt(sx: number, sy: number): { x: number; y: number } | null {
    this.raycaster.setFromCamera(this.ndc(sx, sy), this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, hit)) return null;
    return { x: hit.x * TILE, y: hit.z * TILE };
  }

  /** The `userData[key]` of the nearest object in `group` under the screen point. */
  objectAt(group: THREE.Object3D, key: string, sx: number, sy: number): number | undefined {
    this.raycaster.setFromCamera(this.ndc(sx, sy), this.camera);
    for (const hit of this.raycaster.intersectObject(group, true)) {
      let o: THREE.Object3D | null = hit.object;
      while (o && o.userData[key] === undefined) o = o.parent;
      if (o && o.visible) return o.userData[key] as number;
    }
    return undefined;
  }

  // ---------------------------------------------------------------------------

  /** Draw a frame. `dtMs` is real time. */
  render(dtMs: number): void {
    const dt = dtMs / 1000;
    this.time += dt;
    if (this.mixT < 1) {
      this.mixT = Math.min(1, this.mixT + dtMs / this.mixMs);
      const t = this.mixT;
      this.mix = this.mixFrom + (this.mixTo - this.mixFrom) * (t * t * (3 - 2 * t));
    }
    this.yaw += (this.yawTo - this.yaw) * Math.min(1, dt * 8);
    this.applyLight();
    this.placeCamera();
    this.renderer.render(this.scene, this.camera);
    const r = this.renderer.domElement;
    this.labels.update(this.camera, r.clientWidth, r.clientHeight, dt);
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize);
    this.labels.clear();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
