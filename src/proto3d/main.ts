/**
 * 3D TEST (prototype, not part of the game): the same game state as the real
 * game, shown in real 3D with a camera that can be turned and tilted from
 * almost straight down to almost the side. Open /prototype-3d.html.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GRID_H, GRID_W, RIVER_ROWS, RIVER_TOP } from '../config';
import { getBuilding } from '../data/buildings';
import { GameState, type PlacedBuilding } from '../state/GameState';
import { buildModel, gate, night } from './models';

const TEXT = {
  hud:
    '<b>3D test</b> · Left drag: turn and tilt · Right drag: move · Wheel: zoom · <b>T</b>: day / night<br>' +
    'Same buildings as in the game, just drawn in 3D. <a href="./index.html">Back to the game</a>',
};

// --- a small market, built with the real game rules --------------------------
const state = new GameState();
state.money = 99_999;
const place = (id: Parameters<GameState['place']>[0], tx: number, ty: number, rot: 0 | 1 | 2 | 3 = 0) => state.place(id, tx, ty, true, rot);
place('r_ramen', 17, 14, 1);
place('noodle', 14, 12, 0);
place('skewers', 14, 10 + 4, 0);
place('charm', 13, 17, 1);
place('bubbletea', 18, 11, 0);
place('tea', 11, 13, 0);
place('restroom', 13, 20, 0);
place('lantern', 15, 11);
place('lantern', 15, 16);
place('lantern', 17, 18);
place('brazier', 15, 19);
place('bin', 15, 13);
for (let x = 12; x < 16; x++) place('path', x, 16);

// --- renderer, scene, camera ---------------------------------------------------
const container = document.getElementById('view')!;
document.getElementById('hud')!.innerHTML = TEXT.hud;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(16, 13, 31);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(16, 0, 16);
controls.enableDamping = true;
controls.minDistance = 4;
controls.maxDistance = 45;
controls.minPolarAngle = 0.12; // almost straight down
controls.maxPolarAngle = 1.42; // almost from the side
controls.update();

// --- ground: hotel district, river, market --------------------------------------
function ground(z0: number, rows: number, color: string, y = 0): void {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(GRID_W, rows), new THREE.MeshStandardMaterial({ color, roughness: 1 }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(GRID_W / 2, y, z0 + rows / 2);
  mesh.receiveShadow = true;
  scene.add(mesh);
}
ground(0, RIVER_TOP, '#3a2f2c');
ground(RIVER_TOP, RIVER_ROWS, '#1d3d5c', -0.15);
ground(RIVER_TOP + RIVER_ROWS, GRID_H - RIVER_TOP - RIVER_ROWS, '#2b3640');
// Faint grid on the market.
const grid = new THREE.GridHelper(GRID_W, GRID_W, 0x1b222a, 0x1b222a);
grid.position.set(GRID_W / 2, 0.01, GRID_H / 2);
(grid.material as THREE.Material).opacity = 0.35;
(grid.material as THREE.Material).transparent = true;
scene.add(grid);

// --- buildings from the game state ---------------------------------------------
const pathMat = new THREE.MeshStandardMaterial({ color: '#8a7458', roughness: 1 });
/** Model faces south; rot turns it so its front faces west, north or east. */
const TURN = [0, -Math.PI / 2, Math.PI, Math.PI / 2];

function addBuilding(b: PlacedBuilding): void {
  const { def } = b;
  if (def.id === 'path') {
    const tile = new THREE.Mesh(new THREE.BoxGeometry(1, 0.04, 1), pathMat);
    tile.position.set(b.tx + 0.5, 0.02, b.ty + 0.5);
    tile.receiveShadow = true;
    scene.add(tile);
    return;
  }
  // Models are built in their base size and turned (restaurants only move their doors).
  const model = buildModel(def.restaurant ? def : getBuilding(def.id), b.rot);
  model.position.set(b.tx + def.w / 2, 0, b.ty + def.h / 2);
  if (!def.restaurant) model.rotation.y = TURN[b.rot];
  scene.add(model);
}
for (const b of state.buildings.values()) addBuilding(b);
const g = gate();
g.position.set(state.gate.tx + 1, 0, state.gate.ty + 0.5);
scene.add(g);

