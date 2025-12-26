/**
 * Payment Validators
 * Comprehensive validation for all payment-related operations
 */
import { z } from 'zod';

// ========================================
// Subscription Payment Validation
// ========================================
export const subscriptionPaymentSchema = z.object({
  planId: z.enum(['STARTER', 'BASIC', 'PROFESSIONAL', 'PREMIUM', 'ENTERPRISE']),
  paymentMethod: z.enum(['razorpay', 'manual']).default('razorpay'),
  couponCode: z.string().optional(),
  autoRenew: z.boolean().default(true),
});

export type SubscriptionPaymentInput = z.infer<typeof subscriptionPaymentSchema>;

// ========================================
// Booking Payment Validation
// ========================================
export const bookingPaymentSchema = z.object({
  tripId: z.string().min(12, 'Invalid trip ID'),
  bookingId: z.string().min(12, 'Invalid booking ID'),
  amount: z.number()
    .int('Amount must be in paise (whole number)')
    .min(10000, 'Minimum amount is ₹100')
    .max(100000000, 'Maximum amount is ₹10,00,000'),
  currency: z.enum(['INR']).default('INR'),
  numberOfTravelers: z.number()
    .int('Number of travelers must be whole')
    .min(1, 'At least 1 traveler required')
    .max(50, 'Maximum 50 travelers per booking'),
  paymentMethod: z.enum(['razorpay', 'manual']).default('razorpay'),
  notes: z.record(z.string()).optional(),
});

export type BookingPaymentInput = z.infer<typeof bookingPaymentSchema>;

