/** Size of one grid cell in pixels (world space). */
export const TILE = 48;

/** Market size in cells. */
export const GRID_W = 28;
export const GRID_H = 20;

export const WORLD_W = GRID_W * TILE;
export const WORLD_H = GRID_H * TILE;

/** Extra space around the market the camera may scroll into. */
export const WORLD_PADDING = 160;

export const START_MONEY = 800;

/** Share of the build cost returned when demolishing. */
export const DEMOLISH_REFUND = 0.5;

/** Spirits: how many at most, and how often a new one arrives (ms). */
export const SPIRIT_MAX = 14;
export const SPIRIT_SPAWN_MS = 2200;
/** Spirit walking speed in pixels per second. */
export const SPIRIT_SPEED = 46;

/** Camera. */
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2;
export const PAN_SPEED = 700;

/** UI layout (screen pixels). */
export const HUD_HEIGHT = 44;
export const BAR_HEIGHT = 104;

export const COLORS = {
  background: 0x0b0f1a,
  groundA: 0x27313b,
  groundB: 0x2b3640,
  groundC: 0x232c35,
  groundLine: 0x1b222a,
  groundEdge: 0x161c23,
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
} as const;

export const FONT_TITLE = 'Georgia, "Times New Roman", serif';
export const FONT_UI = '"Trebuchet MS", "Segoe UI", Helvetica, Arial, sans-serif';
