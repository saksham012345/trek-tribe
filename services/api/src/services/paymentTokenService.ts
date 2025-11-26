import { razorpayService } from './razorpayService';
import { logger } from '../utils/logger';

/**
 * Heuristic validation for stored payment method id/token.
 * This function performs a cheap local format check and, when Razorpay
 * credentials are available, will attempt a lightweight verification
 * by calling the Razorpay API where possible. Note: depending on your
 * Razorpay setup you may need to adapt the remote validation step.
 */
export async function validatePaymentMethodId(token?: string): Promise<{ valid: boolean; reason?: string }> {
  if (!token) {
    return { valid: false, reason: 'missing' };
  }

  // Basic heuristic: tokens usually have an underscore and are non-trivial
  if (token.length < 8 || !token.includes('_')) {
    return { valid: false, reason: 'invalid_format' };
  }

  // If Razorpay service not configured, return unknown/heuristic valid
  if (!razorpayService.isConfigured()) {
    logger.warn('Razorpay not configured: skipping remote token validation');
    return { valid: true, reason: 'not_verified_remote' };
  }

  try {
    // Attempt to fetch a payment with this id — this will succeed only if
    // the token corresponds to a payment resource. Some token types will
    // not be fetchable via payments.fetch; adapt this if you use tokens API.
    await razorpayService.fetchPayment(token);
    return { valid: true };
  } catch (err: any) {
    logger.info('Remote validation failed for payment token', { token, error: err?.message });
    // Remote validation failed — token may be a vault token not accessible
    // via payments.fetch, so mark as invalid but provide reason.
    return { valid: false, reason: 'remote_check_failed' };
  }
}

export default { validatePaymentMethodId };
