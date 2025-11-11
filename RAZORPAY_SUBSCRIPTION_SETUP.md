# 💳 Razorpay Subscription System - Complete Setup Guide

## 📋 Overview

This document explains the complete organizer subscription system with:
- **2-month free trial** for new organizers
- **Automatic email reminders** (7 days, 1 day, expired)
- **4 subscription tiers** (5, 10, 20, 50 trips)
- **Razorpay payment integration**
- **CRM bundle option**

---

## 🎯 Subscription Plans

| Plan | Price | Trips | Validity | Savings |
|------|-------|-------|----------|---------|
| **Starter Pack** | ₹1,499 | 5 | 30 days | - |
| **Growth Pack** ⭐ | ₹2,499 | 10 | 60 days | 15% |
| **Professional Pack** | ₹4,499 | 20 | 90 days | 25% |
| **Enterprise Pack** | ₹9,999 | 50 | 180 days | 35% |
| **CRM Bundle** | ₹2,100 | - | 1 year | - |

---

## 🔧 What Was Implemented

### 1. ✅ Updated CRM Subscription Model
**File:** `services/api/src/models/CRMSubscription.ts`

**New Features:**
- Support for 4 trip package sizes (5, 10, 20, 50)
- Razorpay payment fields (orderId, paymentId, signature)
- Trial notification tracking (7 days, 1 day, expired)
- Payment status tracking

**New Plan Types:**
- `trip_package_5` - ₹1,499 for 5 trips
- `trip_package_10` - ₹2,499 for 10 trips  
- `trip_package_20` - ₹4,499 for 20 trips
- `trip_package_50` - ₹9,999 for 50 trips
- `crm_bundle` - ₹2,100 for CRM access
- `trial` - 2-month free trial

### 2. ✅ Created Razorpay Service
**File:** `services/api/src/services/razorpayService.ts`

**Features:**
- Create Razorpay orders
- Verify payment signatures
- Fetch payment/order details
- Process refunds
- Plan pricing configuration

### 3. ✅ Created Notification Service  
**File:** `services/api/src/services/subscriptionNotificationService.ts`

**Automated Emails:**
- **7 days before** trial ends - Friendly reminder with all plans
- **1 day before** trial ends - Urgent notification
- **On expiry** - Informational email about account status

**Email Features:**
- Beautiful HTML templates
- All plan details with features
- Savings percentages highlighted
- Direct links to subscription page

---

## 🚀 Setup Instructions

### Step 1: Install Razorpay Package

```bash
cd C:\Users\hp\Development\trek-tribe\services\api
npm install razorpay
npm install --save-dev @types/razorpay
```

### Step 2: Add Razorpay Credentials

Add to your `.env` file:

```env
# Razorpay Configuration
RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_SECRET_KEY
```

**Get your keys:**
1. Go to https://dashboard.razorpay.com/
2. Sign up / Log in
3. Go to Settings → API Keys
4. Generate Test Keys (use Test Mode first)
5. Copy Key ID and Key Secret

### Step 3: Create Cron Job for Notifications

**File:** `services/api/src/jobs/subscriptionCron.ts`

```typescript
import cron from 'node-cron';
import { subscriptionNotificationService } from '../services/subscriptionNotificationService';
import { logger } from '../utils/logger';

/**
 * Run daily at 9 AM to check for trial expiry and send notifications
 */
export function initSubscriptionCron() {
  // Run every day at 9:00 AM
  cron.schedule('0 9 * * *', async () => {
    logger.info('Running subscription notification cron job');
    try {
      await subscriptionNotificationService.checkAndSendTrialNotifications();
      logger.info('Subscription notification cron completed successfully');
    } catch (error: any) {
      logger.error('Subscription notification cron failed', { error: error.message });
    }
  });

  logger.info('Subscription cron job initialized - runs daily at 9 AM');
}
```

### Step 4: Initialize Cron in Server

Add to `services/api/src/index.ts`:

```typescript
import { initSubscriptionCron } from './jobs/subscriptionCron';

// ... existing code ...

// Initialize cron jobs
initSubscriptionCron();

// ... rest of server code ...
```

### Step 5: Update Subscription Controller

**File:** `services/api/src/controllers/subscriptionController.ts`

Add these new endpoints:

