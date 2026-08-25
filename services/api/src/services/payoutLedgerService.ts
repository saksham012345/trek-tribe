import { prisma } from '../lib/prisma';
import { LedgerEntryType, LedgerSource } from '@prisma/client';
import { logger } from '../utils/logger';

/**
 * Writing a payout ledger entry, exactly once.
 *
 * The ledger was being double-written, and it took moving it to Postgres to see
 * it. Two paths credit the same money:
 *
 *   1. razorpayRouteService.createTransfer() writes a credit for payoutAmount
 *      as soon as the transfer is created.
 *   2. the `transfer.processed` webhook writes a credit for the same
 *      transferDoc.payoutAmount when Razorpay confirms it.
 *
 * The normal flow runs both - payment.captured calls createTransfer, and
 * Razorpay then fires transfer.processed - so every completed payout was
 * credited twice. Refunds had the matching pair: initiateRefund() debits, and
 * `refund.processed` debits again.
 *
 * Nothing caught it because nothing sums the ledger yet. getSettlements() returns
 * the last fifty rows for display, and balanceAfter was never written by anyone.
 * The first thing to total this ledger would have been off by a factor of two,
 * with no way to tell which entries were the real ones.
 *
 * The fix is a unique constraint on (source, referenceId, type): one credit per
 * transfer id, one debit per refund id. The second write is refused by the
 * database, and this function treats that refusal as success - because it is.
 * The entry exists; that is what the caller wanted.
 */
export async function recordLedgerEntry(entry: {
  organizerId: string;
  type: LedgerEntryType;
  source: LedgerSource;
  referenceId: string;
  amount: number | string;
  currency?: string;
  description?: string;
}): Promise<{ recorded: boolean }> {
  try {
    await prisma.payoutLedger.create({
      data: {
        organizerId: entry.organizerId,
        type: entry.type,
        source: entry.source,
        referenceId: entry.referenceId,
        amount: entry.amount,
        currency: entry.currency || 'INR',
        description: entry.description
      }
    });
    return { recorded: true };
  } catch (error: any) {
    if (error?.code === 'P2002') {
      // Already recorded by the other path. Logged rather than silent, because
      // "this happened twice" is worth being able to see in the logs even now
      // that it is harmless.
      logger.info('Ledger entry already recorded, skipping duplicate', {
        source: entry.source,
        referenceId: entry.referenceId,
        type: entry.type
      });
      return { recorded: false };
    }
    throw error;
  }
}
