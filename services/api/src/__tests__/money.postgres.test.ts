import mongoose from 'mongoose';
import { prisma } from '../lib/prisma';
import { recordLedgerEntry } from '../services/payoutLedgerService';
import {
  useTripSlot,
  canCreateTrip,
  addPayment,
  totalPaid,
  tripsRemaining,
  isValid,
  ensureTrialSubscription
} from '../services/organizerSubscriptionService';
import {
  useTripSlot as spendCrmTrip,
  NoTripSlotsError,
  remainingTrips
} from '../services/crmSubscriptionService';
import { sum, toNumber, money } from '../lib/money';

describe('Wave 7 money on Postgres', () => {
  const organizerId = new mongoose.Types.ObjectId().toString();
  const userId = new mongoose.Types.ObjectId().toString();
  const tripId = new mongoose.Types.ObjectId().toString();

  const cleanup = async () => {
    await prisma.payoutLedger.deleteMany({ where: { organizerId } });
    await prisma.marketplaceOrder.deleteMany({ where: { organizerId } });
    await prisma.organizerPayoutConfig.deleteMany({ where: { organizerId } });
    await prisma.organizerSubscription.deleteMany({ where: { organizerId } });
    await prisma.cRMSubscription.deleteMany({ where: { organizerId } });
    await prisma.expense.deleteMany({ where: { organizerId } });
  };

  beforeEach(cleanup);
  afterAll(cleanup);

  const makeOrder = (over: any = {}) =>
    prisma.marketplaceOrder.create({
      data: {
        orderId: 'order_' + Math.random().toString(36).slice(2),
        userId,
        organizerId,
        amount: 100000,
        commissionAmount: 5000,
        commissionRate: 5,
        razorpayFeeAmount: 1800,
        organizerPayoutAmount: 93200,
        ...over
      }
    });

  const makeSubscription = (over: any = {}) =>
    prisma.organizerSubscription.create({
      data: { organizerId, tripsPerCycle: 5, tripsUsed: 0, ...over }
    });

  // ─── money is exact ─────────────────────────────────────────────────────────

  it('adds amounts exactly, where floating point would not', async () => {
    // 0.1 + 0.2 !== 0.3 in double precision. This is the whole reason the
    // columns are Decimal rather than Float.
    await prisma.expense.createMany({
      data: [
        { organizerId, tripId, category: 'food', amount: '0.10', date: new Date() },
        { organizerId, tripId, category: 'food', amount: '0.20', date: new Date() }
      ]
    });

    const agg = await prisma.expense.aggregate({
      where: { organizerId },
      _sum: { amount: true }
    });

    expect(agg._sum.amount!.toString()).toBe('0.3');
    expect(toNumber(agg._sum.amount)).toBe(0.3);
    // and for contrast, the arithmetic this replaced:
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  it('sums Decimals rather than concatenating them', async () => {
    const a = money('1499');
    const b = money('2100');
    // (a + b) would be the string "14992100"
    expect(sum([a, b]).toString()).toBe('3599');
  });

  it('refuses a negative expense', async () => {
    await expect(
      prisma.expense.create({
        data: { organizerId, tripId, category: 'food', amount: -1, date: new Date() }
      })
    ).rejects.toBeDefined();
  });

  // ─── the split adds up ──────────────────────────────────────────────────────

  it('refuses a transfer whose parts do not add up to the whole', async () => {
    const order = await makeOrder();

    await expect(
      prisma.marketplaceTransfer.create({
        data: {
          orderId: order.id,
          organizerId,
          paymentId: 'pay_1',
          amount: 100000,
          commissionAmount: 5000,
          razorpayFeeAmount: 1800,
          payoutAmount: 90000 // 96800 would be right
        }
      })
    ).rejects.toBeDefined();
  });

  it('accepts a transfer whose parts do add up', async () => {
    const order = await makeOrder();

    const transfer = await prisma.marketplaceTransfer.create({
      data: {
        orderId: order.id,
        organizerId,
        paymentId: 'pay_2',
        amount: 100000,
        commissionAmount: 5000,
        razorpayFeeAmount: 1800,
        payoutAmount: 93200
      }
    });

    expect(toNumber(transfer.payoutAmount)).toBe(93200);
  });

  it('refuses a commission rate above 100 percent', async () => {
    await expect(makeOrder({ commissionRate: 150 })).rejects.toBeDefined();
  });

  // ─── the ledger is written once ─────────────────────────────────────────────

  it('records a transfer credit once even when both paths write it', async () => {
    const entry = {
      organizerId,
      type: 'credit' as const,
      source: 'transfer' as const,
      referenceId: 'trf_double',
      amount: 93200
    };

    // createTransfer() writes it, then the transfer.processed webhook writes it
    // again. Before the unique constraint, that was two credits for one payout.
    const first = await recordLedgerEntry(entry);
    const second = await recordLedgerEntry({ ...entry, description: 'Transfer processed' });

    expect(first.recorded).toBe(true);
    expect(second.recorded).toBe(false);

    const rows = await prisma.payoutLedger.findMany({
      where: { organizerId, referenceId: 'trf_double' }
    });
    expect(rows).toHaveLength(1);

    const agg = await prisma.payoutLedger.aggregate({
      where: { organizerId },
      _sum: { amount: true }
    });
    expect(toNumber(agg._sum.amount)).toBe(93200);
  });

  it('still allows a debit and a credit against the same reference', async () => {
    await recordLedgerEntry({
      organizerId, type: 'credit', source: 'transfer', referenceId: 'ref_x', amount: 100
    });
    const debit = await recordLedgerEntry({
      organizerId, type: 'debit', source: 'transfer', referenceId: 'ref_x', amount: 100
    });

    expect(debit.recorded).toBe(true);
    expect(await prisma.payoutLedger.count({ where: { organizerId, referenceId: 'ref_x' } })).toBe(2);
  });

  it('refuses a ledger entry of zero', async () => {
    await expect(
      prisma.payoutLedger.create({
        data: { organizerId, type: 'credit', source: 'adjustment', referenceId: 'z', amount: 0 }
      })
    ).rejects.toBeDefined();
  });

  // ─── bank details ───────────────────────────────────────────────────────────

  it('refuses a bank account with a malformed IFSC', async () => {
    await expect(
      prisma.organizerPayoutConfig.create({
        data: {
          organizerId,
          accountNumberEncrypted: 'enc',
          ifscCode: 'NOTANIFSC',
          accountHolderName: 'A'
        }
      })
    ).rejects.toBeDefined();
  });

  it('accepts a well-formed IFSC', async () => {
    const config = await prisma.organizerPayoutConfig.create({
      data: {
        organizerId,
        accountNumberEncrypted: 'enc',
        ifscCode: 'HDFC0001234',
        accountHolderName: 'A'
      }
    });
    expect(config.ifscCode).toBe('HDFC0001234');
  });

  // ─── trip slots ─────────────────────────────────────────────────────────────

  it('lets two trips created at once take only the slots that exist', async () => {
    const sub = await makeSubscription({ tripsPerCycle: 1 });

    const a = new mongoose.Types.ObjectId().toString();
    const b = new mongoose.Types.ObjectId().toString();

    const results = await Promise.allSettled([
      useTripSlot(sub.id, a, 'Trip A'),
      useTripSlot(sub.id, b, 'Trip B')
    ]);

    const succeeded = results.filter(
      r => r.status === 'fulfilled' && r.value.used
    );
    expect(succeeded).toHaveLength(1);

    const after = await prisma.organizerSubscription.findUnique({ where: { id: sub.id } });
    expect(after!.tripsUsed).toBe(1);
    expect(tripsRemaining(after!)).toBe(0);
  });

  it('spends one slot for one trip however many times it is asked', async () => {
    const sub = await makeSubscription({ tripsPerCycle: 5 });

    const first = await useTripSlot(sub.id, tripId, 'Same Trip');
    const retry = await useTripSlot(sub.id, tripId, 'Same Trip');

    expect(first.used).toBe(true);
    expect(retry.alreadyRecorded).toBe(true);

    const after = await prisma.organizerSubscription.findUnique({ where: { id: sub.id } });
    expect(after!.tripsUsed).toBe(1);
  });

  it('leaves no usage row behind when there was no slot to spend', async () => {
    const sub = await makeSubscription({ tripsPerCycle: 0 });

    await expect(useTripSlot(sub.id, tripId, 'Doomed')).rejects.toThrow(/No trip slots/);

    expect(
      await prisma.subscriptionTripUsage.count({ where: { subscriptionId: sub.id } })
    ).toBe(0);
  });

  it('refuses trips_used above the cycle even written directly', async () => {
    const sub = await makeSubscription({ tripsPerCycle: 2 });
    await expect(
      prisma.organizerSubscription.update({
        where: { id: sub.id },
        data: { tripsUsed: 3 }
      })
    ).rejects.toBeDefined();
  });

  // ─── subscriptions ──────────────────────────────────────────────────────────

  it('gives an organizer with no subscription exactly one, not two', async () => {
    // canCreateTrip creates a row as a side effect. Two requests arriving
    // together used to be two creates and a duplicate key error.
    const [a, b] = await Promise.all([canCreateTrip(organizerId), canCreateTrip(organizerId)]);

    expect(a.allowed).toBe(false);
    expect(b.allowed).toBe(false);
    expect(await prisma.organizerSubscription.count({ where: { organizerId } })).toBe(1);
  });

  it('gives an organizer with an expired subscription a trial without colliding', async () => {
    await makeSubscription({ status: 'expired', isTrialActive: false });

    // The Mongoose version looked for an active-or-trial row, found none, and
    // then hit the unique index on organizerId.
    await expect(ensureTrialSubscription(organizerId)).resolves.toBeUndefined();
    expect(await prisma.organizerSubscription.count({ where: { organizerId } })).toBe(1);
  });

  it('counts a payment once however often the same transaction is submitted', async () => {
    const sub = await makeSubscription();

    const first = await addPayment(sub.id, {
      amount: 1499, paymentMethod: 'razorpay', transactionId: 'pay_same'
    });
    const second = await addPayment(sub.id, {
      amount: 1499, paymentMethod: 'razorpay', transactionId: 'pay_same'
    });

    expect(first.recorded).toBe(true);
    expect(second.recorded).toBe(false);
    expect(await totalPaid(sub.id)).toBe(1499);
  });

  it('totals only the completed payments', async () => {
    const sub = await makeSubscription();
    await addPayment(sub.id, { amount: 1499, paymentMethod: 'razorpay', transactionId: 't1' });
    await addPayment(sub.id, {
      amount: 999, paymentMethod: 'razorpay', transactionId: 't2', status: 'failed'
    });

    expect(await totalPaid(sub.id)).toBe(1499);
  });

  it('resets the cycle and extends the end date on a completed payment', async () => {
    const sub = await makeSubscription({ tripsPerCycle: 5, tripsUsed: 3 });

    await addPayment(sub.id, { amount: 1499, paymentMethod: 'razorpay', transactionId: 't3' });

    const after = await prisma.organizerSubscription.findUnique({ where: { id: sub.id } });
    expect(after!.tripsUsed).toBe(0);
    expect(after!.status).toBe('active');
    expect(after!.subscriptionEndDate).not.toBeNull();
    // and the usage rows survive as the record of the cycle that ended
    expect(isValid(after!)).toBe(true);
  });

  it('reads an expired subscription as expired without anything having saved it', async () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sub = await makeSubscription({ status: 'active', subscriptionEndDate: yesterday });

    // The Mongoose pre-save hook only flipped status when something happened to
    // save the document, so this read 'active' indefinitely.
    expect(sub.status).toBe('active');
    expect(isValid(sub)).toBe(false);
  });

  // ─── CRM subscriptions ──────────────────────────────────────────────────────

  it('lets two CRM trip slots race for one remaining credit', async () => {
    const sub = await prisma.cRMSubscription.create({
      data: { organizerId, planType: 'trip_package_5', totalTrips: 1, usedTrips: 0 }
    });

    const results = await Promise.allSettled([spendCrmTrip(sub.id), spendCrmTrip(sub.id)]);
    const ok = results.filter(r => r.status === 'fulfilled');
    const refused = results.filter(
      r => r.status === 'rejected' && (r as PromiseRejectedResult).reason instanceof NoTripSlotsError
    );

    expect(ok).toHaveLength(1);
    expect(refused).toHaveLength(1);

    const after = await prisma.cRMSubscription.findUnique({ where: { id: sub.id } });
    expect(remainingTrips(after!)).toBe(0);
  });

  it('refuses a CRM payment attempt id twice', async () => {
    const sub = await prisma.cRMSubscription.create({
      data: { organizerId, planType: 'trip_package_5' }
    });

    await prisma.cRMPaymentAttempt.create({
      data: { subscriptionId: sub.id, attemptId: 'attempt_1', amount: 1499 }
    });

    // The schema comment says these exist "for audit and retry idempotency",
    // and nothing made attemptId unique until now.
    await expect(
      prisma.cRMPaymentAttempt.create({
        data: { subscriptionId: sub.id, attemptId: 'attempt_1', amount: 1499 }
      })
    ).rejects.toBeDefined();
  });

  it('refuses pending as a CRM subscription status', async () => {
    // autoPayService created one with status 'pending' on a failed first
    // charge; the allowed value is 'pending_payment'. Mongoose threw on save
    // and the catch above it swallowed the error, so the retry never queued.
    await expect(
      prisma.cRMSubscription.create({
        data: { organizerId, planType: 'trip_package_5', status: 'pending' as any }
      })
    ).rejects.toBeDefined();
  });

  it('refuses basic as a CRM plan type', async () => {
    // subscriptionController's admin update defaulted to 'basic', which belongs
    // to OrganizerSubscription and was never valid here.
    await expect(
      prisma.cRMSubscription.create({
        data: { organizerId, planType: 'basic' as any }
      })
    ).rejects.toBeDefined();
  });

  it('keeps the stored package label with its leading digit', async () => {
    const sub = await prisma.cRMSubscription.create({
      data: { organizerId, planType: 'trip_package_10', packageType: 'trips_10', totalTrips: 10 }
    });

    const raw = await prisma.$queryRaw<Array<{ package_type: string }>>`
      SELECT package_type::text FROM crm_subscriptions WHERE id = ${sub.id}
    `;
    // Prisma members cannot start with a digit; what Mongo holds is '10_trips',
    // so a backfill needs no translation.
    expect(raw[0].package_type).toBe('10_trips');
    expect(sub.packageType).toBe('trips_10');
  });

  it('refuses used_trips above the package total', async () => {
    const sub = await prisma.cRMSubscription.create({
      data: { organizerId, planType: 'trip_package_5', totalTrips: 5 }
    });
    await expect(
      prisma.cRMSubscription.update({ where: { id: sub.id }, data: { usedTrips: 6 } })
    ).rejects.toBeDefined();
  });

  // ─── marketplace idempotency ────────────────────────────────────────────────

  it('refuses two orders claiming the same razorpay payment', async () => {
    await makeOrder({ paymentId: 'pay_shared' });
    await expect(makeOrder({ paymentId: 'pay_shared' })).rejects.toBeDefined();
  });

  it('lets only one caller claim an order for splitting', async () => {
    const order = await makeOrder();

    const first = await prisma.marketplaceOrder.updateMany({
      where: { id: order.id, splitStatus: { in: ['pending', 'failed'] } },
      data: { splitStatus: 'processed', paymentId: 'pay_claim' }
    });
    const second = await prisma.marketplaceOrder.updateMany({
      where: { id: order.id, splitStatus: { in: ['pending', 'failed'] } },
      data: { splitStatus: 'processed', paymentId: 'pay_claim_2' }
    });

    // A retried payment.captured webhook used to create a second real transfer.
    expect(first.count).toBe(1);
    expect(second.count).toBe(0);
  });

  it('takes an order transfers and refunds with it when it is deleted', async () => {
    const order = await makeOrder();
    await prisma.marketplaceTransfer.create({
      data: {
        orderId: order.id, organizerId, paymentId: 'p',
        amount: 100000, commissionAmount: 5000, razorpayFeeAmount: 1800, payoutAmount: 93200
      }
    });
    await prisma.marketplaceRefund.create({
      data: { orderId: order.id, paymentId: 'p', amount: 100 }
    });

    await prisma.marketplaceOrder.delete({ where: { id: order.id } });

    expect(await prisma.marketplaceTransfer.count({ where: { orderId: order.id } })).toBe(0);
    expect(await prisma.marketplaceRefund.count({ where: { orderId: order.id } })).toBe(0);
  });
});
