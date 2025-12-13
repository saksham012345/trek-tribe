import Razorpay from 'razorpay';
import crypto from 'crypto';
import { User } from '../models/User';
import { OrganizerPayoutConfig } from '../models/OrganizerPayoutConfig';
import { MarketplaceOrder } from '../models/MarketplaceOrder';
import { MarketplaceTransfer } from '../models/MarketplaceTransfer';
import { MarketplaceRefund } from '../models/MarketplaceRefund';
import { PayoutLedger } from '../models/PayoutLedger';
import { logger } from '../utils/logger';

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

  /** Calculate platform/organizer split */
  private calculateSplit(amount: number, commissionRate: number) {
    const commissionAmount = Math.round(amount * (commissionRate / 100));
    const razorpayFeeAmount = Math.round(amount * 0.018); // Approx 1.8% fee
    const payoutAmount = amount - commissionAmount - razorpayFeeAmount;
    return { commissionAmount, razorpayFeeAmount, payoutAmount };
  }

  async onboardOrganizer(params: OnboardParams) {
    const { organizerId, legalBusinessName, businessType, bankAccount, commissionRate = 5 } = params;

    if (!this.isReady()) {
      throw new Error('Razorpay is not configured');
    }

    // Placeholder account creation; in production call Razorpay Route API
    const accountId = `acc_${Date.now()}`;

    const encryptedAccount = this.encrypt(bankAccount.accountNumber);

    await OrganizerPayoutConfig.findOneAndUpdate(
      { organizerId },
      {
        organizerId,
        razorpayAccountId: accountId,
        onboardingStatus: 'connected',
        bankDetails: {
          accountNumberEncrypted: encryptedAccount,
          ifscCode: bankAccount.ifscCode,
          accountHolderName: bankAccount.accountHolderName,
          bankName: bankAccount.bankName,
        },
        kycStatus: 'submitted',
        commissionRate,
      },
      { upsert: true, new: true }
    );

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

    await MarketplaceOrder.create({
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
    });

    return order;
  }

  async createTransfer(params: CreateTransferParams) {
    if (!this.razorpay) {
      throw new Error('Razorpay not configured');
    }

    const order = await MarketplaceOrder.findOne({ orderId: params.orderId });
    if (!order) {
      throw new Error('Marketplace order not found');
    }

    const organizerConfig = await OrganizerPayoutConfig.findOne({ organizerId: order.organizerId });
    if (!organizerConfig?.razorpayAccountId) {
      throw new Error('Organizer Route account not found');
    }

    const split = this.calculateSplit(order.amount, order.commissionRate);

    const transfer = await (this.razorpay as any).transfers.create({
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

    const transferDoc = await MarketplaceTransfer.create({
      orderId: order._id,
      organizerId: order.organizerId,
      paymentId: params.paymentId,
      transferId: transfer.id,
      amount: order.amount,
      commissionAmount: split.commissionAmount,
      razorpayFeeAmount: split.razorpayFeeAmount,
      payoutAmount: split.payoutAmount,
      status: 'initiated',
    });

    order.splitStatus = 'processed';
    order.paymentId = params.paymentId;
    await order.save();

    await PayoutLedger.create({
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

    await MarketplaceTransfer.findOneAndUpdate(
      { transferId },
      { status: 'reversed', processedAt: new Date() }
    );

    logger.info('Transfer reversed', { transferId, amount });
    return resp;
  }

  async initiateRefund(params: InitiateRefundParams) {
    if (!this.razorpay) {
      throw new Error('Razorpay not configured');
    }

    const order = await MarketplaceOrder.findOne({ orderId: params.orderId });
    if (!order) {
      throw new Error('Order not found for refund');
    }

    const refund = await (this.razorpay as any).payments.refund(order.paymentId, {
      amount: params.amount,
      notes: { reason: params.reason || 'customer_request' },
    });

    const refundDoc = await MarketplaceRefund.create({
      orderId: order._id,
      paymentId: order.paymentId,
      refundId: refund.id,
      amount: params.amount,
      currency: order.currency,
      reason: params.reason,
      reversedTransfer: false,
      status: 'processed',
      createdBy: params.initiatedBy,
      processedAt: new Date(),
    });

    order.status = params.amount === order.amount ? 'refunded' : 'partial_refund';
    order.refundStatus = params.amount === order.amount ? 'processed' : 'partial';
    await order.save();

    await PayoutLedger.create({
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

  private async getCommissionRate(organizerId: string) {
    const config = await OrganizerPayoutConfig.findOne({ organizerId });
    return config?.commissionRate ?? Number(process.env.PLATFORM_COMMISSION_RATE || 5);
  }
}

export const razorpayRouteService = new RazorpayRouteService();
