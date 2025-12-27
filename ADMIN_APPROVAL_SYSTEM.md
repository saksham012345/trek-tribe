# Admin Approval System - Complete Implementation Guide

## 🎯 Overview

A complete admin approval system for organizer verification with:
- **Backend:** REST API endpoints for verification management
- **Frontend:** Admin dashboard for reviewing and approving organizers
- **Trust Score:** Automated calculation based on 7 metrics (0-100 scale)
- **Email Notifications:** Automated approval/rejection emails

---

## 📡 Backend API Endpoints

### 1. List Verification Requests
```http
GET /admin/verification-requests
```

**Query Parameters:**
- `status` (optional): `pending`, `under_review`, `approved`, `rejected`, or `all`
- `requestType` (optional): `initial`, `document_update`, `re_verification`
- `priority` (optional): `low`, `medium`, `high`
- `page` (default: 1)
- `limit` (default: 20)
- `sortBy` (default: `createdAt`)
- `sortOrder` (default: `desc`)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "req_123",
      "organizerId": {
        "_id": "org_456",
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+919876543210",
        "organizerProfile": {
          "yearsOfExperience": 5,
          "specialties": ["Trekking", "Adventure"],
          "trustScore": { "overall": 0 }
        }
      },
      "requestType": "initial",
      "status": "pending",
      "priority": "medium",
      "createdAt": "2025-12-26T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  },
  "summary": {
    "pending": 12,
    "under_review": 5,
    "approved": 25,
    "rejected": 3,
    "total": 45
  }
}
```

### 2. Get Verification Request Details
```http
GET /admin/verification-requests/:id
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "req_123",
    "organizerId": { /* full organizer details */ },
    "documents": [],
    "kycDetails": {},
    "tripHistory": [
      {
        "title": "Himalayan Trek",
        "price": 5999,
        "participants": 15
      }
    ]
  }
}
```

### 3. Approve Organizer
```http
POST /admin/verification-requests/:id/approve
```

**Request Body:**
```json
{
  "trustScore": 75,
  "verificationBadge": "silver",
  "enableRouting": false,
  "adminNotes": "Documents verified. Experienced organizer."
}
```

**Validation:**
- `trustScore`: Number between 0-100 (required)
- `verificationBadge`: `bronze`, `silver`, `gold`, or `platinum` (optional, auto-calculated if not provided)
- `enableRouting`: Boolean (default: false)
- `adminNotes`: String (optional)

**Response:**
```json
{
  "success": true,
  "message": "Organizer approved successfully",
  "data": {
    "organizerId": "org_456",
    "trustScore": 75,
    "verificationBadge": "silver",
    "routingEnabled": false,
    "approvedAt": "2025-12-26T12:00:00Z"
  }
}
```

**Side Effects:**
- Updates `organizerVerificationStatus` to `approved`
- Sets trust score in organizer profile
- Assigns verification badge
- Sends approval email to organizer
- Logs admin action

### 4. Reject Organizer
```http
POST /admin/verification-requests/:id/reject
```

**Request Body:**
```json
{
  "rejectionReason": "Incomplete KYC documents",
  "adminNotes": "Missing address proof and business license"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Organizer verification rejected",
  "data": {
    "organizerId": "org_456",
    "rejectionReason": "Incomplete KYC documents",
    "rejectedAt": "2025-12-26T12:00:00Z"
  }
}
```

**Side Effects:**
- Updates `organizerVerificationStatus` to `rejected`
- Records rejection reason
- Sends rejection email to organizer
- Logs admin action

### 5. Update Verification Status
```http
PUT /admin/verification-requests/:id/status
```

**Request Body:**
```json
{
  "status": "under_review",
  "priority": "high",
  "adminNotes": "Reviewing documents"
}
```

### 6. Recalculate Trust Score
```http
POST /admin/verification-requests/:id/recalculate-score
```

**Response:**
```json
{
  "success": true,
  "data": {
    "trustScore": {
      "overall": 78,
      "breakdown": {
        "documentVerified": 20,
        "bankVerified": 15,
        "experienceYears": 12,
        "completedTrips": 10,
        "userReviews": 12,
        "responseTime": 8,
        "refundRate": 5
      },
      "lastCalculated": "2025-12-26T12:00:00Z"
    },
    "verificationBadge": "silver",
    "isEligibleForRouting": true,
    "recommendations": [
      "Add and verify bank account details to earn up to 20 points",
      "Successfully complete more trips to increase your score"
    ]
  }
}
```

---

## 🎨 Frontend Components

### Admin Verification Dashboard
**Route:** `/admin/organizer-verification`

**Features:**
- Summary cards (pending, under review, approved, rejected, total)
- Filterable table (all, pending, under_review, approved, rejected)
- Pagination
- Quick actions (approve, reject, recalculate score)
- Approval modal with trust score slider
- Rejection modal with reason input

**Access:**
```tsx
import AdminOrganizerVerification from './pages/AdminOrganizerVerification';

