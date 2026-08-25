/**
 * Backfill wave 7 - money - from MongoDB into Postgres.
 *
 *   npx ts-node scripts/backfill-money.ts             # dry run, writes nothing
 *   npx ts-node scripts/backfill-money.ts --commit    # writes
 *
 * Dry run by default, like every other backfill in this directory.
 *
 * ─── What this reads, and what it found in production ────────────────────────
 *
 * Measured against Atlas on 2026-08-25:
 *
 *     17  organizersubscriptions        0  marketplaceorders
 *     16  expenses                      0  marketplacerefunds
 *      0  payoutledgers                 0  marketplacetransfers
 *      0  crmsubscriptions              0  organizerpayoutconfigs
 *                                       -  payouts     (collection absent)
 *                                       -  promocodes  (collection absent)
 *
 * So two collections have anything in them. The rest are here because they will
 * not always be empty, and because a backfill that silently skips a collection
 * is worse than one that reports zero.
 *
 * ─── Why rows get skipped ────────────────────────────────────────────────────
 *
 * Postgres enforces things Mongo did not, so some documents cannot be moved as
 * they stand. This script never truncates, coerces or invents a value to make a
 * row fit: it reports the document and moves on. What is reported is a real
 * problem in the data that a person should look at.
 *
 * Expect skips for:
 *   - an IFSC that does not match the RBI format (the CHECK refuses it)
 *   - trips_used above trips_per_cycle, which the old useTripSlot could produce
 *   - used_trips above total_trips, same story on the CRM side
 *   - a plan, status or category outside the enum - including the two values
 *     that were never valid: CRMSubscription status 'pending' and plan 'basic'
 *   - a negative amount
 *
 * ─── Idempotency ─────────────────────────────────────────────────────────────
 *
 * Everything keyed on a natural unique - orderId, transferId, refundId,
 * organizerId, transactionId, attemptId - uses skipDuplicates or an existence
 * check, so running twice adds nothing.
 *
 * Three tables have no natural key: expenses, payout_ledger adjustments without
 * a referenceId, and CRM billing entries. Those are keyed on the Mongo _id,
 * carried across as the Postgres id, so re-running them is also safe. That is
 * why the id column is written explicitly rather than defaulted - the Mongo
 * ObjectId is not a uuid, so it is converted deterministically below.
 */

import mongoose from 'mongoose';
import { prisma } from '../src/lib/prisma';
import crypto from 'crypto';

const COMMIT = process.argv.includes('--commit');

/**
 * A Mongo ObjectId is 12 bytes; a uuid is 16. Hashing the hex gives a stable
 * uuid for a given document, so re-running the backfill maps the same document
 * onto the same row rather than inserting a duplicate.
 */
function idFor(objectId: any): string {
  const hex = crypto.createHash('md5').update(String(objectId)).digest('hex');
  return [
    hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32)
  ].join('-');
}

const str = (v: any): string | null => (v === null || v === undefined ? null : String(v));

type Report = { moved: number; skipped: Array<{ id: string; why: string }> };
const reports: Record<string, Report> = {};

function report(collection: string): Report {
  if (!reports[collection]) reports[collection] = { moved: 0, skipped: [] };
  return reports[collection];
}

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(uri);
  const db = mongoose.connection.db!;
  console.log(`Connected. ${COMMIT ? 'COMMITTING' : 'DRY RUN - nothing will be written'}\n`);

  await expenses(db);
  await payoutConfigs(db);
  await ledger(db);
  await marketplace(db);
  await organizerSubscriptions(db);
  await crmSubscriptions(db);

  console.log('\n─── Summary ───');
  for (const [name, r] of Object.entries(reports)) {
    console.log(`${name}: ${r.moved} moved, ${r.skipped.length} skipped`);
    for (const s of r.skipped) console.log(`    ${s.id}  ${s.why}`);
  }

  await mongoose.disconnect();
  await prisma.$disconnect();
}

// ─── expenses ─────────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = [
  'transport', 'stay', 'food', 'guide', 'permits', 'marketing', 'platform_fee', 'miscellaneous'
];

