import Razorpay from 'razorpay';
import crypto from 'crypto';
import { UserPrisma as User } from '../models/userPrismaAdapter';
import { prisma } from '../lib/prisma';
import { upsertRacingSafely } from '../lib/upsert';
import { toNumber } from '../lib/money';
import { recordLedgerEntry } from './payoutLedgerService';
import { logger } from '../utils/logger';
import { calculatePayoutSplit } from '../modules/finance/payoutSplit';

interface OnboardParams {
  organizerId: string;
  email: string;
  phone?: string;
  legalBusinessName: string;
  businessType: 'proprietorship' | 'partnership' | 'llp' | 'pvt_ltd';
  bankAccount: {
    accountNumber: string;
    ifscCode: string;
    accountHolderName: string;
    bankName?: string;
  };
  commissionRate?: number;
}

interface CreateOrderParams {
  amount: number; // in paise
  currency?: string;
  userId: string;
  organizerId: string;
  tripId?: string;
  notes?: Record<string, any>;
}

interface CreateTransferParams {
  paymentId: string;
  orderId: string;
}

interface InitiateRefundParams {
  orderId: string;
  amount: number;
  reason?: string;
  initiatedBy?: string;
}

class RazorpayRouteService {
  private razorpay: Razorpay | null = null;
  private keySecret: string;

  constructor() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || '';

