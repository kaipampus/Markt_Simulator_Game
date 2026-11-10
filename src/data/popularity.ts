/**
 * Popularity (0–100): how much the spirit world likes the market. It is
 * recalculated every morning from the night and decides how many guests
 * come. Few guests → short queues → happy guests → more popularity → more
 * guests → longer queues → popularity drops again, unless the market grows.
 */

export const POPULARITY_START = 10;
export const POPULARITY_MAX = 100;

/** Guests per night = GUESTS_MIN + popularity × guests per point (by open area). */
export const GUESTS_MIN = 6;
export const GUESTS_PER_POINT_MARKET = 0.94; // 100 guests at popularity 100
export const GUESTS_PER_POINT_HOTEL = 3.94; // 400 guests with the hotel district open

/** Change per night (points). Each part is shown in the morning report. */
export const POP = {
  /** Happy share at which mood neither adds nor costs popularity... */
  satisfactionNeutral: 0.4,
  /** ...and the most it adds (everyone happy) or costs (nobody happy). */
  satisfaction: 10,
  /** Per share of guests who left a queue or table in anger. */
  anger: -12,
  /** Average waiting time above this share of a guest's patience starts to cost... */
  waitFree: 0.4,
  /** ...this much per full patience waited on average. */
  waiting: -8,
  /** Per different dirty spot a guest walked over (on average)... */
  dirtPerCell: -0.6,
  /** ...but never more than this. */
  dirtMax: -5,
  /** Per share of guests lost to the sun (all lost = −30). */
  lost: -30,
  /** Offer compared with what guests expect: up to +offerBonus, down to offerPenalty. */
  offerBonus: 4,
  offerPenalty: -8,
  /** Every new stall or restaurant since the last night brings this much... */
  novelty: 1.5,
  /** ...up to this much per night. */
  noveltyMax: 6,
  /** Guests get used to the market: small loss every night. */
  habit: -1,
} as const;

/**
 * What guests expect on night `day`: number of different offers (kinds of
 * wishes plus kitchens). Grows every night, so a market that stops growing
 * slowly loses popularity.
 */
export function expectedOffers(day: number): number {
  return Math.min(14, 2 + (day - 1) * 0.5);
}
