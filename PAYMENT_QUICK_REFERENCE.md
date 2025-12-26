# Payment System - Quick Reference

## 🎯 At a Glance

### Created Files
1. **Razorpay Submerchant Service** - `services/razorpaySubmerchantService.ts`
   - Separate Razorpay accounts per organizer
   - KYC & settlement management
   - Bank detail encryption

2. **Payment Validators** - `validators/paymentValidators.ts`
   - Zod schemas for all payment operations
   - IFSC, PAN, Account number validation
   - Comprehensive error messages

3. **Updated Routes** - `routes/marketplace.ts`
   - Integrated new validators
   - Enhanced error handling
   - Better response messages

4. **Documentation**
   - `API_ENDPOINTS_AUDIT.md` - All 40+ endpoints
   - `PAYMENT_SYSTEM_ENHANCEMENT.md` - Implementation guide
   - `PAYMENT_IMPLEMENTATION_COMPLETE.md` - Full summary
   - `tests/paymentWorkflowTests.ts` - Testing guide

---

## 🚀 Key Workflows

### Customer Subscribes
```
Plans → Trial (opt) → Purchase → Razorpay → Verified → Active
```

### Customer Books Trip
```
Create Booking → Add Details → Create Order → Razorpay → Verify → Confirmed
```

### Organizer Earns
```
Activate Sub → Onboard → Create Account → KYC → Active → Receive Payments
```

### Payments Settle
```
Payment Received → Commission Deducted → Fees Deducted → Weekly Settlement → Bank
```

---

## 🔑 API Endpoints

### Subscription
```
POST /api/subscriptions/create-order
POST /api/subscriptions/verify-payment
GET /api/subscriptions/user
POST /api/subscriptions/cancel
```

### Booking
```
POST /api/bookings/create
POST /api/bookings/:id/create-order
POST /api/bookings/:id/verify-payment
POST /api/bookings/:id/refund
```

### Marketplace (Organizer)
```
POST /api/marketplace/organizer/onboard
GET /api/marketplace/organizer/status
POST /api/marketplace/settlements/request
GET /api/marketplace/settlements/ledger
```

---

## ✅ Validation Examples

### Organizer Onboarding
```json
{
  "legalBusinessName": "Trek Adventures Pvt Ltd",
  "businessType": "pvt_ltd",
  "bankAccount": {
    "accountNumber": "1234567890123",
    "ifscCode": "HDFC0001234",
    "accountHolderName": "Trek Adventures"
  },
  "personalDetails": {
    "panNumber": "AAAPL5055K",
    "aadharNumber": "123456789012"
  },
  "contactEmail": "business@trek.com",
  "contactPhone": "+919876177839"
}
```

### Subscription Purchase
```json
{
  "planId": "PROFESSIONAL",
  "paymentMethod": "razorpay",
  "autoRenew": true
}
```

### Booking Payment
```json
{
  "tripId": "507f1f77bcf86cd799439011",
  "numberOfTravelers": 2,
  "amount": 200000,
  "currency": "INR",
  "paymentMethod": "razorpay"
}
```

---

## 🔐 Security Features

| Feature | Implementation |
|---------|-----------------|
| **Encryption** | AES-256-CBC for bank details |
| **Signature** | HMAC-SHA256 for Razorpay verification |
| **Auth** | JWT on all endpoints |
| **Validation** | Zod schemas for all inputs |
| **Rate Limit** | 100 req/min on payment endpoints |

---

## 📊 Database Models

```
OrganizerPayoutConfig
├── organizerId
├── razorpayAccountId
├── bankAccount (encrypted)
├── kycStatus (pending/verified/rejected)
└── settlementCycle (daily/weekly/monthly)

PayoutLedger
├── organizerId
├── amount (paise)
├── status (pending/processing/completed)
└── transferredAt
```

---

## 🎯 Quick Start for Developers

### 1. Add Validators to Your Endpoint
```typescript
import { validatePaymentInput, subscriptionPaymentSchema } from '../validators/paymentValidators';

const validation = validatePaymentInput(req.body, subscriptionPaymentSchema);
if (!validation.valid) {
  return res.status(400).json({ errors: validation.errors });
}
```

### 2. Use Submerchant Service
```typescript
import { razorpaySubmerchantService } from '../services/razorpaySubmerchantService';

const account = await razorpaySubmerchantService.createSubmerchantAccount({
  organizerId: 'org_123',
  email: 'org@email.com',
  phone: '+919876177839',
  // ... other fields
});
```

### 3. Get Settlement Status
```typescript
const status = await razorpaySubmerchantService.getAccountStatus(organizerId);
const ledger = await razorpaySubmerchantService.getSettlementLedger(organizerId, 10);
```

---

## 🧪 Testing

### Run Payment Tests
```bash
cd services/api
npm run test:payment-workflow
```

### Manual Checklist
- [ ] Test subscription purchase
- [ ] Test booking payment
- [ ] Test refund flow
- [ ] Test organizer onboarding
- [ ] Check settlement ledger
- [ ] Verify payment signatures

---

## 📞 Support

**Payment Issues:**
- Email: tanejasaksham44@gmail.com
- Phone: +9876177839

**Documentation:**
- Complete guide: `PAYMENT_IMPLEMENTATION_COMPLETE.md`
- API audit: `API_ENDPOINTS_AUDIT.md`
- Enhancement: `PAYMENT_SYSTEM_ENHANCEMENT.md`

---

## 🎨 Razorpay Checkout Integration (Frontend)

```typescript
const RazorpayCheckout = ({ orderId, amount, planName }) => {
  const handlePayment = async () => {
    const options = {
      key: process.env.REACT_APP_RAZORPAY_KEY,
      amount: amount,
      currency: 'INR',
      name: 'Trek Tribe',
      description: planName,
      order_id: orderId,
      handler: async (response) => {
        await verifyPayment(response);
      },
      theme: { color: '#3399cc' }
    };
    
    const rzp = new (window as any).Razorpay(options);
    rzp.open();
  };
  
  return <button onClick={handlePayment}>Pay Now</button>;
};
```

---

## 📈 Metrics to Monitor

```
Payment Success Rate:   95%+
Settlement Time:        < 24 hours
API Response:           < 200ms
Uptime:                > 99.9%
```

---

**Last Updated:** December 26, 2025  
**Status:** ✅ Production Ready  
**Commits:** 2 (Security fix + Payment system)