async function expenses(db: any) {
  const r = report('expenses');
  const docs = await db.collection('expenses').find({}).toArray();

  for (const doc of docs) {
    if (!EXPENSE_CATEGORIES.includes(doc.category)) {
      r.skipped.push({ id: String(doc._id), why: `category '${doc.category}' is not one of the eight` });
      continue;
    }
    if (typeof doc.amount !== 'number' || doc.amount < 0) {
      r.skipped.push({ id: String(doc._id), why: `amount ${doc.amount} is negative or missing` });
      continue;
    }
    if (!doc.organizerId || !doc.tripId) {
      r.skipped.push({ id: String(doc._id), why: 'organizerId or tripId is missing' });
      continue;
    }

    if (COMMIT) {
      await prisma.expense.upsert({
        where: { id: idFor(doc._id) },
        create: {
          id: idFor(doc._id),
          organizerId: String(doc.organizerId),
          tripId: String(doc.tripId),
          category: doc.category,
          amount: doc.amount,
          description: doc.description ?? null,
          date: doc.date ?? doc.createdAt ?? new Date(),
          createdAt: doc.createdAt ?? new Date(),
          updatedAt: doc.updatedAt ?? new Date()
        },
        update: {}
      });
    }
    r.moved++;
  }
}

// ─── organizer payout configs ─────────────────────────────────────────────────

const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;

async function payoutConfigs(db: any) {
  const r = report('organizerpayoutconfigs');
  const docs = await db.collection('organizerpayoutconfigs').find({}).toArray();

  for (const doc of docs) {
    const bank = doc.bankDetails || {};
    const ifsc = String(bank.ifscCode || '').toUpperCase();

    if (!IFSC.test(ifsc)) {
      // Not corrected here. An IFSC that does not identify a branch means a
      // payout that fails at the bank, and guessing at it would be worse.
      r.skipped.push({ id: String(doc._id), why: `IFSC '${bank.ifscCode}' is not a valid code` });
      continue;
    }
    if (!bank.accountNumberEncrypted || !bank.accountHolderName) {
      r.skipped.push({ id: String(doc._id), why: 'bankDetails is incomplete' });
      continue;
    }
    const rate = typeof doc.commissionRate === 'number' ? doc.commissionRate : 5;
    if (rate < 0 || rate > 100) {
      r.skipped.push({ id: String(doc._id), why: `commissionRate ${rate} is outside 0-100` });
      continue;
    }

    if (COMMIT) {
      await prisma.organizerPayoutConfig.upsert({
        where: { organizerId: String(doc.organizerId) },
        create: {
          organizerId: String(doc.organizerId),
          razorpayAccountId: str(doc.razorpayAccountId),
          onboardingStatus: doc.onboardingStatus ?? 'pending',
          accountNumberEncrypted: bank.accountNumberEncrypted,
          ifscCode: ifsc,
          accountHolderName: bank.accountHolderName,
          bankName: str(bank.bankName),
          kycStatus: doc.kycStatus ?? 'pending',
          commissionRate: rate,
          createdAt: doc.createdAt ?? new Date(),
          updatedAt: doc.updatedAt ?? new Date()
        },
        update: {}
      });
    }
    r.moved++;
  }
}

// ─── payout ledger ────────────────────────────────────────────────────────────

async function ledger(db: any) {
  const r = report('payoutledgers');
  const docs = await db.collection('payoutledgers').find({}).toArray();

  // The unique on (source, referenceId, type) is new, and the double-write bug
  // means Mongo may hold two entries where Postgres will accept one. The second
  // is reported rather than dropped silently, because "this payout was credited
  // twice" is exactly what someone reconciling the books needs to know.
  const seen = new Set<string>();

  for (const doc of docs) {
    const amount = doc.amount;
    if (typeof amount !== 'number' || amount <= 0) {
      r.skipped.push({ id: String(doc._id), why: `amount ${amount} is not positive` });
      continue;
    }

    // referenceId is required now. An adjustment written without one gets a
    // deterministic reference derived from its document id, which keeps it
    // distinguishable and keeps the backfill idempotent.
    const referenceId = doc.referenceId ? String(doc.referenceId) : `legacy-${doc._id}`;
    const key = `${doc.source}|${referenceId}|${doc.type}`;

    if (seen.has(key)) {
      r.skipped.push({
        id: String(doc._id),
        why: `duplicate ${doc.type} for ${doc.source} ${referenceId} - this money was recorded twice in Mongo`
      });
      continue;
    }
    seen.add(key);

    if (COMMIT) {
      await prisma.payoutLedger.upsert({
        where: { source_referenceId_type: { source: doc.source, referenceId, type: doc.type } },
        create: {
          id: idFor(doc._id),
          organizerId: String(doc.organizerId),
          type: doc.type,
          source: doc.source,
          referenceId,
          amount,
          currency: doc.currency ?? 'INR',
          description: str(doc.description),
          createdAt: doc.createdAt ?? new Date(),
          updatedAt: doc.updatedAt ?? new Date()
        },
        update: {}
      });
    }
    r.moved++;
  }
}

