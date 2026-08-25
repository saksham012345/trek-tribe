import { Prisma } from '@prisma/client';

/**
 * Money crossing the Prisma boundary.
 *
 * Every amount column in wave 7 is `Decimal(14,2)` rather than `Float`. That is
 * the right storage decision - `0.1 + 0.2` is not `0.3` in double precision, and
 * a payout that is off by a paisa with no explanation is exactly the bug that
 * costs a day to find - but it changes what the application gets back.
 *
 * Prisma hands back `Prisma.Decimal`, and on a Decimal:
 *
 *     a + b            // "14991499"  - string concatenation, silently
 *     a > b            // works by coercion, but not for equality
 *     JSON.stringify   // "1499", a string, where the frontend expects a number
 *
 * None of those throw. They produce wrong values that look plausible, which is
 * worse than a crash, so the rule is: amounts are Decimal inside a calculation
 * and numbers at the edges, and this module is the only place the conversion
 * happens.
 *
 * Existing amounts are integers - marketplace values are paise, subscription and
 * expense values are whole rupees - so `toNumber` is exact for everything this
 * system currently stores. It stays exact up to 2^53 paise, which is more money
 * than the business will ever hold.
 */

export type Money = Prisma.Decimal;

/** Build a Decimal from whatever a caller has. */
export function money(value: number | string | Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

/** Sum exactly. Written out because `amounts.reduce((a, b) => a + b)` on Decimals concatenates. */
export function sum(amounts: Array<Prisma.Decimal | number | string>): Prisma.Decimal {
  return amounts.reduce<Prisma.Decimal>((total, next) => total.plus(next), new Prisma.Decimal(0));
}

/**
 * For responses and for arithmetic in code that has not been converted.
 * Null and undefined become 0, matching what the Mongoose consumers assumed of
 * an absent Number field.
 */
export function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  return value.toNumber();
}

/**
 * Convert the named Decimal fields of a row to numbers, in place of the row.
 *
 * Used at the API boundary so a response body carries `amount: 1499` and not
 * `amount: "1499"`. The frontend does arithmetic on these - TripFinancePage sums
 * expenses, the settlements view totals payouts - and a string would turn a sum
 * into a concatenation there instead of here.
 */
export function withNumericMoney<T extends Record<string, any>, K extends keyof T>(
  row: T,
  fields: K[]
): T {
  const out: any = { ...row };
  for (const field of fields) {
    const value = out[field];
    if (value !== null && value !== undefined) {
      out[field] = toNumber(value);
    }
  }
  return out as T;
}

export function withNumericMoneyAll<T extends Record<string, any>, K extends keyof T>(
  rows: T[],
  fields: K[]
): T[] {
  return rows.map(row => withNumericMoney(row, fields));
}
