# 💳 Complete Payment & Subscription Workflow

## Overview
This document explains the complete payment workflow from plan selection to trip creation access, including Razorpay integration and subscription management.

---

## 🔄 Workflow Steps

### **1. User Registration**
```
POST /api/auth/register
{
  "name": "Organizer Name",
  "email": "organizer@example.com",
  "password": "SecurePass123!",
  "role": "organizer"
}

Response: { token, user }
```
- New organizer registers
- Receives JWT token for authentication
- **No subscription created yet**

---

### **2. Trip Creation WITHOUT Subscription (Blocked)**
```
POST /api/trips
Authorization: Bearer <token>
{
  "title": "Mountain Trek",
  "destination": "Manali",
  "price": 5000,
  ...
}

Response: 402 Payment Required
{
  "error": "Subscription required",
  "message": "You need an active subscription to create trips...",
  "requiresSubscription": true,
  "trialAvailable": true,
  "actionUrl": "/organizer/subscription"
}
```
- **Trip creation is blocked** without subscription
- Returns 402 (Payment Required) status
- Suggests free trial or paid plan

---

### **3. View Available Plans**
```
GET /api/subscriptions/plans

Response:
{
  "plans": {
    "STARTER": {
      "price": 599,
      "trips": 2,
      "trialDays": 60,
      "features": [...]
    },
    "BASIC": {
      "price": 1299,
      "trips": 4,
      "trialDays": 60,
      ...
    },
    "PREMIUM": {
      "price": 3999,
      "trips": 15,
      "crmAccess": true,
      "leadCapture": true,
      ...
    },
    ...
  }
}
```

**Available Plans:**
- **STARTER**: ₹599 - 2 trips
- **BASIC**: ₹1,299 - 4 trips  
- **PROFESSIONAL**: ₹2,199 - 6 trips
- **PREMIUM**: ₹3,999 - 15 trips + CRM
- **ENTERPRISE**: ₹7,999 - 40 trips + CRM

All plans include:
- 60-day FREE trial
- 2 months free service
- Email support

---

### **4. Start Free Trial (60 Days)**
```
POST /api/subscriptions/start-trial
Authorization: Bearer <token>
{
  "plan": "BASIC"
}

Response:
{
  "subscription": {
    "status": "trial",
    "plan": "BASIC",
    "tripsPerCycle": 4,
    "tripsUsed": 0,
    "trialEndDate": "2025-02-19T...",
    "isTrialActive": true
  }
}
```
- **60-day free trial** activated
- Full access to plan features
- No payment required
- Trip creation now **allowed**

---

### **5. Create Trip WITH Active Trial ✅**
```
POST /api/trips
Authorization: Bearer <token>
{
  "title": "Himalayan Adventure",
  "destination": "Manali",
  "price": 12000,
  "capacity": 15,
  "startDate": "2025-02-01",
  "endDate": "2025-02-06",
  ...
}

Response: 201 Created
{
  "_id": "trip123",
  "title": "Himalayan Adventure",
  "organizerId": "user123",
  ...
}
```
- Trip created successfully with active trial
- **Subscription counter auto-incremented**: `tripsUsed++`
- Remaining trips calculated: `tripsRemaining = tripsPerCycle - tripsUsed`

---

### **6. Check Subscription Status**
```
GET /api/subscriptions/my
Authorization: Bearer <token>

Response:
{
  "plan": "BASIC",
  "status": "trial",
  "tripsUsed": 1,
  "tripsPerCycle": 4,
  "tripsRemaining": 3,
  "isActive": true,
  "trialEndDate": "2025-02-19T...",
  "daysRemaining": 58
}
```

---

### **7. Upgrade to Paid Plan (Create Razorpay Order)**
```
POST /api/subscriptions/create-order
Authorization: Bearer <token>
{
  "plan": "PREMIUM"
}

Response:
{
  "razorpayOrderId": "order_XXXXXXXXXXXXXX",
  "amount": 399900,  // ₹3,999 in paise
  "currency": "INR",
  "plan": "PREMIUM",
  "key": "rzp_test_XXXXXXXX"  // For frontend
}
```
- Creates Razorpay order for payment
- Returns order ID for Razorpay checkout
- Amount in **paise** (₹3,999 = 399900 paise)

---