```typescript
import { razorpayService, SUBSCRIPTION_PLANS } from '../services/razorpayService';

// Get all subscription plans
export const getSubscriptionPlans = async (req: Request, res: Response) => {
  try {
    res.json({
      plans: SUBSCRIPTION_PLANS,
      razorpayKeyId: razorpayService.getKeyId(),
      isConfigured: razorpayService.isConfigured()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// Create Razorpay order for subscription
export const createSubscriptionOrder = async (req: Request, res: Response) => {
  try {
    const { packageType } = req.body;
    const userId = (req as any).auth.userId;

    const planDetails = razorpayService.getPlanDetails(packageType);
    if (!planDetails) {
      return res.status(400).json({ error: 'Invalid package type' });
    }

    // Create Razorpay order
    const receiptId = razorpayService.generateReceiptId(userId, packageType);
    const order = await razorpayService.createOrder({
      amount: planDetails.price,
      receipt: receiptId,
      notes: {
        userId,
        packageType,
        planName: planDetails.name
      }
    });

    // Create pending subscription record
    const subscription = await CRMSubscription.create({
      organizerId: userId,
      planType: `trip_package_${planDetails.trips}` as any,
      status: 'pending_payment',
      tripPackage: {
        packageType: packageType,
        totalTrips: planDetails.trips,
        usedTrips: 0,
        remainingTrips: planDetails.trips,
        pricePerPackage: planDetails.price / 100 // Convert paise to rupees
      },
      payments: [{
        razorpayOrderId: order.id,
        transactionId: receiptId,
        amount: planDetails.price / 100,
        currency: 'INR',
        paymentMethod: 'razorpay',
        status: 'pending'
      }],
      notifications: {
        trialEndingIn7Days: false,
        trialEndingIn1Day: false,
        trialExpired: false,
        paymentReminder: false
      }
    });

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: razorpayService.getKeyId(),
      subscriptionId: subscription._id,
      planDetails
    });
  } catch (error: any) {
    logger.error('Failed to create subscription order', { error: error.message });
    res.status(500).json({ error: error.message });
  }
};

// Verify payment and activate subscription
export const verifySubscriptionPayment = async (req: Request, res: Response) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, subscriptionId } = req.body;

    // Verify signature
    const isValid = razorpayService.verifyPaymentSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    });

    if (!isValid) {
      return res.status(400).json({ error: 'Payment verification failed' });
    }

    // Update subscription
    const subscription = await CRMSubscription.findById(subscriptionId);
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }

    // Update payment record
    const payment = subscription.payments.find(p => p.razorpayOrderId === razorpayOrderId);
    if (payment) {
      payment.razorpayPaymentId = razorpayPaymentId;
      payment.razorpaySignature = razorpaySignature;
      payment.status = 'completed';
      payment.paidAt = new Date();
    }

    subscription.status = 'active';
    subscription.startDate = new Date();
    await subscription.save();

    // Send success email
    const organizer = await User.findById(subscription.organizerId);
    if (organizer) {
      await emailService.sendEmail({
        to: organizer.email,
        subject: '✅ Subscription Activated - TrekTribe',
        html: `
          <h2>Payment Successful!</h2>
          <p>Hi ${organizer.name},</p>
          <p>Your subscription has been activated successfully.</p>
          <p><strong>Plan:</strong> ${subscription.tripPackage?.packageType}</p>
          <p><strong>Trips:</strong> ${subscription.tripPackage?.totalTrips}</p>
          <p><strong>Amount Paid:</strong> ₹${payment?.amount}</p>
          <p>Start creating your trips now!</p>
        `
      });
    }

    res.json({
      success: true,
      message: 'Subscription activated successfully',
      subscription
    });
  } catch (error: any) {
    logger.error('Payment verification failed', { error: error.message });
    res.status(500).json({ error: error.message });
  }
};
```

---

## 📧 Email Notification Schedule

### Timeline Example:

```
Day 0: Organizer registers → 2-month free trial starts

Day 53: (7 days before) → "⏰ Your TrekTribe Trial Ends in 7 Days!"
        - Detailed email with all 4 plan options
        - Feature comparisons
        - Savings highlighted

Day 59: (1 day before) → "🚨 URGENT: Your TrekTribe Trial Ends Tomorrow!"
        - Urgent reminder
        - Quick plan overview
        - Direct call-to-action

Day 60: (on expiry) → "😔 Your TrekTribe Trial Has Ended"
        - Account status explanation
        - Plans still available
        - Graceful downgrade notice
```

