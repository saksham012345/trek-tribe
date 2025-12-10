# 🚀 QUICK START - Test Subscription Plans

## In 5 Minutes

### Step 1: Start Services
```bash
# Terminal 1: Backend
cd services/api
npm start
# Expected: Server running on port 5000

# Terminal 2: Frontend
cd web
npm start
# Expected: App opens on localhost:3000
```

### Step 2: Login
```
- Navigate to login page
- Login with test organizer account
  OR
- Create new organizer account
```

### Step 3: Test Payment Page
```
- Navigate to http://localhost:3000/auto-pay-setup
- You should see 5 plan cards displayed
```

### Step 4: Select & Test
```
1. Click PROFESSIONAL plan (₹2199)
   Expected: Card highlights with ring, checkmark appears
   
2. Scroll down to see plan details
   Expected: Features list shows CRM access, lead capture, phone numbers
   
3. Check terms checkbox
   Expected: Button becomes enabled
   
4. Click "Complete Payment - ₹2199"
   Expected: Razorpay modal opens
   
5. Use test card: 4111111111111111
   Expected: Payment processes → Redirect to dashboard
```

## Test Cards for Razorpay

| Card Number | Expiry | CVV | Result |
|------------|--------|-----|--------|
| 4111111111111111 | Any future | Any | ✅ Success |
| 4000000000000002 | Any future | Any | ❌ Declined |

## Verify in Database

```bash
# Check subscription was created
db.organizersubscriptions.findOne({ userId: YOUR_USER_ID })

# Should show:
{
  planType: "PROFESSIONAL",
  price: 2199,
  crmAccess: true,
  leadCapture: true,
  phoneNumbers: true,
  status: "active"
}
```

## Test CRM Access Endpoint

```bash
# In browser console or Postman:
curl -X GET 'http://localhost:5000/api/subscriptions/verify-crm-access' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'

# Should return:
{
  "hasCRMAccess": true,
  "hasLeadCapture": true,
  "canViewPhoneNumbers": true,
  "planType": "PROFESSIONAL"
}
```

## Common Issues

### Plans Not Showing?
```
1. Check console (DevTools → Console)
2. Check Network tab for /api/subscriptions/plans request
3. Verify backend is running on port 5000
```

### Payment Modal Not Opening?
```
1. Check if Razorpay script loaded:
   - Open DevTools Console
   - Type: window.Razorpay
   - Should show function object
   
2. Refresh page and try again
3. Check browser console for errors
```

### CRM Access Not Granted?
```
1. Check database subscription was created
2. Verify PROFESSIONAL plan was selected
3. Check subscription shows crmAccess: true
4. Look at backend logs for errors
```

## What to Look For

### ✅ Working Correctly:
- All 5 plan cards visible
- PROFESSIONAL has "⭐ MOST POPULAR" badge
- Selected plan highlights with visual ring
- Feature list shows CRM/lead/phone features for PROFESSIONAL
- Payment button shows correct price
- Payment processes without errors
- Dashboard accessible after payment
- Subscription created in database
- CRM access endpoints return correct values

### ⚠️ Potential Issues:
- Plan cards don't show → Check API response
- Payment button disabled → Accept terms
- Razorpay modal blank → Check Razorpay SDK loaded
- Wrong price in button → Check selectedPlan state
- No CRM access → Check database subscription

## Files to Check

### Frontend
- `web/src/pages/AutoPaySetup.tsx` - Main component
- `web/public/index.html` - Razorpay script included?

### Backend
- `services/api/src/routes/subscriptions.ts` - Plans defined?
- `services/api/src/models/OrganizerSubscription.ts` - Schema correct?

### Configuration
- `.env` - Razorpay keys set?
- `docker-compose.yml` - Services running?

## Success Criteria Checklist

- [ ] All 5 plans display
- [ ] Can select different plans
- [ ] Plan details show correct features
- [ ] CRM features visible for PROFESSIONAL
- [ ] Can complete PROFESSIONAL (₹2199) payment
- [ ] Redirects to dashboard after payment
- [ ] Subscription created in database
- [ ] CRM access endpoint returns true for PROFESSIONAL
- [ ] Mobile responsive (check with browser DevTools)
- [ ] No console errors

---

**Time to Test**: ~5-10 minutes
**Expected Outcome**: Full payment flow working for PROFESSIONAL plan with CRM features
**Next**: Full end-to-end testing guide in TESTING_GUIDE_SUBSCRIPTION_PLANS.md