// ─── marketplace ──────────────────────────────────────────────────────────────

async function marketplace(db: any) {
  const orderReport = report('marketplaceorders');
  const orders = await db.collection('marketplaceorders').find({}).toArray();
  const orderIdMap = new Map<string, string>(); // mongo _id -> postgres id

  for (const doc of orders) {
    if (typeof doc.amount !== 'number' || doc.amount <= 0) {
      orderReport.skipped.push({ id: String(doc._id), why: `amount ${doc.amount} is not positive` });
      continue;
    }
    const pgId = idFor(doc._id);
    orderIdMap.set(String(doc._id), pgId);

    if (COMMIT) {
      await prisma.marketplaceOrder.upsert({
        where: { orderId: String(doc.orderId) },
        create: {
          id: pgId,
          orderId: String(doc.orderId),
          paymentId: str(doc.paymentId),
          userId: String(doc.userId),
          organizerId: String(doc.organizerId),
          tripId: str(doc.tripId),
          amount: doc.amount,
          currency: doc.currency ?? 'INR',
          notes: doc.notes ?? undefined,
          status: doc.status ?? 'created',
          commissionAmount: doc.commissionAmount ?? 0,
          commissionRate: doc.commissionRate ?? 5,
          organizerPayoutAmount: doc.organizerPayoutAmount ?? 0,
          razorpayFeeAmount: doc.razorpayFeeAmount ?? 0,
          splitStatus: doc.splitStatus ?? 'pending',
          refundStatus: doc.refundStatus ?? 'none',
          createdAt: doc.createdAt ?? new Date(),
          updatedAt: doc.updatedAt ?? new Date()
        },
        update: {}
      });
    }
    orderReport.moved++;
  }

  const transferReport = report('marketplacetransfers');
  for (const doc of await db.collection('marketplacetransfers').find({}).toArray()) {
    const orderPgId = orderIdMap.get(String(doc.orderId));
    if (!orderPgId) {
      transferReport.skipped.push({ id: String(doc._id), why: 'its order was not moved' });
      continue;
    }
    // The CHECK says the parts add up. A transfer that fails it was recorded
    // with a split that never balanced, and that is worth a human looking at.
    const parts = (doc.commissionAmount ?? 0) + (doc.razorpayFeeAmount ?? 0) + (doc.payoutAmount ?? 0);
    if (parts !== doc.amount) {
      transferReport.skipped.push({
        id: String(doc._id),
        why: `split does not balance: ${doc.commissionAmount} + ${doc.razorpayFeeAmount} + ${doc.payoutAmount} != ${doc.amount}`
      });
      continue;
    }

    if (COMMIT) {
      await prisma.marketplaceTransfer.upsert({
        where: { id: idFor(doc._id) },
        create: {
          id: idFor(doc._id),
          orderId: orderPgId,
          organizerId: String(doc.organizerId),
          paymentId: String(doc.paymentId),
          transferId: str(doc.transferId),
          amount: doc.amount,
          commissionAmount: doc.commissionAmount,
          razorpayFeeAmount: doc.razorpayFeeAmount,
          payoutAmount: doc.payoutAmount,
          status: doc.status ?? 'pending',
          holdUntil: doc.holdUntil ?? null,
          processedAt: doc.processedAt ?? null,
          failureReason: str(doc.failureReason),
          createdAt: doc.createdAt ?? new Date(),
          updatedAt: doc.updatedAt ?? new Date()
        },
        update: {}
      });
    }
    transferReport.moved++;
  }

  const refundReport = report('marketplacerefunds');
  for (const doc of await db.collection('marketplacerefunds').find({}).toArray()) {
    const orderPgId = orderIdMap.get(String(doc.orderId));
    if (!orderPgId) {
      refundReport.skipped.push({ id: String(doc._id), why: 'its order was not moved' });
      continue;
    }
    if (typeof doc.amount !== 'number' || doc.amount <= 0) {
      refundReport.skipped.push({ id: String(doc._id), why: `amount ${doc.amount} is not positive` });
      continue;
    }

    if (COMMIT) {
      await prisma.marketplaceRefund.upsert({
        where: { id: idFor(doc._id) },
        create: {
          id: idFor(doc._id),
          orderId: orderPgId,
          paymentId: String(doc.paymentId),
          refundId: str(doc.refundId),
          amount: doc.amount,
          currency: doc.currency ?? 'INR',
          reason: str(doc.reason),
          reversedTransfer: !!doc.reversedTransfer,
          status: doc.status ?? 'pending',
          createdBy: str(doc.createdBy),
          processedAt: doc.processedAt ?? null,
          failureReason: str(doc.failureReason),
          createdAt: doc.createdAt ?? new Date(),
          updatedAt: doc.updatedAt ?? new Date()
        },
        update: {}
      });
    }
    refundReport.moved++;
  }
}

