import { prisma } from '../lib/prisma';
import { CRMSubscription, CRMSubscriptionPayment, CRMBillingEntry } from '@prisma/client';
import { toNumber } from '../lib/money';

/**
 * CRMSubscription's shape and behaviour, off the Mongoose model.
 *
 * Four nested objects were flattened into columns - tripPackage, crmBundle,
 * trial and notifications - because nothing queried them as a unit and nesting
 * is what allowed tripPackage.remainingTrips to sit beside the two numbers that
 * already determine it. The API still speaks the nested shape, so `decorate`
 * puts it back on the way out. That is a translation for the frontend's benefit
 * and it comes out when the frontend is updated, like `_id` itself.
 *
 * totalPaid was already a virtual here - the sum of completed payments - so it
 * stays computed. Whoever wrote this model had it right; OrganizerSubscription
 * stored the same quantity and let it drift.
 */

export class NoTripSlotsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoTripSlotsError';
  }
}

type WithChildren = CRMSubscription & {
  payments?: CRMSubscriptionPayment[];
  billingHistory?: CRMBillingEntry[];
};

export function remainingTrips(sub: Pick<CRMSubscription, 'totalTrips' | 'usedTrips'>): number {
  return Math.max(0, sub.totalTrips - sub.usedTrips);
}

/** Was the isValid instance method. Unchanged rules, computed rather than stored. */
export function isValid(sub: CRMSubscription): boolean {
  if (sub.status !== 'active') return false;
  if (sub.trialIsActive && sub.trialEndDate && sub.trialEndDate > new Date()) return true;
  if (remainingTrips(sub) > 0) return true;
  if (sub.crmBundleHasAccess && (!sub.endDate || sub.endDate > new Date())) return true;
  return false;
}

/** The sum of completed payments. Was the totalPaid virtual over the embedded array. */
export async function totalPaid(subscriptionId: string): Promise<number> {
  const result = await prisma.cRMSubscriptionPayment.aggregate({
    where: { subscriptionId, status: 'completed' },
    _sum: { amount: true }
  });
  return toNumber(result._sum.amount);
}

/**
 * The response body the API used to send: `_id`, the four nested objects, and
 * the amounts as numbers rather than Decimals.
 */
export function decorate(sub: WithChildren, computedTotalPaid = 0) {
  return {
    ...sub,
    _id: sub.id,
    totalPaid: computedTotalPaid,
    tripPackage: {
      // The stored value was '5_trips'; the Prisma member is trips_5, and the
      // column still holds the original string.
      packageType: sub.packageType.replace(/^trips_(\d+)$/, '$1_trips'),
      totalTrips: sub.totalTrips,
      usedTrips: sub.usedTrips,
      remainingTrips: remainingTrips(sub),
      pricePerPackage: toNumber(sub.pricePerPackage)
    },
    crmBundle: {
      hasAccess: sub.crmBundleHasAccess,
      price: toNumber(sub.crmBundlePrice),
      features: sub.crmBundleFeatures
    },
    trial: {
      isActive: sub.trialIsActive,
      startDate: sub.trialStartDate,
      endDate: sub.trialEndDate,
      monthsRemaining: sub.trialMonthsRemaining
    },
    notifications: {
      trialEndingIn7Days: sub.trialEndingIn7Days,
      trialEndingIn1Day: sub.trialEndingIn1Day,
      trialExpired: sub.trialExpired,
      paymentReminder: sub.paymentReminder,
      lastReminderSentAt: sub.lastReminderSentAt
    },
    payments: (sub.payments || []).map(p => ({
      ...p,
      _id: p.id,
      amount: toNumber(p.amount)
    })),
    billingHistory: (sub.billingHistory || []).map(b => ({
      ...b,
      _id: b.id,
      amount: toNumber(b.amount)
    }))
  };
}

/** decorate, with totalPaid actually looked up. */
export async function decorateWithTotal(sub: WithChildren) {
  return decorate(sub, await totalPaid(sub.id));
}

/**
 * Spend one trip from the package.
 *
 * Was: read remainingTrips, compare to zero, increment usedTrips, decrement
 * remainingTrips, save. Three problems in five lines - two callers could both
 * see the last trip, the two counters could be written out of step with each
 * other, and remainingTrips was a stored number that only the application kept
 * honest.
 *
 * One conditional UPDATE settles all three: the comparison happens inside the
 * statement, there is only one counter, and the CHECK constraint
 * (used_trips <= total_trips) is there for anyone who writes the column another
 * way.
 */
export async function useTripSlot(subscriptionId: string): Promise<number> {
  const updated = await prisma.$queryRaw<Array<{ used_trips: number; total_trips: number }>>`
    UPDATE crm_subscriptions
       SET used_trips = used_trips + 1, updated_at = now()
     WHERE id = ${subscriptionId}
       AND used_trips < total_trips
    RETURNING used_trips, total_trips
  `;

  if (updated.length === 0) {
    throw new NoTripSlotsError('No remaining trip slots');
  }

  return Math.max(0, updated[0].total_trips - updated[0].used_trips);
}
