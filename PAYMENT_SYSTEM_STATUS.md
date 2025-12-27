# Payment System Status & Implementation Plan

## 📊 CURRENT STATUS

### ✅ What's Working:
1. **Razorpay Integration**
   - Credentials configured in `.env` (test mode)
   - Key ID: `rzp_test_RprUwM1vPIM49e`
   - Razorpay service initialized
   - Submerchant service with route creation

2. **Subscription System**
   - `/subscriptions/create-order` - Create Razorpay order
   - `/subscriptions/verify-payment` - Verify payment
   - Trial subscriptions (60 days)
   - Paid subscriptions (Basic/Premium)

3. **Organizer Verification**
   - Admin approval routes exist
   - `/admin/organizer-verifications/:userId/approve`
   - `/admin/organizer-verifications/:userId/reject`
   - Middleware checks verification status

4. **Payment Routes**
   - Razorpay submerchant service
   - Route creation method exists
   - QR code generation method added

### ⚠️ What's Missing/Broken:

1. **No Routing Toggle**
   - Currently tries to create routes for all organizers
   - No config to disable routing and use main account

2. **Incomplete Onboarding Flow**
   - No step-by-step onboarding wizard
   - No KYC collection during signup

3. **No Verification Request System**
   - Organizers can self-register but no auto-request to admin
   - No trustworthiness score
   - No verification badge display

4. **Payment Workflow Issues**
   - QR code generation fails (invalid Razorpay account IDs)
   - Routes created with placeholder IDs
   - No proper KYC verification flow

---

## 🎯 IMPLEMENTATION PLAN

### Phase 1: Configuration & Toggle System

**1.1 Add Routing Configuration**
```typescript
// Add to .env
ENABLE_RAZORPAY_ROUTING=false  // Toggle routing on/off
MIN_TRUST_SCORE_FOR_ROUTING=70 // Min score to enable routing
```

**1.2 Create Config Service**
```typescript
// services/api/src/config/payment.config.ts
export const paymentConfig = {
  enableRouting: process.env.ENABLE_RAZORPAY_ROUTING === 'true',
  minTrustScoreForRouting: parseInt(process.env.MIN_TRUST_SCORE_FOR_ROUTING || '70'),
  useMainAccountFallback: true
};
```

### Phase 2: Organizer Onboarding Flow

**2.1 Registration with Verification Request**
```typescript
POST /auth/register-organizer
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "********",
  "organizationName": "Adventure Tours",
  "phone": "+919876543210",
  "documents": {
    "pan": "ABCDE1234F",
    "gst": "optional",
    "businessProof": "url"
  }
}

Response:
{
  "userId": "...",
  "verificationStatus": "pending",
  "message": "Account created. Verification request sent to admin."
}
```

**2.2 Admin Notification**
- Create `VerificationRequest` model
- Notify admin via email/dashboard
- Admin reviews documents & approves

**2.3 KYC Flow**
```typescript
POST /organizer/submit-kyc
{
  "panNumber": "ABCDE1234F",
  "aadharNumber": "encrypted",
  "businessName": "Adventure Tours Pvt Ltd",
  "bankAccount": {
    "accountNumber": "1234567890",
    "ifscCode": "SBIN0001234",
    "accountHolderName": "John Doe"
  },
  "address": {...}
}
```

### Phase 3: Trustworthiness Score System

**3.1 Score Calculation**
```typescript
interface TrustworthinessScore {
  overall: number;        // 0-100
  documentVerified: 20;   // PAN, Aadhar verified
  bankVerified: 20;       // Bank account verified
  experienceYears: 15;    // Years in business
  completedTrips: 15;     // Past trip success
  userReviews: 15;        // Average rating
  responseTime: 10;       // Customer support
  refundRate: 5;          // Low refund rate bonus
}
```

**3.2 Verification Badge**
```typescript
enum VerificationBadge {
  NONE = 'none',
  BRONZE = 'bronze',    // Score 50-69
  SILVER = 'silver',    // Score 70-84
  GOLD = 'gold',        // Score 85-94
  PLATINUM = 'platinum' // Score 95-100
}
```

### Phase 4: Payment Workflow with Routing Logic

**4.1 Decision Flow**
```typescript
if (paymentConfig.enableRouting) {
  if (organizer.trustScore >= paymentConfig.minTrustScoreForRouting) {
    // Create Razorpay route for organizer
    const route = await razorpaySubmerchantService.createRoute(...)
    // Generate QR code
    const qr = await razorpaySubmerchantService.generateQRCode(...)
  } else {
    // Use main account with manual payout tracking
    useMainAccountWithTracking(organizer);
  }
} else {
  // Always use main Razorpay account
  useMainAccount();
}
```

**4.2 Payment Collection**
```typescript
// If routing enabled:
Customer → Razorpay Route → Auto split (5% platform + 95% organizer)

// If routing disabled:
Customer → Main Razorpay Account → Manual payout tracking
```

---

## 📋 DATABASE SCHEMA UPDATES

