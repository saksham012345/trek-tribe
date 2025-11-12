# Trek Tribe - Complete Implementation Guide

## ✅ Completed Implementations

### 1. Gmail OTP Email Verification System
**Status: COMPLETE**

**Files Created:**
- `services/api/src/services/emailOtpService.ts` - OTP generation and verification service
- `services/api/src/routes/emailVerification.ts` - Email verification API endpoints
- Updated `services/api/src/models/User.ts` - Added email OTP fields

**Endpoints:**
- `POST /api/verify-email/send-otp` - Send OTP to email
- `POST /api/verify-email/verify-otp` - Verify OTP code
- `POST /api/verify-email/resend-otp` - Resend OTP (rate limited to 1 per minute)
- `GET /api/verify-email/status/:email` - Check verification status

**Features:**
- 6-digit OTP codes
- 5-minute expiry time
- Maximum 5 verification attempts
- Rate limiting (1 minute between resends)
- Beautiful HTML email templates
- Development mode testing (OTP included in response)

**Environment Variables Required:**
```bash
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password
```

**Setup Gmail App Password:**
1. Enable 2FA on Gmail
2. Go to https://myaccount.google.com/apppasswords
3. Generate app password for "Mail"
4. Add to .env file

---

### 2. AI Chatbot Training System
**Status: COMPLETE**

**Files Created:**
- `services/api/src/data/ai_training_data.json` - 40+ conversations, FAQs, trip data
- `services/api/scripts/train_ai_bot.py` - Python training script using transformers
- `services/api/scripts/requirements-ai.txt` - Python dependencies
- `services/api/scripts/AI_TRAINING_README.md` - Complete training documentation

**Training Dataset Includes:**
- 40+ conversational examples
- Trip categories and destinations
- Organizer subscription info
- Platform capabilities
- FAQs and common questions
- Budget and preference-based responses

**To Train the Model:**
```bash
cd services/api/scripts
pip install -r requirements-ai.txt
python train_ai_bot.py
```

**Model Output:**
- Saved to: `services/api/models/trek_ai_bot/`
- Uses microsoft/DialoGPT-small as base
- Fine-tuned on Trek Tribe conversations
- Optimized for friendly, human-like responses

**Training Time:**
- CPU: ~20-30 minutes
- GPU (CUDA): ~5-10 minutes

---

### 3. Recommendations API
**Status: COMPLETE**

**Files Created:**
- `services/api/src/routes/recommendations.ts` - Recommendation engine

**Endpoints:**
- `GET /api/recommendations` - Personalized recommendations (requires auth)
- `POST /api/recommendations/custom` - Custom preference-based recommendations
- `GET /api/recommendations/popular` - Popular/trending trips

**Features:**
- AI-enhanced scoring algorithm
- User preference matching
- Budget and category filtering
- Verification badge bonuses
- Popularity-based ranking
- Travel history consideration

**Integration:**
Connect your "Get Recommendations" button to:
```javascript
fetch('/api/recommendations', {
  headers: {
    'Authorization': `Bearer ${userToken}`
  }
})
```

---

## 🔧 Existing Features (Already Implemented)

Your project already has:
- ✅ CRM routes (`/api/crm`)
- ✅ Lead, Ticket, Notification models
- ✅ Support ticket system
- ✅ Chat service with Socket.IO
- ✅ Trip verification model
- ✅ Razorpay payment integration (OrganizerSubscription model exists)
- ✅ User activity tracking
- ✅ Role-based authentication middleware

---

## 📋 Remaining Implementation Tasks

### 4. Enhanced CRM Features

**Current Status:** Basic CRM exists, needs enhancement

**What to Add:**

#### A. Lead Management Enhancement
**File:** `services/api/src/controllers/crmController.ts`

Add lead scoring algorithm:
```typescript
// Calculate lead score based on:
- Email opened: +10 points
- Profile 50%+ complete: +20 points
- Added to cart: +30 points
- Contacted organizer: +40 points
- Viewed 3+ trips: +15 points
```

