/**
 * 3D TEST: simple low-poly models built from the game's building definitions.
 * Every model is built facing south (+z, towards the default camera) with its
 * footprint centred on the origin; 1 grid cell = 1 unit.
 */
import * as THREE from 'three';
import type { BuildingDef } from '../data/buildings';

/** Things that change between day and night. */
export interface NightParts {
  lights: THREE.PointLight[];
  /** Materials that glow at night (windows, lantern paper, flames). */
  glowing: THREE.MeshStandardMaterial[];
}

export const night: NightParts = { lights: [], glowing: [] };

function mat(color: string | number, extra: THREE.MeshStandardMaterialParameters = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0.02, ...extra });
}

function glowMat(color: string | number, emissive: string | number): THREE.MeshStandardMaterial {
  const m = mat(color, { emissive, emissiveIntensity: 0 });
  night.glowing.push(m);
  return m;
}

function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** A warm light that only shines at night. */
function lamp(group: THREE.Group, x: number, y: number, z: number, color = 0xffb060, power = 7, distance = 7): void {
  const light = new THREE.PointLight(color, 0, distance, 1.6);
  light.position.set(x, y, z);
  light.userData.power = power;
  night.lights.push(light);
  group.add(light);
}

/** Paper lantern: red glowing ball with a dark cap. */
function paperLantern(group: THREE.Group, x: number, y: number, z: number, r = 0.12): void {
  const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), glowMat('#d9452b', '#ff8a3c'));
  ball.scale.y = 1.25;
  ball.position.set(x, y, z);
  group.add(ball);
  group.add(box(r * 1.2, r * 0.3, r * 1.2, mat('#2a1d1a'), x, y + r * 1.15, z));
}

/** Striped awning texture in the building's two colours. */
function stripes(a: string, b: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 8;
  const ctx = c.getContext('2d')!;
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 === 0 ? a : b;
    ctx.fillRect(i * 8, 0, 8, 8);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Emoji sign as a small upright plane. */
function sign(text: string, w = 0.5): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f4e6c8';
  ctx.fillRect(0, 0, 64, 64);
  ctx.font = '44px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 32, 36);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w, w), new THREE.MeshStandardMaterial({ map: t, roughness: 1 }));
}

// ---------------------------------------------------------------------------

/** Stall: open on the front and the back, counter on both sides, striped roof. */
function stall(def: BuildingDef): THREE.Group {
  const g = new THREE.Group();
  const w = def.w;
  const d = def.h * 0.85;
  const { main, roof, accent } = def.colors;
  const wood = mat(main);
  // Counters front and back.
  for (const z of [d / 2 - 0.12, -d / 2 + 0.12]) {
    g.add(box(w - 0.1, 0.42, 0.2, wood, 0, 0, z));
    g.add(box(w - 0.04, 0.05, 0.26, mat(accent), 0, 0.42, z));
  }
  // Posts and a slanted striped roof.
  for (const x of [-w / 2 + 0.06, w / 2 - 0.06]) for (const z of [-d / 2 + 0.05, d / 2 - 0.05]) g.add(box(0.08, 1.15, 0.08, wood, x, 0, z));
  const roofMat = new THREE.MeshStandardMaterial({ map: stripes(roof, accent), roughness: 0.9, side: THREE.DoubleSide });
  roofMat.map!.repeat.set(Math.max(1, w), 1);
  roofMat.map!.wrapS = THREE.RepeatWrapping;
  for (const side of [1, -1]) {
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.2, d * 0.62), roofMat);
    plane.position.set(0, 1.28, (side * d) / 4);
    plane.rotation.x = -Math.PI / 2 + side * 0.35;
    plane.castShadow = true;
    g.add(plane);
  }
  // Goods: pots or lanterns, and the sign.
  for (let x = -w / 2 + 0.35; x < w / 2 - 0.2; x += 0.5) paperLantern(g, x, 1.0, 0, 0.08);
  if (def.sign) {
    const s = sign(def.sign, 0.3);
    s.position.set(0, 0.24, d / 2 + 0.01);
    g.add(s);
  }
  lamp(g, 0, 1.0, 0, 0xffc070, 2.2, 3.5);
  return g;
}

