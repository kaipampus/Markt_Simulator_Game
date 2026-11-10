/**
 * 3D models built in code from the game's building definitions (soft toon
 * look). Every model is built facing south (+z, towards the default camera)
 * with its footprint centred on the origin; 1 grid cell = 1 unit.
 * Lamps are not lights themselves: they are listed in `userData.lamps`, and
 * the world lights the ones near the camera (see LightPool in World3D).
 */
import * as THREE from 'three';
import { TILE } from '../config';
import type { BuildingDef } from '../data/buildings';
import { STAFF, type Role } from '../data/staff';
import { DECK_DEPTH, DECK_HEIGHT, restaurantLayout } from '../entities/layout';

/** A light spot of a model, in the model's own coordinates. */
export interface LampSpot {
  pos: THREE.Vector3;
  color: number;
  power: number;
  distance: number;
}

/** Materials that glow at night (windows, lantern paper, flames). */
export const glowing = new Set<THREE.MeshToonMaterial>();

// --- toon materials ------------------------------------------------------------

/** Three soft light steps: the painted, cel-shaded look. */
const gradient = (() => {
  const data = new Uint8Array([90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  t.minFilter = THREE.NearestFilter;
  t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

const cache = new Map<string, THREE.MeshToonMaterial>();

export function mat(color: string | number): THREE.MeshToonMaterial {
  const key = String(color);
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, gradientMap: gradient });
    cache.set(key, m);
  }
  return m;
}

function glowMat(color: string | number, emissive: string | number): THREE.MeshToonMaterial {
  const key = `${color}|${emissive}`;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color, emissive, emissiveIntensity: 0, gradientMap: gradient });
    cache.set(key, m);
    glowing.add(m);
  }
  return m;
}

/** A material of its own (for figures that fade or change colour). */
export function ownMat(color: string | number, opacity = 1): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, gradientMap: gradient, transparent: opacity < 1, opacity });
}

function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function lamps(g: THREE.Object3D): LampSpot[] {
  g.userData.lamps ??= [];
  return g.userData.lamps as LampSpot[];
}

/** A warm light spot that shines at night. */
function lamp(g: THREE.Object3D, x: number, y: number, z: number, color = 0xffb060, power = 7, distance = 7): void {
  lamps(g).push({ pos: new THREE.Vector3(x, y, z), color, power, distance });
}

/** Paper lantern: glowing ball with a dark cap. */
function paperLantern(g: THREE.Group, x: number, y: number, z: number, r = 0.12, color = '#d9452b'): void {
  const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), glowMat(color, '#ff8a3c'));
  ball.scale.y = 1.25;
  ball.position.set(x, y, z);
  g.add(ball);
  g.add(box(r * 1.2, r * 0.3, r * 1.2, mat('#2a1d1a'), x, y + r * 1.15, z));
}

