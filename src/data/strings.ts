import type { BuildingId, Category, Need, Zone } from './buildings';
import type { Role } from './staff';

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
  skipNight: '☀ Skip to morning',

  eras: ['Lantern Age', 'Steam Age', 'Neon Age'],
  eraNext: (name: string, rep: number, cost: number) => `Next: ${name}  ·  Reputation ${rep}  ·  ${cost} coins`,
  eraBuy: (name: string, cost: number) => `Enter the ${name} (${cost})`,
  eraFinal: 'The world is fully modern',
  eraStarted: (name: string) => `The ${name} begins!`,
  lockedUntil: (name: string) => name,

  hintIdle: 'Space pause · F speed · N start night / skip to morning · P workers · I finances · Drag or WASD to move · Wheel to zoom',
  hintPlacing: 'Left-click to build  ·  Right-click or Esc to cancel',
  hintPainting: 'Hold the left mouse button and drag to lay paths  ·  Right-click or Esc to cancel',
  hintDemolish: 'Click a building to demolish (50% refund)  ·  Right-click or Esc to cancel',
  hintFirstDay: 'Build by day: a stall on the path, an inn up north, then hire workers for both (Workers tab, P) and start the night.',
  hintNight: 'Night: building is closed. Manage the market: click stalls and workers, send cleaners to dirty paths.',
  hintStaffSelected: (role: string) => `Click a ${role} building to move this worker there  ·  Esc to deselect`,
  hintCleanerSelected: 'Click a path to send this cleaner there  ·  Esc to deselect',
  nightNoBuild: 'Building resumes at daybreak',

  notEnoughCoins: 'Not enough coins',
  cantBuildHere: "Can't build here",
  tooClose: 'Too close to another crossing',
  zoneOnly: {
    market: 'Market only',
    hotel: 'Hotel district only',
    land: 'Not on the river',
    river: 'River only',
  } satisfies Record<Zone, string>,
  staffHomeNeeded: 'Your staff still need these beds',
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
    bin: 'Litter Bin',
    hotel: 'Inn',
    hotel_grand: 'Grand Hotel',
    hotel_sky: 'Sky Hotel',
    staff_lodge: 'Staff Lodge',
    staff_dorm: 'Staff Dormitory',
    lantern: 'Paper Lantern',
    gaslamp: 'Gas Lamp',
    neon: 'Neon Sign',
  } satisfies Record<BuildingId, string>,

  /** Short extra info under the name in the build bar. */
  capacity: (n: number) => `${n} at once`,
  perTrip: (n: number) => `${n} per trip`,
  beds: (n: number) => `${n} beds`,
  staffBeds: (n: number) => `${n} staff beds`,
  needsStaff: (role: string) => `needs a ${role}`,
  catchesLitter: 'catches litter nearby',

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
  impatientIcon: '😤',
  angryIcon: '😠',
  queueBadge: (n: number) => `👥 ${n}`,

  // --- staff ---------------------------------------------------------------
  staffTitle: (n: number, beds: number, wages: number) => `Staff ${n} / ${beds} beds  ·  wages ${wages} per night`,
  staffShort: (n: number, beds: number) => `Staff ${n} / ${beds} beds`,
  staffEmpty: 'Nobody hired yet. Click a job on the left to hire someone.',
  staffCount: (n: number) => `${n} workers`,
  more: (n: number) => `+${n} more`,
  perNight: (n: number) => `${n}/night`,
  roleInfo: (role: string, worksAt: string, hire: number, wage: number, count: number, idle: number) =>
    `${role}: ${worksAt}  ·  Hire ${hire}, then ${wage} per night  ·  ${count} hired${idle ? `, ${idle} without a job` : ''}  ·  Click to hire`,
  roleWorksAt: {
    cook: 'Noodle Stall, Tea House, Café',
    clerk: 'Charm Stand, Arcade',
    host: 'every hotel',
    cleaner: 'cleans litter and slime anywhere',
  } satisfies Record<Role, string>,
  hireNoBeds: 'No free staff beds: build a Staff Lodge',
  hired: (name: string, role: string) => `${name} (${role}) joins your staff`,
  fire: 'Dismiss',
  roles: {
    cook: 'Cook',
    clerk: 'Clerk',
    host: 'Host',
    cleaner: 'Cleaner',
  } satisfies Record<Role, string>,
  roleIcons: {
    cook: '🍳',
    clerk: '🏮',
    host: '🛎️',
    cleaner: '🧹',
  } satisfies Record<Role, string>,
  staffStatus: {
    asleep: 'Asleep',
    toPost: 'On the way to work',
    onDuty: 'On duty',
    toHome: 'Going home',
    roam: 'Looking for dirt',
    cleaning: 'Cleaning',
    idle: 'Nothing to do',
    stuck: 'No path!',
    off: 'Off today (no job)',
  },
  postNone: 'No job',
  postAnywhere: 'Whole market',
  postArea: 'Sent to a spot',
  /** Names for new workers (original, generic words). */
  staffNames: [
    'Ume', 'Sora', 'Kiko', 'Tobi', 'Nami', 'Mochi', 'Yuzu', 'Kumo', 'Hotaru', 'Tsuki',
    'Kaede', 'Momo', 'Taro', 'Sumi', 'Nori', 'Aki', 'Fuu', 'Hana', 'Koto', 'Mugi',
    'Ren', 'Shio', 'Toki', 'Ibuki', 'Kuri', 'Natsu', 'Pon', 'Sabi', 'Tama', 'Yoru',
  ],

  // --- selection panel -------------------------------------------------------
  open: 'Open',
  closed: 'Closed',
  noStaff: (role: string) => `Closed: no ${role}`,
  staffComing: 'Staff on the way',
  dayClosed: 'Opens at night',
  worker: (name: string, status: string) => `${name} · ${status}`,
  assignIdle: (name: string) => `Give job to ${name}`,
  hireAndAssign: (role: string, cost: number) => `Hire ${role} (${cost})`,
  unassign: 'Unassign',
  clearArea: 'Free roam',
  bedsUsed: (used: number, total: number, price: number) => `Guests sleeping: ${used} / ${total}  ·  ${price} per room`,
  sells: (icon: string, price: number) => `Sells ${icon} for ${price}`,
  staffHouse: (used: number, total: number) => `Staff beds: ${used} / ${total} in total`,
  assigned: 'Assigned',
  cleanHere: 'Clean here',
  noStaffIcon: '👤❗',
  staffComingIcon: '🚶',
  stuckIcon: '❓',

  // --- tabs and finances -----------------------------------------------------
  workersTab: '👥 Workers',
  financeButton: '📊 Finances',
  finance: {
    title: 'Finances',
    coins: 'Coins now',
    staffHeading: 'Staff costs per night',
    roleLine: (icon: string, role: string, n: number, wage: number) => `${icon} ${n} × ${role} (${wage} each)`,
    noStaff: 'No staff yet.',
    wagesTotal: 'Wages per night',
    wagesNote: 'Wages are paid every morning for every worker, with or without a job.',
    tonight: 'Tonight so far',
    lastNight: (n: number) => (n > 0 ? `Night ${n}` : 'Last night'),
    noReport: 'No night played yet.',
    noSales: 'Guests bought nothing yet.',
    otherSales: 'Other',
    guestsSpent: 'Guests spent',
    rooms: 'Hotel rooms',
    wagesPaid: 'Wages paid',
    profit: 'Profit',
  },

  report: {
    title: (day: number) => `Morning ${day}`,
    guests: (safe: number, lost: number) => `${safe} spirits safe · ${lost} lost to the sun`,
    happy: (h: number, u: number) => `${h} happy · ${u} unhappy`,
    angry: (n: number) => `${n} left a queue in anger`,
    profit: (n: number) => `Profit ${n >= 0 ? '+' : '−'}${Math.abs(n)}  (details: I)`,
    staffLost: (n: number) => `${n} workers lost to the sun`,
    cleaned: (n: number, dirty: number) => `${n} spots cleaned · ${dirty} still dirty`,
    reputation: (value: number, delta: number) => `Reputation ${value} (${delta >= 0 ? '+' : ''}${delta})`,
  },
} as const;