// ========================================
// Organizer Onboarding & Submerchant Setup
// ========================================
export const organizerOnboardingSchema = z.object({
  legalBusinessName: z.string()
    .min(2, 'Business name too short')
    .max(120, 'Business name too long')
    .regex(/^[a-zA-Z0-9\s&.,'-]+$/, 'Invalid characters in business name'),
  
  businessType: z.enum(['proprietorship', 'partnership', 'llp', 'pvt_ltd'], {
    errorMap: () => ({ message: 'Invalid business type' })
  }),
  
  businessRegistration: z.object({
    number: z.string().min(1, 'Registration number required'),
    type: z.enum(['gst', 'pan', 'udyam', 'cin', 'llpin']),
    registrationDate: z.string().datetime().optional(),
  }).optional(),
  
  bankAccount: z.object({
    accountNumber: z.string()
      .regex(/^\d{6,20}$/, 'Invalid account number (6-20 digits)')
      .transform(val => val.replace(/\s/g, '')),
    ifscCode: z.string()
      .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/i, 'Invalid IFSC code format'),
    accountHolderName: z.string()
      .min(2, 'Account holder name too short')
      .max(120, 'Account holder name too long')
      .regex(/^[a-zA-Z\s&.,'-]+$/, 'Invalid characters in account holder name'),
    bankName: z.string()
      .min(2, 'Bank name required')
      .max(120, 'Bank name too long')
      .optional(),
    accountType: z.enum(['savings', 'current']).optional(),
  }),
  
  personalDetails: z.object({
    panNumber: z.string()
      .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format')
      .optional(),
    aadharNumber: z.string()
      .regex(/^[0-9]{12}$/, 'Invalid Aadhar number (12 digits)')
      .optional(),
    dateOfBirth: z.string().datetime().optional(),
  }).optional(),
  
  addressDetails: z.object({
    street: z.string().min(5, 'Street address required'),
    city: z.string().min(2, 'City required'),
    state: z.string().min(2, 'State required'),
    postalCode: z.string()
      .regex(/^[0-9]{6}$/, 'Invalid postal code (6 digits)'),
    country: z.string().default('IN'),
  }).optional(),
  
  commissionRate: z.number()
    .min(0, 'Commission rate cannot be negative')
    .max(100, 'Commission rate cannot exceed 100%')
    .default(5),
  
  settlementCycle: z.enum(['daily', 'weekly', 'monthly']).default('weekly'),
  
  contactEmail: z.string().email('Invalid email'),
  contactPhone: z.string()
    .regex(/^[+]?[0-9]{10,15}$/, 'Invalid phone number'),
});

export type OrganizerOnboardingInput = z.infer<typeof organizerOnboardingSchema>;

// ========================================
// Razorpay Signature Verification
// ========================================
export const razorpaySignatureSchema = z.object({
  razorpayOrderId: z.string().min(1, 'Order ID required'),
  razorpayPaymentId: z.string().min(1, 'Payment ID required'),
  razorpaySignature: z.string().min(1, 'Signature required'),
});

export type RazorpaySignatureInput = z.infer<typeof razorpaySignatureSchema>;

// ========================================
// Refund Request Validation
// ========================================
export const refundRequestSchema = z.object({
  paymentId: z.string().min(1, 'Payment ID required'),
  amount: z.number()
    .int('Amount must be in paise')
    .min(0, 'Amount cannot be negative')
    .optional(),
  reason: z.enum([
    'customer_request',
    'duplicate_charge',
    'cancellation',
    'poor_service',
    'other'
  ]),
  notes: z.string().max(500).optional(),
  refundToWallet: z.boolean().default(false),
});

export type RefundRequestInput = z.infer<typeof refundRequestSchema>;

// ========================================
// Settlement Request Validation
// ========================================
export const settlementRequestSchema = z.object({
  organizerId: z.string().min(12, 'Invalid organizer ID'),
  amount: z.number()
    .int('Amount must be in paise')
    .min(10000, 'Minimum settlement amount is ₹100'),
  settlementMethod: z.enum(['bank_transfer', 'wallet']).default('bank_transfer'),
  forceSettle: z.boolean().default(false),
});

export type SettlementRequestInput = z.infer<typeof settlementRequestSchema>;

// ========================================
// Wallet Top-up Validation
// ========================================
export const walletTopupSchema = z.object({
  amount: z.number()
    .int('Amount must be in paise')
    .min(10000, 'Minimum top-up is ₹100')
    .max(1000000, 'Maximum top-up is ₹10,000'),
  paymentMethod: z.enum(['razorpay', 'upi', 'card']).default('razorpay'),
  currency: z.enum(['INR']).default('INR'),
});

export type WalletTopupInput = z.infer<typeof walletTopupSchema>;

// ========================================
// Recurring Payment Setup
// ========================================
export const recurringPaymentSchema = z.object({
  customerId: z.string().min(1, 'Customer ID required'),
  frequency: z.enum(['daily', 'weekly', 'monthly', 'quarterly', 'yearly']),
  amount: z.number()
    .int('Amount must be in paise')
    .min(10000, 'Minimum amount is ₹100'),
  maxAmount: z.number()
    .int('Max amount must be in paise')
    .optional(),
  cycles: z.number()
    .int('Cycles must be whole number')
    .min(1, 'At least 1 cycle required')
    .optional(),
  startDate: z.string().datetime().optional(),
  notes: z.record(z.string()).optional(),
});

export type RecurringPaymentInput = z.infer<typeof recurringPaymentSchema>;

// ========================================
// Invoice Generation Validation
// ========================================
export const invoiceGenerationSchema = z.object({
  orderId: z.string().min(1, 'Order ID required'),
  bookingId: z.string().optional(),
  subscriptionId: z.string().optional(),
  includeGST: z.boolean().default(true),
  gstRate: z.number().default(18),
  notes: z.string().optional(),
});

export type InvoiceGenerationInput = z.infer<typeof invoiceGenerationSchema>;

// Validation helper function
export function validatePaymentInput(
  data: unknown,
  schema: z.ZodSchema
): { valid: boolean; data?: any; errors?: string[] } {
  try {
    const validated = schema.parse(data);
    return { valid: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
      return { valid: false, errors };
    }
    return { valid: false, errors: ['Unknown validation error'] };
  }
}