### **8. Frontend: Razorpay Checkout**
```javascript
// In React component
const options = {
  key: response.key,
  amount: response.amount,
  currency: response.currency,
  order_id: response.razorpayOrderId,
  name: "Trek Tribe",
  description: `${response.plan} Subscription`,
  handler: function (razorpayResponse) {
    // Step 9: Verify payment
    verifyPayment({
      razorpay_order_id: razorpayResponse.razorpay_order_id,
      razorpay_payment_id: razorpayResponse.razorpay_payment_id,
      razorpay_signature: razorpayResponse.razorpay_signature
    });
  }
};

const rzp = new window.Razorpay(options);
rzp.open();
```

---

### **9. Verify Payment & Activate Subscription**
```
POST /api/subscriptions/verify-payment
Authorization: Bearer <token>
{
  "razorpay_order_id": "order_XXXXXXXXXXXXXX",
  "razorpay_payment_id": "pay_XXXXXXXXXXXXXX",
  "razorpay_signature": "abc123..."
}

Response:
{
  "success": true,
  "message": "Payment verified and subscription activated",
  "subscription": {
    "status": "active",
    "plan": "PREMIUM",
    "tripsPerCycle": 15,
    "tripsUsed": 1,  // Preserved from trial
    "subscriptionEndDate": "2025-04-19T...",  // 2 months
    "payments": [
      {
        "razorpayOrderId": "order_XXX",
        "razorpayPaymentId": "pay_XXX",
        "amount": 3999,
        "status": "completed",
        "paidAt": "2025-12-19T..."
      }
    ]
  }
}
```

**Backend Verification:**
```javascript
// Server-side signature verification
const crypto = require('crypto');

const generatedSignature = crypto
  .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
  .update(razorpay_order_id + '|' + razorpay_payment_id)
  .digest('hex');

if (generatedSignature === razorpay_signature) {
  // Valid payment - activate subscription
  subscription.status = 'active';
  subscription.payments.push({
    razorpayOrderId,
    razorpayPaymentId,
    amount,
    status: 'completed',
    paidAt: new Date()
  });
}
```

---

### **10. Create Trips with Active Subscription**
```
POST /api/trips
Authorization: Bearer <token>
{ ... trip data ... }

✅ Success: Trip created (if within limit)
❌ Blocked: If limit reached

Response (Limit Reached):
{
  "error": "Trip limit reached",
  "message": "You have reached your plan limit of 15 trips.",
  "tripsUsed": 15,
  "tripsPerCycle": 15,
  "requiresUpgrade": true
}
```

---

## 🔒 Subscription Checks Enforced

### **Trip Creation Endpoint** (`POST /api/trips`)
```javascript
// Check 1: Subscription exists and active
const subscription = await OrganizerSubscription.findOne({
  organizerId,
  status: { $in: ['active', 'trial'] }
});

if (!subscription) {
  return 402; // Subscription required
}

// Check 2: Not expired
if (expiryDate < new Date()) {
  return 402; // Subscription expired
}

// Check 3: Payment completed (for paid plans)
if (lastPayment.status !== 'completed') {
  return 402; // Payment pending
}

// Check 4: Trip limit not reached
if (tripsUsed >= tripsPerCycle) {
  return 403; // Trip limit reached
}

// ✅ All checks passed - create trip
const trip = await Trip.create({ ... });

// Auto-increment counter
subscription.tripsUsed += 1;
await subscription.save();
```

### **CRM Access** (Premium/Enterprise Only)
```javascript
// middleware/crmAccess.js
export const requireCRMAccess = async (req, res, next) => {
  const subscription = await OrganizerSubscription.findOne({...});
  
  const crmPlans = ['PREMIUM', 'ENTERPRISE'];
  if (!crmPlans.includes(subscription.plan)) {
    return 403; // CRM access denied
  }
  
  next();
};
```

**CRM Routes Protected:**
- `GET/POST /api/crm/leads`
- `GET /api/crm/analytics/organizer`
- Lead capture forms
- Advanced analytics

---

## 🧪 Testing with Razorpay Test Mode

### **1. Get Test Credentials**
1. Visit https://dashboard.razorpay.com
2. Switch to "Test Mode"
3. Go to Settings → API Keys
4. Copy **Key ID** and **Key Secret**

### **2. Set Environment Variables**
```bash
RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXXXXX
RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXXXXXXXXXX
```

### **3. Test Cards**
| Card Number | CVV | Expiry | Result |
|-------------|-----|--------|--------|
| 4111 1111 1111 1111 | 123 | Any future | ✅ Success |
| 4000 0000 0000 0002 | 123 | Any future | ❌ Decline |