/** Restaurant: open room (no roof) with kitchen at the back and tables. */
function restaurant(def: BuildingDef, ew: boolean): THREE.Group {
  const g = new THREE.Group();
  const W = def.w;
  const D = def.h;
  const { main, roof, accent } = def.colors;
  const wallMat = mat(main);
  g.add(box(W, 0.04, D, mat('#6b4f38'), 0, 0, 0));
  // Kitchen floor tiles.
  g.add(box(W - 0.1, 0.05, D * 0.38, mat('#8f8a80'), 0, 0, -D / 2 + D * 0.19));
  // Back wall (tall) with a roof edge; low side and front walls with door gaps.
  g.add(box(W, 1.5, 0.12, wallMat, 0, 0, -D / 2 + 0.06));
  g.add(box(W + 0.2, 0.12, 0.4, mat(roof), 0, 1.5, -D / 2 + 0.1));
  const low = 0.45;
  const gap = 0.9;
  const wallWithGap = (len: number, hasGap: boolean, place: (from: number, to: number) => void) => {
    if (!hasGap) place(-len / 2, len / 2);
    else {
      place(-len / 2, -gap / 2);
      place(gap / 2, len / 2);
    }
  };
  wallWithGap(W, !ew, (a, b) => g.add(box(b - a, low, 0.12, wallMat, (a + b) / 2, 0, D / 2 - 0.06)));
  for (const x of [-W / 2 + 0.06, W / 2 - 0.06]) {
    wallWithGap(D, ew, (a, b) => g.add(box(0.12, low, b - a, wallMat, x, 0, (a + b) / 2)));
  }
  if (!ew) g.add(box(gap, 1.1, 0.1, mat('#2a1d1a'), 0, 0, -D / 2 + 0.13)); // back door
  // Kitchen: stoves along the back wall, the pass counter in front.
  for (let x = -W / 2 + 0.7; x < -W / 2 + 0.7 + Math.min(2, W - 1.4); x += 0.9) {
    g.add(box(0.7, 0.55, 0.45, mat('#3a3a44'), x, 0, -D / 2 + 0.4));
    const fire = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.12, 12), mat('#1e1e24'));
    fire.position.set(x, 0.62, -D / 2 + 0.4);
    g.add(fire);
  }
  g.add(box(W * 0.8, 0.5, 0.22, mat(accent), 0, 0, -D / 2 + D * 0.38));
  // Sign on the back wall.
  if (def.sign) {
    const s = sign(def.sign, 0.55);
    s.position.set(W * 0.25, 1.05, -D / 2 + 0.13);
    g.add(s);
  }
  // Tables with cushions in two rows.
  const n = def.restaurant?.tables ?? 4;
  const cols = Math.ceil(n / 2);
  for (let i = 0; i < n; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = -W / 2 + (W * (col + 0.5)) / cols;
    const z = -D / 2 + D * (0.62 + row * 0.24);
    g.add(box(0.55, 0.32, 0.45, mat('#3a2a22'), x, 0, z));
    g.add(box(0.3, 0.08, 0.3, mat(roof), x - 0.45, 0, z));
  }
  paperLantern(g, -W / 2 + 0.3, 1.25, -D / 2 + 0.25);
  paperLantern(g, W / 2 - 0.3, 1.25, -D / 2 + 0.25);
  lamp(g, 0, 1.6, 0, 0xffc890, 7, Math.max(W, D) * 1.1);
  return g;
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
    // Windows on the front.
    for (let x = -W / 2 + 0.4; x < W / 2 - 0.2; x += 0.6) {
      const win = box(0.25, 0.3, 0.02, glowMat(accent, '#ffb060'), x, f * fh + 0.35, (D - inset) / 2 + 0.005);
      win.castShadow = false;
      g.add(win);
    }
  }
  // Door with a little curtain.
  g.add(box(0.35, 0.6, 0.03, glowMat('#2a1d1a', '#ff9a50'), 0, 0, D / 2 + 0.01));
  g.add(box(0.5, 0.15, 0.04, mat('#2f4f7a'), 0, 0.6, D / 2 + 0.02));
  // Hipped roof.
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

function paperLanternPost(def: BuildingDef): THREE.Group {
  const g = new THREE.Group();
  g.add(box(0.08, 1.2, 0.08, mat('#2a1d1a')));
  g.add(box(0.4, 0.05, 0.05, mat('#2a1d1a'), 0.12, 1.2, 0));
  paperLantern(g, 0.25, 1.0, 0, 0.16);
  lamp(g, 0.25, 1.0, 0, 0xff9a50, 9, 8);
  void def;
  return g;
}

function brazier(): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const leg = box(0.05, 0.7, 0.05, mat('#2a2226'));
    leg.position.set(Math.cos((i * Math.PI * 2) / 3) * 0.2, 0, Math.sin((i * Math.PI * 2) / 3) * 0.2);
    leg.rotation.z = 0.1;
    g.add(leg);
  }
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.18, 0.18, 12), mat('#3a3236'));
  bowl.position.y = 0.75;
  g.add(bowl);
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 8), glowMat('#ff9a3c', '#ff7a1c'));
  flame.position.y = 1.05;
  flame.userData.flicker = true;
  g.add(flame);
  lamp(g, 0, 1.2, 0, 0xff7a2c, 12, 8);
  return g;
}

function bin(): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.5, 10), mat('#5a6b4a'));
  body.position.y = 0.25;
  body.castShadow = true;
  g.add(body);
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

/** A model for any building definition (falls back to a plain house). */
export function buildModel(def: BuildingDef, rot: number): THREE.Group {
  switch (def.style) {
    case 'stall':
      return stall(def);
    case 'restaurant':
      return restaurant(def, rot % 2 === 1);
    case 'lantern':
    case 'gaslamp':
    case 'neon':
      return paperLanternPost(def);
    case 'brazier':
      return brazier();
    case 'bin':
      return bin();
    default:
      return house(def);
  }
}
