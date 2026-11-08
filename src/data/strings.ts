import type { BuildingId } from './buildings';

/** All player-facing text. Keep in-game text here, not in scene code. */
export const STR = {
  title: 'Spirit Night Market',
  spirits: (n: number) => `Spirits: ${n}`,

  hintIdle: 'Pick a building below  ·  Drag or WASD/arrows to move  ·  Mouse wheel to zoom',
  hintPlacing: 'Left-click to build  ·  Right-click or Esc to cancel',
  hintDemolish: 'Click a building to demolish (50% refund)  ·  Right-click or Esc to cancel',

  notEnoughCoins: 'Not enough coins',
  cantBuildHere: "Can't build here",
  refund: (n: number) => `+${n}`,
  cost: (n: number) => `-${n}`,

  demolish: 'Demolish',

  buildings: {
    lantern: 'Paper Lantern',
    noodle: 'Noodle Stall',
    charm: 'Charm Stand',
    tea: 'Tea House',
    shrine: 'Moon Shrine',
    bathhouse: 'Bathhouse',
  } satisfies Record<BuildingId, string>,
} as const;
