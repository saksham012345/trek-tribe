# Quick Payment System Verification Guide

## Test Credentials

### Organizer Test Account
```
Email: organizer@trektribe.com
Password: Organizer@2025
Role: organizer
```

### Admin Test Account (for verification)
```
Email: admin@trektribe.com
Password: Admin@2025
Role: admin
```

---

## Step-by-Step Test Flow

### Test 1: Home Page Behavior

#### For Organizers
1. Login with `organizer@trektribe.com` / `Organizer@2025`
2. ✅ Home page loads normally
3. ✅ No "Join The Tribe" floating button visible
4. ✅ Header shows "Create Adventure" link

#### For Guests
1. Do NOT log in
2. ✅ Home page shows "Join The Tribe - Become a Partner" button (bottom right)
3. ✅ Click button → modal appears with partner program info
4. Click "Start now" → redirected to login/register

---

### Test 2: Subscription Flow for New Organizer

#### Scenario: First-time organizer signing up
1. Click "Start now" in partner modal
2. Redirect flow:
   ```
   Unauthenticated → /login → /subscribe
   ```
3. ✅ Subscription page displays all 5 plans
4. ✅ PROFESSIONAL plan marked as "Popular"
5. ✅ Plan prices and features visible:
   - STARTER: ₹599/month - 2 trips
   - BASIC: ₹1,299/month - 4 trips
   - PROFESSIONAL: ₹2,199/month - 6 trips (Popular)
   - PREMIUM: ₹3,999/month - 15 trips
   - ENTERPRISE: ₹7,999/month - 40 trips

#### Trial Activation
1. Select PROFESSIONAL plan
2. Click "Start subscription"
3. ✅ If eligible: "60-day trial activated" message
4. ✅ Redirected to `/organizer/route-onboarding`
5. ✅ Can now access trip creation features

#### Paid Subscription
1. If not eligible for trial, Razorpay checkout modal opens
2. ✅ Shows:
   - Plan name and description
   - Amount in INR
   - Prefilled name and email
   - Multiple payment methods

---

### Test 3: Create Trip with Active Subscription

#### Scenario: Organizer with active subscription
1. Login: `organizer@trektribe.com` / `Organizer@2025`
2. Click "Create Adventure" in header
3. Navigate to `/create-trip`
4. ✅ Subscription verification runs (shows loading spinner)
5. ✅ Trip creation form displays (subscription is active)
6. ✅ Can proceed with trip details

---

### Test 4: Create Trip WITHOUT Subscription

#### Scenario: Organizer without subscription
1. Login as organizer (or directly access `/create-trip`)
2. ✅ Shows loading spinner briefly
3. ✅ Redirected to `/subscribe` with message:
   ```
   "You need an active subscription to create trips"
   ```
4. ✅ Can select and activate subscription
5. ✅ Return to `/create-trip` and proceed

---

### Test 5: Payment Verification

#### Using Razorpay Test Mode
Razorpay provides test cards:

**Successful Payment:**
```
Card: 4111 1111 1111 1111
Expiry: Any future date (e.g., 12/25)
CVV: Any 3 digits
OTP: Any 6 digits
```

**Failed Payment:**
```
Card: 4000 0000 0000 0002
```

#### After Successful Payment
1. ✅ Payment verification completes
2. ✅ "Subscription activated" toast appears
3. ✅ Redirected to `/organizer/route-onboarding`
4. ✅ User can now create trips

---

## API Endpoint Testing

### Using curl/Postman

#### Get Available Plans
```bash
curl https://trek-tribe-38in.onrender.com/api/subscriptions/plans
```

Expected Response:
```json
{
  "success": true,
  "plans": [
    {
      "id": "STARTER",
      "name": "Starter Plan",
      "price": 599,
      "trips": 2,
      "features": [...]
    },
    ...
  ]
}
```

#### Check Current Subscription
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://trek-tribe-38in.onrender.com/api/subscriptions/my
```

Expected Response (No Subscription):
```json
{
  "hasSubscription": false,
  "eligibleForTrial": true,
  "trialDays": 60
}
```

Expected Response (Active Subscription):
```json
{
  "hasSubscription": true,
  "subscription": {
    "plan": "professional",
    "status": "active",
    "isActive": true,
    "tripsRemaining": 6,
    "daysUntilExpiry": 28,
    ...
  }
}
```

---

## Browser Console Debugging

### Open Developer Tools (F12)
Look for console messages:

#### Successful Flow:
```
✅ Order created: order_xxxxx
🔓 Opening Razorpay checkout modal...
✅ Payment successful! Verifying...
✅ Payment verified successfully
```

#### Subscription Check:
```
(Before fix) Would show 401 error
(After fix) Should check successfully or redirect
```

---

## Common Issues & Solutions

### Issue: "Razorpay is not loaded"
**Solution:**
- Clear browser cache: `Ctrl + Shift + Del`
- Hard refresh: `Ctrl + Shift + R`
- Verify script tag in `public/index.html`:
  ```html
  <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
  ```

### Issue: "Payment service unavailable"
**Solution:**
- Check backend `.env` has Razorpay credentials
- Restart backend server
- Verify environment variables are loaded: `echo $RAZORPAY_KEY_ID`

### Issue: "You already have an active subscription"
**Solution:**
- This is correct behavior - users with active subscriptions can't create new ones
- To test, use admin dashboard to update user's subscription end date

### Issue: Redirected to subscribe but was supposed to stay on form
**Solution:**
- Check network tab in developer tools for subscription API call
- If getting 401: user token may have expired, try logout/login
- If getting 500: backend error - check server logs

---

## Performance Checks

### Load Times
- Subscription page: < 2s
- Plan selection: instant
- Razorpay checkout: 1-2s
- Trip creation load: < 1s (with subscription)

### Network Activity
- Plans API call: ~50ms
- Subscription check: ~100-200ms
- Create order: ~200-300ms
- Payment verification: ~300-500ms

---

## Success Indicators

✅ All tests passed when you see:
1. Home page loads without CTA for organizers
2. "Start now" button correctly redirects
3. Subscription page displays all 5 plans
4. Trial activation works for eligible users
5. Razorpay payment modal opens correctly
6. Payment verification completes successfully
7. Trip creation requires active subscription
8. Organizers with subscription can create trips

---

## Rollback Test

If you need to verify rollback works:
```bash
# Check git status
git status

# See what files changed
git diff --name-only

# Revert if needed
git checkout -- <filename>
```

---

**Last Updated:** December 13, 2025
**Status:** ✅ Ready for Testing
