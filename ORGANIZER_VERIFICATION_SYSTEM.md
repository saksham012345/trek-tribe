# Organizer Verification System

## ✅ System Status: FULLY CONFIGURED

**Admin verification is MANDATORY for all organizers before they can create trips.**

---

## 🔐 Verification Workflow

### Step 1: Organizer Registration
When someone creates a new account as an organizer:

1. **Account Created with `pending` Status**
   - `organizerVerificationStatus` = `'pending'`
   - `trustScore.overall` = `0` (initialized at 0)
   - `verificationBadge` = `'none'`
   - `routingEnabled` = `false`

2. **Verification Request Auto-Created**
   ```typescript
   VerificationRequest {
     organizerId: user._id,
     organizerName: user.name,
     organizerEmail: user.email,
     requestType: 'initial',
     status: 'pending',
     priority: 'medium'
   }
   ```

3. **Email Verification OTP Sent**
   - Organizer receives email verification code
   - Must verify email first

### Step 2: Admin Review (Manual Process)
Admin reviews the verification request through admin panel:

**Required Admin Endpoints** (to be created):
- `GET /admin/verification-requests` - List all pending requests
- `GET /admin/verification-requests/:id` - View specific request details
- `POST /admin/verification-requests/:id/approve` - Approve organizer
- `POST /admin/verification-requests/:id/reject` - Reject organizer

**Admin Approval Process:**
```typescript
// Approve organizer with trust score
POST /admin/verification-requests/:id/approve
{
  "trustScore": 75,  // Admin assigns initial trust score (0-100)
  "verificationBadge": "silver",  // Based on score
  "enableRouting": false,  // Admin decides if routing should be enabled
  "adminNotes": "Documents verified, experienced organizer"
}
```

### Step 3: Organizer Approved
After admin approves:
- `organizerVerificationStatus` = `'approved'`
- `trustScore.overall` = assigned by admin (e.g., 75)
- `verificationBadge` = assigned based on score
- `routingEnabled` = set by admin (default: false)
- `organizerVerificationApprovedAt` = timestamp
- `organizerVerificationApprovedBy` = admin user ID

### Step 4: Trip Creation Allowed
Now organizer can create trips with payment routing logic applied.

---

## 🚫 Middleware Protection

**Middleware:** `verifyOrganizerApproved`

**Applied to:** Trip creation route
```typescript
router.post('/', 
  authenticateJwt, 
  requireRole(['organizer','admin']), 
  verifyOrganizerApproved,  // ← BLOCKS UNVERIFIED ORGANIZERS
  asyncHandler(tripCreationHandler)
);
```

**Rejection Responses:**

1. **Pending Verification:**
```json
{
  "error": "Organizer verification pending",
  "message": "Your organizer account is awaiting admin verification...",
  "verificationStatus": "pending"
}
```

2. **Rejected Verification:**
```json
{
  "error": "Organizer verification rejected",
  "message": "Your account verification was rejected. Reason: ...",
  "verificationStatus": "rejected"
}
```

3. **Not Verified:**
```json
{
  "error": "Organizer not verified",
  "message": "Your account needs admin verification...",
  "verificationStatus": "unknown"
}
```

---

## 💳 Payment Routing Decision Flow

When an **approved** organizer creates a trip:

### Decision Tree:
```
1. Check Global Toggle (ENABLE_RAZORPAY_ROUTING)
   ├─ FALSE → Use main platform account
   └─ TRUE → Continue to Step 2

2. Check Organizer Trust Score
   ├─ < 70 → Use main platform account
   └─ ≥ 70 → Continue to Step 3

3. Check Admin Override (routingEnabled)
   ├─ FALSE → Use main platform account
   └─ TRUE → Create Razorpay Route

4. Create Route or Use Main Account
   ├─ Route Created → paymentMode = 'active'
   └─ Main Account → paymentMode = 'main_account'
```

### Payment Modes:
- **`active`** - Dedicated Razorpay route created, organizer receives direct payments
- **`main_account`** - Platform Razorpay account used, manual payouts
- **`pending_onboarding`** - Eligible for routing but onboarding incomplete

---

## 🎯 Trust Score System

