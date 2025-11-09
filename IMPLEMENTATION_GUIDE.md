# Trek Tribe™ Production Features - Implementation Guide

## ✅ Completed Features

### 1. Database Models Created
- **Trip Model Enhanced** (`services/api/src/models/Trip.ts`)
  - ✅ Live trip photos with thumbnail auto-selection
  - ✅ PDF itinerary upload with metadata
  - ✅ Verification status and admin approval workflow
  - ✅ Safety information and disclaimers
  - ✅ Duplicate detection via content hash

- **OrganizerSubscription Model** (`services/api/src/models/OrganizerSubscription.ts`)
  - ✅ 2-month free trial period
  - ✅ ₹1499 for 5 trips payment plan
  - ✅ Payment tracking and history
  - ✅ Auto-renewal logic
  - ✅ Trip slot management
  - ✅ Notification system

- **KYC Model** (`services/api/src/models/KYC.ts`)
  - ✅ Organizer/Agent KYC verification
  - ✅ Multi-document upload (Aadhaar, PAN, Business License)
  - ✅ Trust score calculation (0-100)
  - ✅ Verification badge system (basic/verified/premium)
  - ✅ Risk assessment
  - ✅ Admin review workflow

- **PromoCode Model** (`services/api/src/models/PromoCode.ts`)
  - ✅ Percentage and fixed discount types
  - ✅ Usage limits and tracking
  - ✅ Trip-specific and category-specific codes
  - ✅ User restrictions and validation

### 2. GroupBooking Model Enhanced
- ✅ Payment screenshot upload
- ✅ Payment verification workflow
- ✅ QR confirmation generation (existing)

## 📋 Implementation Roadmap

### Phase 1: Core Backend API Routes (Priority: HIGH)

#### A. Trip Management Routes
Create `services/api/src/routes/tripEnhancements.ts`:
```typescript
// Organizer live photo upload
POST /api/trips/:tripId/live-photos
POST /api/trips/:tripId/itinerary-pdf
GET /api/trips/:tripId/download-itinerary

// Admin verification
POST /api/admin/trips/:tripId/approve
POST /api/admin/trips/:tripId/reject
GET /api/admin/trips/pending-verification
```

#### B. Subscription Management Routes
Create `services/api/src/routes/subscriptions.ts`:
```typescript
GET /api/subscriptions/my-subscription
POST /api/subscriptions/payment
POST /api/subscriptions/verify-payment
GET /api/subscriptions/usage
POST /api/subscriptions/renew
```

#### C. KYC Routes
Create `services/api/src/routes/kyc.ts`:
```typescript
POST /api/kyc/submit
GET /api/kyc/my-kyc
PUT /api/kyc/update
POST /api/kyc/upload-document

// Admin routes
GET /api/admin/kyc/pending
POST /api/admin/kyc/:id/approve
POST /api/admin/kyc/:id/reject
POST /api/admin/kyc/:id/request-resubmission
```

#### D. Marketing Routes
Create `services/api/src/routes/marketing.ts`:
```typescript
// Promo codes
POST /api/promo-codes/validate
POST /api/promo-codes/apply
GET /api/promo-codes/available

// Admin
POST /api/admin/promo-codes/create
PUT /api/admin/promo-codes/:id
GET /api/admin/promo-codes/stats

// Referrals
GET /api/referrals/my-code
POST /api/referrals/apply
GET /api/referrals/stats
```

#### E. Agent Support System Routes
Create `services/api/src/routes/agentSupport.ts`:
```typescript
// Real-time chat
POST /api/agent-support/tickets/create
GET /api/agent-support/tickets/my-tickets
POST /api/agent-support/tickets/:id/message
POST /api/agent-support/tickets/:id/escalate

// Agent dashboard
GET /api/agent/tickets/assigned
GET /api/agent/tickets/:id/details
POST /api/agent/tickets/:id/resolve
GET /api/agent/trips/:tripId (read-only)
GET /api/agent/bookings/:bookingId (read-only)
```

### Phase 2: Middleware Implementation

Create `services/api/src/middleware/`:

