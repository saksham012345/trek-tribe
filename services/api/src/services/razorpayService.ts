import Razorpay from 'razorpay';
import crypto from 'crypto';
import { logger } from '../utils/logger';

// Subscription plan pricing
export const SUBSCRIPTION_PLANS = {
  '5_trips': {
    name: 'Starter Pack',
    trips: 5,
    price: 149900, // ₹1499 in paise
    priceDisplay: '₹1,499',
    description: 'Perfect for getting started - 5 trip listings',
    features: ['5 Trip Listings', 'Basic Analytics', 'Email Support', '30-day validity']
  },
  '10_trips': {
    name: 'Growth Pack',
    trips: 10,
    price: 249900, // ₹2499 in paise
    priceDisplay: '₹2,499',
    description: 'Ideal for growing organizers - 10 trip listings',
    features: ['10 Trip Listings', 'Advanced Analytics', 'Priority Support', '60-day validity', '15% savings vs Starter']
  },
  '20_trips': {
    name: 'Professional Pack',
    trips: 20,
    price: 449900, // ₹4499 in paise
    priceDisplay: '₹4,499',
    description: 'For serious organizers - 20 trip listings',
    features: ['20 Trip Listings', 'Premium Analytics', 'Priority Support', '90-day validity', '25% savings vs Starter']
  },
  '50_trips': {
    name: 'Enterprise Pack',
    trips: 50,
    price: 999900, // ₹9999 in paise
    priceDisplay: '₹9,999',
    description: 'For established businesses - 50 trip listings',
    features: ['50 Trip Listings', 'Enterprise Analytics', 'Dedicated Support', '180-day validity', '35% savings vs Starter']
  },
  'crm_bundle': {
    name: 'CRM Pro Access',
    trips: 0,
    price: 210000, // ₹2100 in paise
    priceDisplay: '₹2,100',
    description: 'Full CRM access with advanced features',
    features: ['Lead Management', 'Support Tickets', 'Analytics Dashboard', 'Customer Insights', 'Yearly subscription']
  }
};

interface RazorpayConfig {
  keyId: string;
  keySecret: string;
}

interface CreateOrderParams {
  amount: number;
  currency?: string;
  receipt: string;
  notes?: Record<string, string>;
}

interface VerifyPaymentParams {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

class RazorpayService {
  private razorpay: Razorpay | null = null;
  private keyId: string;
  private keySecret: string;

  constructor() {
    this.keyId = process.env.RAZORPAY_KEY_ID || '';
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || '';

    if (this.keyId && this.keySecret) {
      this.razorpay = new Razorpay({
        key_id: this.keyId,
        key_secret: this.keySecret,
      });
      logger.info('Razorpay service initialized successfully');
    } else {
      logger.warn('Razorpay credentials not found. Payment features will be disabled.');
    }
  }

  /**
   * Check if Razorpay is configured
   */
  isConfigured(): boolean {
    return this.razorpay !== null;
  }

  /**
   * Get Razorpay key ID for frontend
   */
  getKeyId(): string {
    return this.keyId;
  }

  /**
   * Create a Razorpay order for subscription purchase
   */
  async createOrder(params: CreateOrderParams): Promise<any> {
    if (!this.razorpay) {
      throw new Error('Razorpay is not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to environment variables.');
    }

    try {
      const order = await this.razorpay.orders.create({
        amount: params.amount, // Amount in paise
        currency: params.currency || 'INR',
        receipt: params.receipt,
        notes: params.notes || {},
      });

      logger.info('Razorpay order created', { 
        orderId: order.id, 
        amount: params.amount,
        receipt: params.receipt 
      });

      return order;
    } catch (error: any) {
      logger.error('Failed to create Razorpay order', { 
        error: error.message,
        params 
      });
      throw new Error(`Payment order creation failed: ${error.message}`);
    }
  }