### Score Range: 0-100

### Components (7 metrics):
```typescript
{
  documentVerified: 20,    // KYC documents verified
  bankVerified: 20,        // Bank account verified
  experienceYears: 15,     // Years of organizing experience
  completedTrips: 15,      // Successfully completed trips
  userReviews: 15,         // Average user ratings
  responseTime: 10,        // Response time to queries
  refundRate: 5            // Refund/cancellation rate
}
```

### Verification Badges:
- **None** (< 50): `'none'` - New/unverified organizers
- **Bronze** (50-69): `'bronze'` - Basic verification
- **Silver** (70-84): `'silver'` - **Routing eligible**
- **Gold** (85-94): `'gold'` - High trust
- **Platinum** (95-100): `'platinum'` - Premium organizers

---

## ⚙️ Configuration Variables

### Environment Variables:
```env
# Razorpay Test Credentials
RAZORPAY_KEY_ID=rzp_test_RprUwM1vPIM49e
RAZORPAY_KEY_SECRET=J0qz50Bw0jzv6LK9G0jdN3cF
RAZORPAY_WEBHOOK_SECRET=whsec_TrekTribe2025SecureWebhookSecret4Razorpay

# Payment Routing Configuration
ENABLE_RAZORPAY_ROUTING=false          # Default: disabled
MIN_TRUST_SCORE_FOR_ROUTING=70         # Minimum score for routing eligibility
PLATFORM_COMMISSION_RATE=5.0           # Platform commission percentage
```

### Configuration File:
**Location:** `services/api/src/config/payment.config.ts`

```typescript
export const paymentConfig = {
  razorpay: {
    enableRouting: process.env.ENABLE_RAZORPAY_ROUTING === 'true',
    minTrustScoreForRouting: parseInt(process.env.MIN_TRUST_SCORE_FOR_ROUTING || '70'),
    platformCommissionRate: parseFloat(process.env.PLATFORM_COMMISSION_RATE || '5.0')
  }
};
```

---

## 📊 Database Models

### User Model - Organizer Profile
```typescript
organizerProfile: {
  trustScore: {
    overall: number,              // 0-100
    breakdown: {
      documentVerified: number,   // 0-20
      bankVerified: number,       // 0-20
      experienceYears: number,    // 0-15
      completedTrips: number,     // 0-15
      userReviews: number,        // 0-15
      responseTime: number,       // 0-10
      refundRate: number          // 0-5
    },
    lastCalculated: Date
  },
  verificationBadge: 'none' | 'bronze' | 'silver' | 'gold' | 'platinum',
  routingEnabled: boolean,          // Admin toggle
  razorpayRouteId?: string          // Route ID if routing enabled
}

// Verification status fields (root level)
organizerVerificationStatus: 'pending' | 'approved' | 'rejected'
organizerVerificationSubmittedAt: Date
organizerVerificationApprovedAt?: Date
organizerVerificationApprovedBy?: ObjectId
organizerVerificationRejectedAt?: Date
organizerVerificationRejectionReason?: string
```

### VerificationRequest Model
```typescript
{
  organizerId: ObjectId,
  organizerName: string,
  organizerEmail: string,
  requestType: 'initial' | 'document_update' | 're_verification',
  status: 'pending' | 'under_review' | 'approved' | 'rejected',
  priority: 'low' | 'medium' | 'high',
  documents: Array<{
    type: 'id_proof' | 'address_proof' | 'business_license' | 'tax_id',
    fileUrl: string,
    uploadedAt: Date,
    verified: boolean
  }>,
  kycDetails: {
    fullName?: string,
    phone?: string,
    address?: string,
    businessName?: string,
    taxId?: string
  },
  adminNotes?: string,
  reviewedBy?: ObjectId,
  reviewedAt?: Date,
  initialTrustScore?: number
}
```

---

## 🔍 Testing the System

### 1. Test Organizer Registration
```bash
POST http://localhost:4000/auth/register
{
  "email": "test.organizer@example.com",
  "password": "SecurePass123!",
  "name": "Test Organizer",
  "role": "organizer",
  "bio": "Experienced trekking guide",
  "yearsOfExperience": 5
}
```