function canvasTexture(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const stripeCache = new Map<string, THREE.MeshToonMaterial>();
/** Striped awning in the building's two colours. */
function stripes(a: string, b: string): THREE.MeshToonMaterial {
  const key = a + b;
  let m = stripeCache.get(key);
  if (!m) {
    const t = canvasTexture(64, 8, (ctx) => {
      for (let i = 0; i < 8; i++) {
        ctx.fillStyle = i % 2 === 0 ? a : b;
        ctx.fillRect(i * 8, 0, 8, 8);
      }
    });
    t.wrapS = THREE.RepeatWrapping;
    m = new THREE.MeshToonMaterial({ map: t, gradientMap: gradient, side: THREE.DoubleSide });
    stripeCache.set(key, m);
  }
  return m;
}

const signCache = new Map<string, THREE.MeshToonMaterial>();
/** Emoji sign as a small upright plane. */
function sign(text: string, w = 0.5): THREE.Mesh {
  let m = signCache.get(text);
  if (!m) {
    const t = canvasTexture(64, 64, (ctx) => {
      ctx.fillStyle = '#f4e6c8';
      ctx.fillRect(0, 0, 64, 64);
      ctx.font = '44px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 32, 36);
    });
    m = new THREE.MeshToonMaterial({ map: t, gradientMap: gradient, emissive: '#5a4a30', emissiveIntensity: 0 });
    glowing.add(m);
    signCache.set(text, m);
  }
  return new THREE.Mesh(new THREE.PlaneGeometry(w, w), m);
}

// --- buildings -----------------------------------------------------------------------

/** Stall: open on the front and the back, counters on both sides, striped roof. */
function stall(def: BuildingDef): THREE.Group {
  const g = new THREE.Group();
  const w = def.w;
  const d = def.h * 0.85;
  const { main, roof, accent } = def.colors;
  const wood = mat(main);
  for (const z of [d / 2 - 0.12, -d / 2 + 0.12]) {
    g.add(box(w - 0.1, 0.42, 0.2, wood, 0, 0, z));
    g.add(box(w - 0.04, 0.05, 0.26, mat(accent), 0, 0.42, z));
  }
  for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) for (const z of [-d / 2 + 0.05, d / 2 - 0.05]) g.add(box(0.08, 1.15, 0.08, wood, x, 0, z));
  const roofMat = stripes(roof, accent);
  for (const side of [1, -1]) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.2, d * 0.62), roofMat);
    plane.position.set(0, 1.28, (side * d) / 4);
    plane.rotation.x = -Math.PI / 2 + side * 0.35;
    plane.castShadow = true;
    g.add(plane);
  }
  for (let x = -w / 2 + 0.35; x < w / 2 - 0.2; x += 0.5) paperLantern(g, x, 1.0, 0, 0.08);
  if (def.sign) {
    for (const side of [1, -1]) {
      const s = sign(def.sign, 0.3);
      s.position.set(0, 0.24, side * (d / 2 + 0.01));
      if (side < 0) s.rotation.y = Math.PI;
      g.add(s);
    }
  }
  lamp(g, 0, 1.0, 0, 0xffc070, 2.2, 3.5);
  return g;
}

/** Restaurant: open room (no roof) with kitchen at the back, pass counter and tables. */
function restaurant(def: BuildingDef, ew: boolean): THREE.Group {
  const g = new THREE.Group();
  const W = def.w;
  const D = def.h;
  const { main, roof, accent } = def.colors;
  const wallMat = mat(main);
  g.add(box(W, 0.04, D, mat('#6b4f38'), 0, 0, 0));
  g.add(box(W - 0.1, 0.05, D * 0.38, mat('#8f8a80'), 0, 0, -D / 2 + D * 0.19));
  g.add(box(W, 1.5, 0.12, wallMat, 0, 0, -D / 2 + 0.06));
  const deck = (def.restaurant?.upper ?? 0) > 0;
  g.add(box(W + 0.2, 0.12, 0.4, mat(roof), 0, deck ? DECK_HEIGHT + 0.75 : 1.5, -D / 2 + 0.1));
  const low = 0.45;
  const gap = 0.9;
  // Doors sit in the middle cell of a side (like the game's door cells).
  const doorX = Math.floor(W / 2) + 0.5 - W / 2;
  const doorZ = Math.floor(D / 2) + 0.5 - D / 2;
  const wallWithGap = (len: number, gapAt: number | null, place: (from: number, to: number) => void) => {
    if (gapAt === null) place(-len / 2, len / 2);
    else {
      place(-len / 2, gapAt - gap / 2);
      place(gapAt + gap / 2, len / 2);
    }
  };
  wallWithGap(W, ew ? null : doorX, (a, b) => g.add(box(b - a, low, 0.12, wallMat, (a + b) / 2, 0, D / 2 - 0.06)));
  for (const x of [-W / 2 + 0.06, W / 2 - 0.06]) {
    wallWithGap(D, ew ? doorZ : null, (a, b) => g.add(box(0.12, low, b - a, wallMat, x, 0, (a + b) / 2)));
  }
  if (!ew) g.add(box(gap, 1.1, 0.1, mat('#2a1d1a'), doorX, 0, -D / 2 + 0.13));
  for (let x = -W / 2 + 0.7; x < -W / 2 + 0.7 + Math.min(2, W - 1.4); x += 0.9) {
    g.add(box(0.7, 0.55, 0.45, mat('#3a3a44'), x, 0, -D / 2 + 0.4));
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.12, 12), mat('#1e1e24'));
    pot.position.set(x, 0.62, -D / 2 + 0.4);
    g.add(pot);
  }
  g.add(box(W * 0.8, 0.5, 0.22, mat(accent), 0, 0, -D / 2 + D * 0.38));
  if (def.sign) {
    const s = sign(def.sign, 0.55);
    s.position.set(W * 0.25, 1.05, -D / 2 + 0.13);
    g.add(s);
  }
  // Tables and seats where the game logic puts the guests (layout.ts).
  const layout = restaurantLayout(def);
  const at = (p: { x: number; y: number }) => [p.x / TILE - W / 2, p.y / TILE - D / 2] as const;
  for (const t of layout.tables) {
    const [x, z] = at(t.table);
    g.add(box(0.55, 0.32, 0.45, mat('#3a2a22'), x, t.table.z, z));
    g.add(box(0.3, 0.08, 0.3, mat(roof), x - 0.35, t.table.z, z + 0.1));
  }
  if (layout.stairs) upperFloor(g, W, D, layout.stairs, at, wallMat, mat(roof), accent);
  paperLantern(g, -W / 2 + 0.3, 1.25, -D / 2 + 0.25);
  paperLantern(g, W / 2 - 0.3, 1.25, -D / 2 + 0.25);
  lamp(g, 0, deck ? DECK_HEIGHT + 1.2 : 1.6, 0, 0xffc890, 7, Math.max(W, D) * 1.1);
  return g;
}

