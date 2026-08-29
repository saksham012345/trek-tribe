/**
 * Sprint 6 gate: "Payout remainder exact to the paisa on Rs 1,00,001".
 *
 * That amount is in the plan for a reason - it is odd, it is large enough that
 * a percentage of it lands between paise, and 1.8% of it does not divide
 * cleanly. If a split is going to lose a paisa anywhere, it loses it here.
 *
 * These tests carry no GST. They are the part of Sprint 6 that can run before
 * the CA answers O2 and O3.
 */

import {
  calculatePayoutSplit,
  splitReconciles,
  rupeesToPaise,
  RAZORPAY_FEE_RATE,
} from '../modules/finance/payoutSplit';

describe('payout split', () => {
  describe('the gate case: Rs 1,00,001', () => {
    const amount = rupeesToPaise(100001); // 1,00,00,100 paise

    it('converts to paise without losing anything', () => {
      expect(amount).toBe(10000100);
    });

    it('adds up exactly at the default 5% commission', () => {
      const split = calculatePayoutSplit(amount, 5);
      expect(splitReconciles(amount, split)).toBe(true);
      expect(
        split.commissionAmount + split.razorpayFeeAmount + split.payoutAmount
      ).toBe(amount);
    });

    it('adds up exactly at every commission rate from 0 to 100 in quarter steps', () => {
      for (let rate = 0; rate <= 100; rate += 0.25) {
        const split = calculatePayoutSplit(amount, rate);
        expect(splitReconciles(amount, split)).toBe(true);
      }
    });

    it('gives the remainder to the organizer, never rounds it', () => {
      const split = calculatePayoutSplit(amount, 5);
      const commission = Math.round(amount * 0.05);
      const fee = Math.round(amount * RAZORPAY_FEE_RATE);
      expect(split.payoutAmount).toBe(amount - commission - fee);
    });
  });

  describe('exactness holds generally, not just on the named case', () => {
    // A rounding bug that survives one example rarely survives a few thousand.
    it('adds up for a wide sweep of amounts and rates', () => {
      const rates = [0, 0.01, 1, 2.5, 5, 7.33, 12.5, 18, 33.33, 50, 99.99, 100];
      for (let rupees = 1; rupees <= 200000; rupees += 977) {
        const amount = rupeesToPaise(rupees);
        for (const rate of rates) {
          const split = calculatePayoutSplit(amount, rate);
          expect(split.commissionAmount + split.razorpayFeeAmount + split.payoutAmount).toBe(
            amount
          );
        }
      }
    });

    it('adds up on amounts chosen to sit between paise', () => {
      // .005 rupees is half a paisa - the classic place a naive split drifts.
      const awkward = [0.005, 0.015, 1.005, 99.995, 100000.005, 123456.785];
      for (const rupees of awkward) {
        const amount = rupeesToPaise(rupees);
        for (const rate of [3, 5, 18]) {
          const split = calculatePayoutSplit(amount, rate);
          expect(splitReconciles(amount, split)).toBe(true);
        }
      }
    });

    it('handles zero without producing negative parts', () => {
      const split = calculatePayoutSplit(0, 5);
      expect(split).toEqual({ commissionAmount: 0, razorpayFeeAmount: 0, payoutAmount: 0 });
    });

    it('still reconciles when commission is 100% and the organizer gets nothing', () => {
      const amount = rupeesToPaise(100001);
      const split = calculatePayoutSplit(amount, 100);
      expect(splitReconciles(amount, split)).toBe(true);
      // Commission takes everything, so the fee has to come out of the payout,
      // which goes negative. That is arithmetic being honest rather than a
      // rounding error, and the caller is the right place to refuse it.
      expect(split.payoutAmount).toBeLessThan(0);
    });
  });

  describe('inputs it refuses', () => {
    it('refuses a rupee figure passed as paise', () => {
      expect(() => calculatePayoutSplit(100.5, 5)).toThrow(/integer number of paise/);
    });

    it('refuses a negative amount', () => {
      expect(() => calculatePayoutSplit(-1, 5)).toThrow(/must not be negative/);
    });

    it('refuses a commission rate outside 0-100', () => {
      expect(() => calculatePayoutSplit(1000, -1)).toThrow(/between 0 and 100/);
      expect(() => calculatePayoutSplit(1000, 101)).toThrow(/between 0 and 100/);
    });
  });

  describe('rupeesToPaise', () => {
    it('rounds before it multiplies out, not after', () => {
      expect(rupeesToPaise(1000.005)).toBe(100001);
      expect(rupeesToPaise(0.01)).toBe(1);
      expect(rupeesToPaise(1234.56)).toBe(123456);
    });
  });
});