<Route 
  path="/admin/organizer-verification" 
  element={user?.role === 'admin' ? <AdminOrganizerVerification /> : <Navigate to="/home" />}
/>
```

**Navigation from Admin Dashboard:**
```tsx
<button onClick={() => navigate('/admin/organizer-verification')}>
  🔐 Organizer Verification
</button>
```

---

## 📊 Trust Score System

### Score Breakdown (Total: 100 points)

1. **Document Verification (20 points)**
   - Approved status: 20 points
   - Pending status: 5 points
   - Not verified: 0 points

2. **Bank Account Verification (20 points)**
   - Razorpay account linked: 20 points
   - Bank details added: 15 points
   - No bank details: 0 points

3. **Years of Experience (15 points)**
   - ≥10 years: 15 points
   - ≥5 years: 12 points
   - ≥3 years: 9 points
   - ≥1 year: 5 points
   - <1 year: 0 points

4. **Completed Trips (15 points)**
   - ≥50 trips: 15 points
   - ≥25 trips: 13 points
   - ≥10 trips: 10 points
   - ≥5 trips: 7 points
   - ≥1 trip: 3 points
   - 0 trips: 0 points

5. **User Reviews (15 points)**
   - Base score on average rating (0-12 points)
   - Bonus for review count (0-3 points)
   - Formula: rating score + review bonus

6. **Response Time (10 points)**
   - Fast response: 10 points
   - Average response: 8 points
   - Slow response: 5 points
   - (Currently based on verification status, will track actual response times)

7. **Refund Rate (5 points)**
   - ≤5% cancellations: 5 points
   - ≤10% cancellations: 4 points
   - ≤15% cancellations: 3 points
   - ≤25% cancellations: 2 points
   - >25% cancellations: 1 point

### Verification Badges

- **None** (0-49): New/unverified organizers
- **Bronze** (50-69): Basic verification
- **Silver** (70-84): **Routing eligible** (if enabled globally)
- **Gold** (85-94): High trust
- **Platinum** (95-100): Premium verified organizers

### Auto-Calculation

Trust scores are automatically calculated based on:
- Organizer profile data
- Trip history
- User reviews
- Cancellation rates

**Trigger recalculation:**
```typescript
import TrustScoreService from '../services/trustScoreService';

// Manual recalculation
const trustScore = await TrustScoreService.calculateTrustScore(organizerId);

// Update in database
await TrustScoreService.updateOrganizerTrustScore(organizerId);

// Batch update all organizers (cron job)
await TrustScoreService.updateAllOrganizerScores();
```

---

## 📧 Email Notifications

### Approval Email Template

**Subject:** 🎉 Your TrekTribe Organizer Account is Approved!

**Content:**
- Congratulations message
- Trust score and verification badge
- Payment routing status
- Next steps (create trips, manage bookings)
- Link to organizer dashboard
- Admin notes (if provided)

### Rejection Email Template

**Subject:** TrekTribe Organizer Account - Verification Update

**Content:**
- Professional rejection notice
- Detailed rejection reason
- Opportunity to reapply
- Support contact information

---

## 🔄 Complete Workflow

### 1. Organizer Registration
```typescript
POST /auth/register
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "role": "organizer",
  "yearsOfExperience": 5,
  "specialties": ["Trekking"]
}
```

**Result:**
- User created with `organizerVerificationStatus: 'pending'`
- VerificationRequest created automatically
- Trust score initialized at 0
- Email verification OTP sent

### 2. Admin Reviews Request
```typescript
GET /admin/verification-requests?status=pending
```

**Admin sees:**
- Organizer name, email, phone
- Years of experience
- Specialties
- Request submission date
- Priority level

### 3. Admin Approves
```typescript
POST /admin/verification-requests/:id/approve
{
  "trustScore": 75,
  "verificationBadge": "silver",
  "enableRouting": false,
  "adminNotes": "Documents verified"
}
```

**System actions:**
- Updates organizer verification status
- Sets trust score and badge
- Sends approval email
- Logs admin action

### 4. Organizer Creates Trip
```typescript
POST /trips
Authorization: Bearer <organizer_token>
{
  "title": "Himalayan Trek",
  "price": 5999,
  ...
}
```

**Result:**
- Trip created successfully
- Payment routing decision applied
- QR code generated (if premium tier)

---

## 🧪 Testing

### Run Complete Workflow Test
```bash
cd services/api
npx ts-node src/scripts/test-verification-workflow.ts
```

**Test Coverage:**
1. ✅ Organizer registration
2. ✅ Verification request auto-creation
3. ✅ Blocked trip creation (unverified)
4. ✅ Admin fetches pending requests
5. ✅ Admin approves organizer
6. ✅ Successful trip creation (verified)
7. ✅ Trust score recalculation

### Manual Testing Checklist

- [ ] Register new organizer
- [ ] Verify verification request created
- [ ] Login as admin
- [ ] Navigate to `/admin/organizer-verification`
- [ ] View pending requests
- [ ] Approve organizer with trust score
- [ ] Check approval email received
- [ ] Login as approved organizer
- [ ] Create trip successfully
- [ ] Verify payment routing logic
- [ ] Test rejection flow
- [ ] Test trust score recalculation

---

## 🔒 Security & Permissions

### Admin-Only Routes
All verification endpoints require:
```typescript
router.use(authenticateJwt);
router.use(requireRole(['admin']));
```

### Middleware Protection
Trip creation protected by:
```typescript
router.post('/', 
  authenticateJwt, 
  requireRole(['organizer','admin']), 
  verifyOrganizerApproved,  // ← Blocks unverified
  asyncHandler(tripCreationHandler)
);
```

---

## 📁 File Structure

### Backend
```
services/api/src/
├── routes/
│   └── admin.ts                           # Verification endpoints (400+ lines)
├── services/
│   └── trustScoreService.ts               # Trust score calculation
├── models/
│   ├── User.ts                            # Updated with trust score fields
│   └── VerificationRequest.ts             # Verification tracking model
├── middleware/
│   └── verifyOrganizer.ts                 # Organizer verification middleware
└── scripts/
    └── test-verification-workflow.ts      # Complete workflow test
