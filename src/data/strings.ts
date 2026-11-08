import type { BuildingId, Need, Zone } from './buildings';

function clock(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** All player-facing text. Keep in-game text here, not in scene code. */
export const STR = {
  title: 'Spirit Night Market',
  spirits: (n: number) => `Spirits ${n}`,
  reputation: (n: number) => `Reputation ${n}`,

  clockDay: (day: number, ms: number) => `☀ Day ${day} · night falls in ${clock(ms)}`,
  clockNight: (day: number, ms: number) => `☾ Night ${day} · dawn in ${clock(ms)}`,
  clockDawn: (ms: number) => `⚠ Dawn in ${clock(ms)}: spirits are hurrying home!`,

  hintIdle: 'Pick a building below  ·  Drag or WASD to move  ·  Mouse wheel to zoom',
  hintPlacing: 'Left-click to build  ·  Right-click or Esc to cancel',
  hintPainting: 'Hold the left mouse button and drag to lay paths  ·  Right-click or Esc to cancel',
  hintDemolish: 'Click a building to demolish (50% refund)  ·  Right-click or Esc to cancel',
  hintFirstDay: 'Build stalls on the market and a hotel up north before night falls!',

  notEnoughCoins: 'Not enough coins',
  cantBuildHere: "Can't build here",
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

  zoneLabels: { hotel: 'Hotel District', river: '', market: 'Night Market' },

  buildings: {
    path: 'Path',
    lantern: 'Lantern',
    bridge: 'Bridge',
    noodle: 'Noodle Stall',
    tea: 'Tea House',
    charm: 'Charm Stand',
    shrine: 'Moon Shrine',
    brazier: 'Brazier',
    restroom: 'Restroom',
    hotel: 'Hotel',
  } satisfies Record<BuildingId, string>,

  /** Shown in the bubble above a spirit. */
  needIcons: {
    hunger: '🍜',
    thirst: '🍵',
    luck: '🧧',
    warmth: '🔥',
    relief: '🚻',
  } satisfies Record<Need, string>,
  homeIcon: '💤',

  report: {
    title: (day: number) => `Morning ${day}`,
    safe: (n: number) => `${n} spirits safe`,
    lost: (n: number) => `${n} lost to the sun`,
    happy: (h: number, u: number) => `${h} happy · ${u} unhappy`,
    income: (n: number) => `Earned tonight: ${n}`,
    rooms: (n: number) => `Hotel rooms: ${n}`,
    reputation: (value: number, delta: number) => `Reputation ${value} (${delta >= 0 ? '+' : ''}${delta})`,
  },

  gameOverTitle: 'The spirits have lost their trust',
  gameOverText: (day: number) => `Your market lasted ${day} nights.`,
  tryAgain: 'Try again',
} as const;