// --- spirits floating along the path ---------------------------------------------
const pathCells = [...state.buildings.values()].filter((b) => b.def.id === 'path' && b.tx === 16).map((b) => b.ty);
const minY = Math.min(...pathCells);
const maxY = Math.max(...pathCells);
const ghostMat = new THREE.MeshStandardMaterial({ color: '#f4f8ff', emissive: '#9fc4ff', emissiveIntensity: 0.25, transparent: true, opacity: 0.88 });
const eyeMat = new THREE.MeshBasicMaterial({ color: '#1a1626' });
const spirits = Array.from({ length: 10 }, (_, i) => {
  const ghost = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.3, 4, 10), ghostMat);
  body.position.y = 0.45;
  body.castShadow = true;
  ghost.add(body);
  for (const x of [-0.07, 0.07]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), eyeMat);
    eye.position.set(x, 0.6, 0.18);
    ghost.add(eye);
  }
  scene.add(ghost);
  return { ghost, t: i / 10, speed: 0.025 + Math.random() * 0.02, lane: (Math.random() - 0.5) * 0.5, seed: Math.random() * 10 };
});

// --- light: day and night ----------------------------------------------------------
const hemi = new THREE.HemisphereLight(0xffffff, 0x445566, 1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe8c0, 2.2);
sun.position.set(30, 40, 30);
sun.target.position.set(16, 0, 16);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 120 });
scene.add(sun, sun.target);
const moon = new THREE.AmbientLight(0x2a3a70, 0);
scene.add(moon);

let isNight = true;
let mix = 1; // 0 = day, 1 = night (animated)
const dayBg = new THREE.Color('#9fc4e8');
const nightBg = new THREE.Color('#05070f');
scene.fog = new THREE.FogExp2(nightBg.clone(), 0.02);

function applyLight(): void {
  hemi.intensity = THREE.MathUtils.lerp(1.1, 0.06, mix);
  sun.intensity = THREE.MathUtils.lerp(2.2, 0, mix);
  moon.intensity = THREE.MathUtils.lerp(0, 0.55, mix);
  for (const l of night.lights) l.intensity = (l.userData.power as number) * mix;
  for (const m of night.glowing) m.emissiveIntensity = 1.6 * mix;
  const bg = dayBg.clone().lerp(nightBg, mix);
  scene.background = bg;
  (scene.fog as THREE.FogExp2).color.copy(bg);
  (scene.fog as THREE.FogExp2).density = THREE.MathUtils.lerp(0.004, 0.02, mix);
}

window.addEventListener('keydown', (e) => {
  if (e.key === 't' || e.key === 'T') isNight = !isNight;
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- loop ---------------------------------------------------------------------------
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const dt = Math.min(0.05, clock.getDelta());
  const time = clock.elapsedTime;
  mix = THREE.MathUtils.clamp(mix + (isNight ? dt : -dt) * 0.8, 0, 1);
  applyLight();

  for (const s of spirits) {
    s.t = (s.t + s.speed * dt) % 2;
    const k = s.t < 1 ? s.t : 2 - s.t; // walk up and back down
    const z = THREE.MathUtils.lerp(maxY + 0.5, minY + 0.5, k);
    s.ghost.position.set(16.5 + s.lane, Math.sin(time * 2 + s.seed) * 0.06, z);
    s.ghost.rotation.y = s.t < 1 ? Math.PI : 0;
  }
  // Flickering flames and lights.
  for (const l of night.lights) l.intensity *= 0.92 + Math.sin(time * 9 + l.position.x * 3) * 0.08;

  controls.update();
  renderer.render(scene, camera);
});

// Handy for looking around in the browser console.
if (import.meta.env.DEV) Object.assign(window, { scene3d: scene, camera3d: camera, controls3d: controls });
