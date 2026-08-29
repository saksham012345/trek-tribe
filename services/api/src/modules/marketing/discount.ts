/**
 * Coupon stacking and the discount floor — Sprint 7
 *
 * Pure arithmetic, no database, so the rule that decides how much money leaves
 * the business can be tested directly rather than inferred from a screen.
 *
 * Two decisions from the plan shape all of this:
 *
 *   D6 — coupons stack, and percentages come off the ORIGINAL amount. Two 15%
 *        coupons are 30%, not 27.75%. Compounding off a shrinking base is
 *        invisible until someone reconciles a payout.
 *
 *   O1 — the floor. Still unanswered as a number, so this fails CLOSED: with no
 *        floor configured, no coupon applies at all. An unconfigured account
 *        sells at full price. That is wrong in the safe direction, where
 *        guessing the number would be wrong in the direction that costs money —
 *        without a cap, two 50% coupons make a trip free.
 *
 * Everything is integer paise.
 */

export type FloorKind = 'max_total_percent' | 'min_net_amount';

export interface DiscountFloor {
  kind: FloorKind;
  /** Percentage of the original amount, when kind is max_total_percent. */
  maxTotalPercent?: number;
  /** Integer paise, when kind is min_net_amount. */
  minNetPaise?: number;
}

export interface CouponInput {
  id: string;
  code: string;
  kind: 'percent' | 'fixed_amount';
  percentOff?: number;
  amountOffPaise?: number;
}

export interface AppliedCoupon {
  couponId: string;
  code: string;
  /** What this coupon actually took off, after the floor was applied. */
  discountPaise: number;
  /** The amount it was calculated against — the original, per D6. */
  basePaise: number;
  /** True when the floor reduced this coupon's effect. */
  trimmedByFloor: boolean;
}

export interface DiscountResult {
  basePaise: number;
  /** Total actually taken off, never more than the floor allows. */
  totalDiscountPaise: number;
  /** What the customer pays. */
  netPaise: number;
  applied: AppliedCoupon[];
  /** Set when nothing could be applied, with the reason. */
  refused: string | null;
  /** True when the floor bound the total. */
  floorApplied: boolean;
}

export class DiscountError extends Error {}

/** The most that may be taken off, given a floor. */
export function maxDiscountAllowed(basePaise: number, floor: DiscountFloor): number {
  if (floor.kind === 'max_total_percent') {
    if (floor.maxTotalPercent === undefined) {
      throw new DiscountError('A max_total_percent floor needs a percentage');
    }
    return Math.floor((basePaise * floor.maxTotalPercent) / 100);
  }
  if (floor.minNetPaise === undefined) {
    throw new DiscountError('A min_net_amount floor needs an amount');
  }
  // Never negative: if the base is already below the minimum net, no discount
  // is available rather than a negative one being handed back.
  return Math.max(0, basePaise - floor.minNetPaise);
}

/**
 * Apply a stack of coupons to an amount.
 *
 * @param basePaise Original amount in integer paise.
 * @param coupons   The stack, in the order the customer applied them.
 * @param floor     The organizer's configured floor, or null if none is set.
 *
 * With `floor === null` nothing is applied and `refused` explains why. That is
 * the O1 failure mode, chosen deliberately: no cap means no coupons, not
 * unlimited coupons.
 */
export function applyCoupons(
  basePaise: number,
  coupons: CouponInput[],
  floor: DiscountFloor | null
): DiscountResult {
  if (!Number.isInteger(basePaise) || basePaise < 0) {
    throw new DiscountError(`basePaise must be a non-negative integer, got ${basePaise}`);
  }

  if (floor === null) {
    return {
      basePaise,
      totalDiscountPaise: 0,
      netPaise: basePaise,
      applied: [],
      refused:
        'No discount floor is configured for this organizer, so coupons cannot be applied. ' +
        'Set a floor first — without one, stacked coupons can reduce a booking to nothing.',
      floorApplied: false,
    };
  }

  const cap = maxDiscountAllowed(basePaise, floor);

  let running = 0;
  let floorApplied = false;
  const applied: AppliedCoupon[] = [];

  for (const c of coupons) {
    // D6: every percentage comes off the ORIGINAL amount, not off what is left.
    const wanted =
      c.kind === 'percent'
        ? Math.round((basePaise * (c.percentOff ?? 0)) / 100)
        : c.amountOffPaise ?? 0;

    const remainingRoom = Math.max(0, cap - running);
    const granted = Math.min(wanted, remainingRoom);

    if (granted < wanted) floorApplied = true;

    // A coupon that lands on zero room is still recorded, at zero. Dropping it
    // silently would leave a customer looking at a code they entered and no
    // explanation of why it did nothing.
    applied.push({
      couponId: c.id,
      code: c.code,
      discountPaise: granted,
      basePaise,
      trimmedByFloor: granted < wanted,
    });

    running += granted;
  }

  return {
    basePaise,
    totalDiscountPaise: running,
    netPaise: basePaise - running,
    applied,
    refused: null,
    floorApplied,
  };
}
