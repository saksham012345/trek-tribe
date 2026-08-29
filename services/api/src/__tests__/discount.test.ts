/**
 * Sprint 7 gate: "Coupons stack per D6; the floor from O1 is enforced, not just
 * displayed."
 *
 * The scenario the plan warns about is two 50% coupons making a trip free. That
 * is the first test here, and it is the one that decides whether any of the
 * rest matters.
 */

import {
  applyCoupons,
  maxDiscountAllowed,
  DiscountError,
  CouponInput,
  DiscountFloor,
} from '../modules/marketing/discount';

const rupees = (n: number) => n * 100; // paise

const pct = (id: string, off: number): CouponInput => ({
  id,
  code: id.toUpperCase(),
  kind: 'percent',
  percentOff: off,
});

const flat = (id: string, paise: number): CouponInput => ({
  id,
  code: id.toUpperCase(),
  kind: 'fixed_amount',
  amountOffPaise: paise,
});

describe('coupon stacking and the discount floor', () => {
  describe('the case the plan warns about', () => {
    const base = rupees(10000);

    it('two 50% coupons do NOT make the trip free when a floor is set', () => {
      const floor: DiscountFloor = { kind: 'max_total_percent', maxTotalPercent: 40 };
      const r = applyCoupons(base, [pct('a', 50), pct('b', 50)], floor);

      expect(r.netPaise).toBeGreaterThan(0);
      expect(r.totalDiscountPaise).toBe(rupees(4000));
      expect(r.netPaise).toBe(rupees(6000));
      expect(r.floorApplied).toBe(true);
    });

    it('three 40% coupons never take more than the floor allows', () => {
      const floor: DiscountFloor = { kind: 'max_total_percent', maxTotalPercent: 40 };
      const r = applyCoupons(base, [pct('a', 40), pct('b', 40), pct('c', 40)], floor);
      expect(r.totalDiscountPaise).toBe(rupees(4000));
      expect(r.netPaise).toBe(rupees(6000));
    });

    it('the customer is never paid to travel', () => {
      const floor: DiscountFloor = { kind: 'min_net_amount', minNetPaise: rupees(500) };
      const r = applyCoupons(base, [pct('a', 60), pct('b', 60), flat('c', rupees(9000))], floor);
      expect(r.netPaise).toBeGreaterThanOrEqual(rupees(500));
      expect(r.totalDiscountPaise).toBeLessThanOrEqual(base);
    });
  });

  describe('O1 unanswered means coupons do not apply — fails closed', () => {
    it('no floor configured refuses every coupon', () => {
      const r = applyCoupons(rupees(10000), [pct('a', 50)], null);
      expect(r.totalDiscountPaise).toBe(0);
      expect(r.netPaise).toBe(rupees(10000));
      expect(r.applied).toHaveLength(0);
      expect(r.refused).toMatch(/no discount floor is configured/i);
    });

    it('an unconfigured account sells at full price, not at zero', () => {
      const r = applyCoupons(rupees(1), [pct('a', 100)], null);
      expect(r.netPaise).toBe(rupees(1));
    });
  });

  describe('D6: percentages come off the original, never a shrinking base', () => {
    it('two 15% coupons are 30%, not 27.75%', () => {
      const base = rupees(10000);
      const floor: DiscountFloor = { kind: 'max_total_percent', maxTotalPercent: 100 };
      const r = applyCoupons(base, [pct('a', 15), pct('b', 15)], floor);

      expect(r.totalDiscountPaise).toBe(rupees(3000));
      // Compounding would give 27.75% — 277500 paise. It must not.
      expect(r.totalDiscountPaise).not.toBe(277500);
      expect(r.applied.every((a) => a.basePaise === base)).toBe(true);
    });
  });

  describe('the floor binds the total, not each coupon', () => {
    const base = rupees(10000);
    const floor: DiscountFloor = { kind: 'max_total_percent', maxTotalPercent: 25 };

    it('the first coupon fits and the second is trimmed', () => {
      const r = applyCoupons(base, [pct('a', 20), pct('b', 20)], floor);
      expect(r.applied[0].discountPaise).toBe(rupees(2000));
      expect(r.applied[0].trimmedByFloor).toBe(false);
      expect(r.applied[1].discountPaise).toBe(rupees(500));
      expect(r.applied[1].trimmedByFloor).toBe(true);
      expect(r.totalDiscountPaise).toBe(rupees(2500));
    });

    it('a coupon landing on no remaining room is recorded at zero, not dropped', () => {
      const r = applyCoupons(base, [pct('a', 25), pct('b', 10)], floor);
      expect(r.applied).toHaveLength(2);
      expect(r.applied[1].discountPaise).toBe(0);
      expect(r.applied[1].trimmedByFloor).toBe(true);
    });
  });

  describe('maxDiscountAllowed', () => {
    it('computes a percentage floor', () => {
      expect(maxDiscountAllowed(rupees(1000), { kind: 'max_total_percent', maxTotalPercent: 30 }))
        .toBe(rupees(300));
    });

    it('computes a minimum-net floor', () => {
      expect(maxDiscountAllowed(rupees(1000), { kind: 'min_net_amount', minNetPaise: rupees(400) }))
        .toBe(rupees(600));
    });

    it('never returns a negative allowance when the base is already below the minimum', () => {
      expect(maxDiscountAllowed(rupees(100), { kind: 'min_net_amount', minNetPaise: rupees(500) }))
        .toBe(0);
    });

    it('refuses a floor whose value does not match its kind', () => {
      expect(() => maxDiscountAllowed(1000, { kind: 'max_total_percent' })).toThrow(DiscountError);
      expect(() => maxDiscountAllowed(1000, { kind: 'min_net_amount' })).toThrow(DiscountError);
    });
  });

  describe('inputs it refuses', () => {
    it('refuses a non-integer base', () => {
      expect(() => applyCoupons(100.5, [], { kind: 'max_total_percent', maxTotalPercent: 10 }))
        .toThrow(/non-negative integer/);
    });

    it('refuses a negative base', () => {
      expect(() => applyCoupons(-1, [], { kind: 'max_total_percent', maxTotalPercent: 10 }))
        .toThrow(/non-negative integer/);
    });
  });

  describe('nothing ever goes negative', () => {
    it('holds across a sweep of amounts, floors and stacks', () => {
      const floors: DiscountFloor[] = [
        { kind: 'max_total_percent', maxTotalPercent: 0 },
        { kind: 'max_total_percent', maxTotalPercent: 40 },
        { kind: 'max_total_percent', maxTotalPercent: 100 },
        { kind: 'min_net_amount', minNetPaise: 0 },
        { kind: 'min_net_amount', minNetPaise: rupees(500) },
      ];
      const stacks: CouponInput[][] = [
        [pct('a', 100)],
        [pct('a', 50), pct('b', 50)],
        [pct('a', 40), pct('b', 40), pct('c', 40)],
        [flat('a', rupees(100000))],
        [pct('a', 99), flat('b', rupees(50000))],
      ];

      for (let r = 1; r <= 200000; r += 3571) {
        const base = rupees(r);
        for (const floor of floors) {
          for (const stack of stacks) {
            const res = applyCoupons(base, stack, floor);
            expect(res.netPaise).toBeGreaterThanOrEqual(0);
            expect(res.totalDiscountPaise).toBeLessThanOrEqual(base);
            expect(res.totalDiscountPaise).toBe(base - res.netPaise);
          }
        }
      }
    });
  });
});
