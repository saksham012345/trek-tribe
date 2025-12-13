# Quick Start - Payment System Testing

## ⚡ 2-Minute Test

### Test 1: Home Page (30 seconds)
```
1. DON'T log in
2. Visit home page
3. ✅ See "Join The Tribe" floating button (bottom right)
4. Click it → Modal appears
5. Click "Start now" → Redirected to login
```

### Test 2: Subscribe Page (1 minute)
```
1. After login as organizer@trektribe.com / Organizer@2025
2. Access /subscribe
3. ✅ See 5 plans:
   - STARTER (₹599)
   - BASIC (₹1,299)
   - PROFESSIONAL (₹2,199) ← "Popular"
   - PREMIUM (₹3,999)
   - ENTERPRISE (₹7,999)
4. Click "Start subscription" on PROFESSIONAL
5. ✅ One of two things happens:
   - Trial activated (60-day) → Redirect to onboarding
   - Payment modal opens → Enter test card
```

### Test 3: Trip Creation (30 seconds)
```
1. With active subscription, click "Create Adventure" in header
2. ✅ Trip creation form loads immediately
3. Form is ready for data entry
```

---

## 🧪 Full Payment Test (5 minutes)

### Prerequisites
- Fresh organizer account (or logout first)
- Razorpay test card: `4111 1111 1111 1111`

### Step 1: Initiate Subscription
```
1. Login as: organizer@trektribe.com / Organizer@2025
2. Navigate to /subscribe
3. Select PROFESSIONAL plan
4. Click "Start subscription"
```

### Step 2: Trial or Payment
```
Option A (Trial - If eligible):
- ✅ Message: "60-day trial activated"
- ✅ Redirect to /organizer/route-onboarding

Option B (Payment - If not eligible):
- ✅ Razorpay checkout modal opens
- ✅ Fill form (pre-filled):
  - Email: organizer@trektribe.com
  - Name: (pre-filled)
  - Phone: (pre-filled)
```

### Step 3: Complete Payment (If not trial)
```
1. Fill card details:
   Card: 4111 1111 1111 1111
   Expiry: 12/25 (any future date)
   CVV: 123 (any 3 digits)
   
2. Click "Pay Now"
3. ✅ Enter OTP (any 6 digits in test mode)
4. ✅ Payment successful message
5. ✅ Redirect to onboarding page
```

### Step 4: Verify Subscription
```
1. Go to /subscribe again
2. ✅ Message: "You already have an active subscription"
3. ✅ Button changes to "Go to Onboarding"
4. Trip creation should now be available
```

---

## 🔍 Verify Backend

### Using Terminal/PowerShell

#### Check Plans Endpoint
```powershell
$response = Invoke-WebRequest `
  -Uri "https://trek-tribe-38in.onrender.com/api/subscriptions/plans" `
  -Method GET

$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

Expected: See all 5 plans with prices and features

#### Check User Subscription (Requires Token)
```powershell
# First, login and get token from browser console or login endpoint
$token = "YOUR_JWT_TOKEN_HERE"

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type" = "application/json"
}

$response = Invoke-WebRequest `
  -Uri "https://trek-tribe-38in.onrender.com/api/subscriptions/my" `
  -Headers $headers `
  -Method GET

$response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

---

## 🚨 Troubleshooting

### Issue: "Razorpay is not loaded"
**Quick Fix:**
```
1. Clear browser cache: Ctrl + Shift + Del
2. Hard refresh: Ctrl + Shift + R
3. Try again
```

### Issue: Trial not activating
**Check:**
```
1. Open browser console (F12)
2. Look for success message
3. If error, check network tab
4. Verify `/api/subscriptions/create-order` response
```

### Issue: Payment modal doesn't open
**Check:**
```
1. Console for "Razorpay is not loaded"
2. Network tab for 200 response from create-order
3. Razorpay script loaded: Check network tab for checkout.razorpay.com
```

### Issue: Redirected to subscribe instead of trip form
**Check:**
```
1. Subscription status: /api/subscriptions/my
2. Should return: "isActive": true
3. If false, need to activate subscription first
```

---

## 📊 Test Scenarios Checklist

- [ ] Home page shows CTA for guests
- [ ] Home page hides CTA for organizers
- [ ] "Start now" button works
- [ ] Subscribe page loads all 5 plans
- [ ] PROFESSIONAL marked as "Popular"
- [ ] Trial activation works (or payment modal opens)
- [ ] Payment verification completes successfully
- [ ] Redirected to onboarding after payment
- [ ] Can't create trip without subscription
- [ ] Can create trip with subscription
- [ ] Payment signature validated correctly
- [ ] Error messages are helpful

---

## 🎯 Success Indicators

You'll know it's working when:

✅ **Home Page**
- Guest: Sees floating "Join The Tribe" button
- Organizer: Doesn't see the button

✅ **Subscribe Page**
- All 5 plans visible
- PROFESSIONAL shows "Popular"
- Prices and features match:
  - STARTER: ₹599, 2 trips
  - BASIC: ₹1,299, 4 trips
  - PROFESSIONAL: ₹2,199, 6 trips ⭐
  - PREMIUM: ₹3,999, 15 trips
  - ENTERPRISE: ₹7,999, 40 trips

✅ **Payment Flow**
- Trial: Activates immediately
- Payment: Razorpay modal opens
- Success: Redirects to onboarding

✅ **Trip Creation**
- Without subscription: Redirected to /subscribe
- With subscription: Form loads

---

## 📞 Quick Reference

### Test Credentials
```
Email: organizer@trektribe.com
Password: Organizer@2025
Role: organizer
```

### Test Card (Razorpay)
```
Card: 4111 1111 1111 1111
Expiry: 12/25
CVV: 123
OTP: Any 6 digits
```

### Important URLs
```
Home: http://localhost:3000 or https://trek-tribe.vercel.app
Subscribe: /subscribe
Create Trip: /create-trip
Plans API: https://trek-tribe-38in.onrender.com/api/subscriptions/plans
```

### Key Files
```
Frontend:
- web/src/components/JoinTheTribeModal.tsx
- web/src/pages/Subscribe.tsx
- web/src/pages/CreateTrip.tsx

Backend:
- services/api/src/routes/subscriptions.ts
- services/api/src/models/OrganizerSubscription.ts
```

---

## ✅ Final Checklist

Before deploying, verify:

- [ ] Frontend builds successfully (`npm run build`)
- [ ] No TypeScript errors
- [ ] All 5 plans display correctly
- [ ] Razorpay credentials in .env
- [ ] Trial system works
- [ ] Payment verification works
- [ ] Trip creation guard works
- [ ] Home page looks clean
- [ ] Error handling works
- [ ] Loading states display

---

**You're ready to test! 🚀**

Start with the 2-Minute Test above, then move to the Full Payment Test if you want to go deeper.

If you encounter any issues, check the Troubleshooting section or review the PAYMENT_IMPLEMENTATION_SUMMARY.md file.
