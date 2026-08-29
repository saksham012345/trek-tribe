/**
 * Reconciliation and cash flow — Sprint 6, the part that carries no GST.
 *
 * The sprint's entry gate is unanswered: the CA has not confirmed which GST
 * scheme applies (O2) or whether 18%-with-ITC survives (O3). Nothing here
 * computes tax, formats an invoice, or touches a rate. It reads money that has
 * already moved and says whether the records agree.
 *
 * The gate condition is "reconciliation flags computed live, never
 * hand-authored". That is the whole design: there is no discrepancy table, no
 * status column an operator can set, and no way to mark something reconciled.
 * A flag exists because the numbers disagree right now, and it disappears when
 * they stop disagreeing. A stored flag would be a claim about the past that
 * nothing re-checks - which is how a reconciliation dashboard ends up green
 * while the money is wrong.
 */

import { prisma } from '../../lib/prisma';
import { toNumber } from '../../lib/money';
import { calculatePayoutSplit, splitReconciles } from './payoutSplit';

export type FlagSeverity = 'error' | 'warning';

export interface ReconciliationFlag {
  kind:
    | 'split_does_not_sum'
    | 'paid_order_without_transfer'
    | 'transfer_without_ledger_entry'
    | 'ledger_credit_without_transfer'
    | 'commission_rate_drifted'
    | 'refund_exceeds_order';
  severity: FlagSeverity;
  reference: string;
  detail: string;
  amountPaise?: number;
}

export interface ReconciliationReport {
  organizerId: string;
  window: { from: Date; to: Date };
  checked: {
    orders: number;
    transfers: number;
    ledgerEntries: number;
    refunds: number;
  };
  flags: ReconciliationFlag[];
  /** True when nothing disagrees. Derived, never stored. */
  clean: boolean;
}

/**
 * Recompute every reconciliation flag from current data.
 *
 * Deliberately does no writes. Calling this twice in a row produces the same
 * answer, and calling it after a fix produces a different one - which is the
 * only property that makes a reconciliation screen worth looking at.
 */
export async function reconcile(
  organizerId: string,
  from: Date,
  to: Date
): Promise<ReconciliationReport> {
  const [orders, transfers, ledger, refunds, config] = await Promise.all([
    prisma.marketplaceOrder.findMany({
      where: { organizerId, createdAt: { gte: from, lte: to } },
    }),
    prisma.marketplaceTransfer.findMany({
      where: { order: { organizerId }, createdAt: { gte: from, lte: to } },
      include: { order: { select: { orderId: true, organizerId: true } } },
    }),
    prisma.payoutLedger.findMany({
      where: { organizerId, createdAt: { gte: from, lte: to } },
    }),
    prisma.marketplaceRefund.findMany({
      where: { order: { organizerId }, createdAt: { gte: from, lte: to } },
      include: { order: { select: { orderId: true, amount: true } } },
    }),
  ]).then(async ([o, t, l, r]) => [
    o,
    t,
    l,
    r,
    await prisma.organizerPayoutConfig.findUnique({ where: { organizerId } }),
  ] as const);

  const flags: ReconciliationFlag[] = [];

  // 1. Every transfer's parts must sum to its amount. The CHECK on the table
  //    should make this impossible, so a hit here means either the constraint
  //    is missing on this database or something wrote around it.
  for (const t of transfers) {
    const amount = toNumber(t.amount);
    const parts = {
      commissionAmount: toNumber(t.commissionAmount),
      razorpayFeeAmount: toNumber(t.razorpayFeeAmount),
      payoutAmount: toNumber(t.payoutAmount),
    };
    if (!splitReconciles(amount, parts)) {
      flags.push({
        kind: 'split_does_not_sum',
        severity: 'error',
        reference: t.id,
        amountPaise: amount,
        detail: `Transfer parts sum to ${
          parts.commissionAmount + parts.razorpayFeeAmount + parts.payoutAmount
        } against an amount of ${amount}.`,
      });
    }
  }

  // 2. A paid order with no transfer is money taken and not passed on. This is
  //    the flag that matters most, and it is exactly the one a stored status
  //    would hide once someone marked it handled.
  const transferByOrderId = new Set(transfers.map((t) => t.order.orderId));
  for (const o of orders) {
    if (o.status === 'paid' && !transferByOrderId.has(o.orderId)) {
      flags.push({
        kind: 'paid_order_without_transfer',
        severity: 'error',
        reference: o.orderId,
        amountPaise: toNumber(o.amount),
        detail: 'Order is paid but no transfer exists for it.',
      });
    }
  }

  // 3. and 4. The ledger and the transfers must describe the same events.
  //    payout_ledger is uniquely keyed on (source, referenceId, type), so a
  //    double credit cannot be written; a missing one still can.
  const creditRefs = new Set(
    ledger.filter((e) => e.type === 'credit' && e.source === 'transfer').map((e) => e.referenceId)
  );
  for (const t of transfers) {
    if (t.status === 'processed' && !creditRefs.has(t.id)) {
      flags.push({
        kind: 'transfer_without_ledger_entry',
        severity: 'error',
        reference: t.id,
        amountPaise: toNumber(t.payoutAmount),
        detail: 'Transfer was processed but the organizer was never credited in the ledger.',
      });
    }
  }

  const transferIds = new Set(transfers.map((t) => t.id));
  for (const e of ledger) {
    if (e.type === 'credit' && e.source === 'transfer' && !transferIds.has(e.referenceId)) {
      flags.push({
        kind: 'ledger_credit_without_transfer',
        severity: 'error',
        reference: e.id,
        amountPaise: toNumber(e.amount),
        detail: `Ledger credits transfer ${e.referenceId}, which does not exist in this window.`,
      });
    }
  }

  // 5. A transfer computed at a rate the organizer is not on. Not necessarily
  //    wrong - the rate may have changed since - so it warns rather than errors.
  if (config) {
    const currentRate = toNumber(config.commissionRate);
    for (const t of transfers) {
      const amount = toNumber(t.amount);
      if (amount === 0) continue;
      const expected = calculatePayoutSplit(amount, currentRate);
      if (expected.commissionAmount !== toNumber(t.commissionAmount)) {
        flags.push({
          kind: 'commission_rate_drifted',
          severity: 'warning',
          reference: t.id,
          amountPaise: toNumber(t.commissionAmount),
          detail: `Commission is ${toNumber(t.commissionAmount)} where the current ${currentRate}% rate gives ${expected.commissionAmount}. Expected if the rate changed after this transfer.`,
        });
      }
    }
  }

  // 6. Refunds totalling more than the order.
  const refundedByOrder = new Map<string, number>();
  for (const r of refunds) {
    const key = r.order.orderId;
    refundedByOrder.set(key, (refundedByOrder.get(key) ?? 0) + toNumber(r.amount));
  }
  for (const [orderId, refunded] of refundedByOrder) {
    const order = orders.find((o) => o.orderId === orderId);
    if (order && refunded > toNumber(order.amount)) {
      flags.push({
        kind: 'refund_exceeds_order',
        severity: 'error',
        reference: orderId,
        amountPaise: refunded,
        detail: `Refunds total ${refunded} against an order of ${toNumber(order.amount)}.`,
      });
    }
  }

  return {
    organizerId,
    window: { from, to },
    checked: {
      orders: orders.length,
      transfers: transfers.length,
      ledgerEntries: ledger.length,
      refunds: refunds.length,
    },
    flags,
    clean: flags.length === 0,
  };
}

