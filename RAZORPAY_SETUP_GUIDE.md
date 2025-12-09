# 🔧 Razorpay Integration & Testing Setup Guide

**Purpose:** Complete step-by-step guide to set up and test Razorpay payment system for Trek Tribe  
**Date:** December 9, 2025  
**Status:** CRITICAL - Needed for production launch

---

## 📋 TABLE OF CONTENTS

1. [Current Status](#current-status)
2. [Prerequisites](#prerequisites)
3. [Step-by-Step Setup](#step-by-step-setup)
4. [Testing Guide](#testing-guide)
5. [Troubleshooting](#troubleshooting)
6. [Production Deployment](#production-deployment)

---

## 🔍 CURRENT STATUS

### What's Already Implemented ✅
```
✅ Razorpay SDK integration
✅ Order creation API endpoint
✅ Payment verification logic
✅ Signature verification
✅ Database models
✅ Subscription plans configured
✅ Auto-pay scheduling
✅ Cron job setup
✅ Test file prepared
```

### What's MISSING ❌
```
❌ Razorpay API credentials (KEY_ID, KEY_SECRET)
❌ Webhook configuration
❌ Frontend checkout integration (partial)
❌ Live testing environment
❌ Payment processing verification
```

### System Architecture
```
Frontend (React)
    ↓
   [User clicks "Setup Auto-Pay"]
    ↓
Opens Razorpay Checkout Modal
    ↓
Backend API (Node.js + Express)
    ↓
Razorpay Service (verifies signature)
    ↓
MongoDB (stores payment info)
    ↓
Webhook Handler (Razorpay → Backend)
    ↓
Update Subscription Status
```

---

## 📦 PREREQUISITES

### What You Need
- [ ] Razorpay account
- [ ] TEST mode API credentials
- [ ] Node.js backend running
- [ ] MongoDB database
- [ ] Environment file (.env)
- [ ] Public webhook URL (for webhook testing)

### System Requirements
- Node.js 14+ (you have 18+)
- npm or yarn
- MongoDB running
- Docker (optional, for deployment)

---

## 🚀 STEP-BY-STEP SETUP

### STEP 1: Create Razorpay Account & Get Credentials (5 minutes)

#### 1.1 Create Account
1. Go to https://razorpay.com
2. Click "Sign Up"
3. Enter email and password
4. Verify email
5. Complete KYC (Indian users) - IMPORTANT

#### 1.2 Get TEST Mode Credentials
1. Login to Razorpay Dashboard
2. Go to **Settings → API Keys**
3. Make sure you're in **TEST Mode** (toggle at top)
4. You'll see:
   ```
   Key ID:     rzp_test_XXXXXXXXXXXXXX
   Key Secret: XXXXXXXXXXXXXXXXXXXXXXXX
   ```
5. Copy both values

#### 1.3 Create Webhook Secret
1. Go to **Settings → Webhooks** (or **Notifications → Webhooks**)
2. Add a webhook (for now, use testing service like ngrok)
3. Select events:
   - payment.authorized
   - payment.failed
   - order.created
   - order.paid
4. Copy the webhook secret

---

### STEP 2: Configure Environment Variables (5 minutes)

#### 2.1 Update `.env` File
Find your `.env` file at `services/api/.env`:

```env
# ==================== RAZORPAY CONFIGURATION ====================

# Razorpay TEST Mode Credentials (get from https://dashboard.razorpay.com)
RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXXX
RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXXXXXXXXXX
RAZORPAY_WEBHOOK_SECRET=whsec_XXXXXXXXXXXXXXXXXXXXXXXX

# Webhook Configuration (will be used for payment updates)
# For local testing, use: http://localhost:4000/webhooks/razorpay
# For production, use: https://yourdomain.com/api/webhooks/razorpay
RAZORPAY_WEBHOOK_URL=http://localhost:4000/api/webhooks/razorpay

# ===================================================================
```

#### 2.2 Verify Your Credentials
After updating `.env`, restart backend:
```bash
npm run dev
# or
npm start
```

Check logs for:
```
✅ Razorpay service initialized successfully
```

If you see:
```
⚠️ Razorpay credentials not found. Payment features will be disabled.
```

Then your credentials are not set correctly.

---

### STEP 3: Set Up Webhook (10-15 minutes)

#### 3.1 For Local Testing (Development)

Use **ngrok** to expose local server:

```bash
# Install ngrok (if not installed)
npm install -g ngrok

# Start ngrok tunnel
ngrok http 4000

# You'll see:
# Forwarding    https://xxxx-xx-xxx-xxx-xx.ngrok.io -> http://localhost:4000
```

#### 3.2 Configure in Razorpay Dashboard

1. Go to Razorpay Dashboard → **Settings → Webhooks**
2. Click "Create Webhook"
3. Webhook URL: `https://xxxx-xx-xxx-xxx-xx.ngrok.io/api/webhooks/razorpay`
4. Select Events:
   - [ ] payment.authorized
   - [ ] payment.failed
   - [ ] order.created
   - [ ] order.paid
5. Click "Create Webhook"
6. Copy the **Webhook Secret**
7. Add to `.env`:
   ```env
   RAZORPAY_WEBHOOK_SECRET=your_webhook_secret
   ```

#### 3.3 For Production

When deploying:
```bash
# Update webhook URL to production domain
RAZORPAY_WEBHOOK_URL=https://api.trektribe.in/api/webhooks/razorpay
```

---

### STEP 4: Verify Configuration (5 minutes)

#### 4.1 Test Razorpay Connection
```bash
curl -X GET http://localhost:4000/api/subscriptions/plans \
  -H "Authorization: Bearer YOUR_TEST_TOKEN"
```

Expected response:
```json
{
  "success": true,
  "plans": {
    "BASIC": {
      "name": "Basic Plan",
      "price": 1499,
      "trips": 5,
      "duration": 30
    },
    "PREMIUM": {
      "name": "Premium Plan",
      "price": 2100,
      "trips": 10,
      "duration": 30
    }
  }
}
```

#### 4.2 Check Backend Logs
```bash
# In terminal where backend is running
npm run dev

# Look for:
# ✅ Razorpay service initialized successfully
# ✅ Server listening on port 4000
```

---

## 🧪 TESTING GUIDE

### TEST SCENARIO 1: Create Subscription Order

#### Step 1: Get Test Token
```bash
# Login as organizer
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "organizer@test.com",
    "password": "password123"
  }'

# Response:
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { ... }
}
```

#### Step 2: Create Order
```bash
curl -X POST http://localhost:4000/api/subscriptions/create-order \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "planType": "BASIC",
    "skipTrial": false
  }'

# Response:
{
  "success": true,
  "order": {
    "id": "order_XXXXXXXXXXXXXXXX",
    "amount": 149900,
    "currency": "INR",
    "receipt": "rpay_org_123_5trips_1234567890"
  },
  "keyId": "rzp_test_XXXXXXXXXXXXXX"
}
```

#### Step 3: Save These Values
```
orderID = order_XXXXXXXXXXXXXXXX
keyId = rzp_test_XXXXXXXXXXXXXX
amount = 149900
```

---

### TEST SCENARIO 2: Frontend Payment Integration

#### Step 1: Open Browser Console
```javascript
// Add Razorpay script (if not already added)
const script = document.createElement('script');
script.src = 'https://checkout.razorpay.com/v1/checkout.js';
document.body.appendChild(script);
```

#### Step 2: Create Checkout
```javascript
// Use values from Step 1
const options = {
  key: "rzp_test_XXXXXXXXXXXXXX",  // From response
  amount: 149900,  // Amount in paise
  currency: "INR",
  order_id: "order_XXXXXXXXXXXXXXXX",  // From response
  handler: function(response) {
    console.log("Payment successful!");
    console.log(response.razorpay_payment_id);
    console.log(response.razorpay_order_id);
    console.log(response.razorpay_signature);
    
    // Send to backend to verify
    verifyPayment(response);
  },
  prefill: {
    email: "organizer@test.com",
    contact: "9999999999"
  }
};

const rzp = new Razorpay(options);
rzp.open();
```

#### Step 3: Complete Payment with Test Card
When Razorpay modal opens:
1. Click "Pay Using Email"
2. Enter email: `organizer@test.com`
3. Select Payment Method: **Card**
4. Use test card:
   ```
   Card Number: 4111 1111 1111 1111
   Expiry: Any future date (e.g., 12/25)
   CVV: Any 3 digits
   Name: Any name
   ```
5. Click "Pay"

---

### TEST SCENARIO 3: Verify Payment (Backend)

#### Step 1: Get Payment Details
```bash
# After payment is made, use response values
curl -X POST http://localhost:4000/api/subscriptions/verify-payment \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "razorpayOrderId": "order_XXXXXXXXXXXXXXXX",
    "razorpayPaymentId": "pay_XXXXXXXXXXXXXXXX",
    "razorpaySignature": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
  }'
```

#### Step 2: Check Response
```json
{
  "success": true,
  "message": "Payment verified and subscription activated",
  "subscription": {
    "planType": "BASIC",
    "status": "active",
    "expiresAt": "2025-02-08",
    "tripsRemaining": 5
  }
}
```

---

### TEST SCENARIO 4: Check Auto-Pay Status

```bash
curl -X GET http://localhost:4000/api/auto-pay/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Response:
{
  "isSetup": true,
  "scheduledPaymentDate": "2025-03-10",
  "daysUntilPayment": 60,
  "subscriptionActive": true,
  "listingsRemaining": 5,
  "amount": 149900,
  "currency": "INR"
}
```

---

### TEST SCENARIO 5: Failed Payment

#### Step 1: Use Failed Test Card
```
Card Number: 4000 0000 0000 0002
Expiry: Any future date
CVV: Any 3 digits
```

#### Step 2: Attempt Payment
Payment will fail with error message

#### Step 3: Check Status
```bash
curl -X GET http://localhost:4000/api/auto-pay/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Should show: "subscriptionActive": false
```

---

## 🧪 TEST CARDS REFERENCE

| Scenario | Card Number | Status |
|----------|-------------|--------|
| Success | 4111 1111 1111 1111 | ✅ Succeeds |
| Decline | 4000 0000 0000 0002 | ❌ Fails |
| Invalid CVV | 4000 0000 0000 2010 | ❌ Fails CVV check |
| Expired Card | 4000 0000 0000 0069 | ❌ Card expired |
| 3D Secure | 4000 0000 0000 3220 | 🔐 Requires OTP |

For all test cards:
- **Expiry:** Any future date
- **CVV:** Any 3 digits
- **Name:** Any name
- **OTP:** 000000 (if 3DS is enabled)

---

## 🐛 TROUBLESHOOTING

### Issue 1: "Razorpay credentials not found"
```
Error: Razorpay is not configured. Payment features will be disabled.
```

**Solution:**
1. Check `.env` file exists
2. Verify `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set
3. Restart backend server
4. Check `npm run dev` logs

### Issue 2: "Invalid credentials" error
```
Error: Invalid key_id or key_secret
```

**Solution:**
1. Go to Razorpay Dashboard → Settings → API Keys
2. Make sure you're in **TEST Mode**
3. Copy exact values (no extra spaces)
4. Restart server after updating .env

### Issue 3: Payment verification fails
```
Error: Payment signature verification failed
```

**Solution:**
1. Ensure `RAZORPAY_KEY_SECRET` is correct
2. Check that `razorpayOrderId`, `razorpayPaymentId`, and `razorpaySignature` are correct
3. Verify in Razorpay Dashboard that order exists
4. Check server logs for detailed error

### Issue 4: Webhook not receiving events
```
Webhook URL returning 404 or timeout
```

**Solution:**
1. Check ngrok tunnel is running
2. Use correct webhook URL in Razorpay Dashboard
3. Verify webhook endpoint exists: `/api/webhooks/razorpay`
4. Check server is listening on port 4000
5. Check firewall isn't blocking requests

### Issue 5: "Order not found" error
```
Error: Order XXXX not found
```

**Solution:**
1. Make sure order was created successfully (check response)
2. Order must be in same Razorpay account as payment
3. Order ID should start with "order_"
4. Try creating a new order

### Issue 6: Frontend Razorpay modal not opening
```
Error: RazorpayError or modal not appearing
```

**Solution:**
1. Check Razorpay script is loaded: `window.Razorpay` should exist
2. Verify `key` parameter in options is correct
3. Check browser console for errors
4. Try in incognito/private mode
5. Disable browser extensions

---

## ✅ TESTING CHECKLIST

Run through these checks to verify everything works:

### Pre-Testing
- [ ] `.env` has RAZORPAY_KEY_ID
- [ ] `.env` has RAZORPAY_KEY_SECRET
- [ ] Backend is running (`npm run dev`)
- [ ] MongoDB is running
- [ ] You can login as organizer

### Payment Flow Testing
- [ ] Can create subscription order
- [ ] Can open Razorpay checkout modal
- [ ] Can complete payment with test card
- [ ] Payment signature verifies successfully
- [ ] Subscription status updates to "active"
- [ ] Trip posting limit is enforced

### Auto-Pay Testing
- [ ] Auto-pay status endpoint returns correct data
- [ ] Scheduled payment date is 60 days from now
- [ ] Days until payment calculated correctly
- [ ] Trip listing count is limited

### Error Handling
- [ ] Failed payment shows error message
- [ ] Invalid signature is rejected
- [ ] Missing credentials shows warning
- [ ] Invalid credentials shows error

### Database
- [ ] Subscription record created in MongoDB
- [ ] Payment record created
- [ ] User subscription status updated
- [ ] Audit log entry created

---

## 🌐 PRODUCTION DEPLOYMENT

### Before Going Live

#### 1. Switch to LIVE Credentials
```bash
# In Razorpay Dashboard, switch from TEST to LIVE mode
RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXXXX
RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXXXXXXXXXX
```

#### 2. Update Webhook URL
```bash
RAZORPAY_WEBHOOK_URL=https://api.trektribe.in/api/webhooks/razorpay
```

#### 3. Configure DNS & SSL
- [ ] Domain has SSL certificate
- [ ] Webhook URL is accessible
- [ ] CORS is configured for your domain

#### 4. Final Testing
- [ ] Test payment with LIVE test cards
- [ ] Verify webhook delivery
- [ ] Check email notifications
- [ ] Test refund process

#### 5. Set Up Monitoring
- [ ] Enable payment alerts in Razorpay Dashboard
- [ ] Set up error tracking (Sentry, etc.)
- [ ] Monitor transaction logs
- [ ] Set up daily reconciliation

---

## 📞 SUPPORT & RESOURCES

### Razorpay Official Links
- Docs: https://razorpay.com/docs/
- Dashboard: https://dashboard.razorpay.com
- Support: https://razorpay.com/support/
- Community: https://community.razorpay.com

### Trek Tribe Implementation Files
```
Service:      services/api/src/services/razorpayService.ts
Routes:       services/api/src/routes/subscriptions.ts
Tests:        services/api/src/__tests__/razorpay.test.ts
Auto-Pay:     services/api/src/services/autoPayService.ts
Docs:         services/api/docs/PAYMENT_TESTING_GUIDE.md
```

### Common Issues Contact
If you encounter issues:
1. Check logs: `services/api/logs/`
2. Review test file: `src/__tests__/razorpay.test.ts`
3. Check Razorpay Dashboard for transaction history
4. Contact Razorpay support with transaction ID

---

## ⏱️ ESTIMATED TIME

| Task | Time |
|------|------|
| Create Razorpay account | 10 min |
| Get credentials | 5 min |
| Configure .env | 5 min |
| Set up ngrok | 5 min |
| Configure webhook | 10 min |
| Test payment flow | 15 min |
| Fix issues (if any) | 10-30 min |
| **Total** | **1-2 hours** |

---

## 🎉 NEXT STEPS

After completing this setup:

1. ✅ Run payment testing (above)
2. ✅ Test all scenarios
3. ✅ Verify webhook delivery
4. ✅ Update frontend UI if needed
5. ✅ Deploy to staging
6. ✅ Final QA testing
7. ✅ Deploy to production

---

**Setup Guide Created:** December 9, 2025  
**Status:** Ready for Implementation  
**Difficulty:** Easy (just configuration)  
**Time Required:** 1-2 hours  

This is a CRITICAL setup needed before launch. Follow these steps and you'll have Razorpay fully functional! 🚀