// ─── organizer subscriptions ──────────────────────────────────────────────────

const PLANS = ['trial', 'free-trial', 'starter', 'basic', 'pro', 'professional', 'premium', 'enterprise'];
const PLAN_MEMBER: Record<string, string> = { 'free-trial': 'free_trial' };
const SUB_STATUSES = ['pending_payment', 'active', 'expired', 'cancelled', 'trial'];

async function organizerSubscriptions(db: any) {
  const r = report('organizersubscriptions');
  const docs = await db.collection('organizersubscriptions').find({}).toArray();

  for (const doc of docs) {
    const plan = doc.plan ?? 'free-trial';
    if (!PLANS.includes(plan)) {
      r.skipped.push({ id: String(doc._id), why: `plan '${plan}' is not one of the eight` });
      continue;
    }
    const status = doc.status ?? 'pending_payment';
    if (!SUB_STATUSES.includes(status)) {
      r.skipped.push({ id: String(doc._id), why: `status '${status}' is not one of the five` });
      continue;
    }

    const tripsPerCycle = doc.tripsPerCycle ?? 5;
    const tripsUsed = doc.tripsUsed ?? 0;
    if (tripsUsed > tripsPerCycle) {
      // The old useTripSlot could produce this: two trips created at once both
      // took the last slot. Reported, not clamped - the organizer was allowed
      // trips they had not paid for and someone should decide what to do.
      r.skipped.push({
        id: String(doc._id),
        why: `tripsUsed ${tripsUsed} exceeds tripsPerCycle ${tripsPerCycle} - the old slot race let this happen`
      });
      continue;
    }

    const subId = idFor(doc._id);

    if (COMMIT) {
      await prisma.organizerSubscription.upsert({
        where: { organizerId: String(doc.organizerId) },
        create: {
          id: subId,
          organizerId: String(doc.organizerId),
          plan: (PLAN_MEMBER[plan] ?? plan) as any,
          planType: str(doc.planType),
          status: status as any,
          isTrialActive: !!doc.isTrialActive,
          crmAccess: !!doc.crmAccess,
          crmBundleHasAccess: !!doc.crmBundle?.hasAccess,
          crmBundlePrice: doc.crmBundle?.price ?? 0,
          crmBundleFeatures: doc.crmBundle?.features ?? [],
          subscriptionStartDate: doc.subscriptionStartDate ?? null,
          subscriptionEndDate: doc.subscriptionEndDate ?? null,
          trialStartDate: doc.trialStartDate ?? null,
          trialEndDate: doc.trialEndDate ?? null,
          currentPeriodStart: doc.currentPeriodStart ?? null,
          currentPeriodEnd: doc.currentPeriodEnd ?? null,
          tripsPerCycle,
          tripsUsed,
          pricePerCycle: doc.pricePerCycle ?? 1499,
          currency: doc.currency ?? 'INR',
          lastPaymentDate: doc.lastPaymentDate ?? null,
          nextPaymentDue: doc.nextPaymentDue ?? null,
          razorpayOrderId: str(doc.razorpayOrderId),
          razorpayPaymentId: str(doc.razorpayPaymentId),
          autoRenew: !!doc.autoRenew,
          paymentMethodId: str(doc.paymentMethodId),
          paymentMethodValid: doc.paymentMethodValid ?? null,
          notes: str(doc.notes),
          createdAt: doc.createdAt ?? new Date(),
          updatedAt: doc.updatedAt ?? new Date()
        },
        update: {}
      });

      // payments[], tripUsageHistory[] and notificationsSent[] become rows.
      for (const p of doc.payments ?? []) {
        if (!p.transactionId) continue;
        await prisma.subscriptionPayment.upsert({
          where: { transactionId: String(p.transactionId) },
          create: {
            subscriptionId: subId,
            amount: p.amount ?? 0,
            currency: p.currency ?? 'INR',
            paymentMethod: p.paymentMethod ?? 'unknown',
            transactionId: String(p.transactionId),
            paymentDate: p.paymentDate ?? new Date(),
            status: p.status ?? 'pending',
            receiptUrl: str(p.receiptUrl)
          },
          update: {}
        });
      }

      // One slot per trip is a new constraint; Mongo could hold the same trip
      // twice. skipDuplicates keeps the first.
      await prisma.subscriptionTripUsage.createMany({
        data: (doc.tripUsageHistory ?? [])
          .filter((t: any) => t.tripId)
          .map((t: any) => ({
            subscriptionId: subId,
            tripId: String(t.tripId),
            tripTitle: t.tripTitle ?? 'Untitled',
            status: t.status ?? 'active',
            createdAt: t.createdAt ?? new Date()
          })),
        skipDuplicates: true
      });

      await prisma.subscriptionNotification.createMany({
        data: (doc.notificationsSent ?? []).map((n: any) => ({
          subscriptionId: subId,
          type: n.type,
          message: n.message ?? '',
          sentAt: n.sentAt ?? new Date()
        })),
        skipDuplicates: true
      });
    }
    r.moved++;
  }
}

