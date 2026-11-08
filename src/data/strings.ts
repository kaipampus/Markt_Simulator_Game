import type { BuildingId, Category, Need, Zone } from './buildings';

function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** All player-facing text. Keep in-game text here, not in scene code. */
export const STR = {
  title: 'Spirit Night Market',
  spirits: (n: number) => `Spirits ${n}`,
  reputation: (n: number) => `Reputation ${n}`,

  clockDay: (day: number, ms: number) => `☀ Day ${day} · night in ${clock(ms)}`,
  clockNight: (day: number, ms: number) => `☾ Night ${day} · dawn in ${clock(ms)}`,
  clockDawn: (ms: number) => `⚠ Dawn in ${clock(ms)}`,
  paused: 'Paused',
  speedLabels: ['⏸', '1×', '2×', '4×'],
  startNight: '☾ Start night',

  eras: ['Lantern Age', 'Steam Age', 'Neon Age'],
  eraNext: (name: string, rep: number, cost: number) => `Next: ${name}  ·  Reputation ${rep}  ·  ${cost} coins`,
  eraBuy: (name: string, cost: number) => `Enter the ${name} (${cost})`,
  eraFinal: 'The world is fully modern',
  eraStarted: (name: string) => `The ${name} begins!`,
  lockedUntil: (name: string) => name,

  hintIdle: 'Space pause · F speed · N start night · Drag or WASD to move · Wheel to zoom',
  hintPlacing: 'Left-click to build  ·  Right-click or Esc to cancel',
  hintPainting: 'Hold the left mouse button and drag to lay paths  ·  Right-click or Esc to cancel',
  hintDemolish: 'Click a building to demolish (50% refund)  ·  Right-click or Esc to cancel',
  hintFirstDay: 'Spirits only walk on paths. Build stalls along the path and a hotel up north, then start the night.',

  notEnoughCoins: 'Not enough coins',
  cantBuildHere: "Can't build here",
  tooClose: 'Too close to another crossing',
  zoneOnly: {
    market: 'Market only',
    hotel: 'Hotel district only',
    land: 'Not on the river',
    river: 'River only',
  } satisfies Record<Zone, string>,
  refund: (n: number) => `+${n}`,
  cost: (n: number) => `-${n}`,
  earn: (n: number) => `+${n}`,
  lostSpirit: 'Lost to the sun',

  demolish: 'Demolish',

  categories: {
    transport: 'Transport',
    market: 'Market',
    services: 'Services',
    hotels: 'Hotels',
    decor: 'Decor',
  } satisfies Record<Category, string>,

  zoneLabels: { hotel: 'Hotel District', market: 'Night Market' },

  buildings: {
    path: 'Path',
    bridge: 'Wooden Bridge',
    bridge_stone: 'Stone Bridge',
    ferry_steam: 'Steam Ferry',
    bridge_steel: 'Steel Bridge',
    ferry_motor: 'Motor Ferry',
    noodle: 'Noodle Stall',
    tea: 'Tea House',
    charm: 'Charm Stand',
    shrine: 'Moon Shrine',
    cafe: 'Café',
    vending: 'Vending Machine',
    arcade: 'Arcade',
    brazier: 'Brazier',
    restroom: 'Restroom',
    hotel: 'Inn',
    hotel_grand: 'Grand Hotel',
    hotel_sky: 'Sky Hotel',
    lantern: 'Paper Lantern',
    gaslamp: 'Gas Lamp',
    neon: 'Neon Sign',
  } satisfies Record<BuildingId, string>,

  /** Short extra info under the name in the build bar. */
  capacity: (n: number) => `${n} at once`,
  perTrip: (n: number) => `${n} per trip`,
  beds: (n: number) => `${n} beds`,

  /** Shown in the bubble above a spirit. */
  needIcons: {
    hunger: '🍜',
    thirst: '🍵',
    luck: '🧧',
    warmth: '🔥',
    relief: '🚻',
  } satisfies Record<Need, string>,
  homeIcon: '💤',
  waitIcon: '⏳',

  report: {
    title: (day: number) => `Morning ${day}`,
    safe: (n: number) => `${n} spirits safe`,
    lost: (n: number) => `${n} lost to the sun`,
    happy: (h: number, u: number) => `${h} happy · ${u} unhappy`,
    income: (n: number) => `Earned tonight: ${n}`,
    rooms: (n: number) => `Hotel rooms: ${n}`,
    reputation: (value: number, delta: number) => `Reputation ${value} (${delta >= 0 ? '+' : ''}${delta})`,
  },
} as const;