Add lead conversion tracking:
```typescript
interface LeadConversion {
  leadId: ObjectId;
  convertedAt: Date;
  bookingId: ObjectId;
  value: number;
}
```

#### B. Analytics Dashboard
**File:** Create `services/api/src/routes/analytics.ts`

**Metrics to Track:**
```typescript
GET /api/analytics/dashboard
{
  totalTrips: number,
  verifiedTrips: number,
  pendingVerifications: number,
  totalUsers: number,
  totalOrganizers: number,
  revenueThisMonth: number,
  conversionRate: number,
  averageBookingValue: number,
  topDestinations: Array<{name: string, count: number}>,
  monthlyGrowth: number
}
```

#### C. Trip Verification Workflow
**Existing Model:** `TripVerification` already exists

**Add Routes:**
```typescript
POST /api/admin/verify-trip/:tripId/approve
POST /api/admin/verify-trip/:tripId/reject
GET /api/admin/verify-trip/pending
```

**Logic:**
```typescript
- Admin reviews documents
- Marks as Verified/Pending/Rejected
- Sends email notification to organizer
- Updates trip.isVerified field
```

---

### 5. Payment & Subscription System

**Current Status:** Razorpay integration exists, needs enhancement

**Subscription Plans:**

#### Update `services/api/src/models/OrganizerSubscription.ts`
```typescript
Plans:
1. Basic: ₹1,499 for 5 trips, 2-month free trial
2. Premium: ₹2,100 for 10 trips + CRM access + AI tools
```

#### Add Subscription Routes
**File:** `services/api/src/routes/subscriptions.ts`

```typescript
POST /api/subscriptions/create - Create Razorpay order
POST /api/subscriptions/verify - Verify payment
GET /api/subscriptions/my - Get user's subscription
GET /api/subscriptions/plans - List all plans
```

#### Payment Status Tracking
Add to organizer dashboard:
```typescript
{
  currentPlan: "Basic" | "Premium",
  tripsRemaining: number,
  expiryDate: Date,
  autoRenewal: boolean,
  paymentHistory: Array<Payment>
}
```

---

### 6. Security Enhancements

#### A. Rate Limiting
**File:** Create `services/api/src/middleware/rateLimiter.ts`

```typescript
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 login attempts
  skipSuccessfulRequests: true
});
```

Apply in `index.ts`:
```typescript
app.use('/api/', apiLimiter);
app.use('/auth/login', authLimiter);
```

#### B. Audit Logs
**File:** Create `services/api/src/models/AuditLog.ts`

```typescript
interface AuditLog {
  userId: ObjectId;
  action: string; // 'CREATE', 'UPDATE', 'DELETE'
  resource: string; // 'Trip', 'User', 'Payment'
  resourceId: ObjectId;
  changes: object;
  ipAddress: string;
  timestamp: Date;
}
```

Middleware:
```typescript
// Log all admin actions
app.use('/admin/*', auditLogMiddleware);
```

#### C. Input Validation
Already using Zod schemas - ensure all routes have validation.

---

### 7. Notification System

**Current Status:** Notification model exists, needs implementation

#### A. Email Notifications
**File:** Create `services/api/src/services/notificationService.ts`

```typescript
class NotificationService {
  async sendPaymentSuccess(userId, payment) {...}
  async sendTicketUpdate(userId, ticket) {...}
  async sendTripVerification(organizerId, status) {...}
  async sendTrialExpiring(organizerId, daysLeft) {...}
}
```

#### B. In-Dashboard Notifications
**Routes:** Add to existing CRM routes

```typescript
GET /api/notifications - Get user's notifications
PUT /api/notifications/:id/read - Mark as read
DELETE /api/notifications/:id - Delete notification
```

