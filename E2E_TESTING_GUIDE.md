# End-to-End Testing Guide for Trek Tribe Payment & CRM System

## 1. Overview

This guide covers comprehensive end-to-end testing for:
- Subscription plans (5 tiers with new pricing)
- Payment processing (Razorpay integration)
- CRM access and lead management
- User workflows from registration to CRM interaction

**Test Timeline:** 2-3 hours for complete coverage
**Tools Needed:** 
- Browser DevTools
- Postman (for API testing)
- MongoDB Compass (for data verification)
- Test credit card: `4111 1111 1111 1111`

---

## 2. Subscription Pricing Validation Tests

### Test 2.1: Verify All 5 Plan Tiers Display Correctly

**Steps:**
1. Navigate to `/` (Home page)
2. Scroll to "Choose Your Plan" section
3. Verify all 5 plans appear: STARTER, BASIC, PROFESSIONAL, PREMIUM, ENTERPRISE

**Expected Results:**
```
STARTER: ₹599/month, 2 trips, No CRM
BASIC: ₹1299/month, 4 trips, No CRM
PROFESSIONAL: ₹2199/month, 6 trips, CRM Access ✓
PREMIUM: ₹3999/month, 15 trips, CRM Access ✓
ENTERPRISE: ₹9999/month, 100 trips, CRM Access ✓
```

**Pass Criteria:** ✅ All prices and features match the list above

---

### Test 2.2: Verify Plan Feature Comparison Table

**Steps:**
1. Stay on plan selection view
2. Look for comparison table (if available)
3. Verify CRM access column shows:
   - STARTER: ❌
   - BASIC: ❌
   - PROFESSIONAL: ✅
   - PREMIUM: ✅
   - ENTERPRISE: ✅

**Pass Criteria:** ✅ CRM column matches above

---

### Test 2.3: Value-to-Price Ratio Validation

**Manual Check - Ensure pricing makes sense:**

```
₹599 → 2 trips  = ₹299.50 per trip    ✓ Budget tier
₹1299 → 4 trips = ₹324.75 per trip    ✓ Economy tier
₹2199 → 6 trips = ₹366.50 per trip    ✓ Standard tier (with CRM)
₹3999 → 15 trips = ₹266.60 per trip   ✓ Premium tier (bulk discount)
₹9999 → 100 trips = ₹99.99 per trip   ✓ Enterprise tier (best rate)
```

**Pass Criteria:** ✅ Enterprise offers best per-trip rate

---

## 3. Payment Processing Tests

### Test 3.1: Complete Payment Flow - PROFESSIONAL Plan (₹2199)

**Setup:**
- Clear browser cookies/cache
- Be logged in as a new user

**Steps:**
1. Click "Choose Plan" for PROFESSIONAL
2. Review plan details (should show 6 trips + CRM)
3. Click "Subscribe Now"
4. Enter payment details:
   - Card: `4111 1111 1111 1111`
   - Expiry: `12/25`
   - CVV: `123`
5. Submit payment
6. Wait for confirmation page

**Expected Results:**
- ✅ Payment successful notification
- ✅ Redirect to organizer dashboard
- ✅ "CRM Access Enabled" message visible
- ✅ 6 trip slots available

**Backend Verification:**
```bash
# Check in MongoDB
db.organizersubscriptions.findOne({ 
  userId: "<user_id>",
  planType: "PROFESSIONAL"
})

# Should return:
{
  userId: "...",
  planType: "PROFESSIONAL",
  price: 2199,
  trips: 6,
  crmAccess: true,
  status: "active"
}
```

**Pass Criteria:** ✅ All values match expected subscription

---

### Test 3.2: Complete Payment Flow - ENTERPRISE Plan (₹9999)

**Steps:**
1. Log in as another test user
2. Select ENTERPRISE plan
3. Complete payment with same test card
4. Verify confirmation

**Expected Results:**
- ✅ Payment successful
- ✅ 100 trip slots available
- ✅ CRM Access enabled
- ✅ All premium features accessible

**Backend Verification:**
```bash
db.organizersubscriptions.findOne({ 
  planType: "ENTERPRISE"
})

# Should show:
{
  price: 9999,
  trips: 100,
  crmAccess: true
}
```

**Pass Criteria:** ✅ Enterprise subscription created correctly

---

### Test 3.3: Verify No CRM Access for BASIC Plan (₹1299)

**Steps:**
1. Log in as test user
2. Select BASIC plan
3. Complete payment
4. Navigate to `/organizer/crm`

**Expected Result:**
- ✅ "Upgrade to Professional" message
- ✅ CRM blocked with "CRM access not available" message
- ❌ No leads table visible

**Backend Check:**
```bash
db.organizersubscriptions.findOne({ 
  planType: "BASIC"
})

# Should show:
{
  crmAccess: false,
  leadCapture: false
}
```