/**
 * Second floor of a restaurant: a deck over the kitchen on posts, with a
 * railing, a low back wall, lanterns and stairs along its front edge.
 */
function upperFloor(
  g: THREE.Group,
  W: number,
  D: number,
  stairs: { bottom: { x: number; y: number }; top: { x: number; y: number } },
  at: (p: { x: number; y: number }) => readonly [number, number],
  wallMat: THREE.Material,
  roofMat: THREE.Material,
  accent: string,
): void {
  const y = DECK_HEIGHT;
  const depth = D * DECK_DEPTH;
  const front = -D / 2 + depth;
  const wood = mat('#6b4f38');
  const dark = mat('#2a1d1a');
  // Floor and the beam along its front edge.
  g.add(box(W, 0.1, depth, wood, 0, y - 0.1, -D / 2 + depth / 2));
  g.add(box(W, 0.14, 0.12, dark, 0, y - 0.2, front - 0.06));
  // Posts under the front edge (none where the stairs come up).
  for (const x of [-W / 2 + 0.08, W / 2 - 0.08, W * 0.36]) g.add(box(0.12, y - 0.1, 0.12, dark, x, 0, front - 0.06));
  // Low walls on the back and the sides, a railing along the front with a gap at the top of the stairs.
  g.add(box(W, 0.75, 0.12, wallMat, 0, y, -D / 2 + 0.06));
  for (const x of [-W / 2 + 0.06, W / 2 - 0.06]) g.add(box(0.12, 0.45, depth, wallMat, x, y, -D / 2 + depth / 2));
  const [topX] = at(stairs.top);
  const gapFrom = topX - 0.35;
  const gapTo = topX + 0.35;
  for (const [a, b] of [[-W / 2, gapFrom], [gapTo, W / 2]] as const) {
    if (b - a < 0.05) continue;
    g.add(box(b - a, 0.05, 0.06, roofMat, (a + b) / 2, y + 0.4, front - 0.04));
    for (let x = a + 0.15; x < b - 0.05; x += 0.45) g.add(box(0.05, 0.4, 0.05, dark, x, y, front - 0.04));
  }
  // Stairs: steps rising from left to right in front of the deck.
  const [x0, zc] = at(stairs.bottom);
  const steps = 8;
  const run = (topX - x0) / steps;
  for (let i = 0; i < steps; i++) {
    const h = (y * (i + 1)) / steps;
    g.add(box(run + 0.01, h, 0.42, wood, x0 + run * (i + 0.5), 0, zc));
  }
  g.add(box(topX - x0, 0.05, 0.05, roofMat, (x0 + topX) / 2, y * 0.5 + 0.45, zc + 0.22));
  // A garland of lanterns over the upper floor.
  for (let i = 0; i < 3; i++) paperLantern(g, -W / 2 + (W * (i + 0.5)) / 3, y + 1.05, -D / 2 + 0.25, 0.11, i === 1 ? accent : '#d9452b');
}

