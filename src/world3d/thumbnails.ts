/**
 * Small pictures of the 3D models for the interface (build bar, worker cards).
 * Every model is photographed once at start-up with a small renderer of its
 * own, which is thrown away afterwards.
 */
import * as THREE from 'three';
import { BUILDINGS } from '../data/buildings';
import { ROLES } from '../data/staff';
import { buildModel, pathTile, workerFigure } from './models';

const SIZE = 128;

/** Picture URLs: building ids, and `worker:<role>` for the jobs. */
export type Thumbnails = Map<string, string>;

export function makeThumbnails(): Thumbnails {
  const out: Thumbnails = new Map();
  const canvas = document.createElement('canvas');
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  } catch {
    return out; // No WebGL: the interface shows names only.
  }
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE, false);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0x55607a, 1.6));
  const sun = new THREE.DirectionalLight(0xffe8c0, 2.4);
  sun.position.set(-4, 8, 6);
  scene.add(sun);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 200);

  const shoot = (key: string, model: THREE.Object3D) => {
    scene.add(model);
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const sphere = box.getBoundingSphere(new THREE.Sphere());
    // Three-quarter view from the front left, like the default camera.
    const dir = new THREE.Vector3(-0.55, 0.75, 1).normalize();
    const dist = (sphere.radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 0.92;
    camera.position.copy(sphere.center).addScaledVector(dir, dist);
    camera.lookAt(sphere.center);
    renderer.render(scene, camera);
    out.set(key, canvas.toDataURL('image/png'));
    // Geometries may be shared with the game's own models, so they are not disposed here.
    scene.remove(model);
  };

  for (const def of BUILDINGS) {
    try {
      shoot(def.id, def.id === 'path' ? pathTile(0) : buildModel(def, 0));
    } catch {
      // A model that cannot be built simply has no picture.
    }
  }
  for (const role of ROLES) shoot(`worker:${role}`, workerFigure(role).group);

  renderer.dispose();
  renderer.forceContextLoss();
  return out;
}