1. **subscriptionCheck.ts** - Verify organizer subscription before trip creation
```typescript
export const checkSubscription = async (req, res, next) => {
  const subscription = await OrganizerSubscription.canCreateTrip(req.user.id);
  if (!subscription.allowed) {
    return res.status(403).json({ error: subscription.message });
  }
  next();
};
```

2. **tripVerification.ts** - Block unverified trips from public listing
```typescript
export const requireVerifiedTrip = async (req, res, next) => {
  const trip = await Trip.findById(req.params.tripId);
  if (trip.verificationStatus !== 'approved') {
    return res.status(403).json({ error: 'Trip not verified' });
  }
  next();
};
```

3. **rbacPermissions.ts** - Enhanced role-based access control
```typescript
export const permissions = {
  canViewTrip: ['admin', 'organizer', 'agent', 'traveler'],
  canEditTrip: ['admin', 'organizer'],
  canApproveTrip: ['admin'],
  canViewKYC: ['admin', 'agent'],
  canApproveKYC: ['admin']
};
```

### Phase 3: Utility Functions

Create `services/api/src/utils/`:

1. **duplicateDetection.ts**
```typescript
import crypto from 'crypto';

export function generateContentHash(trip: any): string {
  const content = `${trip.title}-${trip.destination}-${trip.startDate}`;
  return crypto.createHash('md5').update(content.toLowerCase()).digest('hex');
}

export async function detectDuplicateTrip(trip: any) {
  const hash = generateContentHash(trip);
  const existing = await Trip.findOne({ 
    contentHash: hash,
    _id: { $ne: trip._id }
  });
  return existing;
}
```

2. **seoHelpers.ts** - Schema.org structured data
```typescript
export function generateTripSchema(trip: any) {
  return {
    '@context': 'https://schema.org',
    '@type': 'TouristTrip',
    'name': trip.title,
    'description': trip.description,
    'image': trip.images,
    'offers': {
      '@type': 'Offer',
      'price': trip.price,
      'priceCurrency': 'INR'
    },
    'location': {
      '@type': 'Place',
      'name': trip.destination
    },
    'startDate': trip.startDate,
    'endDate': trip.endDate
  };
}
```

3. **ogImageGenerator.ts** - Dynamic OG image generation
```typescript
// Use canvas or puppeteer to generate OG images
export async function generateOGImage(trip: any): Promise<string> {
  // Implementation using canvas or external service
}
```

4. **sitemap.ts** - Dynamic sitemap generation
```typescript
export async function generateSitemap() {
  const trips = await Trip.find({ verificationStatus: 'approved' });
  // Generate XML sitemap
}
```

### Phase 4: Email & Notification Templates

Create `services/api/src/services/emailTemplates/`:

1. **subscriptionNotifications.ts**
2. **bookingConfirmations.ts**
3. **kycUpdates.ts**
4. **tripApproval.ts**

### Phase 5: Frontend Dashboard Enhancements

#### A. Organizer Dashboard (`web/src/pages/organizer/`)

1. **LivePhotosUpload.tsx** - Photo upload during trip
2. **SubscriptionManager.tsx** - View usage, renew plan
3. **ITineraryPDFUpload.tsx** - Upload trip itinerary
4. **KYCSubmission.tsx** - KYC document submission

#### B. Admin Dashboard (`web/src/pages/admin/`)

1. **TripVerificationQueue.tsx** - Approve/reject trips
2. **KYCVerificationPanel.tsx** - Review KYC submissions
3. **PromoCodeManager.tsx** - Create/manage promo codes
4. **AgentManagement.tsx** - Manage support agents

#### C. Agent Dashboard (`web/src/pages/agent/`)

1. **TicketQueue.tsx** - Assigned support tickets
2. **LiveChat.tsx** - Real-time chat interface
3. **TripBookingViewer.tsx** - Read-only trip/booking access

#### D. Adventurer Enhancements (`web/src/pages/adventurer/`)

1. **BookingPaymentUpload.tsx** - Upload payment screenshot
2. **BookingQRConfirmation.tsx** - View QR confirmation
3. **ItineraryDownload.tsx** - Download trip PDF