/** House, lodge, hotel, restroom: walls, glowing windows and a hipped roof. */
function house(def: BuildingDef): THREE.Group {
  const g = new THREE.Group();
  const W = def.w * 0.9;
  const D = def.h * 0.85;
  const { main, roof, accent } = def.colors;
  const floors = def.rise > 110 ? 3 : def.rise > 60 ? 2 : 1;
  const fh = 0.85;
  for (let f = 0; f < floors; f++) {
    const inset = f * 0.15;
    g.add(box(W - inset, fh, D - inset, mat(main), 0, f * fh, 0));
    for (let x = -W / 2 + 0.4; x < W / 2 - 0.2; x += 0.6) {
      const win = box(0.25, 0.3, 0.02, glowMat(accent, '#ffb060'), x, f * fh + 0.35, (D - inset) / 2 + 0.005);
      win.castShadow = false;
      g.add(win);
    }
  }
  g.add(box(0.35, 0.6, 0.03, glowMat('#2a1d1a', '#ff9a50'), 0, 0, D / 2 + 0.01));
  g.add(box(0.5, 0.15, 0.04, mat('#2f4f7a'), 0, 0.6, D / 2 + 0.02));
  const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(Math.max(W, D) * 0.78, 0.9, 4, 1), mat(roof));
  roofMesh.rotation.y = Math.PI / 4;
  roofMesh.scale.set(W / Math.max(W, D), 1, D / Math.max(W, D));
  roofMesh.position.y = floors * fh + 0.45;
  roofMesh.castShadow = true;
  g.add(roofMesh);
  paperLantern(g, -W / 2 + 0.15, 0.9, D / 2 + 0.12);
  paperLantern(g, W / 2 - 0.15, 0.9, D / 2 + 0.12);
  lamp(g, 0, 0.8, D / 2 + 0.6, 0xffb060, 3, 4);
  return g;
}

/** Paper lantern, gas lamp or neon sign on a post. */
function lampPost(def: BuildingDef): THREE.Group {
  const g = new THREE.Group();
  const neon = def.style === 'neon';
  const gas = def.style === 'gaslamp';
  g.add(box(0.08, gas ? 1.5 : 1.2, 0.08, mat(gas || neon ? '#2a2d33' : '#2a1d1a')));
  if (neon) {
    const sign = box(0.5, 0.35, 0.06, glowMat(def.colors.main, def.colors.main), 0, 1.0, 0.05);
    g.add(sign);
    lamp(g, 0, 1.1, 0.2, 0xff6fc0, 8, 7);
  } else if (gas) {
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.08, 0.25, 6), glowMat('#fff1c4', '#ffe9a8'));
    glass.position.y = 1.62;
    g.add(glass);
    lamp(g, 0, 1.6, 0, 0xfff0c0, 10, 9);
  } else {
    g.add(box(0.4, 0.05, 0.05, mat('#2a1d1a'), 0.12, 1.2, 0));
    paperLantern(g, 0.25, 1.0, 0, 0.16);
    lamp(g, 0.25, 1.0, 0, 0xff9a50, 9, 8);
  }
  return g;
}

function brazier(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const leg = box(0.05, 0.7, 0.05, mat('#2a2226'));
    leg.position.set(Math.cos((i * Math.PI * 2) / 3) * 0.2, 0, Math.sin((i * Math.PI * 2) / 3) * 0.2);
    g.add(leg);
  }
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.18, 0.18, 12), mat('#3a3236'));
  bowl.position.y = 0.75;
  g.add(bowl);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 8), glowMat('#ff9a3c', '#ff7a1c'));
  flame.position.y = 1.05;
  g.add(flame);
  lamp(g, 0, 1.2, 0, 0xff7a2c, 12, 8);
  return g;
}

function bin(def: BuildingDef): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.5, 10), mat(def.colors.main));
  body.position.y = 0.25;
  body.castShadow = true;
  g.add(body);
  g.add(box(0.46, 0.05, 0.46, mat(def.colors.roof), 0, 0.5, 0));
  return g;
}

