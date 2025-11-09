# Trek Tribe™ - Quick Start Guide

## 🚀 What's Been Built

### ✅ Completed (Ready to Use)
1. **4 New Database Models**
   - `OrganizerSubscription` - Subscription management
   - `KYC` - Organizer/agent verification
   - `PromoCode` - Marketing campaigns
   - Enhanced `Trip` - Live photos, verification, duplicate detection

2. **Middleware**
   - `subscriptionCheck.ts` - Trip creation limits
   - Subscription validation middleware

3. **Utilities**
   - `duplicateDetection.ts` - Advanced trip duplicate detection

4. **Documentation**
   - `IMPLEMENTATION_GUIDE.md` - Complete roadmap
   - `FEATURES_SUMMARY.md` - Feature reference
   - This quick start guide

---

## 📝 What Needs to Be Done

### Priority 1: Backend Routes (1-2 days)
Create these 5 route files to expose the new models via API:

1. `services/api/src/routes/subscriptions.ts`
2. `services/api/src/routes/kyc.ts`
3. `services/api/src/routes/marketing.ts`
4. `services/api/src/routes/tripEnhancements.ts`
5. Enhance `services/api/src/routes/admin.ts`

### Priority 2: Connect Routes (1 hour)
Update `services/api/src/index.ts` to register new routes:
```typescript
import subscriptionRoutes from './routes/subscriptions';
import kycRoutes from './routes/kyc';
import marketingRoutes from './routes/marketing';
import tripEnhancementRoutes from './routes/tripEnhancements';

// Add after existing routes
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/kyc', kycRoutes);
app.use('/api/promo-codes', marketingRoutes);
app.use('/api/trips', tripEnhancementRoutes);
```

### Priority 3: Frontend Components (2-3 days)
Build dashboard components for each user role.

---

## 🔧 Step-by-Step Implementation

### Step 1: Test Existing Models (10 minutes)

```bash
# Start MongoDB and API
npm run dev

# Open MongoDB Compass or shell and verify models are registered
```

Test subscription model:
```javascript
// In MongoDB shell or via API test
const sub = await OrganizerSubscription.create({ 
  organizerId: 'USER_ID_HERE' 
});
console.log(sub.tripsRemaining); // Should be 5
```

### Step 2: Create Subscription Routes (30 minutes)

Create `services/api/src/routes/subscriptions.ts`:
```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { OrganizerSubscription } from '../models/OrganizerSubscription';
import { Types } from 'mongoose';

const router = Router();

// GET /api/subscriptions/my-subscription
router.get('/my-subscription', authenticate, async (req, res) => {
  try {
    const userId = new Types.ObjectId(req.user!.id);
    let subscription = await OrganizerSubscription.findOne({ organizerId: userId });
    
    if (!subscription) {
      subscription = await OrganizerSubscription.create({ organizerId: userId });
    }
    
    res.json({
      subscription: subscription.toObject(),
      isValid: (subscription as any).isValid,
      daysRemaining: (subscription as any).daysRemaining
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/subscriptions/payment
router.post('/payment', authenticate, async (req, res) => {
  try {
    const userId = new Types.ObjectId(req.user!.id);
    const { amount, transactionId, paymentMethod, receiptUrl } = req.body;
    
    const subscription = await OrganizerSubscription.findOne({ organizerId: userId });
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    await subscription.addPayment({
      amount,
      transactionId,
      paymentMethod,
      receiptUrl,
      status: 'completed'
    });
    
    res.json({
      message: 'Payment recorded successfully',
      subscription: subscription.toObject()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/subscriptions/usage
router.get('/usage', authenticate, async (req, res) => {
  try {
    const userId = new Types.ObjectId(req.user!.id);
    const subscription = await OrganizerSubscription.findOne({ organizerId: userId })
      .populate('tripUsageHistory.tripId', 'title destination startDate');
    
    if (!subscription) {
      return res.status(404).json({ error: 'Subscription not found' });
    }
    
    res.json({
      tripsUsed: subscription.tripsUsed,
      tripsRemaining: subscription.tripsRemaining,
      tripsPerCycle: subscription.tripsPerCycle,
      history: subscription.tripUsageHistory
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

### Step 3: Integrate Subscription Check with Trip Creation (20 minutes)

Update `services/api/src/routes/trips.ts`:
```typescript
import { checkSubscription, useSubscriptionSlot } from '../middleware/subscriptionCheck';
import { generateContentHash, detectDuplicateTrip } from '../utils/duplicateDetection';