```

### Frontend
```
web/src/
├── pages/
│   ├── AdminOrganizerVerification.tsx     # Main verification dashboard (900+ lines)
│   └── AdminDashboard.tsx                 # Updated with verification link
└── App.tsx                                # Route added
```

---

## 🚀 Deployment

### Environment Variables
```env
# Admin Email (for notifications)
ADMIN_EMAIL=admin@trektribe.com

# Frontend URL (for email links)
FRONTEND_URL=https://trektribe.com

# Trust Score Threshold
MIN_TRUST_SCORE_FOR_ROUTING=70

# Payment Routing Toggle
ENABLE_RAZORPAY_ROUTING=false
```

### Database Indexes
```javascript
// Add indexes for better query performance
db.verificationrequests.createIndex({ status: 1, createdAt: -1 });
db.verificationrequests.createIndex({ organizerId: 1 });
db.users.createIndex({ organizerVerificationStatus: 1 });
```

### Cron Job (Optional)
```javascript
// Update all organizer trust scores daily
import cron from 'node-cron';
import TrustScoreService from './services/trustScoreService';

// Run every day at 2 AM
cron.schedule('0 2 * * *', async () => {
  console.log('Running daily trust score update...');
  await TrustScoreService.updateAllOrganizerScores();
});
```

---

## 📈 Future Enhancements

1. **KYC Document Upload**
   - Frontend file upload component
   - Backend document storage (S3/Cloudinary)
   - Document verification tracking

2. **Real-time Notifications**
   - WebSocket notifications for new verification requests
   - Email alerts to admin on new submissions
   - Push notifications for organizers on approval/rejection

3. **Advanced Trust Score**
   - Track actual response times
   - Sentiment analysis on reviews
   - Booking completion rate
   - Customer retention metrics

4. **Verification Request Comments**
   - Admin can comment on requests
   - Organizer can reply to queries
   - Thread-based discussion

5. **Bulk Actions**
   - Approve/reject multiple requests at once
   - Export verification data to CSV
   - Batch trust score recalculation

6. **Analytics Dashboard**
   - Verification approval rate
   - Average approval time
   - Trust score distribution
   - Top-performing organizers

---

## ✅ Implementation Status

### Completed ✅
- [x] Backend API endpoints (6 routes)
- [x] Trust score calculation service
- [x] Frontend admin dashboard
- [x] Approval/rejection modals
- [x] Email notifications
- [x] Middleware protection
- [x] User model updates
- [x] VerificationRequest model
- [x] Complete workflow testing
- [x] Documentation

### Ready for Production 🚀
The admin approval system is **fully functional** and ready for use!

### Next Steps
1. Deploy to staging environment
2. Test email delivery
3. Train admin users
4. Set up cron jobs for trust score updates
5. Monitor verification workflow metrics

---

## 📞 Support

For issues or questions:
- **Backend:** Check [services/api/src/routes/admin.ts](../services/api/src/routes/admin.ts)
- **Frontend:** Check [web/src/pages/AdminOrganizerVerification.tsx](../web/src/pages/AdminOrganizerVerification.tsx)
- **Trust Score:** Check [services/api/src/services/trustScoreService.ts](../services/api/src/services/trustScoreService.ts)
- **Testing:** Run `npx ts-node src/scripts/test-verification-workflow.ts`

---

**Last Updated:** December 26, 2025  
**Version:** 1.0.0  
**Status:** Production Ready ✅
