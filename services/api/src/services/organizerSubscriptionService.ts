import { prisma } from '../lib/prisma';
import { upsertRacingSafely } from '../lib/upsert';
import { OrganizerSubscription, Prisma } from '@prisma/client';
import { toNumber } from '../lib/money';
import { logger } from '../utils/logger';

/**
 * The behaviour that used to hang off the Mongoose OrganizerSubscription model.
 *
 * Mongoose let a schema carry statics (canCreateTrip), instance methods
 * (useTripSlot, addPayment, addNotification), virtuals (isValid, daysRemaining)
 * and a pre-save hook that quietly recomputed tripsRemaining and expired the
 * subscription. Prisma has nowhere to put any of that, so it lives here as
 * ordinary functions - which makes two things visible that were not:
 *
 *   - useTripSlot did a read, an increment and a save, and two trips created at
 *     the same moment both read the same remaining count. Both got a slot.
 *   - the pre-save hook only ran when something happened to save the document,
 *     so an expired subscription kept reading 'active' until an unrelated write
 *     touched it.
 *
 * The first is fixed by letting the database decide (see useTripSlot below). The
 * second is fixed by not storing the answer: isValid() computes it from the
 * dates every time it is asked.
 */

export class NoTripSlotsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NoTripSlotsError';
  }
}

/** tripsPerCycle - tripsUsed. Was a stored column that a pre-save hook kept in step. */
export function tripsRemaining(sub: Pick<OrganizerSubscription, 'tripsPerCycle' | 'tripsUsed'>): number {
  return Math.max(0, sub.tripsPerCycle - sub.tripsUsed);
}

/** Was the `isValid` virtual. Same rule: active, and not past the end date. */
export function isValid(sub: Pick<OrganizerSubscription, 'status' | 'subscriptionEndDate'>): boolean {
  return sub.status === 'active' && !!sub.subscriptionEndDate && new Date() <= sub.subscriptionEndDate;
}

/** Was the `daysRemaining` virtual. */
export function daysRemaining(sub: Pick<OrganizerSubscription, 'subscriptionEndDate'>): number {
  if (!sub.subscriptionEndDate) return 0;
  const diff = sub.subscriptionEndDate.getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * totalPaid was a stored column that addPayment() incremented. It is the sum of
 * the completed payment rows, so it is a query - which also means it can no
 * longer disagree with the payments it is supposed to total.
 */
export async function totalPaid(subscriptionId: string): Promise<number> {
  const result = await prisma.subscriptionPayment.aggregate({
    where: { subscriptionId, status: 'completed' },
    _sum: { amount: true }
  });
  return toNumber(result._sum.amount);
}

/**
 * The response shape the frontend and the old consumers expect: `_id`, the two
 * virtuals, and tripsRemaining, none of which are columns.
 */
export function decorate<T extends OrganizerSubscription>(sub: T) {
  return {
    ...sub,
    _id: sub.id,
    tripsRemaining: tripsRemaining(sub),
    isValid: isValid(sub),
    daysRemaining: daysRemaining(sub),
    pricePerCycle: toNumber(sub.pricePerCycle),
    crmBundlePrice: toNumber(sub.crmBundlePrice),
    // crmBundle was a nested object and callers still read it that way.
    crmBundle: {
      hasAccess: sub.crmBundleHasAccess,
      price: toNumber(sub.crmBundlePrice),
      features: sub.crmBundleFeatures
    }
  };
}

export function decorateMany<T extends OrganizerSubscription>(subs: T[]) {
  return subs.map(decorate);
}

/**
 * Spend one trip slot, atomically.
 *
 * Two things have to be true and neither was:
 *
 *   1. A trip consumes at most one slot, even if the request is retried. The
 *      unique constraint on (subscription_id, trip_id) is what guarantees it;
 *      the Mongoose version pushed onto an array and would happily record the
 *      same trip twice, charging the organizer two slots for one trip.
 *
 *   2. Slots cannot be spent past the cycle. `trips_used < trips_per_cycle` is
 *      evaluated by Postgres inside the UPDATE, so two concurrent trip
 *      creations cannot both see the last remaining slot. The CHECK constraint
 *      backs it up if anyone writes trips_used another way.
 *
 * Both happen in one transaction, so a trip that finds no slot leaves no usage
 * row behind.
 */
export async function useTripSlot(
  subscriptionId: string,
  tripId: string,
  tripTitle: string
): Promise<{ used: boolean; alreadyRecorded: boolean; remaining: number }> {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.subscriptionTripUsage.create({
        data: { subscriptionId, tripId, tripTitle }
      });

      // Prisma cannot compare two columns in a `where`, so the guard is written
      // as SQL. RETURNING tells us whether the row was updated without a second
      // read that another transaction could slip past.
      const updated = await tx.$queryRaw<Array<{ trips_used: number; trips_per_cycle: number }>>`
        UPDATE organizer_subscriptions
           SET trips_used = trips_used + 1, updated_at = now()
         WHERE id = ${subscriptionId}
           AND trips_used < trips_per_cycle
        RETURNING trips_used, trips_per_cycle
      `;

      if (updated.length === 0) {
        throw new NoTripSlotsError('No trip slots remaining. Please purchase more trips.');
      }

      return {
        used: true,
        alreadyRecorded: false,
        remaining: Math.max(0, updated[0].trips_per_cycle - updated[0].trips_used)
      };
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      // This trip already spent a slot. A retry, not a second trip.
      const sub = await prisma.organizerSubscription.findUnique({ where: { id: subscriptionId } });
      logger.info('Trip slot already recorded for this trip, not spending another', {
        subscriptionId,
        tripId
      });
      return {
        used: false,
        alreadyRecorded: true,
        remaining: sub ? tripsRemaining(sub) : 0
      };
    }
    throw error;
  }
}

