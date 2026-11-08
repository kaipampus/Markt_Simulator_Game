import * as Phaser from 'phaser';
import { COLORS, GRID_H, GRID_W, TILE, WORLD_H, WORLD_W } from '../config';
import { BUILDINGS, GATE, type BuildingDef } from '../data/buildings';

/**
 * Placeholder graphics drawn with the Canvas 2D API at startup.
 * They will be replaced by real art in phase 5; keys stay the same.
 */

export const TEX = {
  ground: 'ground',
  gate: 'gate',
  glow: 'glow',
  spirit: 'spirit',
  shadow: 'shadow',
  coin: 'coin',
  dust: 'dust',
  building: (id: string) => `b_${id}`,
} as const;

type Ctx = CanvasRenderingContext2D;

function makeCanvas(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) throw new Error(`Could not create texture ${key}`);
  draw(tex.getContext());
  tex.refresh();
}

/** Lighten (amt > 0) or darken (amt < 0) a #rrggbb colour. */
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt))));
  const r = f((n >> 16) & 255);
  const g = f((n >> 8) & 255);
  const b = f(n & 255);
  return `rgb(${r},${g},${b})`;
}

function hex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}

/** Small deterministic random generator so the ground looks the same every start. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// shared drawing helpers
// ---------------------------------------------------------------------------

/** Soft shadow on the ground, centred at cx, `width` wide. */
function footShadow(ctx: Ctx, cx: number, width: number, h: number, footH: number): void {
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(cx, h - footH * 0.45, width * 0.5, footH * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
}

function glowDot(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function hangingLantern(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.strokeStyle = '#1e1414';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y - r - 4);
  ctx.lineTo(x, y - r);
  ctx.stroke();
  ctx.fillStyle = '#d9452b';
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.85, r, 0, 0, Math.PI * 2);
  ctx.fill();
  glowDot(ctx, x, y, r * 0.8, 'rgba(255,214,130,0.9)');
  ctx.fillStyle = '#1e1414';
  ctx.fillRect(x - r * 0.45, y - r - 1, r * 0.9, 2);
  ctx.fillRect(x - r * 0.45, y + r - 1, r * 0.9, 2);
}

/**
 * Asian-style hipped roof with upturned eave tips, seen from slightly above.
 * The eave runs along `eaveY` from x0 to x1; the ridge sits at `ridgeY`.
 */
function roof(ctx: Ctx, x0: number, x1: number, eaveY: number, ridgeY: number, color: string): void {
  const w = x1 - x0;
  const rl = x0 + w * 0.24;
  const rr = x1 - w * 0.24;
  const tip = Math.min(8, w * 0.08);

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x0, eaveY - tip);
  ctx.quadraticCurveTo(x0 + tip, eaveY, x0 + tip * 2.2, eaveY);
  ctx.lineTo(x1 - tip * 2.2, eaveY);
  ctx.quadraticCurveTo(x1 - tip, eaveY, x1, eaveY - tip);
  ctx.lineTo(rr, ridgeY);
  ctx.lineTo(rl, ridgeY);
  ctx.closePath();
  ctx.fill();

  // Tile rows.
  ctx.strokeStyle = shade(color, -0.35);
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 1;
  const rows = Math.max(3, Math.round(w / 9));
  for (let i = 1; i < rows; i++) {
    const t = i / rows;
    ctx.beginPath();
    ctx.moveTo(rl + (rr - rl) * t, ridgeY + 1);
    ctx.lineTo(x0 + tip * 2.2 + (w - tip * 4.4) * t, eaveY - 1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Light on the upper half, dark eave edge, ridge cap.
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.beginPath();
  ctx.moveTo(rl, ridgeY);
  ctx.lineTo(rr, ridgeY);
  ctx.lineTo(rr + (x1 - rr) * 0.45, ridgeY + (eaveY - ridgeY) * 0.45);
  ctx.lineTo(rl - (rl - x0) * 0.45, ridgeY + (eaveY - ridgeY) * 0.45);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = shade(color, -0.5);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x0, eaveY - tip);
  ctx.quadraticCurveTo(x0 + tip, eaveY, x0 + tip * 2.2, eaveY);
  ctx.lineTo(x1 - tip * 2.2, eaveY);
  ctx.quadraticCurveTo(x1 - tip, eaveY, x1, eaveY - tip);
  ctx.stroke();

  ctx.strokeStyle = shade(color, -0.55);
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(rl - 3, ridgeY - 2);
  ctx.lineTo(rr + 3, ridgeY - 2);
  ctx.stroke();
}