---

## 🎨 Frontend Integration

### 1. Create Subscription Plans Page

**File:** `web/src/pages/SubscriptionPlans.tsx`

```typescript
import React, { useState, useEffect } from 'react';
import { razorpayService } from '../services/razorpayService';

const SubscriptionPlans = () => {
  const [plans, setPlans] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    const response = await api.get('/api/subscriptions/plans');
    setPlans(response.data.plans);
  };

  const handlePurchase = async (packageType: string) => {
    try {
      setLoading(true);

      // Create order
      const { data } = await api.post('/api/subscriptions/create-order', {
        packageType
      });

      // Initialize Razorpay
      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: 'TrekTribe',
        description: data.planDetails.name,
        order_id: data.orderId,
        handler: async function (response: any) {
          // Verify payment
          await api.post('/api/subscriptions/verify-payment', {
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
            subscriptionId: data.subscriptionId
          });
          
          alert('Subscription activated successfully!');
          window.location.href = '/dashboard';
        },
        prefill: {
          name: user.name,
          email: user.email,
          contact: user.phone
        },
        theme: {
          color: '#667eea'
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (error) {
      alert('Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="subscription-plans">
      {/* Render plan cards with pricing */}
    </div>
  );
};
```

### 2. Add Razorpay Script to HTML

Add to `web/public/index.html`:

```html
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
```

---

## 🧪 Testing

### Test Mode (Safe Testing)

1. Use Test API keys from Razorpay dashboard
2. Test card numbers:
   - Success: `4111 1111 1111 1111`
   - Failure: `4111 1111 1111 1112`
   - CVV: Any 3 digits
   - Expiry: Any future date

### Test Trial Notifications

```bash
# Manually trigger notification check
cd services/api
npx ts-node src/scripts/test-notifications.ts
```

Create `test-notifications.ts`:

```typescript
import { subscriptionNotificationService } from '../services/subscriptionNotificationService';

async function test() {
  await subscriptionNotificationService.checkAndSendTrialNotifications();
  console.log('✅ Notification check completed');
  process.exit(0);
}

test();
```

---

## 📊 How Organizers See Their Trial Status

### Dashboard Widget

```
┌─────────────────────────────────────────┐
│ 🎯 Your Subscription Status             │
├─────────────────────────────────────────┤
│ Plan: Free Trial                        │
│ Status: Active                          │
│ Ends: January 20, 2025 (7 days left)   │
│                                         │
│ ⚠️ Your trial is ending soon!           │
│                                         │
│ [Upgrade Now →]                         │
└─────────────────────────────────────────┘
```

---

## 🔒 Security Considerations

1. **Never expose secret key** - Only use it on backend
2. **Always verify signatures** - Prevents payment tampering
3. **Use webhooks** - For production, set up Razorpay webhooks
4. **Log all transactions** - Keep audit trail
5. **Test mode first** - Always test before going live

---

## 🎯 Production Checklist

- [ ] Get Razorpay production keys
- [ ] Update environment variables with production keys
- [ ] Set up Razorpay webhooks
- [ ] Test complete payment flow
- [ ] Test email notifications
- [ ] Set up cron job monitoring
- [ ] Configure payment retry logic
- [ ] Add invoice generation
- [ ] Test refund process
- [ ] Add analytics tracking

---

## 📞 Support

### Razorpay Documentation
- Dashboard: https://dashboard.razorpay.com/
- Docs: https://razorpay.com/docs/
- Support: support@razorpay.com

### Common Issues

**Issue: "Razorpay is not configured"**
- Solution: Add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` to `.env`

**Issue: Payment verification fails**
- Solution: Check if signature verification is correct
- Ensure secret key matches the one used to create order

**Issue: Emails not sending**
- Solution: Check email service configuration
- Verify SMTP credentials in `.env`

---

## 💡 Future Enhancements

1. **Auto-renewal** - Charge automatically before expiry
2. **Promo codes** - Discount codes for marketing
3. **Bulk discounts** - Custom enterprise pricing
4. **Subscription pause** - Allow temporary suspension
5. **Usage analytics** - Track how organizers use trips
6. **Referral rewards** - Give bonus trips for referrals

---

**Last Updated:** January 2025  
**Status:** Ready for Testing  
**Next Step:** Install Razorpay package and add API keys