// ─── Cash flow ───────────────────────────────────────────────────────────────

export interface CashFlowBucket {
  period: string;
  inflowPaise: number;
  outflowPaise: number;
  netPaise: number;
}

export interface CashFlowReport {
  buckets: CashFlowBucket[];
  totals: { inflowPaise: number; outflowPaise: number; netPaise: number };
}

/**
 * Money in and out per month, from the ledger.
 *
 * The ledger is the record of what an organizer is owed, and it is uniquely
 * keyed per (source, reference, type), so this cannot double-count an event
 * that was delivered twice by a webhook.
 */
export async function getCashFlow(
  organizerId: string,
  from: Date,
  to: Date
): Promise<CashFlowReport> {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT
      to_char(date_trunc('month', created_at), 'YYYY-MM') AS period,
      COALESCE(SUM(amount) FILTER (WHERE type = 'credit'), 0) AS inflow,
      COALESCE(SUM(amount) FILTER (WHERE type = 'debit'), 0)  AS outflow
    FROM payout_ledger
    WHERE organizer_id = ${organizerId}
      AND created_at >= ${from}
      AND created_at <= ${to}
    GROUP BY 1
    ORDER BY 1
  `;

  const buckets: CashFlowBucket[] = rows.map((r) => {
    const inflowPaise = Number(r.inflow);
    const outflowPaise = Number(r.outflow);
    return { period: r.period, inflowPaise, outflowPaise, netPaise: inflowPaise - outflowPaise };
  });

  const totals = buckets.reduce(
    (acc, b) => ({
      inflowPaise: acc.inflowPaise + b.inflowPaise,
      outflowPaise: acc.outflowPaise + b.outflowPaise,
      netPaise: acc.netPaise + b.netPaise,
    }),
    { inflowPaise: 0, outflowPaise: 0, netPaise: 0 }
  );

  return { buckets, totals };
}

// ─── Payout readiness ────────────────────────────────────────────────────────

/**
 * Why an organizer cannot be paid out, if they cannot.
 *
 * The gate says kyc_blocked must stay visually distinct from failed. They are
 * different problems with different fixes: a blocked payout is waiting on the
 * organizer to finish KYC, a failed one is waiting on someone to retry it, and
 * telling an organizer their payout "failed" when it is really their own
 * paperwork sends them to support instead of to the form.
 *
 * The distinction is produced here rather than stored, because it is entirely
 * derivable from the KYC record.
 */
export type PayoutReadiness = 'ready' | 'kyc_blocked' | 'not_onboarded';

export async function getPayoutReadiness(
  organizerId: string
): Promise<{ state: PayoutReadiness; reason: string }> {
  const config = await prisma.organizerPayoutConfig.findUnique({ where: { organizerId } });

  if (!config || !config.razorpayAccountId) {
    return { state: 'not_onboarded', reason: 'No payout account has been connected yet.' };
  }

  if (config.kycStatus !== 'approved') {
    return {
      state: 'kyc_blocked',
      reason: `KYC is ${config.kycStatus.replace(/_/g, ' ')}. Payouts resume once it is approved.`,
    };
  }

  return { state: 'ready', reason: 'Payouts can be sent.' };
}