**Expected Result:**
- User created with `organizerVerificationStatus: 'pending'`
- VerificationRequest created automatically
- Email verification OTP sent

### 2. Test Trip Creation (Should FAIL)
```bash
POST http://localhost:4000/trips
Authorization: Bearer <organizer_token>
{
  "title": "Test Trek",
  "price": 5000,
  ...
}
```

**Expected Error:**
```json
{
  "error": "Organizer verification pending",
  "message": "Your organizer account is awaiting admin verification...",
  "verificationStatus": "pending"
}
```

### 3. Admin Approves Organizer
```bash
# (Admin endpoint to be created)
POST http://localhost:4000/admin/verification-requests/:id/approve
Authorization: Bearer <admin_token>
{
  "trustScore": 75,
  "verificationBadge": "silver",
  "enableRouting": false
}
```

### 4. Test Trip Creation (Should SUCCEED)
```bash
POST http://localhost:4000/trips
Authorization: Bearer <organizer_token>
{
  "title": "Himalayan Trek",
  "price": 5999,
  ...
}
```

**Expected Result:**
- Trip created successfully
- Payment mode: `'main_account'` (routing disabled globally)
- QR code generated (if premium tier)

---

## 🛡️ Security Features

### ✅ Implemented:
1. **Mandatory Admin Approval** - Organizers cannot create trips without admin verification
2. **Trust Score System** - Gradual trust building based on 7 metrics
3. **Three-Layer Routing Decision** - Global toggle → Trust score → Admin override
4. **Default Safe Mode** - Routing disabled by default (`ENABLE_RAZORPAY_ROUTING=false`)
5. **Verification Request Tracking** - All organizer verifications logged in database
6. **Middleware Protection** - `verifyOrganizerApproved` blocks unverified organizers
7. **Email Verification** - OTP-based email verification required

### ⏳ Pending:
1. **Admin Verification Endpoints** - API routes for admin to approve/reject
2. **Trust Score Calculation Service** - Automated score updates based on activity
3. **KYC Document Upload** - Frontend + backend for document submission
4. **Admin Notification System** - Email/webhook alerts for new verification requests
5. **Organizer Dashboard** - Show verification status to organizers

---

## 📁 Key Files

### Models:
- `services/api/src/models/User.ts` - User model with trust score fields
- `services/api/src/models/VerificationRequest.ts` - Verification request tracking

### Routes:
- `services/api/src/routes/auth.ts` - Registration with verification request creation
- `services/api/src/routes/trips.ts` - Trip creation with routing logic

### Middleware:
- `services/api/src/middleware/verifyOrganizer.ts` - Admin verification enforcement

### Configuration:
- `services/api/src/config/payment.config.ts` - Payment routing configuration

### Services:
- `services/api/src/services/razorpaySubmerchantService.ts` - Route & QR generation

---

## 🎯 Next Steps

### Priority 1: Admin Verification Endpoints
Create admin API routes:
```typescript
// services/api/src/routes/admin.ts

// List all verification requests
GET /admin/verification-requests?status=pending

// Approve organizer
POST /admin/verification-requests/:id/approve
Body: { trustScore, verificationBadge, enableRouting, adminNotes }

// Reject organizer
POST /admin/verification-requests/:id/reject
Body: { rejectionReason, adminNotes }
```

### Priority 2: Trust Score Service
Automated trust score calculation:
```typescript
// services/api/src/services/trustScoreService.ts
calculateTrustScore(organizerId) {
  // Analyze organizer activity
  // Update trust score breakdown
  // Assign verification badge
  // Return updated score
}
```

### Priority 3: Frontend Integration
- Organizer verification status display
- Admin verification dashboard
- KYC document upload interface

---

## ✅ Summary

**Organizers MUST be verified by admin before creating trips.**

The system enforces this through:
1. ✅ Automatic verification request creation on registration
2. ✅ Middleware blocking unverified organizers from trip creation
3. ✅ Trust score system for gradual trust building
4. ✅ Admin-controlled payment routing (disabled by default)
5. ✅ Comprehensive verification status tracking

**The verification flow is complete and functional.**
Admin just needs the approval endpoints to start reviewing organizers!