// Find the trip creation route and update:
router.post('/', 
  authenticate, 
  checkSubscription,  // ADD THIS
  async (req, res, next) => {
    try {
      // Existing trip creation logic...
      const tripData = req.body;
      
      // ADD: Generate content hash for duplicate detection
      tripData.contentHash = generateContentHash(tripData);
      
      // ADD: Check for duplicates
      const duplicate = await detectDuplicateTrip({
        ...tripData,
        organizerId: req.user!.id
      });
      
      if (duplicate) {
        return res.status(409).json({
          error: 'Potential duplicate trip detected',
          duplicate: duplicate,
          message: 'A similar trip already exists. Please review before creating.'
        });
      }
      
      // Create trip...
      const trip = await Trip.create(tripData);
      
      // ADD: Store trip info for subscription slot usage
      res.locals.createdTripId = trip._id;
      res.locals.createdTripTitle = trip.title;
      
      res.json({ trip });
      next();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  },
  useSubscriptionSlot  // ADD THIS
);
```

### Step 4: Create KYC Routes (30 minutes)

Create `services/api/src/routes/kyc.ts`:
```typescript
import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { KYC } from '../models/KYC';
import { Types } from 'mongoose';

const router = Router();

// User routes
router.post('/submit', authenticate, async (req, res) => {
  try {
    const userId = new Types.ObjectId(req.user!.id);
    const kycData = {
      userId,
      userRole: req.user!.role,
      ...req.body
    };
    
    const kyc = await KYC.create(kycData);
    res.json({ kyc, message: 'KYC submitted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/my-kyc', authenticate, async (req, res) => {
  try {
    const userId = new Types.ObjectId(req.user!.id);
    const kyc = await KYC.findOne({ userId });
    
    if (!kyc) {
      return res.status(404).json({ error: 'KYC not found' });
    }
    
    res.json({ 
      kyc: kyc.toObject(),
      completionPercentage: (kyc as any).completionPercentage,
      isFullyVerified: (kyc as any).isFullyVerified
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin routes
router.get('/pending', authenticate, requireAdmin, async (req, res) => {
  try {
    const pending = await KYC.find({
      status: { $in: ['pending', 'under_review'] }
    })
      .populate('userId', 'name email')
      .sort({ submittedAt: -1 });
    
    res.json({ pending, count: pending.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/approve', authenticate, requireAdmin, async (req, res) => {
  try {
    const kyc = await KYC.findById(req.params.id);
    if (!kyc) {
      return res.status(404).json({ error: 'KYC not found' });
    }
    
    const adminId = new Types.ObjectId(req.user!.id);
    await kyc.approve(adminId, req.body.notes);
    
    res.json({ message: 'KYC approved', kyc });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/reject', authenticate, requireAdmin, async (req, res) => {
  try {
    const kyc = await KYC.findById(req.params.id);
    if (!kyc) {
      return res.status(404).json({ error: 'KYC not found' });
    }
    
    const adminId = new Types.ObjectId(req.user!.id);
    await kyc.reject(adminId, req.body.reason, req.body.notes);
    
    res.json({ message: 'KYC rejected', kyc });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
```

### Step 5: Register Routes in Main App (5 minutes)

Edit `services/api/src/index.ts`:
```typescript
// Add imports at top
import subscriptionRoutes from './routes/subscriptions';
import kycRoutes from './routes/kyc';

// Add routes (after existing routes)
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/kyc', kycRoutes);
```

### Step 6: Test API Endpoints (15 minutes)

```bash
# Start the server
npm run dev:api

# Test subscription endpoint
curl -X GET http://localhost:4000/api/subscriptions/my-subscription \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Test KYC submission
curl -X POST http://localhost:4000/api/kyc/submit \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "dateOfBirth": "1990-01-01",
    "gender": "male",
    "email": "test@example.com",
    "phone": "1234567890",
    "address": {
      "line1": "123 Test St",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001",
      "country": "India"
    },
    "documents": [{
      "type": "pan",
      "documentNumber": "ABCDE1234F",
      "documentUrl": "https://example.com/pan.pdf",
      "filename": "pan.pdf"
    }],
    "termsAccepted": true,
    "privacyPolicyAccepted": true
  }'
```

---

## 🎨 Frontend Quick Start

### Step 7: Create Organizer Subscription Component (30 minutes)

Create `web/src/pages/organizer/SubscriptionManager.tsx`:
```tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

const SubscriptionManager: React.FC = () => {
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscription();
  }, []);

  const fetchSubscription = async () => {
    try {
      const response = await axios.get('/api/subscriptions/my-subscription');
      setSubscription(response.data.subscription);
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">My Subscription</h1>
      
      {/* Subscription Status */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-gray-600">Status</p>
            <p className="text-2xl font-bold">
              {subscription.isTrialActive ? 'Trial Active' : subscription.status}
            </p>
          </div>
          <div>
            <p className="text-gray-600">Trips Remaining</p>
            <p className="text-2xl font-bold text-blue-600">
              {subscription.tripsRemaining} / {subscription.tripsPerCycle}
            </p>
          </div>
        </div>
      </div>

      {/* Trial Info */}
      {subscription.isTrialActive && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-800">
            🎉 Your 2-month free trial is active! 
            Expires on {new Date(subscription.trialEndDate).toLocaleDateString()}
          </p>
        </div>
      )}

      {/* Renewal Button */}
      {subscription.tripsRemaining === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="font-bold mb-2">Trips Exhausted</h3>
          <p className="mb-4">Purchase 5 more trips for ₹1499</p>
          <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700">
            Renew Subscription
          </button>
        </div>
      )}

      {/* Payment History */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold mb-4">Payment History</h2>
        {subscription.payments.length === 0 ? (
          <p className="text-gray-500">No payments yet</p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Date</th>
                <th className="text-left py-2">Amount</th>
                <th className="text-left py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {subscription.payments.map((payment: any, index: number) => (
                <tr key={index} className="border-b">
                  <td className="py-2">
                    {new Date(payment.paymentDate).toLocaleDateString()}
                  </td>
                  <td className="py-2">₹{payment.amount}</td>
                  <td className="py-2">
                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                      {payment.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default SubscriptionManager;
```

---

## 📊 Testing the Complete Flow

### End-to-End Test: Organizer Journey

1. **Create New Organizer Account**
   ```bash
   POST /auth/register
   { "email": "organizer@test.com", "role": "organizer", ... }
   ```

2. **Check Subscription (Auto-created with 2-month trial)**
   ```bash
   GET /api/subscriptions/my-subscription
   # Response: { tripsRemaining: 5, isTrialActive: true }
   ```

3. **Create Trip #1**
   ```bash
   POST /trips
   # Subscription check passes ✅
   # Trip created ✅
   # Slot used: tripsRemaining = 4 ✅
   ```

4. **Create 4 More Trips**
   ```bash
   # Keep creating until tripsRemaining = 0
   ```

5. **Try to Create 6th Trip**
   ```bash
   POST /trips
   # Response: 403 Forbidden
   # Error: "You have used all 5 trips for this cycle"
   ```

6. **Renew Subscription**
   ```bash
   POST /api/subscriptions/payment
   { "amount": 1499, "transactionId": "TXN123", ... }
   # tripsRemaining resets to 5 ✅
   ```

---

## 🎯 Next Actions

### This Week
1. ✅ Review all created models
2. ⏳ Create remaining route files (2-3 hours)
3. ⏳ Test all endpoints with Postman/curl
4. ⏳ Build basic frontend components

### Next Week
1. ⏳ Create admin verification UI
2. ⏳ Build KYC submission form
3. ⏳ Add promo code functionality
4. ⏳ Implement file upload service

### Following Week
1. ⏳ Add Redis caching
2. ⏳ Set up monitoring
3. ⏳ Write tests
4. ⏳ Deploy to production

---

## 🆘 Common Issues & Solutions

### Issue: Models not registered
**Solution**: Import models in `index.ts` before using them:
```typescript
import './models/OrganizerSubscription';
import './models/KYC';
import './models/PromoCode';
```

### Issue: Subscription check fails
**Solution**: Ensure user is authenticated and has organizer role:
```typescript
if (!req.user || req.user.role !== 'organizer') {
  return res.status(403).json({ error: 'Organizer access required' });
}
```

### Issue: Duplicate detection not working
**Solution**: Generate contentHash when creating trip:
```typescript
import { generateContentHash } from '../utils/duplicateDetection';
tripData.contentHash = generateContentHash(tripData);
```

---

## 📚 Resources

- **Full Implementation Guide**: `IMPLEMENTATION_GUIDE.md`
- **Features Summary**: `FEATURES_SUMMARY.md`
- **Existing API Docs**: `services/api/API_DOCUMENTATION.md`
- **Models Directory**: `services/api/src/models/`
- **Middleware Directory**: `services/api/src/middleware/`

---

## ✅ Verification Checklist

- [ ] All 4 models created and functional
- [ ] Subscription middleware working
- [ ] Duplicate detection utility working
- [ ] Subscription routes created
- [ ] KYC routes created
- [ ] Marketing routes created
- [ ] Routes registered in index.ts
- [ ] API endpoints tested with Postman
- [ ] Frontend subscription component working
- [ ] Frontend KYC form working
- [ ] Admin verification UI working

---

**Ready to Continue?** Start with Step 2 above to create the subscription routes!