/** Shrine: a small red torii. */
function torii(def: BuildingDef): THREE.Group {
  const g = new THREE.Group();
  const red = mat(def.colors.main);
  for (const x of [-0.3, 0.3]) g.add(box(0.08, 1.1, 0.08, red, x, 0, 0));
  g.add(box(0.85, 0.08, 0.12, mat(def.colors.roof), 0, 1.1, 0));
  g.add(box(0.7, 0.06, 0.08, red, 0, 0.9, 0));
  g.add(box(0.3, 0.25, 0.25, mat(def.colors.accent), 0, 0, -0.25));
  return g;
}

/** Vending machine or arcade: boxes with a glowing front. */
function machine(def: BuildingDef): THREE.Group {
  const g = new THREE.Group();
  const W = def.w * 0.8;
  const D = def.h * 0.6;
  const H = def.style === 'arcade' ? 1.4 : 1.1;
  g.add(box(W, H, D, mat(def.colors.main)));
  g.add(box(W * 0.8, H * 0.55, 0.02, glowMat(def.colors.accent, def.colors.accent), 0, H * 0.3, D / 2 + 0.01));
  if (def.style === 'arcade') g.add(box(W + 0.1, 0.2, D + 0.1, glowMat(def.colors.roof, def.colors.roof), 0, H, 0));
  lamp(g, 0, H * 0.6, D / 2 + 0.4, def.glow?.color ?? 0x9fe8ff, 4, 4);
  return g;
}

/** Wooden, stone or steel bridge across the river (1 cell wide, length = footprint). */
export function bridge(def: BuildingDef): THREE.Group {
  const g = new THREE.Group();
  const L = def.h;
  const { main, roof } = def.colors;
  g.add(box(0.9, 0.12, L + 0.2, mat(main), 0, 0.02, 0));
  for (const x of [-0.42, 0.42]) {
    g.add(box(0.06, 0.06, L + 0.2, mat(roof), x, 0.42, 0));
    for (let z = -L / 2; z <= L / 2 + 0.01; z += 0.75) g.add(box(0.07, 0.45, 0.07, mat(roof), x, 0.02, z));
  }
  return g;
}

/** Ferry: a jetty on both banks (the boat is a separate model). */
export function ferryDock(def: BuildingDef): THREE.Group {
  const g = new THREE.Group();
  const L = def.h;
  for (const z of [-L / 2 + 0.35, L / 2 - 0.35]) {
    g.add(box(0.9, 0.08, 0.7, mat(def.colors.main), 0, 0.02, z));
    for (const x of [-0.4, 0.4]) g.add(box(0.08, 0.5, 0.08, mat(def.colors.roof), x, -0.3, z));
  }
  return g;
}

export function boat(def: BuildingDef): THREE.Group {
  const g = new THREE.Group();
  const hull = box(0.75, 0.25, 1.1, mat(def.colors.main), 0, -0.05, 0);
  g.add(hull);
  g.add(box(0.5, 0.35, 0.4, mat(def.colors.roof), 0, 0.2, -0.25));
  const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 8), mat('#2a2226'));
  chimney.position.set(0, 0.7, -0.25);
  g.add(chimney);
  lamp(g, 0, 0.6, 0.4, 0xffd080, 3, 4);
  return g;
}

/** The market gate: a red torii with two lanterns. */
export function gate(): THREE.Group {
  const g = new THREE.Group();
  const red = mat('#c8372d');
  for (const x of [-0.8, 0.8]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 2.2, 10), red);
    post.position.set(x, 1.1, 0);
    post.castShadow = true;
    g.add(post);
    paperLantern(g, x, 1.4, 0.3, 0.14);
    lamp(g, x, 1.4, 0.4, 0xff9a50, 8, 7);
  }
  g.add(box(2.4, 0.16, 0.24, mat('#1e1a1a'), 0, 2.2, 0));
  g.add(box(2.0, 0.12, 0.18, red, 0, 1.8, 0));
  return g;
}

