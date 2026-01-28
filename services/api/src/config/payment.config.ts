/**
 * Payment Configuration
 * Controls routing behavior and payment processing logic
 */

export interface PaymentConfig {
  // Whether to use Razorpay routing (submerchant accounts) or main account
  enableRouting: boolean;

  // Minimum trust score required for routing enablement
  minTrustScoreForRouting: number;

  // Fallback to main account if routing fails
  useMainAccountFallback: boolean;

  // Platform commission rate (percentage)
  platformCommissionRate: number;

  // Auto-approve organizers below this score use main account
  autoApproveMainAccountThreshold: number;
}

export const paymentConfig: PaymentConfig = {
  enableRouting: process.env.ENABLE_RAZORPAY_ROUTING === 'true',
  minTrustScoreForRouting: parseInt(process.env.MIN_TRUST_SCORE_FOR_ROUTING || '70', 10),
  useMainAccountFallback: process.env.USE_MAIN_ACCOUNT_FALLBACK !== 'false',
  platformCommissionRate: parseFloat(process.env.PLATFORM_COMMISSION_RATE || '4'),
  autoApproveMainAccountThreshold: parseInt(process.env.AUTO_APPROVE_THRESHOLD || '50', 10)
};

export function shouldEnableRoutingForOrganizer(trustScore: number, adminOverride?: boolean): boolean {
  // Admin can override and force enable/disable
  if (adminOverride !== undefined) {
    return adminOverride;
  }

  // If routing globally disabled, return false
  if (!paymentConfig.enableRouting) {
    return false;
  }

  // Check trust score meets minimum
  return trustScore >= paymentConfig.minTrustScoreForRouting;
}

export function calculateCommission(amount: number): { platformFee: number; organizerPayout: number } {
  const platformFee = Math.round(amount * (paymentConfig.platformCommissionRate / 100));
  const organizerPayout = amount - platformFee;

  return { platformFee, organizerPayout };
}