### User Model (Add to organizerProfile)
```typescript
organizerProfile: {
  // ... existing fields
  verificationStatus: 'pending' | 'approved' | 'rejected' | 'suspended',
  verificationBadge: 'none' | 'bronze' | 'silver' | 'gold' | 'platinum',
  trustScore: {
    overall: Number,
    breakdown: {
      documentVerified: Number,
      bankVerified: Number,
      experienceYears: Number,
      completedTrips: Number,
      userReviews: Number,
      responseTime: Number,
      refundRate: Number
    },
    lastCalculated: Date
  },
  kycDetails: {
    panNumber: String,
    panVerified: Boolean,
    aadharNumber: String, // Encrypted
    aadharVerified: Boolean,
    businessRegistration: String,
    businessVerified: Boolean
  },
  routingEnabled: Boolean,  // Individual toggle
  razorpayRouteId: String   // If routing enabled
}
```

### VerificationRequest Model (New)
```typescript
{
  organizerId: ObjectId,
  organizerName: String,
  organizerEmail: String,
  requestType: 'initial' | 'kyc_update' | 're_verification',
  status: 'pending' | 'under_review' | 'approved' | 'rejected',
  documents: [{
    type: 'pan' | 'aadhar' | 'business_proof' | 'bank_statement',
    url: String,
    verified: Boolean
  }],
  adminNotes: String,
  reviewedBy: ObjectId,
  reviewedAt: Date,
  createdAt: Date
}
```

---

## 🔧 API ENDPOINTS TO CREATE

### Organizer Onboarding
```
POST   /auth/register-organizer        - Register as organizer
POST   /organizer/submit-kyc           - Submit KYC documents
GET    /organizer/verification-status  - Check verification status
POST   /organizer/request-routing      - Request route enablement
```

### Admin Verification
```
GET    /admin/verification-requests              - List pending requests
GET    /admin/verification-requests/:id          - Get request details
POST   /admin/verification-requests/:id/approve  - Approve with score
POST   /admin/verification-requests/:id/reject   - Reject with reason
PUT    /admin/organizers/:id/trust-score         - Update trust score
POST   /admin/organizers/:id/enable-routing      - Enable routing for organizer
POST   /admin/organizers/:id/disable-routing     - Disable routing
```

### Payment Configuration
```
GET    /admin/payment-config          - Get current config
PUT    /admin/payment-config          - Update routing settings
GET    /admin/payment-stats           - Payment statistics
```

---

## 🚀 IMPLEMENTATION PRIORITY

### **HIGH PRIORITY** (Do Now)
1. ✅ Add routing toggle configuration
2. ✅ Fix trip creation to respect routing config
3. ✅ Add verification request on organizer signup
4. ✅ Add trustworthiness score calculation

### **MEDIUM PRIORITY** (Do Next)
5. ⚠️ Implement KYC submission flow
6. ⚠️ Create verification badge system
7. ⚠️ Add admin verification dashboard

### **LOW PRIORITY** (Nice to Have)
8. ⬜ Automated trust score calculation
9. ⬜ Verification email notifications
10. ⬜ Payment analytics dashboard

---

## 💡 RECOMMENDED FLOW

### New Organizer Journey:
```
1. Register → Email: "organizer@example.com", Password: "****"
   ↓
2. Verification Request Created (Status: Pending)
   ↓
3. Admin Notified (Email + Dashboard notification)
   ↓
4. Admin Reviews Documents
   ↓
5. Admin Approves → Trust Score Assigned (e.g., 65/100)
   ↓
6. Organizer Can Now Create Trips
   ↓
7. Organizer Decides to Buy Subscription
   ↓
8. Payment via Razorpay (Main Account - Routing Disabled by Default)
   ↓
9. Subscription Activated
   ↓
10. [If Trust Score ≥ 70] Option to Request Routing
    ↓
11. Admin Enables Routing → Razorpay Route Created
    ↓
12. Organizer Gets QR Code for Direct Payments
```

### Trip Creation Journey:
```
1. Organizer Creates Trip
   ↓
2. Check: Is Routing Enabled?
   ├─ YES → Check Trust Score ≥ Min Required
   │   ├─ YES → Create Razorpay Route + QR
   │   └─ NO  → Use Main Account
   └─ NO → Always Use Main Account
   ↓
3. Trip Published
   ↓
4. Customer Books → Pays
   ↓
5. Payment Captured
   ├─ Routing Enabled → Auto Split (95% organizer, 5% platform)
   └─ Routing Disabled → Manual Payout Tracking
```

---

## 🔐 SECURITY CONSIDERATIONS

1. **KYC Data Encryption**
   - Aadhar numbers encrypted at rest
   - PAN verified via external API (optional)

2. **Route Creation**
   - Only admins can enable routing
   - Requires minimum trust score
   - Can be revoked anytime

3. **Payment Safety**
   - All payments go through Razorpay
   - Webhook signature verification
   - Idempotency keys for orders

---

## 📝 NEXT STEPS

1. Create payment config file
2. Add routing toggle logic to trip creation
3. Create verification request model
4. Implement organizer registration flow
5. Build admin verification dashboard
6. Test end-to-end flow

---

**Current Test Credentials:**
- Razorpay Key: `rzp_test_RprUwM1vPIM49e`
- Razorpay Secret: `J0qz50Bw0jzv6LK9G0jdN3cF`
- Test Mode: Active