### Phase 6: Infrastructure & DevOps

#### A. File Upload & CDN

Create `services/api/src/services/uploadService.ts`:
```typescript
// Enhanced file upload with:
// - Virus scanning (ClamAV)
// - Image optimization (Sharp)
// - CDN integration (Cloudinary/AWS S3)
// - Size limits and validation
```

#### B. Caching Layer

Create `services/api/src/services/cacheService.ts`:
```typescript
// Redis integration for:
// - Trip listings
// - User sessions
// - Promo code validation
// - Rate limiting
```

#### C. Logging

Enhance `services/api/src/utils/logger.ts`:
```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty'
  }
});
```

#### D. Rate Limiting

Create `services/api/src/middleware/rateLimiter.ts`:
```typescript
import rateLimit from 'express-rate-limit';

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100
});
```

### Phase 7: Testing & Monitoring

1. **Integration Tests**
   - Create `services/api/tests/` with Jest
   - Test all new routes and models

2. **Performance Monitoring**
   - Add New Relic / Sentry integration
   - Setup health check endpoints

3. **Database Backups**
   - Automated MongoDB backups
   - Setup in `services/api/src/scripts/backup.ts`

## 🚀 Deployment Checklist

### Environment Variables to Add

```bash
# Subscription
SUBSCRIPTION_TRIAL_DAYS=60
SUBSCRIPTION_PRICE=1499
SUBSCRIPTION_TRIPS_PER_CYCLE=5

# File Upload
MAX_FILE_SIZE_MB=10
ALLOWED_FILE_TYPES=image/jpeg,image/png,application/pdf
CDN_URL=https://cdn.trektribe.in

# Redis (for caching)
REDIS_URL=redis://localhost:6379

# Email Marketing
SENDGRID_API_KEY=your_key
WHATSAPP_API_KEY=your_key

# Monitoring
SENTRY_DSN=your_dsn
NEW_RELIC_KEY=your_key
```

### Database Indexes to Add

Run migration script:
```typescript
// services/api/src/scripts/add-indexes.ts
await Trip.collection.createIndex({ contentHash: 1 });
await Trip.collection.createIndex({ verificationStatus: 1, status: 1 });
await OrganizerSubscription.collection.createIndex({ organizerId: 1, status: 1 });
await KYC.collection.createIndex({ userId: 1, status: 1 });
```

### CI/CD Pipeline

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: npm install
      - run: npm test
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - run: npm run build
      - run: docker-compose build
      # Deploy to production
```

## 📊 Monitoring & Analytics

### Key Metrics to Track

1. **Subscription Metrics**
   - Trial conversions
   - Revenue per organizer
   - Churn rate

2. **Trust Metrics**
   - KYC approval rate
   - Verification badge distribution
   - Trust score averages

3. **Booking Metrics**
   - Payment screenshot verification time
   - Booking completion rate
   - Promo code usage

4. **Support Metrics**
   - Average response time
   - Ticket resolution time
   - Agent performance

## 🔒 Security Enhancements

1. **File Upload Security**
   - Virus scanning on all uploads
   - File type validation
   - Size limits enforcement
   - Secure file storage with expiring URLs

2. **RBAC Hardening**
   - Fine-grained permissions
   - Action logging
   - Session management

3. **Data Privacy**
   - PII encryption at rest
   - Secure KYC document storage
   - GDPR compliance

## 📝 Next Steps

1. **Week 1**: Implement all backend routes and middleware
2. **Week 2**: Build frontend dashboard components
3. **Week 3**: Integration testing and bug fixes
4. **Week 4**: Performance optimization and deployment

---

## Quick Start Commands

```bash
# Install dependencies
npm run install:all

# Run migrations
cd services/api && npm run migrations

# Start development
npm run dev

# Build for production
npm run build

# Deploy
npm run deploy
```

## Support

For questions or issues during implementation:
- Check `/docs` folder for detailed API documentation
- Review existing patterns in codebase
- Test each feature incrementally before moving to next

---

**Status**: Models created ✅ | Routes pending ⏳ | Frontend pending ⏳ | Testing pending ⏳