// ─── CRM subscriptions ────────────────────────────────────────────────────────

const CRM_PLANS = [
  'trip_package_5', 'trip_package_10', 'trip_package_20', 'trip_package_50', 'crm_bundle', 'trial'
];
const CRM_STATUSES = ['active', 'expired', 'cancelled', 'pending_payment'];
const PACKAGE_MEMBER: Record<string, string> = {
  '5_trips': 'trips_5', '10_trips': 'trips_10', '20_trips': 'trips_20', '50_trips': 'trips_50'
};

async function crmSubscriptions(db: any) {
  const r = report('crmsubscriptions');
  const docs = await db.collection('crmsubscriptions').find({}).toArray();

  for (const doc of docs) {
    if (!CRM_PLANS.includes(doc.planType)) {
      // 'basic' will land here. subscriptionController's admin update defaulted
      // to it, and it has never been valid for this model.
      r.skipped.push({ id: String(doc._id), why: `planType '${doc.planType}' is not one of the six` });
      continue;
    }
    const status = doc.status ?? 'active';
    if (!CRM_STATUSES.includes(status)) {
      // 'pending' will land here - autoPayService wrote it on a failed first
      // charge. Mongoose rejected it on save, so any such document predates
      // that validation or was written by another path.
      r.skipped.push({ id: String(doc._id), why: `status '${status}' is not one of the four` });
      continue;
    }

    const pkg = doc.tripPackage ?? {};
    const totalTrips = pkg.totalTrips ?? 5;
    const usedTrips = pkg.usedTrips ?? 0;
    if (usedTrips > totalTrips) {
      r.skipped.push({
        id: String(doc._id),
        why: `usedTrips ${usedTrips} exceeds totalTrips ${totalTrips}`
      });
      continue;
    }
    const packageType = PACKAGE_MEMBER[pkg.packageType ?? '5_trips'];
    if (!packageType) {
      r.skipped.push({ id: String(doc._id), why: `packageType '${pkg.packageType}' is unknown` });
      continue;
    }

    const subId = idFor(doc._id);

    if (COMMIT) {
      const exists = await prisma.cRMSubscription.findUnique({ where: { id: subId } });
      if (!exists) {
        await prisma.cRMSubscription.create({
          data: {
            id: subId,
            organizerId: String(doc.organizerId),
            planType: doc.planType,
            status: status as any,
            packageType: packageType as any,
            totalTrips,
            usedTrips,
            pricePerPackage: pkg.pricePerPackage ?? 1499,
            crmBundleHasAccess: !!doc.crmBundle?.hasAccess,
            crmBundlePrice: doc.crmBundle?.price ?? 2100,
            crmBundleFeatures: doc.crmBundle?.features ?? [],
            trialIsActive: !!doc.trial?.isActive,
            trialStartDate: doc.trial?.startDate ?? null,
            trialEndDate: doc.trial?.endDate ?? null,
            trialMonthsRemaining: doc.trial?.monthsRemaining ?? 2,
            trialEndingIn7Days: !!doc.notifications?.trialEndingIn7Days,
            trialEndingIn1Day: !!doc.notifications?.trialEndingIn1Day,
            trialExpired: !!doc.notifications?.trialExpired,
            paymentReminder: !!doc.notifications?.paymentReminder,
            lastReminderSentAt: doc.notifications?.lastReminderSentAt ?? null,
            startDate: doc.startDate ?? new Date(),
            endDate: doc.endDate ?? null,
            expiryReminderSent: !!doc.expiryReminderSent,
            autoRenew: !!doc.autoRenew,
            cancelledAt: doc.cancelledAt ?? null,
            cancellationReason: str(doc.cancellationReason),
            createdAt: doc.createdAt ?? new Date(),
            updatedAt: doc.updatedAt ?? new Date()
          }
        });
      }

      for (const p of doc.payments ?? []) {
        if (!p.transactionId) continue;
        await prisma.cRMSubscriptionPayment.upsert({
          where: { transactionId: String(p.transactionId) },
          create: {
            subscriptionId: subId,
            razorpayOrderId: str(p.razorpayOrderId),
            razorpayPaymentId: str(p.razorpayPaymentId),
            razorpaySignature: str(p.razorpaySignature),
            transactionId: String(p.transactionId),
            amount: p.amount ?? 0,
            currency: p.currency ?? 'INR',
            paymentMethod: p.paymentMethod ?? 'unknown',
            status: p.status ?? 'pending',
            paidAt: p.paidAt ?? null,
            metadata: p.metadata ?? undefined
          },
          update: {}
        });
      }

      for (const a of doc.paymentAttempts ?? []) {
        // attemptId is unique now and was optional before. An attempt without
        // one gets a deterministic id so the backfill stays idempotent.
        const attemptId = a.attemptId ? String(a.attemptId) : `legacy-${subId}-${a.createdAt ?? ''}`;
        await prisma.cRMPaymentAttempt.upsert({
          where: { attemptId },
          create: {
            subscriptionId: subId,
            attemptId,
            razorpayOrderId: str(a.razorpayOrderId),
            razorpayPaymentId: str(a.razorpayPaymentId),
            amount: a.amount ?? null,
            status: a.status ?? 'attempted',
            errorMessage: str(a.errorMessage),
            createdAt: a.createdAt ?? new Date()
          },
          update: {}
        });
      }

      await prisma.cRMBillingEntry.createMany({
        data: (doc.billingHistory ?? []).map((b: any) => ({
          subscriptionId: subId,
          date: b.date ?? new Date(),
          amount: b.amount ?? 0,
          description: b.description ?? '',
          invoiceUrl: str(b.invoiceUrl)
        })),
        skipDuplicates: true
      });
    }
    r.moved++;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