**Pass Criteria:** ✅ BASIC plan correctly blocked from CRM

---

### Test 3.4: Payment Webhook Verification

**Steps:**
1. Complete a payment (use Test 3.1)
2. Open browser DevTools → Network tab
3. Look for webhook call to `/api/subscriptions/webhook`

**Expected Results:**
- ✅ Webhook called with event: `payment.authorized`
- ✅ Webhook signature verified
- ✅ Subscription created/updated in DB

**Verification:**
```bash
# Check webhook logs
tail -f services/api/logs/webhook.log

# Should show:
[INFO] Webhook received: payment.authorized
[INFO] Signature verified successfully
[INFO] Subscription updated: <user_id>
```

**Pass Criteria:** ✅ Webhook processed successfully

---

## 4. CRM Access and Lead Management Tests

### Test 4.1: Verify CRM Access Check

**Steps:**
1. Log in as PROFESSIONAL plan user (₹2199, 6 trips)
2. Navigate to `/organizer/crm`
3. Wait for page to load

**Expected Results:**
- ✅ Page loads without "Upgrade" message
- ✅ Stats dashboard visible
- ✅ Leads table visible

**API Check:**
```bash
# GET /api/subscriptions/verify-crm-access
# Response should be:
{
  hasCRMAccess: true,
  planType: "PROFESSIONAL",
  crmFeatures: {
    leadCapture: true,
    phoneNumbers: true,
    leadVerification: true
  }
}
```

**Pass Criteria:** ✅ CRM access granted correctly

---

### Test 4.2: Create a Lead (via Trip Inquiry)

**Setup:**
- Have a PROFESSIONAL or PREMIUM plan user logged in
- Have a published trip available

**Steps:**
1. Go to `/trips`
2. Click on any trip created by the user
3. Fill inquiry form with:
   - Name: "Test Lead"
   - Email: "testlead@example.com"
   - Phone: "9999999999"
   - Message: "Interested in this trip"
4. Submit form

**Expected Results:**
- ✅ Inquiry submitted message
- ✅ Lead created in database
- ✅ Lead visible in CRM dashboard

**API Check:**
```bash
# GET /api/crm/leads
# Response includes:
{
  "leads": [
    {
      "_id": "...",
      "name": "Test Lead",
      "email": "testlead@example.com",
      "phone": "9999999999",
      "status": "new",
      "verified": false,
      "tripId": "...",
      "createdAt": "2024-..."
    }
  ]
}
```

**Pass Criteria:** ✅ Lead created and visible in CRM

---

### Test 4.3: Update Lead Status (new → contacted → interested → qualified)

**Steps:**
1. In CRM Dashboard, find a lead with status "new"
2. Click status dropdown
3. Change to "contacted"
4. Verify status updated
5. Repeat for "interested" and "qualified"

**Expected Results:**
- ✅ Status changes immediately (no page refresh needed)
- ✅ Updated status persists after page reload
- ✅ Stats update accordingly

**API Check:**
```bash
# PUT /api/crm/leads/<leadId>
# Body: { status: "contacted" }
# Response: 
{
  "success": true,
  "lead": {
    "status": "contacted",
    "updatedAt": "2024-..."
  }
}
```

**Pass Criteria:** ✅ Status transitions work correctly

---

### Test 4.4: Verify Lead - CRM Access Feature

**Steps:**
1. In CRM Dashboard, find a lead
2. Click "Verify" button (if available)
3. Observe lead's "verified" status change to ✓

**Expected Results:**
- ✅ Lead marked as verified
- ✅ Verified status persists
- ✅ API called: POST `/api/crm/leads/<leadId>/verify`

**Pass Criteria:** ✅ Lead verification works

---

### Test 4.5: Search and Filter Leads

**Steps:**
1. In CRM Dashboard, have 5+ leads
2. Type in search box: "testlead"
3. Verify only matching leads appear
4. Use status filter dropdown
5. Select "new" status
6. Verify only new leads appear

**Expected Results:**
- ✅ Search filters leads by name/email/phone
- ✅ Status filter works
- ✅ Combined filters work together

**Pass Criteria:** ✅ Search and filter function correctly

---

### Test 4.6: CRM Statistics Dashboard

**Steps:**
1. In CRM Dashboard, observe stats cards:
   - Total Leads
   - New Leads
   - Contacted
   - Interested
   - Qualified
   - Conversion Rate

**Expected Results:**
- ✅ All stats show correct counts
- ✅ Conversion Rate = (Qualified / Total) × 100
- ✅ Stats update after status changes

**Example Calculation:**
```
Total: 10 leads
Qualified: 2 leads
Conversion Rate: (2/10) × 100 = 20%
```

**Pass Criteria:** ✅ Stats calculated correctly

---

## 5. Trip Limits and Usage Tests