/**
 * Was the canCreateTrip static.
 *
 * It creates a subscription when none exists, which is a surprising thing for a
 * question to do - but callers depend on the organizer having a row afterwards,
 * so the behaviour is kept and made safe: organizerId is unique, so the upsert
 * cannot produce two rows when two requests arrive together. The Mongoose
 * version's `create` would have.
 */
export async function canCreateTrip(organizerId: string): Promise<{ allowed: boolean; message: string }> {
  const subscription = await prisma.organizerSubscription.findUnique({ where: { organizerId } });

  if (!subscription) {
    await upsertRacingSafely(() => prisma.organizerSubscription.upsert({
      where: { organizerId },
      create: { organizerId },
      update: {}
    }));
    return {
      allowed: false,
      message: 'No active subscription found. Please purchase a plan to start creating trips.'
    };
  }

  if (!isValid(subscription)) {
    return {
      allowed: false,
      message: 'Your subscription has expired. Please renew to create more trips.'
    };
  }

  const remaining = tripsRemaining(subscription);
  if (remaining <= 0) {
    return {
      allowed: false,
      message: `You have used all ${subscription.tripsPerCycle} trips for this cycle. Please purchase more trips.`
    };
  }

  return {
    allowed: true,
    message: `${remaining} trips remaining in current cycle`
  };
}

/**
 * Was the addPayment instance method.
 *
 * transactionId is unique across every subscription, so recording the same
 * gateway transaction twice is refused rather than counted twice - which
 * matters more now that totalPaid is the sum of these rows.
 *
 * The cycle reset, the one-month extension and the next-payment-due date are
 * unchanged from the Mongoose version.
 */
export async function addPayment(
  subscriptionId: string,
  payment: {
    amount: number;
    currency?: string;
    paymentMethod: string;
    transactionId: string;
    paymentDate?: Date;
    status?: 'pending' | 'completed' | 'failed' | 'refunded';
    receiptUrl?: string;
  }
): Promise<{ recorded: boolean }> {
  const subscription = await prisma.organizerSubscription.findUnique({ where: { id: subscriptionId } });
  if (!subscription) throw new Error('Subscription not found');

  const status = payment.status || 'completed';
  const paymentDate = payment.paymentDate || new Date();

  try {
    await prisma.subscriptionPayment.create({
      data: {
        subscriptionId,
        amount: payment.amount,
        currency: payment.currency || 'INR',
        paymentMethod: payment.paymentMethod,
        transactionId: payment.transactionId,
        paymentDate,
        status,
        receiptUrl: payment.receiptUrl
      }
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      logger.warn('Payment already recorded for this transaction id', {
        subscriptionId,
        transactionId: payment.transactionId
      });
      return { recorded: false };
    }
    throw error;
  }

  if (status !== 'completed') {
    return { recorded: true };
  }

  const currentEnd = subscription.subscriptionEndDate || new Date();
  const newEnd = new Date(currentEnd);
  newEnd.setMonth(newEnd.getMonth() + 1); // 1 month extension per payment

  const nextDue = new Date(newEnd);
  nextDue.setDate(nextDue.getDate() - 7); // 7 days before expiry

  await prisma.organizerSubscription.update({
    where: { id: subscriptionId },
    data: {
      lastPaymentDate: paymentDate,
      // New cycle: the slots go back, and the usage rows stay as the record of
      // what the previous cycle was spent on.
      tripsUsed: 0,
      subscriptionEndDate: newEnd,
      status: 'active',
      currentPeriodStart: new Date(),
      currentPeriodEnd: newEnd,
      nextPaymentDue: nextDue
    }
  });

  return { recorded: true };
}

/** Was the addNotification instance method. */
export async function addNotification(
  subscriptionId: string,
  type: Prisma.SubscriptionNotificationCreateInput['type'],
  message: string
): Promise<void> {
  await prisma.subscriptionNotification.create({
    data: { subscriptionId, type, message }
  });
}

/**
 * Give an organizer a 30-day trial subscription if they do not have one.
 *
 * Three places in admin.service.ts did this inline, identically, and all three
 * were written the same wrong way:
 *
 *     const existing = await OrganizerSubscription.findOne({
 *       organizerId, status: { $in: ['active', 'trial'] }
 *     });
 *     if (!existing) await OrganizerSubscription.create({ organizerId, ... });
 *
 * organizerId is unique. An organizer whose subscription had expired or been
 * cancelled matched no row in that query, so the code went on to create a second
 * one - and hit a duplicate key error. Verifying such an organizer failed with
 * E11000 rather than with anything a human could act on.
 *
 * The upsert says what was meant: at most one subscription per organizer, and a
 * trial only for an organizer who has none at all. An existing expired
 * subscription is left as it is rather than quietly restarted, which is a
 * decision for whoever handles renewals, not for a verification step.
 */
export async function ensureTrialSubscription(organizerId: string): Promise<void> {
  const trialEndDate = new Date();
  trialEndDate.setDate(trialEndDate.getDate() + 30);

  await upsertRacingSafely(() => prisma.organizerSubscription.upsert({
    where: { organizerId },
    create: {
      organizerId,
      plan: 'free_trial',
      status: 'trial',
      isTrialActive: true,
      trialStartDate: new Date(),
      trialEndDate,
      tripsPerCycle: 5,
      tripsUsed: 0,
      pricePerCycle: 0
    },
    update: {}
  }));
}
