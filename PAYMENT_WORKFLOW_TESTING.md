# Payment Workflow Testing Guide - Trek Tribe

## Overview
Complete guide for testing Razorpay payment integration with subscription plans and CRM access.

---

## 📋 Prerequisites

### Required Configuration
Ensure these environment variables are set in `services/api/.env`:

```env
# Razorpay Credentials
RAZORPAY_KEY_ID=rzp_test_xxxxx       # Your Razorpay test key
RAZORPAY_KEY_SECRET=your_secret       # Your Razorpay secret
RAZORPAY_WEBHOOK_SECRET=webhook_secret

# Encryption for payments
ENCRYPTION_KEY=32_character_aes_key_for_bank_data

# MongoDB & Redis for session management
MONGODB_URI=your_mongodb_connection
REDIS_URL=your_redis_connection

# JWT
JWT_SECRET=minimum_32_characters_required
```

### Test Account Setup
1. Login to [Razorpay Dashboard](https://razorpay.com/dashboard)
2. Navigate to **Settings → API Keys**
3. Copy **Test Mode** credentials (NOT Live)
4. Update `.env` with test credentials

---

## 🧪 Payment Workflow Test Cases

### Test 1: Trial Subscription (Free 60 Days)

**Endpoint:** `POST /api/subscriptions/create-order`

```bash
curl -X POST http://localhost:4000/api/subscriptions/create-order \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "planType": "PROFESSIONAL",
    "skipTrial": false
  }'
```

**Expected Response:**
```json
{
  "isTrial": true,
  "subscription": {
    "_id": "...",
    "organizerId": "...",
    "plan": "free-trial",
    "status": "trial",
    "isTrialActive": true,
    "trialDays": 60,
    "crmAccess": true
  },
  "message": "60-day free trial activated!"
}
```

**Verification:**
- User should see "Trial Active" status
- CRM access enabled immediately
- No payment required

---

### Test 2: Paid Subscription (PROFESSIONAL Plan - ₹2,199)

**Step 1: Create Razorpay Order**

```bash
curl -X POST http://localhost:4000/api/subscriptions/create-order \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "planType": "PROFESSIONAL",
    "skipTrial": true
  }'
```

**Expected Response:**
```json
{
  "isTrial": false,
  "orderId": "order_xxx",
  "amount": 219900,
  "currency": "INR",
  "keyId": "rzp_test_xxxxx",
  "plan": {
    "name": "Professional Plan",
    "price": 2199,
    "trips": 6,
    "features": [...]
  }
}
```

**Step 2: Complete Payment on Frontend**

1. Use **Razorpay Test Cards** (from [Razorpay Documentation](https://razorpay.com/docs/payments/test-cards/)):

| Card Type | Card Number | Expiry | CVV |
|-----------|------------|--------|-----|
| Visa (Success) | 4111 1111 1111 1111 | 12/25 | 123 |
| Visa (Failure) | 4222 2222 2222 2222 | 12/25 | 123 |
| MasterCard | 5555 5555 5555 4444 | 12/25 | 123 |

2. Frontend redirects to Razorpay checkout
3. Complete payment with test card details

**Step 3: Verify Payment**

```bash
curl -X POST http://localhost:4000/api/subscriptions/verify-payment \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "razorpay_order_id": "order_xxx",
    "razorpay_payment_id": "pay_xxx",
    "razorpay_signature": "signature_xxx",
    "planType": "PROFESSIONAL"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "subscription": {
    "_id": "...",
    "organizerId": "...",
    "plan": "PROFESSIONAL",
    "status": "active",
    "crmAccess": true,
    "leadCapture": true,
    "phoneNumbers": true,
    "subscriptionEndDate": "2026-01-22T12:00:00Z"
  },
  "message": "Payment verified and subscription activated!"
}
```

---

### Test 3: CRM Access Verification

**Endpoint:** `GET /api/subscriptions/verify-crm-access`

```bash
curl -X GET http://localhost:4000/api/subscriptions/verify-crm-access \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response (PROFESSIONAL+ Plan):**
```json
{
  "hasCRMAccess": true,
  "hasLeadCapture": true,
  "canViewPhoneNumbers": true,
  "planType": "PROFESSIONAL",
  "planName": "Professional Plan",
  "planPrice": 2199,
  "subscriptionStatus": "active",
  "features": {
    "crm": {
      "enabled": true,
      "description": "Full CRM access for managing leads and participants"
    },
    "leadCapture": {
      "enabled": true,
      "description": "Automatically capture and organize leads from your trips"
    },
    "phoneNumbers": {
      "enabled": true,
      "description": "View phone numbers of leads and participants"
    }
  }
}
```

**Expected Response (STARTER/BASIC Plan):**
```json
{
  "hasCRMAccess": false,
  "hasLeadCapture": false,
  "canViewPhoneNumbers": false,
  "planType": "STARTER",
  "message": "Subscription is not active",
  "accessDeniedReason": "CRM requires Professional plan or above"
}
```

---

## 🎯 End-to-End Flow

### Complete User Journey

**1. Organizer Registers**
```
POST /api/auth/register
→ User created with default NONE plan
```

**2. Dashboard Shows CRM Preview**
```
GET /api/subscriptions/verify-crm-access
→ Returns hasCRMAccess: false
→ Shows "Upgrade to Professional" button
```

**3. Organizer Clicks Upgrade**
```
Navigate to /subscribe
→ Shows PROFESSIONAL plan (₹2,199)
```

**4. Start Trial (Option A)**
```
POST /api/subscriptions/create-order
→ planType: PROFESSIONAL, skipTrial: false
→ Returns isTrial: true
→ 60-day free trial activated
→ CRM immediately accessible
```

**5. Or Skip Trial & Pay (Option B)**
```
POST /api/subscriptions/create-order
→ planType: PROFESSIONAL, skipTrial: true
→ Returns Razorpay order
→ Complete payment with test card
→ POST /api/subscriptions/verify-payment
→ Subscription activated
→ CRM accessible
```

**6. Access CRM**
```
GET /api/subscriptions/verify-crm-access
→ Returns hasCRMAccess: true
→ Frontend shows "Open CRM Dashboard" button
→ Navigate to /organizer/crm
```

---

## 📊 Payment Plans Summary

| Plan | Price | CRM | Lead Capture | Phone Numbers | Trial |
|------|-------|-----|--------------|---------------|-------|
| **STARTER** | ₹599 | ❌ | ❌ | ❌ | 60 days |
| **BASIC** | ₹1,299 | ❌ | ❌ | ❌ | 60 days |
| **PROFESSIONAL** | ₹2,199 | ✅ | ✅ | ✅ | 60 days |
| **PREMIUM** | ₹3,999 | ✅ | ✅ | ✅ | 60 days |
| **ENTERPRISE** | ₹7,999 | ✅ | ✅ | ✅ | 60 days |

---

## 🔍 Testing Checklist

### Backend Payment Flow
- [ ] Razorpay credentials configured in `.env`
- [ ] Trial creation works (no payment required)
- [ ] Razorpay order creation works with paid plans
- [ ] Payment verification validates signature correctly
- [ ] Subscription status updates after payment
- [ ] CRM access granted for PROFESSIONAL+ plans
- [ ] CRM access denied for STARTER/BASIC plans

### Frontend Integration
- [ ] OrganizerDashboard shows "Upgrade to Professional" button
- [ ] Button navigates to `/subscribe` page
- [ ] CRM section shows sample preview for non-subscribers
- [ ] "Open CRM Dashboard" button visible for subscribers
- [ ] Razorpay checkout appears on payment
- [ ] Success/Error handling works properly

### API Endpoints
- [ ] `POST /api/subscriptions/create-order` - Creates trial/order
- [ ] `POST /api/subscriptions/verify-payment` - Verifies payment
- [ ] `GET /api/subscriptions/verify-crm-access` - Checks CRM eligibility
- [ ] `GET /api/crm/subscriptions/my` - Gets subscription details
- [ ] `GET /api/subscriptions/my` - Gets user subscription

---

## 🚀 Live Razorpay Testing

### Switch to Live Mode
When ready to go live:

1. Get **Live Mode** credentials from Razorpay Dashboard
2. Update `.env`:
   ```env
   RAZORPAY_KEY_ID=rzp_live_xxxxx
   RAZORPAY_KEY_SECRET=your_live_secret
   ```
3. Use real credit/debit cards for testing
4. Enable webhook for transaction notifications

### Webhook Setup
```
POST /api/subscriptions/webhook
- Handles: payment.authorized, payment.failed, subscription.charged
- Validates: X-Razorpay-Signature header
- Updates: Subscription status, transaction logs
```

---

## 🐛 Troubleshooting

### Issue: "Payment service unavailable"
**Solution:** Razorpay not initialized
- Check `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `.env`
- Verify credentials are from Test Mode (not Live)
- Restart API server after `.env` changes

### Issue: "Invalid signature"
**Solution:** Payment verification failed
- Ensure `RAZORPAY_KEY_SECRET` is correct
- Check order ID matches the one from create-order response
- Verify payment ID from Razorpay response

### Issue: CRM Access Still Denied After Payment
**Solution:** Subscription status not updated
- Check MongoDB `OrganizerSubscription` collection
- Verify `status` field is "active"
- Check subscription expiry date is in future
- Clear browser cache and try again

### Issue: Trial Not Activating
**Solution:** User may have already used trial
- Check if `isTrialActive: false` exists in previous subscription
- Set `skipTrial: true` to force paid subscription
- Admin can reset trial status in database

---

## 📞 Support
For issues:
1. Check API logs: `docker logs api-service`
2. Check Razorpay Dashboard for payment status
3. Verify database connection and subscription records
4. Contact: support@trektribe.com

---

## 📝 Notes
- **Test Mode:** Use test cards - no real charges
- **Production:** Use Live Mode credentials only
- **Webhooks:** Essential for automated subscription management
- **Encryption:** Bank details encrypted with `ENCRYPTION_KEY`
- **Rate Limiting:** 100 requests/min per IP

Last Updated: December 22, 2025
