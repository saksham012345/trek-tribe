# API Endpoints Audit & Checklist

## Payment & Subscription Endpoints

### Subscription Management
- **GET /api/subscriptions/plans** - List all subscription plans ✅
- **POST /api/subscriptions/purchase** - Purchase subscription plan ✅
- **POST /api/subscriptions/activate-trial** - Activate free trial ✅
- **GET /api/subscriptions/user** - Get user's active subscription ✅
- **POST /api/subscriptions/cancel** - Cancel subscription ✅
- **POST /api/subscriptions/renew** - Renew subscription ✅

### Booking & Payment
- **POST /api/bookings/create** - Create new booking ✅
- **POST /api/bookings/:id/payment** - Process booking payment ✅
- **POST /api/bookings/:id/confirm** - Confirm booking with payment ✅
- **GET /api/bookings/user** - Get user's bookings ✅
- **POST /api/bookings/:id/cancel** - Cancel booking & refund ✅

### Razorpay & Marketplace
- **POST /api/marketplace/organizer/onboard** - Onboard organizer (create submerchant) ✅
- **GET /api/marketplace/organizer/status** - Get organizer account status ✅
- **POST /api/marketplace/orders/create** - Create marketplace order ✅
- **POST /api/marketplace/payments/split** - Split payment between platform & organizer ✅
- **POST /api/marketplace/transfers/create** - Create transfer to organizer ✅
- **POST /api/marketplace/refunds/initiate** - Process refund ✅

### Auto-Pay (Recurring Payments)
- **POST /api/autopay/setup** - Setup recurring payment ✅
- **POST /api/autopay/charge** - Execute auto-charge ✅
- **GET /api/autopay/status** - Get autopay status ✅
- **POST /api/autopay/cancel** - Cancel recurring payment ✅

### Receipts & Invoices
- **GET /api/receipts/booking/:id** - Get booking receipt ✅
- **GET /api/receipts/subscription/:id** - Get subscription receipt ✅
- **POST /api/receipts/download** - Download receipt as PDF ✅

### Payment Verification
- **POST /api/payments/verify** - Verify Razorpay signature ✅
- **GET /api/payments/:id/status** - Get payment status ✅
- **POST /api/payments/:id/refund** - Initiate refund ✅

---

## Core Endpoints

### Authentication
- **POST /api/auth/register** - Register new user ✅
- **POST /api/auth/login** - Login user ✅
- **POST /api/auth/verify-otp** - Verify OTP ✅
- **POST /api/auth/refresh-token** - Refresh JWT token ✅
- **POST /api/auth/logout** - Logout user ✅

### User Management
- **GET /api/profile** - Get user profile ✅
- **PATCH /api/profile/update** - Update user profile ✅
- **POST /api/profile/avatar** - Upload avatar ✅
- **GET /api/users/:id** - Get public user profile ✅

### Trips
- **POST /api/trips/create** - Create new trip ✅
- **GET /api/trips** - List trips (with filters) ✅
- **GET /api/trips/:id** - Get trip details ✅
- **PATCH /api/trips/:id/update** - Update trip ✅
- **DELETE /api/trips/:id** - Delete trip ✅
- **POST /api/trips/:id/publish** - Publish trip ✅

### Search & Discovery
- **GET /api/search/trips** - Search trips ✅
- **GET /api/search/organizers** - Search organizers ✅
- **POST /api/search/filters** - Apply advanced filters ✅

### Social Features
- **POST /api/follows/create** - Follow organizer ✅
- **DELETE /api/follows/:id** - Unfollow organizer ✅
- **GET /api/follows/user** - Get user's followers ✅

### Reviews & Ratings
- **POST /api/reviews/create** - Create trip review ✅
- **GET /api/reviews/trip/:id** - Get trip reviews ✅
- **PATCH /api/reviews/:id** - Update review ✅
- **DELETE /api/reviews/:id** - Delete review ✅

### Support & Chat
- **POST /api/chat/create-ticket** - Create support ticket ✅
- **GET /api/chat/tickets** - Get user's support tickets ✅
- **POST /api/chat/send-message** - Send message in ticket ✅
- **POST /api/chat/generate-response** - Generate AI response ✅