### Test 5.1: Verify Trip Limits - PROFESSIONAL Plan

**Setup:**
- Logged in as PROFESSIONAL plan user (6 trips)

**Steps:**
1. Navigate to Create Trip page
2. Check trip counter: should show "X/6 trips used"
3. Create first trip and publish
4. Check counter: should show "1/6 trips used"
5. Repeat 5 more times
6. On 7th attempt, button should be disabled

**Expected Results:**
- ✅ Counter updates correctly
- ✅ Trip creation blocked at 6 trips
- ✅ "Upgrade plan" suggestion shown

**API Check:**
```bash
# GET /api/subscriptions/my
# Response:
{
  "tripsUsed": 6,
  "tripsAvailable": 6,
  "canCreateMore": false
}
```

**Pass Criteria:** ✅ Trip limits enforced correctly

---

### Test 5.2: Trip Limits - ENTERPRISE Plan

**Setup:**
- Logged in as ENTERPRISE plan user (100 trips)

**Steps:**
1. Create 50 trips
2. Verify counter shows "50/100 trips used"
3. Still able to create more

**Expected Result:**
- ✅ Can create up to 100 trips
- ✅ Counter accurate

**Pass Criteria:** ✅ High limits work correctly

---

## 6. Integration Tests

### Test 6.1: Payment → Subscription → CRM Access Flow

**Complete User Journey:**

```
1. New user registers
   ↓
2. Sees subscription plans
   ↓
3. Clicks "PROFESSIONAL" (₹2199)
   ↓
4. Completes payment
   ↓
5. Subscription created (6 trips, CRM enabled)
   ↓
6. Redirected to /organizer/dashboard
   ↓
7. Sees "CRM Access Enabled" message
   ↓
8. Creates a trip
   ↓
9. Receives inquiry from user
   ↓
10. Lead appears in CRM Dashboard
   ↓
11. Updates lead status
   ↓
12. Sees updated stats
```

**Verification Points:**
- ✅ User created in DB
- ✅ Subscription created
- ✅ Trip created
- ✅ Lead created
- ✅ All data properly linked

**Pass Criteria:** ✅ Complete flow works end-to-end

---

### Test 6.2: Downgrade Prevention

**Steps:**
1. User has PROFESSIONAL plan (6 trips, CRM)
2. Try to view BASIC plan details
3. System should not allow downgrade

**Expected Result:**
- ✅ User cannot downgrade (or downgrade is pending)
- ✅ System prevents loss of CRM access

**Pass Criteria:** ✅ Downgrade restrictions work

---

## 7. Mobile Responsive Tests

### Test 7.1: CRM Dashboard Mobile View

**Setup:**
- Open CRM Dashboard on mobile device or Chrome DevTools (375px width)

**Verify:**
- ✅ Stats cards stack vertically
- ✅ Leads table scrolls horizontally
- ✅ Buttons are touch-friendly (min 44px height)
- ✅ Search bar fully accessible
- ✅ No text cutoff

**Pass Criteria:** ✅ Mobile layout responsive

---

### Test 7.2: Payment Form Mobile View

**Setup:**
- Open payment page on mobile

**Verify:**
- ✅ Plan details readable
- ✅ Payment form inputs accessible
- ✅ Submit button clickable
- ✅ No horizontal scroll

**Pass Criteria:** ✅ Payment form mobile-friendly

---

## 8. Error Handling Tests

### Test 8.1: Payment Failure Handling

**Steps:**
1. Try payment with invalid card: `4000 0000 0000 0002`
2. Submit form

**Expected Results:**
- ✅ Error message displayed: "Payment declined"
- ✅ No subscription created
- ✅ User can retry

**Pass Criteria:** ✅ Error handled gracefully

---

### Test 8.2: Network Error During Payment

**Steps:**
1. Open DevTools → Network
2. Set throttling to "Offline"
3. Submit payment form
4. Turn network back online

**Expected Result:**
- ✅ Error message shown
- ✅ No duplicate subscription
- ✅ User can retry

**Pass Criteria:** ✅ Network errors handled

---

### Test 8.3: CRM Access Denied

**Setup:**
- Logged in as BASIC plan user

**Steps:**
1. Manually navigate to `/organizer/crm`
2. Try to access `/api/crm/leads`

**Expected Result:**
- ✅ API returns 403 Forbidden
- ✅ UI shows upgrade message
- ✅ No data leaked

**Pass Criteria:** ✅ Access control enforced

---

## 9. Performance Tests

### Test 9.1: CRM Dashboard Load Time

**Setup:**
- Clear cache
- Open DevTools → Lighthouse

**Steps:**
1. Navigate to `/organizer/crm`
2. Wait for full load (including leads fetch)
3. Note time in DevTools → Performance tab

