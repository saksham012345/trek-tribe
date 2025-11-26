import { validatePaymentMethodId } from '../services/paymentTokenService';

describe('paymentTokenService validatePaymentMethodId (heuristic)', () => {
  it('returns false for missing token', async () => {
    const res = await validatePaymentMethodId(undefined);
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('missing');
  });

  it('returns false for short/invalid format tokens', async () => {
    const res = await validatePaymentMethodId('abc');
    expect(res.valid).toBe(false);
    expect(res.reason).toBe('invalid_format');
  });

  it('returns true for heuristically valid token when razorpay not configured', async () => {
    // Payment tokens that look plausible (includes underscore and length)
    const res = await validatePaymentMethodId('card_tok_123456');
    // In test environment Razorpay is not configured in memory tests, so we expect not-verified remote
    expect(res.valid).toBe(true);
    expect(res.reason).toBe('not_verified_remote');
  });
});