/** A model for any building definition. */
export function buildModel(def: BuildingDef, rot: number): THREE.Group {
  switch (def.style) {
    case 'stall':
      return stall(def);
    case 'restaurant':
      return restaurant(def, rot % 2 === 1);
    case 'lantern':
    case 'gaslamp':
    case 'neon':
      return lampPost(def);
    case 'brazier':
      return brazier();
    case 'bin':
      return bin(def);
    case 'torii':
      return torii(def);
    case 'vending':
    case 'arcade':
      return machine(def);
    case 'bridge':
      return bridge(def);
    case 'ferry':
      return ferryDock(def);
    default:
      return house(def);
  }
}

// --- figures ---------------------------------------------------------------------------

export interface Figure {
  group: THREE.Group;
  /** Materials of this figure (for fading and burning). */
  mats: THREE.MeshToonMaterial[];
}

const capsule = new THREE.CapsuleGeometry(0.2, 0.3, 4, 10);
const eye = new THREE.SphereGeometry(0.03, 6, 6);
const eyeMat = new THREE.MeshBasicMaterial({ color: '#1a1626' });

/** A spirit guest: soft ghost with two eyes. */
export function spiritFigure(tint: number, scale: number, opacity: number): Figure {
  const group = new THREE.Group();
  const body = ownMat(tint, opacity);
  body.emissive = new THREE.Color('#9fc4ff');
  body.emissiveIntensity = 0.25;
  const mesh = new THREE.Mesh(capsule, body);
  mesh.position.y = 0.45;
  mesh.castShadow = true;
  group.add(mesh);
  for (const x of [-0.07, 0.07]) {
    const e = new THREE.Mesh(eye, eyeMat);
    e.position.set(x, 0.6, 0.18);
    group.add(e);
  }
  group.scale.setScalar(scale);
  return { group, mats: [body] };
}

/** A worker: ghost in a work coat (job colour) with a headband. */
export function workerFigure(role: Role): Figure {
  const { group, mats } = spiritFigure(0xffffff, 1, 1);
  const coat = ownMat(STAFF[role].coat);
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.23, 0.32, 12), coat);
  c.position.y = 0.3;
  c.castShadow = true;
  group.add(c);
  const band = ownMat(STAFF[role].band);
  const b = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.025, 6, 16), band);
  b.rotation.x = Math.PI / 2;
  b.position.y = 0.68;
  group.add(b);
  return { group, mats: [...mats, coat, band] };
}

export function plate(): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 12), mat('#f4f0e6'));
  m.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), mat('#d9a42b')));
  return m;
}

// --- ground details ------------------------------------------------------------------------

export function pathTile(look = 0): THREE.Mesh {
  const color = ['#8a7458', '#8f8a86', '#3a3d44'][look] ?? '#8a7458';
  const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.04, 1), mat(color));
  m.position.y = 0.02;
  m.receiveShadow = true;
  return m;
}

export function doormat(): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.4), glowMat('#a8743a', '#6a3a10'));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.045;
  return m;
}

/** Litter (paper bits) and slime puddles on a path cell. */
export function litter(): THREE.Group {
  const g = new THREE.Group();
  const colors = ['#e8dcc0', '#f3e9d2', '#c9b48a', '#d9452b'];
  for (let i = 0; i < 6; i++) {
    const bit = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.08), mat(colors[i % 4]));
    bit.position.set((Math.random() - 0.5) * 0.7, 0.05, (Math.random() - 0.5) * 0.7);
    bit.rotation.y = Math.random() * Math.PI;
    g.add(bit);
  }
  return g;
}

const slimeMat = new THREE.MeshToonMaterial({ color: '#8fe08a', gradientMap: gradient, transparent: true, opacity: 0.75, emissive: '#3a8a3a', emissiveIntensity: 0.3 });
export function slime(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const blob = new THREE.Mesh(new THREE.CircleGeometry(0.14 + Math.random() * 0.08, 12), slimeMat);
    blob.rotation.x = -Math.PI / 2;
    blob.position.set((Math.random() - 0.5) * 0.6, 0.05, (Math.random() - 0.5) * 0.6);
    blob.scale.x = 1.4;
    g.add(blob);
  }
  return g;
}

/** Make a model see-through in one colour (placement preview). */
export function ghostify(model: THREE.Object3D, color: number): void {
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false });
  model.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.material = m;
      o.castShadow = false;
    }
  });
}