### Analytics & Reporting
- **GET /api/analytics/user** - Get user analytics ✅
- **GET /api/analytics/organizer** - Get organizer analytics ✅
- **GET /api/analytics/platform** - Get platform-wide analytics ✅
- **POST /api/analytics/events** - Track custom events ✅

---

## Frontend Integration Checklist

### Subscription Flow
- [ ] Subscription plans display with proper pricing
- [ ] Plan comparison UI
- [ ] Trial activation button
- [ ] Payment modal integration (Razorpay)
- [ ] Success/failure handling
- [ ] Subscription management page
- [ ] Cancellation flow with confirmation

### Booking Flow
- [ ] Trip selection & details display
- [ ] Traveler information form
- [ ] Package selection
- [ ] Amount calculation (including fees)
- [ ] Payment method selection
- [ ] Razorpay checkout integration
- [ ] Booking confirmation page
- [ ] Email confirmation sent

### Organizer Onboarding
- [ ] Business details form
- [ ] Bank account information form
- [ ] Document upload (GST, PAN)
- [ ] Address verification
- [ ] Account activation confirmation
- [ ] Settlement details display

### Payment Verification
- [ ] Payment success page
- [ ] Receipt generation & download
- [ ] Payment failure handling
- [ ] Retry mechanism
- [ ] Refund status tracking

---

## Known Issues & Improvements

### 1. **Submerchant Account Creation**
- ✅ DONE: Razorpay submerchant service created
- ✅ DONE: Payment validators added
- [ ] TODO: Update marketplace.ts to use new service
- [ ] TODO: Add KYC verification flow
- [ ] TODO: Add settlement scheduling

### 2. **Payment Validation**
- ✅ DONE: Comprehensive validators created
- [ ] TODO: Add rate limiting on payment endpoints
- [ ] TODO: Add fraud detection
- [ ] TODO: Add PCI compliance checks

### 3. **Frontend Integration**
- [ ] TODO: Test Razorpay checkout on all platforms
- [ ] TODO: Add loading states during payment
- [ ] TODO: Add error recovery UI
- [ ] TODO: Mobile payment optimization

### 4. **Settlement & Payouts**
- [ ] TODO: Automatic daily settlement scheduler
- [ ] TODO: Settlement status dashboard
- [ ] TODO: Payout history & ledger
- [ ] TODO: Tax calculation (TDS/GST)

### 5. **Webhooks**
- [ ] TODO: Razorpay webhook handler for payment confirmations
- [ ] TODO: Webhook signature verification
- [ ] TODO: Retry mechanism for failed webhooks
- [ ] TODO: Idempotency key handling

---

## Testing Checklist

### Unit Tests
- [ ] Payment validator tests
- [ ] Signature verification tests
- [ ] Amount calculation tests
- [ ] Submerchant creation tests

### Integration Tests
- [ ] End-to-end booking flow
- [ ] End-to-end subscription flow
- [ ] Refund flow
- [ ] Settlement flow

### Manual Testing
- [ ] Create booking with payment
- [ ] Create subscription
- [ ] Cancel subscription & refund
- [ ] Organizer onboarding
- [ ] Settlement processing

---

## Performance & Security

### Security Measures ✅
- Bank details encrypted with AES-256
- Payment signature verification
- JWT authentication on all endpoints
- Rate limiting on sensitive endpoints
- HTTPS/TLS for all APIs

### Performance Optimizations
- [ ] TODO: Caching for subscription plans
- [ ] TODO: Database indexing for payment queries
- [ ] TODO: Async payment processing
- [ ] TODO: Webhooks for async operations

---

## Environment Variables Required

```env
# Razorpay Main Account
RAZORPAY_KEY_ID=rzp_live_xxxxxx
RAZORPAY_KEY_SECRET=xxxxx

# Encryption
ENCRYPTION_KEY=32_character_encryption_key

# Settlement
SETTLEMENT_CYCLE=weekly
MIN_SETTLEMENT_AMOUNT=100000  # ₹1000 in paise

# Fraud Detection
PAYMENT_LIMIT_PER_DAY=10000000  # ₹100,000
PAYMENT_LIMIT_PER_MONTH=100000000  # ₹10,00,000
```

---

## Success Metrics

- Payment success rate: > 95%
- Subscription retention rate: > 70%
- Settlement processing time: < 24 hours
- API response time: < 200ms
- System uptime: > 99.9%