    if (keyId && this.keySecret) {
      this.razorpay = new Razorpay({ key_id: keyId, key_secret: this.keySecret });
      logger.info('Razorpay Route service initialized');
    } else {
      logger.warn('Razorpay credentials missing - marketplace features disabled');
    }
  }

  /** Basic AES-256-CBC encryption for sensitive bank details */
  private encrypt(value: string): string {
    if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be 32 characters for AES-256');
    }
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(process.env.ENCRYPTION_KEY), iv);
    let encrypted = cipher.update(value, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return `${iv.toString('base64')}:${encrypted}`;
  }

  /** Decrypt helper (not exposed externally) */
  private decrypt(value: string): string {
    const [ivPart, data] = value.split(':');
    const iv = Buffer.from(ivPart, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(process.env.ENCRYPTION_KEY as string), iv);
    let decrypted = decipher.update(data, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  isReady(): boolean {
    return !!this.razorpay;
  }

  /**
   * Calculate platform/organizer split.
   *
   * The arithmetic moved to modules/finance/payoutSplit so it could be tested.
   * The sprint gate asks for the remainder to be exact to the paisa on
   * Rs 1,00,001, and a private method can only be checked by reading it.
   *
   * Behaviour is unchanged: payout is still the remainder, so the three parts
   * still sum to the whole by construction, for every input.
   */
  private calculateSplit(amount: number, commissionRate: number) {
    return calculatePayoutSplit(amount, commissionRate);
  }

  async onboardOrganizer(params: OnboardParams) {
    const { organizerId, legalBusinessName, businessType, bankAccount, commissionRate = 5 } = params;

    if (!this.isReady()) {
      throw new Error('Razorpay is not configured');
    }

    // Placeholder account creation; in production call Razorpay Route API
    const accountId = `acc_${Date.now()}`;

    const encryptedAccount = this.encrypt(bankAccount.accountNumber);

    // bankDetails was a sub-document; the four fields are columns now, three of
    // them NOT NULL. Onboarding genuinely does set onboardingStatus, so unlike
    // the bank-details route this writes it on both create and update.
    const configFields = {
      razorpayAccountId: accountId,
      onboardingStatus: 'connected' as const,
      accountNumberEncrypted: encryptedAccount,
      ifscCode: bankAccount.ifscCode.toUpperCase(),
      accountHolderName: bankAccount.accountHolderName,
      bankName: bankAccount.bankName || null,
      kycStatus: 'submitted' as const,
      commissionRate,
    };

    await upsertRacingSafely(() => prisma.organizerPayoutConfig.upsert({
      where: { organizerId },
      create: { organizerId, ...configFields },
      update: configFields,
    }));

    await User.findByIdAndUpdate(organizerId, {
      razorpayAccountId: accountId,
      kycStatus: 'submitted',
      kycSubmittedAt: new Date(),
    });

    logger.info('Organizer onboarded to Route (placeholder)', { organizerId, accountId, legalBusinessName, businessType });

    return { accountId, onboardingStatus: 'connected' };
  }

  async createPlatformOrder(params: CreateOrderParams) {
    if (!this.razorpay) {
      throw new Error('Razorpay not configured');
    }

    const commissionRate = await this.getCommissionRate(params.organizerId);
    const split = this.calculateSplit(params.amount, commissionRate);

    const order = await this.razorpay.orders.create({
      amount: params.amount,
      currency: params.currency || 'INR',
      receipt: `order_${Date.now()}`,
      notes: {
        ...params.notes,
        type: 'marketplace',
        organizerId: params.organizerId,
        userId: params.userId,
      },
    });

    await prisma.marketplaceOrder.create({
      data: {
      orderId: order.id,
      userId: params.userId,
      organizerId: params.organizerId,
      tripId: params.tripId,
      amount: params.amount,
      currency: params.currency || 'INR',
      notes: params.notes,
      status: 'created',
      commissionAmount: split.commissionAmount,
      commissionRate,
      organizerPayoutAmount: split.payoutAmount,
      razorpayFeeAmount: split.razorpayFeeAmount,
      }
    });

    return order;
  }

  async createTransfer(params: CreateTransferParams) {
    if (!this.razorpay) {
      throw new Error('Razorpay not configured');
    }

    const order = await prisma.marketplaceOrder.findUnique({ where: { orderId: params.orderId } });
    if (!order) {
      throw new Error('Marketplace order not found');
    }

    const organizerConfig = await prisma.organizerPayoutConfig.findUnique({
      where: { organizerId: order.organizerId }
    });
    if (!organizerConfig?.razorpayAccountId) {
      throw new Error('Organizer Route account not found');
    }

    // Claim the order before calling Razorpay.
    //
    // This function is reached from the payment.captured webhook, and Razorpay
    // retries webhooks. The Mongoose version set order.splitStatus = 'processed'
    // *after* the transfer was created, so a retried delivery found the order
    // still 'pending' and created a second real transfer - the organizer was
    // paid twice, out of the platform's money.
    //
    // Moving the status first makes the claim atomic: whoever the database lets
    // through does the transfer, and everyone else finds count 0 and stops.
    // 'failed' is claimable so a genuine retry after an error still works.
    const claimed = await prisma.marketplaceOrder.updateMany({
      where: { id: order.id, splitStatus: { in: ['pending', 'failed'] } },
      data: { splitStatus: 'processed', paymentId: params.paymentId }
    });

    if (claimed.count === 0) {
      const existing = await prisma.marketplaceTransfer.findFirst({
        where: { orderId: order.id },
        orderBy: { createdAt: 'desc' }
      });
      logger.info('Transfer already in progress or done for this order', { orderId: params.orderId });
      return existing;
    }

    // toNumber because calculateSplit does integer arithmetic on paise, and
    // Decimal * number would not have thrown - it would have returned a Decimal
    // that Math.round turns into NaN.
    const split = this.calculateSplit(toNumber(order.amount), toNumber(order.commissionRate));

    let transfer;
    try {
      transfer = await (this.razorpay as any).transfers.create({
      account: organizerConfig.razorpayAccountId,
      amount: split.payoutAmount,
      currency: order.currency,
      source: params.paymentId,
      notes: {
        orderId: params.orderId,
        organizerId: order.organizerId.toString(),
        type: 'trip_booking_payout',
      },
      on_hold: false,
      });
    } catch (error: any) {
      // Release the claim so the next attempt can take it.
      await prisma.marketplaceOrder.update({
        where: { id: order.id },
        data: { splitStatus: 'failed' }
      });
      throw error;
    }

    const transferDoc = await prisma.marketplaceTransfer.create({
      data: {
        orderId: order.id,
        organizerId: order.organizerId,
        paymentId: params.paymentId,
        transferId: transfer.id,
        amount: order.amount,
        commissionAmount: split.commissionAmount,
        razorpayFeeAmount: split.razorpayFeeAmount,
        payoutAmount: split.payoutAmount,
        status: 'initiated',
      }
    });

    // The order was already claimed above, so nothing to save here.

    await recordLedgerEntry({
      organizerId: order.organizerId,
      type: 'credit',
      source: 'transfer',
      referenceId: transfer.id,
      amount: split.payoutAmount,
      currency: order.currency,
      description: `Payout for order ${order.orderId}`,
    });

    logger.info('Transfer created via Route', { transferId: transfer.id, orderId: order.orderId });
    return transferDoc;
  }

  async reverseTransfer(transferId: string, amount?: number) {
    if (!this.razorpay) {
      throw new Error('Razorpay not configured');
    }

    const resp = await (this.razorpay as any).transfers.reverse(transferId, { amount });

    await prisma.marketplaceTransfer.updateMany({
      where: { transferId },
      data: { status: 'reversed', processedAt: new Date() }
    });

    logger.info('Transfer reversed', { transferId, amount });
    return resp;
  }

  async initiateRefund(params: InitiateRefundParams) {
    if (!this.razorpay) {
      throw new Error('Razorpay not configured');
    }

    const order = await prisma.marketplaceOrder.findUnique({ where: { orderId: params.orderId } });
    if (!order) {
      throw new Error('Order not found for refund');
    }

    // paymentId is nullable - an order that was created but never paid has none.
    // Mongoose passed undefined straight to Razorpay, which fails with a message
    // about a missing path rather than about an unpaid order.
    if (!order.paymentId) {
      throw new Error('Order has no captured payment to refund');
    }

    const refund = await (this.razorpay as any).payments.refund(order.paymentId, {
      amount: params.amount,
      notes: { reason: params.reason || 'customer_request' },
    });

    const refundDoc = await prisma.marketplaceRefund.create({
      data: {
        orderId: order.id,
        paymentId: order.paymentId,
        refundId: refund.id,
        amount: params.amount,
        currency: order.currency,
        reason: params.reason,
        reversedTransfer: false,
        status: 'processed',
        createdBy: params.initiatedBy,
        processedAt: new Date(),
      }
    });

    // `params.amount === order.amount` compared a number to a Decimal, which is
    // false for every full refund. Both sides are numbers here.
    const isFullRefund = params.amount === toNumber(order.amount);

    await prisma.marketplaceOrder.update({
      where: { id: order.id },
      data: {
        status: isFullRefund ? 'refunded' : 'partial_refund',
        refundStatus: isFullRefund ? 'processed' : 'partial',
      }
    });

    await recordLedgerEntry({
      organizerId: order.organizerId,
      type: 'debit',
      source: 'refund',
      referenceId: refund.id,
      amount: params.amount,
      currency: order.currency,
      description: `Refund for order ${order.orderId}`,
    });

    logger.info('Refund initiated', { refundId: refund.id, orderId: order.orderId });
    return refundDoc;
  }

  verifyWebhookSignature(payload: any, signature: string, secret: string) {
    const shasum = crypto.createHmac('sha256', secret);
    shasum.update(payload);
    const digest = shasum.digest('hex');
    return digest === signature;
  }

  async generateQRCode(accountId: string, name: string, description: string) {
    if (!this.razorpay) throw new Error('Razorpay not initialized');

    // Create a QR Code
    // API Ref: https://razorpay.com/docs/api/qr-codes/create/
    const response = await this.razorpay.qrCode.create({
      type: 'upi_qr',
      name: name,
      usage: 'multiple_use', // Changed to multiple_use as it might be used by multiple people for the trip? Or keep single? trips.ts logic implies generic trip QR.
      fixed_amount: false,
      description: description,
      notes: {
        accountId: accountId
      }
    });

    return {
      qrCodeId: response.id,
      imageUrl: response.image_url,
      status: response.status
    };
  }

  private async getCommissionRate(organizerId: string): Promise<number> {
    const config = await prisma.organizerPayoutConfig.findUnique({ where: { organizerId } });
    // commissionRate is Decimal in the database and feeds calculateSplit, which
    // computes `amount * (commissionRate / 100)`. Dividing a Decimal by a number
    // yields a Decimal, multiplying yields another, and Math.round of a Decimal
    // is NaN - so the split would have been three NaNs, and the CHECK that says
    // the parts add up to the whole would have refused the transfer with a
    // message about a constraint rather than about a type.
    if (config) return toNumber(config.commissionRate);
    return Number(process.env.PLATFORM_COMMISSION_RATE || 5);
  }
}

export const razorpayRouteService = new RazorpayRouteService();
