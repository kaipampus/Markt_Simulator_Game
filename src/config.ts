/** Size of one grid cell in pixels (world space). */
export const TILE = 48;

/** Map size in cells. */
export const GRID_W = 32;
export const GRID_H = 24;

/**
 * Map layout from top to bottom: hotel district, river, market.
 * Rows [0, RIVER_TOP) = hotel district, [RIVER_TOP, RIVER_TOP + RIVER_ROWS) = river, rest = market.
 */
export const RIVER_TOP = 8;
export const RIVER_ROWS = 3;

export const WORLD_W = GRID_W * TILE;
export const WORLD_H = GRID_H * TILE;

/** Extra space around the map the camera may scroll into. */
export const WORLD_PADDING = 160;

export const START_MONEY = 650;

/** Share of the build cost returned when demolishing. */
export const DEMOLISH_REFUND = 0.5;

// --- Time (milliseconds) -----------------------------------------------------

export const FIRST_DAY_MS = 90_000;
export const DAY_MS = 45_000;
export const NIGHT_MS = 240_000;
/** Last part of the night in which every spirit hurries home. */
export const DAWN_WARNING_MS = 40_000;
/** New guests stop arriving this long before the dawn warning, so late guests still have time to shop. */
export const ARRIVAL_END_MARGIN_MS = 30_000;

// --- Spirits -------------------------------------------------------------------

/** Base walking speed in pixels per second (multiplied by spirit kind and terrain). */
export const SPIRIT_SPEED = 52;
/** How long a visit takes at buildings without their own service time (ms). */
export const VISIT_MS = 2000;
/** Game speed steps (0 = paused). */
export const SPEEDS = [0, 1, 2, 4] as const;

/** Extra pathfinding cost per spirit waiting at a bridge (spreads crowds over crossings). */
export const BRIDGE_QUEUE_COST = 0.5;
/** Pathfinding cost of one ferry lane cell (slightly less attractive than a free bridge). */
export const FERRY_CELL_COST = 2;

/** Hard upper limit of spirits on the map. */
export const SPIRIT_HARD_CAP = 250;

/** Guests per night = (GUESTS_BASE + popularity × GUESTS_PER_POPULARITY) × reputation factor, at most GUEST_CAP. */
export const GUESTS_BASE = 6;
export const GUESTS_PER_POPULARITY = 1;
/** Most guests per night for now (area 1). Later each unlocked area raises it. */
export const GUEST_CAP = 120;

// --- Reputation ----------------------------------------------------------------

export const REPUTATION_START = 50;
export const REPUTATION_MAX = 100;
/**
 * Reputation change per night, based on shares so it works for 20 and 2000 guests:
 * REP_MOOD × (happy − unhappy) / guests  +  REP_LOST × lost / guests.
 */
export const REP_MOOD = 10;
export const REP_LOST = -25;
/** A spirit counts as happy when at least this share of its needs was met. */
export const HAPPY_THRESHOLD = 0.5;

// --- Camera ----------------------------------------------------------------------

export const ZOOM_MIN = 0.45;
export const ZOOM_MAX = 2;
export const PAN_SPEED = 700;

// --- UI layout (screen pixels) ------------------------------------------------

export const HUD_HEIGHT = 44;
export const BAR_HEIGHT = 122;
/** Time controls panel right below the top bar (centred). */
export const TIME_PANEL_HEIGHT = 34;
export const TIME_PANEL_HALF_WIDTH = 248;
/** Era panel below the top bar (left). */
export const ERA_PANEL_WIDTH = 330;
export const ERA_PANEL_HEIGHT = 58;

// --- Depth layers ----------------------------------------------------------------

export const DEPTH = {
  ground: -1000,
  flat: -500, // paths, bridges
  boat: -300,
  nightOverlay: 150_000,
  glow: 150_001,
  preview: 160_000,
  floatText: 200_000,
} as const;

export const COLORS = {
  background: 0x0b0f1a,
  marketA: 0x27313b,
  marketB: 0x2b3640,
  marketC: 0x232c35,
  hotelA: 0x3a2f2c,
  hotelB: 0x40342f,
  hotelC: 0x342a27,
  water: 0x1d3d5c,
  groundLine: 0x1b222a,
  groundEdge: 0x161c23,
  night: 0x060a24,
  valid: 0x8fe3a8,
  invalid: 0xff6b6b,
  uiPanel: 0x141a28,
  uiPanelEdge: 0x3a3150,
  uiButton: 0x221c33,
  uiButtonHover: 0x2e2645,
  uiButtonActive: 0x5a3a2a,
  uiAccent: 0xf2b45a,
  uiText: '#f3e9d2',
  uiTextDim: '#a79fb8',
  uiGold: '#f2c46a',
  uiRed: '#ff8a7a',
  uiGreen: '#9fe0a8',
} as const;

export const FONT_TITLE = 'Georgia, "Times New Roman", serif';
export const FONT_UI = '"Trebuchet MS", "Segoe UI", Helvetica, Arial, sans-serif';
