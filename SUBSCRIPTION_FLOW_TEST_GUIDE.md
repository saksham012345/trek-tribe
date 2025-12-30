# Subscription Flow Testing Guide

## ✅ What Was Fixed

1. **Removed role restriction** - Users no longer need to be organizers to subscribe (auto-upgrade happens)
2. **Fixed plan display** - Plans now load and display correctly on Subscribe page
3. **Fixed payment flow** - Razorpay integration works with proper error handling
4. **Auto-upgrade to organizer** - Users are automatically upgraded to organizer role when subscribing

## 🧪 Manual Testing Steps

### Prerequisites
1. **Start Backend Server:**
   ```bash
   cd services/api
   npm run dev
   ```
   Server should start on `http://localhost:5000`

2. **Start Frontend:**
   ```bash
   cd web
   npm start
   ```
   Frontend should start on `http://localhost:3000`

### Test Flow 1: New User (Not Logged In)

1. **Navigate to Home Page**
   - Go to `http://localhost:3000`
   - You should see the "Join The Tribe – Become a Partner" floating button

2. **Click "Join The Tribe"**
   - Should redirect to `/login` (if not logged in)
   - Or show JoinTheTribe modal/page

3. **Login/Register**
   - If you have an account, login
   - If not, register a new account (can be traveler role)

4. **After Login**
   - Should redirect to `/subscribe` page
   - You should see all 5 subscription plans displayed:
     - STARTER (₹599/mo)
     - BASIC (₹1299/mo)
     - PROFESSIONAL (₹2199/mo)
     - PREMIUM (₹3999/mo)
     - ENTERPRISE (₹7999/mo)

5. **Select a Plan**
   - Click on any plan card to select it
   - Selected plan should have green border and "Selected" badge

6. **Click "Subscribe & Continue"**
   - Should create Razorpay order (if not trial eligible)
   - OR activate 60-day trial (if eligible)
   - Razorpay checkout should open

7. **Complete Payment**
   - Use Razorpay test credentials
   - Complete payment
   - Should redirect to organizer dashboard
   - User role should be automatically upgraded to "organizer"

### Test Flow 2: Existing User (Already Logged In)

1. **Navigate to Home Page**
   - Go to `http://localhost:3000`
   - You should be logged in

2. **Click "Join The Tribe"**
   - Should directly go to `/subscribe` page
   - No login required

3. **Follow steps 4-7 from Flow 1**

### Test Flow 3: Direct Navigation

1. **Navigate directly to Subscribe page**
   - Go to `http://localhost:3000/subscribe`
   - If not logged in, should redirect to login
   - After login, should show subscribe page

2. **Follow steps 4-7 from Flow 1**

## 🔍 What to Check

### ✅ Plans Page Should Show:
- [ ] All 5 plans displayed in a grid
- [ ] Each plan shows: name, price, trips, features
- [ ] Plan selection works (clicking selects plan)
- [ ] Selected plan has visual indicator
- [ ] "Subscribe & Continue" button is enabled

### ✅ Payment Flow Should:
- [ ] Create order successfully (check browser console for API calls)
- [ ] Open Razorpay checkout modal
- [ ] Accept test payment
- [ ] Verify payment on backend
- [ ] Create subscription in database
- [ ] Auto-upgrade user role to "organizer"
- [ ] Redirect to organizer dashboard

### ✅ Error Handling:
- [ ] If plans fail to load, shows fallback message
- [ ] If payment fails, shows error message
- [ ] If user cancels payment, shows cancellation message
- [ ] All errors are user-friendly

## 🐛 Common Issues & Solutions

### Issue: Plans not showing
**Solution:** Check browser console for API errors. Verify backend is running on port 5000.

### Issue: "Unauthorized" error
**Solution:** 
- Check if user is logged in
- Check if cookies are being sent (check Network tab)
- Verify JWT_SECRET is set in backend .env

### Issue: Razorpay not opening
**Solution:**
- Check if RAZORPAY_KEY_ID is set in backend .env
- Check browser console for errors
- Verify Razorpay SDK is loaded (check Network tab for checkout.js)

### Issue: Payment succeeds but subscription not created
**Solution:**
- Check backend logs for errors
- Verify payment verification endpoint is working
- Check database for subscription record

## 📝 API Endpoints to Test

### 1. GET /api/subscriptions/plans
**Expected:** Returns all 5 plans
```json
{
  "success": true,
  "plans": [
    {
      "id": "STARTER",
      "name": "Starter Plan",
      "price": 599,
      "trips": 2,
      ...
    }
  ]
}
```

### 2. POST /api/subscriptions/create-order
**Expected:** Creates Razorpay order (requires auth)
```json
{
  "success": true,
  "order": {
    "id": "order_xxx",
    "amount": 59900,
    "currency": "INR"
  },
  "keyId": "rzp_test_xxx"
}
```

### 3. POST /api/subscriptions/verify-payment
**Expected:** Verifies payment and creates subscription (requires auth)
```json
{
  "success": true,
  "subscription": { ... },
  "message": "Subscription activated"
}
```

## ✅ Success Criteria

The flow is working correctly if:
1. ✅ Plans load and display on Subscribe page
2. ✅ User can select a plan
3. ✅ "Subscribe & Continue" button works
4. ✅ Razorpay checkout opens
5. ✅ Payment can be completed
6. ✅ User is redirected to dashboard after payment
7. ✅ User role is upgraded to "organizer"
8. ✅ Subscription is created in database

## 🎯 Next Steps After Testing

If all tests pass:
1. Test with different user roles (traveler, organizer, admin)
2. Test trial activation (first-time users)
3. Test payment failures and retries
4. Test subscription renewal flow

If tests fail:
1. Check browser console for errors
2. Check backend logs for errors
3. Verify environment variables are set
4. Check database connection
5. Verify Razorpay credentials