#### C. Email Templates
Create in `services/api/src/templates/`:
- `payment-success.ejs`
- `trip-verified.ejs`
- `ticket-update.ejs`
- `trial-expiring.ejs`

---

### 8. Admin Panel Features

#### A. Admin Dashboard
**File:** Create `services/api/src/routes/adminDashboard.ts`

```typescript
GET /api/admin/dashboard - Get overview stats
GET /api/admin/trips - Manage all trips
GET /api/admin/users - Manage users
GET /api/admin/organizers - Manage organizers
GET /api/admin/payments - View all payments
GET /api/admin/tickets - View all support tickets
POST /api/admin/users/:id/suspend - Suspend user
POST /api/admin/trips/:id/feature - Feature trip
```

#### B. Verification Queue
```typescript
GET /api/admin/verification-queue
{
  pendingTrips: [...],
  pendingOrganizers: [...],
  pendingDocuments: [...]
}
```

---

### 9. Frontend Dashboards

**Location:** `web/src/pages/`

#### A. User Dashboard
**File:** `web/src/pages/Dashboard/UserDashboard.tsx`

**Sections:**
- My Trips (upcoming, past, saved)
- Recommendations
- Support Tickets
- Notifications
- Profile Settings

#### B. Organizer Dashboard
**File:** `web/src/pages/Dashboard/OrganizerDashboard.tsx`

**Tabs:**
1. **Overview:** Stats, revenue, bookings
2. **My Trips:** Create/edit trips, view participants
3. **Leads:** Track inquiries, conversion funnel
4. **Support Tickets:** Respond to traveler questions
5. **Payments:** Subscription status, transaction history
6. **Analytics:** Charts, trends, popular trips
7. **Settings:** Profile, payment details, notifications

#### C. Admin Dashboard
**File:** `web/src/pages/Dashboard/AdminDashboard.tsx`

**Sections:**
- Platform Stats
- User Management
- Trip Verification Queue
- Payment Monitoring
- Support Tickets
- System Logs

**Styling:** Use Tailwind CSS with shadcn/ui components

---

### 10. Environment Variables

**Add to `.env` and `.env.example`:**

```bash
# Email OTP
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password

# Razorpay (if not already there)
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret

# AI Model (optional)
AI_MODEL_PATH=services/api/models/trek_ai_bot

# Rate Limiting
RATE_LIMIT_WINDOW=900000  # 15 minutes
RATE_LIMIT_MAX=100

# Notifications
NOTIFICATION_EMAIL_ENABLED=true
NOTIFICATION_PUSH_ENABLED=false

# Admin
ADMIN_EMAILS=admin@trektribe.com,support@trektribe.com
```

---

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] Set all environment variables
- [ ] Train AI model (`python train_ai_bot.py`)
- [ ] Run `npm run build` in services/api
- [ ] Run `npm run build` in web
- [ ] Test email OTP flow
- [ ] Test payment flow
- [ ] Verify database indexes

### Database Indexes
```javascript
db.users.createIndex({ email: 1 });
db.trips.createIndex({ location: 1, startDate: 1 });
db.leads.createIndex({ score: -1, createdAt: -1 });
db.notifications.createIndex({ userId: 1, read: 1 });
```

### Production Settings
```bash
NODE_ENV=production
LOG_LEVEL=error
RATE_LIMIT_ENABLED=true
EMAIL_ENABLED=true
```

---

## 📊 API Endpoints Summary

### Authentication
- POST /auth/register
- POST /auth/login
- POST /auth/google

### Email Verification ✅ NEW
- POST /api/verify-email/send-otp
- POST /api/verify-email/verify-otp
- POST /api/verify-email/resend-otp
- GET /api/verify-email/status/:email

### Recommendations ✅ NEW
- GET /api/recommendations
- POST /api/recommendations/custom
- GET /api/recommendations/popular

### Trips
- GET /trips
- POST /trips
- GET /trips/:id
- PUT /trips/:id
- DELETE /trips/:id

