/**
 * Popularity = how many guests come per night. It is recalculated every
 * morning from the night: a good night makes it grow by a few percent (plus
 * a few curious guests for every new attraction), long
 * queues, dirt or guests lost to the sun make it shrink. Opening a new area
 * only raises the upper limit, it never changes the number by itself.
 */

/** Guests on the very first night. */
export const POPULARITY_START = 15;
/** Never fewer guests than this. */
export const POPULARITY_MIN = 8;

/** Change per night, in percent of the current popularity. Each part is shown in the morning report. */
export const POP = {
  /** Happy share at which mood neither adds nor costs... */
  satisfactionNeutral: 0.4,
  /** ...and the most it adds (everyone happy) or costs (nobody happy), in %. */
  satisfaction: 16,
  /** % per share of guests who left a queue or table in anger (all angry = −15 %). */
  anger: -15,
  /** Average waiting time above this share of a guest's patience starts to cost... */
  waitFree: 0.4,
  /** ...this many % per full patience waited on average. */
  waiting: -10,
  /** % per different dirty spot a guest walked over (on average)... */
  dirtPerCell: -0.6,
  /** ...but never more than this. */
  dirtMax: -6,
  /** % per share of guests lost to the sun (all lost = −40 %). */
  lost: -40,
  /** Offer behind what guests expect costs up to this many %. */
  offerPenalty: -8,
  /**
   * Every new stall or restaurant since the last night brings this many
   * curious guests (a fixed number, not a percentage, so building matters
   * most while the market is small)...
   */
  noveltyGuests: 1.5,
  /** ...up to this many per night. */
  noveltyMaxGuests: 5,
  /** Every building placed or torn down at night costs this many % (guests dislike the noise)... */
  nightWork: -1,
  /** ...but never more than this per night. */
  nightWorkMax: -5,
} as const;

/**
 * Different offers (kinds of wishes plus kitchens) guests expect on night
 * `day`. Grows slowly, so a market that never adds anything new falls behind.
 */
export function expectedOffers(day: number): number {
  return Math.min(14, 2 + (day - 1) * 0.3);
}