  /**
   * Verify Razorpay payment signature
   */
  verifyPaymentSignature(params: VerifyPaymentParams): boolean {
    try {
      const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = params;

      // Create signature verification string
      const text = `${razorpayOrderId}|${razorpayPaymentId}`;
      
      // Generate HMAC signature
      const expectedSignature = crypto
        .createHmac('sha256', this.keySecret)
        .update(text)
        .digest('hex');

      // Compare signatures
      const isValid = expectedSignature === razorpaySignature;

      if (isValid) {
        logger.info('Payment signature verified successfully', { 
          orderId: razorpayOrderId,
          paymentId: razorpayPaymentId 
        });
      } else {
        logger.warn('Payment signature verification failed', { 
          orderId: razorpayOrderId,
          paymentId: razorpayPaymentId 
        });
      }

      return isValid;
    } catch (error: any) {
      logger.error('Error verifying payment signature', { error: error.message });
      return false;
    }
  }

  /**
   * Fetch payment details from Razorpay
   */
  async fetchPayment(paymentId: string): Promise<any> {
    if (!this.razorpay) {
      throw new Error('Razorpay is not configured');
    }

    try {
      const payment = await (this.razorpay as any).payments.fetch(paymentId);
      logger.info('Payment details fetched', { paymentId });
      return payment;
    } catch (error: any) {
      logger.error('Failed to fetch payment details', { 
        paymentId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Fetch order details from Razorpay
   */
  async fetchOrder(orderId: string): Promise<any> {
    if (!this.razorpay) {
      throw new Error('Razorpay is not configured');
    }

    try {
      const order = await this.razorpay.orders.fetch(orderId);
      logger.info('Order details fetched', { orderId });
      return order;
    } catch (error: any) {
      logger.error('Failed to fetch order details', { 
        orderId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Create refund for a payment
   */
  async createRefund(paymentId: string, amount?: number): Promise<any> {
    if (!this.razorpay) {
      throw new Error('Razorpay is not configured');
    }

    try {
      const refund = await (this.razorpay as any).payments.refund(paymentId, {
        amount: amount, // Optional - full refund if not provided
      });

      logger.info('Refund created successfully', { 
        paymentId, 
        refundId: refund.id,
        amount 
      });

      return refund;
    } catch (error: any) {
      logger.error('Failed to create refund', { 
        paymentId, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Attempt to charge a saved customer payment method (vault/token)
   * Note: This requires that `paymentMethodId` represents a token/payment source
   * stored with Razorpay (token, card token, etc.). Behavior depends on Razorpay account setup.
   */
  async chargeCustomer(params: { customerId: string; paymentMethodId: string; amount: number; currency?: string; orderId?: string; capture?: boolean; }): Promise<any> {
    if (!this.razorpay) {
      throw new Error('Razorpay is not configured');
    }

    try {
      const { customerId, paymentMethodId, amount, currency = 'INR', orderId, capture = true } = params;

      const payload: any = {
        amount,
        currency,
        // If an order id exists, associate it
        ...(orderId ? { order_id: orderId } : {}),
        // Using token/payment method id stored in Razorpay vault
        token: paymentMethodId,
        customer_id: customerId,
        payment_capture: capture ? 1 : 0
      };

      const payment = await (this.razorpay as any).payments.create(payload);

      logger.info('Charged customer via Razorpay', { paymentId: payment.id, orderId: orderId });
      return payment;
    } catch (error: any) {
      logger.error('Failed to charge customer', { error: error.message, params });
      throw error;
    }
  }

  /**
   * Get subscription plan details
   */
  getPlanDetails(packageType: string): typeof SUBSCRIPTION_PLANS[keyof typeof SUBSCRIPTION_PLANS] | null {
    return SUBSCRIPTION_PLANS[packageType as keyof typeof SUBSCRIPTION_PLANS] || null;
  }

  /**
   * Calculate discount percentage
   */
  calculateDiscount(originalPrice: number, discountedPrice: number): number {
    return Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
  }

  /**
   * Generate payment receipt ID
   */
  generateReceiptId(userId: string, packageType: string): string {
    const timestamp = Date.now();
    return `rcpt_${userId.slice(-6)}_${packageType}_${timestamp}`;
  }
}

// Singleton instance
export const razorpayService = new RazorpayService();