**Target Metrics:**
- ✅ First Contentful Paint (FCP): < 1.5s
- ✅ Largest Contentful Paint (LCP): < 2.5s
- ✅ Time to Interactive (TTI): < 3.5s

**Pass Criteria:** ✅ All metrics within targets

---

### Test 9.2: Lead Table Performance (100+ leads)

**Setup:**
- Database seeded with 100+ test leads
- CRM Dashboard loaded

**Steps:**
1. Load page with 100 leads
2. Test search functionality
3. Test filter functionality
4. Note any lag

**Expected Result:**
- ✅ No noticeable lag
- ✅ Search responds in < 500ms
- ✅ Filters update in < 300ms

**Pass Criteria:** ✅ Performance acceptable

---

### Test 9.3: Payment Form Load Time

**Steps:**
1. Navigate to plan selection
2. Time until plans visible

**Target:**
- ✅ < 2 seconds

**Pass Criteria:** ✅ Fast load time

---

## 10. Security Tests

### Test 10.1: JWT Token Validation

**Steps:**
1. Log in and copy JWT token from cookie/localStorage
2. Make API call to `/api/crm/leads` with valid token
3. Modify token slightly
4. Make API call again

**Expected Results:**
- ✅ Valid token: API returns 200 with data
- ✅ Invalid token: API returns 401 Unauthorized

**Pass Criteria:** ✅ JWT validation working

---

### Test 10.2: CRM Access Control

**Steps:**
1. Get JWT for BASIC plan user (no CRM)
2. Call `/api/crm/leads` with that token

**Expected Result:**
- ✅ API returns 403 Forbidden
- ✅ Error message: "CRM access not available"

**Pass Criteria:** ✅ Access control enforced

---

### Test 10.3: Webhook Signature Verification

**Setup:**
- Monitor webhook logs

**Steps:**
1. Razorpay sends webhook
2. Check if signature verified

**Expected Result:**
- ✅ Signature verified successfully
- ✅ Webhook processed
- ✅ Invalid signatures rejected

**Pass Criteria:** ✅ Webhook security working

---

## 11. Test Data Management

### Create Test Leads Programmatically

**Using MongoDB shell:**
```javascript
db.leads.insertMany([
  {
    name: "Lead 1",
    email: "lead1@example.com",
    phone: "9111111111",
    status: "new",
    verified: false,
    organizerId: "YOUR_USER_ID",
    tripId: "TRIP_ID",
    tripName: "Sample Trip",
    createdAt: new Date(),
    notes: ""
  },
  // Repeat for more leads
]);
```

### Create Test Subscriptions

**Using MongoDB shell:**
```javascript
db.organizersubscriptions.insertOne({
  userId: "TEST_USER_ID",
  planType: "PROFESSIONAL",
  price: 2199,
  trips: 6,
  crmAccess: true,
  leadCapture: true,
  phoneNumbers: true,
  status: "active",
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 30*24*60*60*1000)
});
```

---

## 12. Sign-Off Checklist

After completing all tests, verify:

- [ ] All 5 plans display correctly
- [ ] Prices match specification (STARTER ₹599 → ENTERPRISE ₹9999)
- [ ] CRM access correctly enabled for PROFESSIONAL+
- [ ] Payment flow works end-to-end
- [ ] Webhooks process correctly
- [ ] Trip limits enforced
- [ ] CRM leads can be created, read, updated
- [ ] Search and filters work
- [ ] Mobile responsive
- [ ] Error handling works
- [ ] Security controls in place
- [ ] Performance acceptable

**Final Status:** ✅ READY FOR PRODUCTION

---

## 13. Deployment Checklist

Before pushing to production:

```bash
# 1. Run all automated tests
npm test

# 2. Check environment variables
echo $RAZORPAY_KEY_ID
echo $RAZORPAY_KEY_SECRET
echo $JWT_SECRET
echo $MONGODB_URI

# 3. Verify database indexes
db.createIndex({ "organizersubscriptions": { "userId": 1, "status": 1 } })
db.createIndex({ "leads": { "organizerId": 1, "createdAt": -1 } })

# 4. Check webhook URL in Razorpay
# Should be: https://your-domain.com/api/subscriptions/webhook

# 5. Run load test
npm run load-test

# 6. Backup database
mongodump --db trek-tribe --out ./backups/$(date +%Y%m%d)
```

---

## 14. Post-Launch Monitoring

After deployment:

```bash
# Monitor webhook processing
tail -f services/api/logs/webhook.log

# Monitor API errors
tail -f services/api/logs/error.log

# Check subscription creation rate
db.organizersubscriptions.countDocuments({ 
  createdAt: { $gte: new Date(Date.now() - 24*60*60*1000) }
})

# Check failed payments
db.payments.find({ status: "failed" }).count()
```

---

**Test Guide Created:** 2024
**Last Updated:** Current Session
**Status:** ✅ Ready for testing