### **4. Test UPI**
- VPA: `success@razorpay`
- Result: ✅ Instant success

---

## 📊 Database Schema

### **OrganizerSubscription Model**
```javascript
{
  organizerId: ObjectId,
  plan: "STARTER" | "BASIC" | "PROFESSIONAL" | "PREMIUM" | "ENTERPRISE",
  status: "trial" | "active" | "expired" | "cancelled",
  
  // Trip limits
  tripsPerCycle: Number,
  tripsUsed: Number,
  tripsRemaining: Number (virtual),
  
  // Trial info
  isTrialActive: Boolean,
  trialStartDate: Date,
  trialEndDate: Date,
  
  // Subscription dates
  subscriptionStartDate: Date,
  subscriptionEndDate: Date,
  
  // Payment records
  payments: [{
    razorpayOrderId: String,
    razorpayPaymentId: String,
    amount: Number,
    status: "pending" | "completed" | "failed",
    paidAt: Date
  }],
  
  // Timestamps
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🚨 Error Codes

| Code | Error | Meaning |
|------|-------|---------|
| 401 | Unauthorized | Missing/invalid token |
| 402 | Payment Required | No subscription |
| 403 | Forbidden | Limit reached or wrong plan |
| 409 | Conflict | Trial already used |
| 500 | Internal Error | Server error |

---

## 🔄 State Transitions

```
Registration → No Subscription
    ↓
Start Trial → status: "trial"
    ↓
Create Order → Razorpay order created
    ↓
Payment Success → status: "active"
    ↓
Create Trips → tripsUsed increments
    ↓
Limit Reached → requiresUpgrade: true
    ↓
Expires → status: "expired"
    ↓
Renew → New order/payment cycle
```

---

## ✅ Verification Checklist

- [x] **Registration**: User can register as organizer
- [x] **Block without subscription**: Trip creation returns 402
- [x] **Free trial**: 60-day trial activates successfully
- [x] **Trial access**: Trip creation works with active trial
- [x] **Counter increment**: tripsUsed auto-increments
- [x] **Razorpay order**: Order created successfully
- [x] **Payment verification**: Signature validated with HMAC
- [x] **Subscription activation**: Status changes to "active"
- [x] **Trip limits**: Creation blocked when limit reached
- [x] **CRM gating**: Premium/Enterprise only access
- [x] **Expiry handling**: Expired subscriptions blocked

---

## 📝 Testing Script

Run the comprehensive test:
```powershell
.\test-payment-workflow.ps1
```

This script tests:
1. Registration
2. Blocked trip creation
3. Plan selection
4. Free trial activation
5. Trial trip creation
6. Subscription counter
7. Razorpay order creation
8. Payment simulation
9. Verification
10. Trip limit enforcement
11. CRM access validation

---

## 🎯 Key Features

✅ **60-day free trial** - No payment required  
✅ **Automatic counter** - tripsUsed increments on creation  
✅ **Razorpay integration** - Secure payment with HMAC verification  
✅ **Plan-based features** - CRM access for Premium+  
✅ **Limit enforcement** - Automatic blocking at limit  
✅ **Trial → Paid transition** - Seamless upgrade path  
✅ **Test mode support** - Full testing without real payments  

---

## 🔗 API Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/subscriptions/plans` | GET | ✅ | Get all plans |
| `/api/subscriptions/start-trial` | POST | ✅ | Start 60-day trial |
| `/api/subscriptions/create-order` | POST | ✅ | Create Razorpay order |
| `/api/subscriptions/verify-payment` | POST | ✅ | Verify & activate |
| `/api/subscriptions/my` | GET | ✅ | Get subscription status |
| `/api/trips` | POST | ✅ | Create trip (gated) |
| `/api/crm/leads` | GET | ✅ | CRM access (Premium+) |

---

## 💡 Implementation Notes

1. **Admins bypass all checks** - Can create unlimited trips
2. **Trial preserves trip count** - When upgrading to paid, tripsUsed carries over
3. **Test mode supported** - Works with Razorpay test credentials
4. **HMAC signature validation** - Ensures payment authenticity
5. **Automatic expiry** - Subscriptions checked on every request
6. **Graceful degradation** - Clear error messages guide users

---

**Last Updated**: December 19, 2025  
**Version**: 1.0  
**Status**: ✅ Production Ready