/** Front wall with wooden beams, a lit door and optional windows. */
function wall(ctx: Ctx, x0: number, x1: number, bottom: number, wallH: number, main: string, light: string, windows: boolean): void {
  const top = bottom - wallH;
  const w = x1 - x0;

  ctx.fillStyle = main;
  ctx.fillRect(x0, top, w, wallH);

  // Beams.
  ctx.fillStyle = shade(main, -0.4);
  ctx.fillRect(x0, top, w, 3);
  ctx.fillRect(x0, top, 3, wallH);
  ctx.fillRect(x1 - 3, top, 3, wallH);
  const beams = Math.floor(w / 26);
  for (let i = 1; i < beams; i++) ctx.fillRect(x0 + (w / beams) * i - 1, top, 2, wallH);

  // Stone foundation.
  ctx.fillStyle = '#4b4a55';
  ctx.fillRect(x0 - 2, bottom - 5, w + 4, 5);

  // Door.
  const dw = Math.min(20, w * 0.32);
  const dh = Math.min(wallH - 8, 30);
  const dx = x0 + (w - dw) / 2;
  ctx.fillStyle = shade(main, -0.55);
  ctx.fillRect(dx - 2, bottom - 5 - dh - 2, dw + 4, dh + 2);
  ctx.fillStyle = light;
  ctx.fillRect(dx, bottom - 5 - dh, dw, dh);
  ctx.fillStyle = 'rgba(120,60,20,0.35)';
  ctx.fillRect(dx + dw / 2 - 1, bottom - 5 - dh, 2, dh);

  if (windows && w > 70) {
    const ww = 14;
    const wh = Math.min(14, wallH - 20);
    const wy = top + Math.max(8, (wallH - wh) / 2 - 4);
    for (const wx of [x0 + w * 0.2 - ww / 2, x1 - w * 0.2 - ww / 2]) {
      ctx.fillStyle = shade(main, -0.55);
      ctx.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
      ctx.fillStyle = light;
      ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = 'rgba(90,50,20,0.5)';
      ctx.fillRect(wx + ww / 2 - 0.5, wy, 1, wh);
      ctx.fillRect(wx, wy + wh / 2 - 0.5, ww, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// building styles
// ---------------------------------------------------------------------------

function drawLantern(ctx: Ctx, w: number, h: number, def: BuildingDef): void {
  footShadow(ctx, w / 2, w * 0.6, h, 18);
  const cx = w / 2;
  const ly = Math.round(h * 0.32);

  // Stone base and pole.
  ctx.fillStyle = '#55545e';
  ctx.fillRect(cx - 8, h - 12, 16, 7);
  ctx.fillStyle = '#3a3640';
  ctx.fillRect(cx - 5, h - 15, 10, 4);
  ctx.fillStyle = def.colors.roof;
  ctx.fillRect(cx - 2, ly - 18, 4, h - 15 - (ly - 18));
  ctx.fillRect(cx - 2, ly - 20, 12, 3);

  // Lantern body.
  ctx.fillStyle = def.colors.main;
  ctx.beginPath();
  ctx.ellipse(cx, ly, 11, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  glowDot(ctx, cx, ly, 11, 'rgba(255,220,140,0.95)');
  ctx.strokeStyle = shade(def.colors.main, -0.35);
  ctx.lineWidth = 1;
  for (const k of [-0.5, 0, 0.5]) {
    ctx.beginPath();
    ctx.ellipse(cx, ly, Math.abs(11 * k) || 0.5, 14, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = def.colors.roof;
  ctx.fillRect(cx - 7, ly - 16, 14, 4);
  ctx.fillRect(cx - 7, ly + 12, 14, 4);
  ctx.fillRect(cx - 1, ly + 16, 2, 5);
}

function drawStall(ctx: Ctx, w: number, h: number, def: BuildingDef): void {
  const footH = def.h * TILE;
  footShadow(ctx, w / 2, w, h, footH);
  const { main, roof: awning, accent } = def.colors;

  const counterTop = h - 28;
  const awnTop = Math.max(4, h - footH - def.rise + 8);
  const awnBottom = awnTop + 20;

  // Back panel, posts.
  ctx.fillStyle = shade(main, -0.45);
  ctx.fillRect(8, awnBottom, w - 16, counterTop - awnBottom);
  ctx.fillStyle = shade(main, -0.25);
  ctx.fillRect(7, awnTop + 6, 4, h - awnTop - 10);
  ctx.fillRect(w - 11, awnTop + 6, 4, h - awnTop - 10);

  // Goods hanging under the awning.
  if (def.id === 'charm') {
    for (let x = 14; x < w - 12; x += 7) {
      ctx.fillStyle = accent;
      ctx.fillRect(x, awnBottom + 2, 4, 12);
      ctx.fillStyle = '#b8352a';
      ctx.fillRect(x + 1, awnBottom + 5, 2, 5);
    }
  } else {
    for (let x = 20; x < w - 14; x += 22) hangingLantern(ctx, x, awnBottom + 9, 5);
  }

  // Counter.
  ctx.fillStyle = main;
  ctx.fillRect(5, counterTop, w - 10, 24);
  ctx.fillStyle = shade(main, 0.25);
  ctx.fillRect(3, counterTop - 3, w - 6, 5);
  ctx.fillStyle = shade(main, -0.35);
  for (let x = 12; x < w - 8; x += 12) ctx.fillRect(x, counterTop + 4, 1, 18);

  // Things on the counter.
  if (def.id === 'noodle') {
    for (const bx of [w * 0.3, w * 0.7]) {
      ctx.fillStyle = '#e9e1d0';
      ctx.beginPath();
      ctx.ellipse(bx, counterTop - 4, 7, 4, 0, 0, Math.PI);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(bx - 2, counterTop - 8);
      ctx.quadraticCurveTo(bx - 6, counterTop - 13, bx - 1, counterTop - 18);
      ctx.moveTo(bx + 3, counterTop - 8);
      ctx.quadraticCurveTo(bx - 1, counterTop - 14, bx + 4, counterTop - 20);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = '#7fd1c1';
    ctx.beginPath();
    ctx.arc(w / 2 - 6, counterTop - 4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2c46a';
    ctx.beginPath();
    ctx.arc(w / 2 + 5, counterTop - 4, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Striped awning with scalloped edge.
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(10, awnTop);
  ctx.lineTo(w - 10, awnTop);
  ctx.lineTo(w - 2, awnBottom);
  ctx.lineTo(2, awnBottom);
  ctx.closePath();
  ctx.clip();
  const stripes = Math.max(4, Math.round(w / 10));
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? awning : accent;
    ctx.fillRect((w / stripes) * i, awnTop, w / stripes + 1, awnBottom - awnTop);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.fillRect(0, awnTop + (awnBottom - awnTop) * 0.6, w, awnBottom);
  ctx.restore();
  const scallops = Math.max(4, Math.round(w / 10));
  for (let i = 0; i < scallops; i++) {
    const sx = 2 + ((w - 4) / scallops) * (i + 0.5);
    ctx.fillStyle = i % 2 === 0 ? awning : accent;
    ctx.beginPath();
    ctx.arc(sx, awnBottom, (w - 4) / scallops / 2, 0, Math.PI);
    ctx.fill();
  }
  ctx.fillStyle = shade(awning, -0.5);
  ctx.fillRect(9, awnTop - 2, w - 18, 3);
}

function drawHouse(ctx: Ctx, w: number, h: number, def: BuildingDef): void {
  const footH = def.h * TILE;
  footShadow(ctx, w / 2, w, h, footH);
  const { main, roof: roofColor, accent } = def.colors;
  const bottom = h - 3;
  const wallH = Math.round((footH + def.rise) * 0.38);
  wall(ctx, 8, w - 8, bottom, wallH, main, accent, true);
  roof(ctx, 0, w, bottom - wallH + 6, 6, roofColor);
  hangingLantern(ctx, 14, bottom - wallH + 14, 6);
  hangingLantern(ctx, w - 14, bottom - wallH + 14, 6);
}

function drawTorii(ctx: Ctx, w: number, h: number, main: string, beam: string, withLanterns: boolean): void {
  footShadow(ctx, w / 2, w * 0.85, h, 20);
  const s = w / TILE; // scale relative to a one-cell gate
  const postW = Math.max(4, Math.round(4.5 * s));
  const postL = Math.round(w * 0.22);
  const postR = Math.round(w * 0.78) - postW;
  const top = Math.round(h * 0.2);

  // Posts with dark feet.
  ctx.fillStyle = main;
  ctx.fillRect(postL, top + 6, postW, h - top - 10);
  ctx.fillRect(postR, top + 6, postW, h - top - 10);
  ctx.fillStyle = '#1e1a1a';
  ctx.fillRect(postL - 1, h - 10, postW + 2, 6);
  ctx.fillRect(postR - 1, h - 10, postW + 2, 6);

  // Lower beam (nuki).
  ctx.fillStyle = main;
  ctx.fillRect(postL - 6 * s, top + 16 * s, postR - postL + postW + 12 * s, 4 * s);

  // Top beam (kasagi) with upturned ends.
  ctx.fillStyle = main;
  ctx.fillRect(4, top + 3 * s, w - 8, 4 * s);
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(0, top - 3 * s);
  ctx.quadraticCurveTo(w / 2, top + 3 * s, w, top - 3 * s);
  ctx.lineTo(w - 2, top + 3 * s);
  ctx.quadraticCurveTo(w / 2, top + 7 * s, 2, top + 3 * s);
  ctx.closePath();
  ctx.fill();

  // Plaque.
  ctx.fillStyle = '#1e1a1a';
  ctx.fillRect(w / 2 - 3 * s, top + 7 * s, 6 * s, 9 * s);
  ctx.fillStyle = '#d8b46a';
  ctx.fillRect(w / 2 - 2 * s, top + 8 * s, 4 * s, 7 * s);

  if (withLanterns) {
    hangingLantern(ctx, postL - 10, top + 36, 7);
    hangingLantern(ctx, postR + postW + 10, top + 36, 7);
  } else {
    // Small offering box with a candle between the posts.
    ctx.fillStyle = '#5c4632';
    ctx.fillRect(w / 2 - 6, h - 16, 12, 9);
    glowDot(ctx, w / 2, h - 19, 6, 'rgba(255,220,150,0.95)');
  }
}

function drawBathhouse(ctx: Ctx, w: number, h: number, def: BuildingDef): void {
  const footH = def.h * TILE;
  footShadow(ctx, w / 2, w, h, footH);
  const { main, roof: roofColor, accent } = def.colors;
  const bottom = h - 3;

  // Lower floor.
  const lowerWall = 74;
  wall(ctx, 10, w - 10, bottom, lowerWall, main, accent, true);
  const lowerEave = bottom - lowerWall + 6;
  roof(ctx, 0, w, lowerEave, lowerEave - 52, roofColor);

  // Chimney behind the upper floor.
  const chX = w - 34;
  ctx.fillStyle = '#5b3b33';
  ctx.fillRect(chX, 14, 14, lowerEave - 40);
  ctx.fillStyle = '#3a2622';
  ctx.fillRect(chX - 2, 12, 18, 5);
  for (const [px, py, r] of [
    [chX + 8, 6, 6],
    [chX + 15, 1, 5],
  ] as const) {
    ctx.fillStyle = 'rgba(220,225,235,0.35)';
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Upper floor sits on the lower roof.
  const upperBottom = lowerEave - 26;
  const upperWall = 38;
  wall(ctx, 34, w - 34, upperBottom, upperWall, shade(main, -0.08), accent, false);
  roof(ctx, 22, w - 22, upperBottom - upperWall + 6, 10, roofColor);

  // Banner over the door.
  ctx.fillStyle = '#c8372d';
  ctx.fillRect(w / 2 - 16, bottom - lowerWall + 4, 32, 9);
  ctx.fillStyle = '#f4e6c8';
  ctx.fillRect(w / 2 - 3, bottom - lowerWall + 6, 6, 5);

  hangingLantern(ctx, 16, lowerEave + 10, 7);
  hangingLantern(ctx, w - 16, lowerEave + 10, 7);
}

function drawBuilding(ctx: Ctx, w: number, h: number, def: BuildingDef): void {
  switch (def.style) {
    case 'lantern':
      return drawLantern(ctx, w, h, def);
    case 'stall':
      return drawStall(ctx, w, h, def);
    case 'house':
      return drawHouse(ctx, w, h, def);
    case 'torii':
      return drawTorii(ctx, w, h, def.colors.main, def.colors.roof, false);
    case 'bathhouse':
      return drawBathhouse(ctx, w, h, def);
  }
}

// ---------------------------------------------------------------------------
// ground, spirits, effects
// ---------------------------------------------------------------------------

function drawGround(ctx: Ctx): void {
  const rand = rng(7);
  const tones = [COLORS.groundA, COLORS.groundB, COLORS.groundC].map(hex);

  for (let y = 0; y < GRID_H; y++) {
    for (let x = 0; x < GRID_W; x++) {
      const px = x * TILE;
      const py = y * TILE;
      const base = tones[Math.floor(rand() * tones.length)];
      ctx.fillStyle = base;
      ctx.fillRect(px, py, TILE, TILE);

      // Bevel: light top-left, dark bottom-right.
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fillRect(px + 1, py + 1, TILE - 2, 2);
      ctx.fillRect(px + 1, py + 1, 2, TILE - 2);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(px + 1, py + TILE - 3, TILE - 2, 2);
      ctx.fillRect(px + TILE - 3, py + 1, 2, TILE - 2);

      // Moss specks.
      const specks = Math.floor(rand() * 4);
      for (let i = 0; i < specks; i++) {
        ctx.fillStyle = `rgba(110,150,110,${0.12 + rand() * 0.15})`;
        ctx.beginPath();
        ctx.arc(px + 6 + rand() * (TILE - 12), py + 6 + rand() * (TILE - 12), 1 + rand() * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // Grout lines.
  ctx.strokeStyle = hex(COLORS.groundLine);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= GRID_W; x++) {
    ctx.moveTo(x * TILE + 0.5, 0);
    ctx.lineTo(x * TILE + 0.5, WORLD_H);
  }
  for (let y = 0; y <= GRID_H; y++) {
    ctx.moveTo(0, y * TILE + 0.5);
    ctx.lineTo(WORLD_W, y * TILE + 0.5);
  }
  ctx.stroke();

  // Darker vignette towards the market edge.
  const g = ctx.createRadialGradient(WORLD_W / 2, WORLD_H / 2, WORLD_H * 0.3, WORLD_W / 2, WORLD_H / 2, WORLD_W * 0.62);
  g.addColorStop(0, 'rgba(10,12,24,0)');
  g.addColorStop(1, 'rgba(10,12,24,0.55)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  ctx.strokeStyle = hex(COLORS.groundEdge);
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, WORLD_W - 6, WORLD_H - 6);
}

function drawSpirit(ctx: Ctx, w: number, h: number): void {
  const cx = w / 2;
  const r = w / 2 - 4;
  const bodyBottom = h - 6;

  ctx.fillStyle = 'rgba(250,252,255,0.95)';
  ctx.beginPath();
  ctx.moveTo(cx - r, r + 4);
  ctx.arc(cx, r + 4, r, Math.PI, 0);
  ctx.lineTo(cx + r, bodyBottom - 3);
  const bumps = 4;
  const bw = (r * 2) / bumps;
  for (let i = 0; i < bumps; i++) {
    const x0 = cx + r - bw * i;
    ctx.quadraticCurveTo(x0 - bw / 2, bodyBottom + 4, x0 - bw, bodyBottom - 3);
  }
  ctx.closePath();
  ctx.fill();

  // Soft inner shading.
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(1, 'rgba(150,160,200,0.25)');
  ctx.fillStyle = g;
  ctx.fill();

  // Face.
  ctx.fillStyle = '#1a1626';
  ctx.beginPath();
  ctx.ellipse(cx - 5, r + 3, 2.2, 3.2, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 5, r + 3, 2.2, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,140,170,0.45)';
  ctx.beginPath();
  ctx.ellipse(cx - 9, r + 9, 3, 2, 0, 0, Math.PI * 2);
  ctx.ellipse(cx + 9, r + 9, 3, 2, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------

/** Creates every placeholder texture once. Safe to call again. */
export function createTextures(scene: Phaser.Scene): void {
  makeCanvas(scene, TEX.ground, WORLD_W, WORLD_H, drawGround);

  for (const def of BUILDINGS) {
    const w = def.w * TILE;
    const h = def.h * TILE + def.rise;
    makeCanvas(scene, TEX.building(def.id), w, h, (ctx) => drawBuilding(ctx, w, h, def));
  }

  const gw = GATE.w * TILE;
  const gh = GATE.h * TILE + GATE.rise;
  makeCanvas(scene, TEX.gate, gw, gh, (ctx) => drawTorii(ctx, gw, gh, '#c8372d', '#1e1a1a', true));

  makeCanvas(scene, TEX.glow, 256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,205,130,0.55)');
    g.addColorStop(0.35, 'rgba(255,170,90,0.2)');
    g.addColorStop(1, 'rgba(255,150,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  });

  makeCanvas(scene, TEX.spirit, 36, 46, (ctx) => drawSpirit(ctx, 36, 46));

  makeCanvas(scene, TEX.shadow, 30, 12, (ctx) => {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(15, 6, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  });

  makeCanvas(scene, TEX.coin, 22, 22, (ctx) => {
    const g = ctx.createRadialGradient(8, 8, 1, 11, 11, 11);
    g.addColorStop(0, '#fbe6a2');
    g.addColorStop(1, '#c48d2c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(11, 11, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8a6420';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeRect(7.5, 7.5, 7, 7);
    ctx.fillStyle = '#141a28';
    ctx.fillRect(8.5, 8.5, 5, 5);
  });

  makeCanvas(scene, TEX.dust, 16, 16, (ctx) => {
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, 'rgba(200,195,210,0.8)');
    g.addColorStop(1, 'rgba(200,195,210,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 16);
  });
}
