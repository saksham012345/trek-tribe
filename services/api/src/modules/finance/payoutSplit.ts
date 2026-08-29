/**
 * Payout split — Sprint 6 (the part that carries no GST)
 *
 * Extracted from razorpayRouteService.calculateSplit so it can be tested. It
 * was correct there; it was also private, which meant the sprint gate
 * "payout remainder exact to the paisa on Rs 1,00,001" could only be checked by
 * reading it.
 *
 * Everything here is integer paise. Rupees never appear: 0.1 + 0.2 is not 0.3
 * in double precision, and a payout a paisa short with no explanation is the
 * bug that costs a day to find.
 *
 * Exactness comes from the shape of the calculation, not from luck with
 * rounding. Two parts are rounded and the third is the remainder:
 *
 *     payout = amount - commission - fee
 *
 * so commission + fee + payout is amount by construction, for every input,
 * whatever the rounding did. That is the same identity the CHECK constraint on
 * marketplace_transfers enforces, which is why a transfer whose parts do not
 * add up cannot be recorded at all.
 */

export interface PayoutSplit {
  /** Platform commission, in paise. */
  commissionAmount: number;
  /** Gateway fee, in paise. */
  razorpayFeeAmount: number;
  /** What reaches the organizer, in paise. The remainder, never rounded. */
  payoutAmount: number;
}

/** Razorpay's standard rate. Kept named so a change is a change to a constant. */
export const RAZORPAY_FEE_RATE = 0.018;

/**
 * Split an amount in paise between commission, gateway fee and organizer.
 *
 * @param amountPaise    Gross amount in integer paise.
 * @param commissionRate Platform commission as a percentage, e.g. 5 for 5%.
 */
export function calculatePayoutSplit(amountPaise: number, commissionRate: number): PayoutSplit {
  if (!Number.isInteger(amountPaise)) {
    throw new Error(`amountPaise must be an integer number of paise, got ${amountPaise}`);
  }
  if (amountPaise < 0) {
    throw new Error(`amountPaise must not be negative, got ${amountPaise}`);
  }
  if (commissionRate < 0 || commissionRate > 100) {
    throw new Error(`commissionRate must be between 0 and 100, got ${commissionRate}`);
  }

  const commissionAmount = Math.round(amountPaise * (commissionRate / 100));
  const razorpayFeeAmount = Math.round(amountPaise * RAZORPAY_FEE_RATE);

  // The remainder. Not rounded, not recomputed - whatever the two roundings
  // above left over belongs to the organizer, and taking it this way is what
  // makes the three parts sum to the whole for every possible input.
  const payoutAmount = amountPaise - commissionAmount - razorpayFeeAmount;

  return { commissionAmount, razorpayFeeAmount, payoutAmount };
}

/**
 * The identity the split guarantees. Exported so callers and tests assert the
 * same thing, rather than each writing their own version of "adds up".
 */
export function splitReconciles(amountPaise: number, split: PayoutSplit): boolean {
  return (
    split.commissionAmount + split.razorpayFeeAmount + split.payoutAmount === amountPaise
  );
}

/** Rupees to integer paise, for callers holding a rupee figure. */
export function rupeesToPaise(rupees: number): number {
  // Multiply before rounding: Math.round(1000.005 * 100) is exact where
  // Math.round(1000.005) * 100 has already lost the paisa.
  return Math.round(rupees * 100);
}