### CRM (Existing)
- GET /api/crm/leads
- POST /api/crm/leads
- PUT /api/crm/leads/:id
- GET /api/crm/tickets
- POST /api/crm/tickets

### Subscriptions (To Implement)
- POST /api/subscriptions/create
- POST /api/subscriptions/verify
- GET /api/subscriptions/my

### Notifications (To Implement)
- GET /api/notifications
- PUT /api/notifications/:id/read
- DELETE /api/notifications/:id

### Admin (To Implement)
- GET /api/admin/dashboard
- GET /api/admin/verification-queue
- POST /api/admin/verify-trip/:id/approve
- POST /api/admin/users/:id/suspend

---

## 🧪 Testing

### Email OTP
```bash
# Development mode includes OTP in response
POST /api/verify-email/send-otp
{
  "email": "test@example.com"
}

# Response includes OTP for testing
{
  "otp": "123456"
}
```

### Recommendations
```bash
# Test authenticated recommendations
GET /api/recommendations
Authorization: Bearer <token>

# Test custom recommendations
POST /api/recommendations/custom
{
  "preferences": {
    "budget": 5000,
    "destination": "Himalayas"
  }
}
```

### AI Model
```bash
cd services/api/scripts
python train_ai_bot.py --test
```

---

## 📚 Documentation Files Created

1. **AI_TRAINING_README.md** - AI model training guide
2. **IMPLEMENTATION_GUIDE.md** - This file
3. **EMAIL_QUICK_SETUP.txt** - Gmail OTP setup (if needed)

---

## 🐛 Known Issues & Solutions

### Issue: OTP not sending
**Solution:** Check GMAIL_APP_PASSWORD is correct, 2FA enabled

### Issue: AI model too large
**Solution:** Use DialoGPT-small (already configured)

### Issue: Rate limiting too strict
**Solution:** Adjust RATE_LIMIT_MAX in .env

### Issue: Payment webhook fails
**Solution:** Verify Razorpay webhook secret

---

## 🎯 Next Steps

1. **Implement Subscription Routes** (4-6 hours)
2. **Build Frontend Dashboards** (8-12 hours)
3. **Add Notification System** (3-4 hours)
4. **Implement Analytics** (4-6 hours)
5. **Security Enhancements** (2-3 hours)
6. **Admin Panel** (6-8 hours)
7. **Testing & QA** (4-6 hours)

**Total Estimated Time:** 31-45 hours

---

## 💡 Pro Tips

1. **Use the existing models** - Don't recreate Lead, Ticket, Notification models
2. **Follow existing patterns** - Check how auth.ts and trips.ts are structured
3. **Test locally first** - Use Postman or Thunder Client
4. **Keep env variables synced** - Update both .env and .env.example
5. **Version control** - Commit frequently with clear messages

---

## 🔗 Useful Resources

- **Razorpay Docs:** https://razorpay.com/docs/api/
- **Nodemailer:** https://nodemailer.com/
- **Transformers:** https://huggingface.co/docs/transformers
- **Socket.IO:** https://socket.io/docs/v4/
- **Zod Validation:** https://zod.dev/

---

## ✅ Verification Checklist

Before marking complete, verify:
- [ ] Email OTP sends and verifies correctly
- [ ] Recommendations return personalized results
- [ ] AI training script runs without errors
- [ ] All routes return proper error codes
- [ ] TypeScript builds without errors
- [ ] Environment variables documented
- [ ] API endpoints tested with Postman
- [ ] Frontend can connect to new endpoints

---

## 📞 Support

For implementation help:
1. Check existing route patterns in `/routes/`
2. Review model schemas in `/models/`
3. Test with sample data in development
4. Use `console.log` liberally for debugging

---

**Document Version:** 1.0  
**Last Updated:** 2025-11-12  
**Status:** Implementation In Progress
