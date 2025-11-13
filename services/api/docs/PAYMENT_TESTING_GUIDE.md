# Payment System Testing Guide

## 🎯 Overview
This guide provides step-by-step instructions for testing the complete payment system, including Razorpay integration, auto-pay subscription, and organizer onboarding flow.

---

## 📋 Prerequisites

### 1. Environment Variables
Ensure these are set in your `.env` file:

```env
# Razorpay Configuration
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# For testing, use Razorpay TEST mode credentials
# Get them from: https://dashboard.razorpay.com/app/keys
```

### 2. Database Setup
Run the preset users script:
```bash
npm run setup:users:updated
```

---

## 👥 Test Accounts

### Admin Account
- **Email:** trektribe_root@trektribe.in
- **Password:** Saksham@4700
- **Phone:** +919999999999
- **Access:** Full system control, admin dashboard

### Agent Account
- **Email:** tanejasaksham44@gmail.com
- **Password:** Agent@9800
- **Phone:** +919999999998
- **Access:** CRM, support tickets, agent dashboard

### Demo Organizer Account (FOR PAYMENT TESTING)
- **Email:** demo.organizer@trektribe.in
- **Password:** Demo@1234
- **Phone:** +919876543210
- **Access:** Organizer dashboard, trip management, auto-pay setup
- **Status:** Auto-pay NOT setup (ready for testing)
- **Subscription:** ₹1,499 for 5 trip listings per 60 days
- **First Payment Due:** 60 days from first login

---

## 🧪 Testing Scenarios

### Scenario 1: Organizer Onboarding & Auto-Pay Setup

#### Step 1: Login as Demo Organizer
1. Navigate to login page: `http://localhost:3000/login`
2. Enter credentials:
   - Email: `demo.organizer@trektribe.in`
   - Password: `Demo@1234`
3. Click "Login"

#### Step 2: Access Organizer Dashboard
1. After login, you should be redirected to `/organizer-dashboard`
2. You should see an alert: **"Auto-pay setup required"**
3. Dashboard should show:
   - Stats: 0 trips, 0 bookings, ₹0 revenue
   - Auto-Pay Status: **Not Setup** (orange warning)
   - Subscription Info: 0/5 listings used

#### Step 3: Setup Auto-Pay
1. Click "Setup Auto-Pay Now" button in the alert or auto-pay card
2. Navigate to `/setup-auto-pay` page
3. Verify page displays:
   - Subscription cost: ₹1,499
   - Billing cycle: Every 60 days
   - First payment: 60 days from now
   - Benefits list
   - Razorpay payment method option
4. Check the terms & conditions checkbox
5. Click "Setup Auto-Pay" button

#### Step 4: Razorpay Integration Test
1. You should be redirected to Razorpay checkout page
2. **For TEST mode**, use these test cards:

**Successful Payment:**
- Card Number: `4111 1111 1111 1111`
- CVV: Any 3 digits
- Expiry: Any future date
- Name: Any name

**Failed Payment:**
- Card Number: `4000 0000 0000 0002`

**UPI Test:**
- UPI ID: `success@razorpay`

3. Complete the payment
4. You should be redirected back to the application
5. Success toast: "Auto-pay setup successful!"

#### Step 5: Verify Auto-Pay Activation
1. You should be redirected to organizer dashboard
2. Verify Auto-Pay Status card shows:
   - Status: **Active** (green indicator)
   - Next payment date: 60 days from today
   - Days remaining: ~60
3. Verify Subscription card shows:
   - Listings: 0/5 used
   - Subscription expires in 60 days

#### Step 6: Create a Trip
1. Click "Create New Trip" button
2. Fill in trip details:
   - Title: Test Trek to Himalayas
   - Destination: Manali, Himachal Pradesh
   - Price: ₹15000 (150000 in paise)
   - Capacity: 10
   - Start Date: Future date
   - End Date: Future date
   - Difficulty: Intermediate
   - Categories: Adventure, Mountain
3. Submit the trip
4. Verify trip is created successfully
5. Dashboard should now show: 1 trip, 1/5 listings used

---

### Scenario 2: Payment Verification & Booking Flow

#### Step 1: Create Traveler Account
1. Logout from organizer account
2. Register as a new traveler:
   - Email: `test.traveler@example.com`
   - Password: `Test@1234`
   - Phone: `+919876543211`
   - Role: Traveler

#### Step 2: Book a Trip
1. Browse trips and select the trip created by demo organizer
2. Click "Book Now"
3. Fill in booking details:
   - Number of guests: 2
   - Participant details
4. Proceed to payment
5. Upload payment screenshot (or use Razorpay for online payment)
6. Submit booking

#### Step 3: Organizer Verification (Payment Screenshot Method)
1. Logout and login as demo organizer
2. Navigate to organizer dashboard
3. Check "Pending Bookings" or quick action for "Verify Payments"
4. You should see the new booking with status: **Pending Verification**
5. Click on the booking to view details
6. View uploaded payment screenshot
7. Click "Verify Payment" or "Reject Payment"
8. Verify booking status updates accordingly

---

### Scenario 3: Auto-Pay Scheduled Payment Testing

#### Test Immediate Payment (Admin Only)
1. Login as admin
2. Use the admin API to trigger scheduled payment:
   ```bash
   curl -X POST http://localhost:5000/api/auto-pay/process-scheduled \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```
3. Check organizer's auto-pay status
4. Verify payment was processed
5. Check next scheduled payment date (should be +60 days)

#### Test Payment Reminders (Admin Only)
1. Use admin API to send reminders:
   ```bash
   curl -X POST http://localhost:5000/api/auto-pay/send-reminders \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```
2. Check organizer's email for reminder notification
3. Verify reminder includes:
   - Payment amount
   - Payment date
   - Days remaining
   - Cancel option

---

### Scenario 4: Auto-Pay Cancellation

#### Step 1: Cancel Auto-Pay
1. Login as demo organizer
2. Navigate to organizer dashboard
3. Click "Manage Auto-Pay" in auto-pay status card
4. Navigate to `/auto-pay/manage` page
5. Click "Cancel Auto-Pay" button
6. Confirm cancellation in modal
7. API call: `POST /api/auto-pay/cancel`

#### Step 2: Verify Cancellation
1. Auto-pay status should show: **Inactive**
2. Dashboard should show warning alert
3. Subscription should remain active until expiry date
4. After expiry, trips should be deactivated
5. Organizer should be prompted to re-setup auto-pay

---

### Scenario 5: Subscription Expiry & Renewal

#### Test Subscription Expiry
1. As admin, manually update organizer's subscription expiry date to past
2. Run cron job or trigger manually:
   ```bash
   curl -X POST http://localhost:5000/api/auto-pay/process-scheduled \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```
3. Verify:
   - Organizer's trips are deactivated
   - Dashboard shows critical alert
   - Auto-pay status prompts renewal

#### Test Subscription Renewal
1. Organizer sets up auto-pay again
2. Payment is processed successfully
3. Verify:
   - Subscription is renewed for 60 days
   - Trips are reactivated
   - Listing count resets to 0/5
   - Next payment scheduled for +60 days

---

## 🔍 API Endpoints for Testing

### Auto-Pay Status
```bash
GET /api/auto-pay/status
Authorization: Bearer <organizer_token>
```

**Expected Response:**
```json
{
  "isSetup": true,
  "scheduledPaymentDate": "2025-03-13T00:00:00.000Z",
  "daysUntilPayment": 60,
  "subscriptionActive": true,
  "listingsRemaining": 5,
  "amount": 149900,
  "currency": "INR"
}
```

### Setup Auto-Pay
```bash
POST /api/auto-pay/setup
Authorization: Bearer <organizer_token>
Content-Type: application/json

{
  "paymentMethod": "razorpay",
  "razorpayPaymentId": "pay_XXXXXXXXXXXXXXXX",
  "razorpayOrderId": "order_XXXXXXXXXXXXXXXX",
  "razorpaySignature": "XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
}
```

### Cancel Auto-Pay
```bash
POST /api/auto-pay/cancel
Authorization: Bearer <organizer_token>
```

### Process Scheduled Payments (Admin Only)
```bash
POST /api/auto-pay/process-scheduled
Authorization: Bearer <admin_token>
```

### Send Payment Reminders (Admin Only)
```bash
POST /api/auto-pay/send-reminders
Authorization: Bearer <admin_token>
```

---

## 📊 Dashboard API Testing

### Organizer Dashboard
```bash
GET /api/dashboard/organizer
Authorization: Bearer <organizer_token>
```

**Expected Response:**
```json
{
  "stats": {
    "trips": { "total": 1, "active": 1, "upcoming": 1, "completed": 0 },
    "bookings": { "total": 0, "pending": 0, "confirmed": 0, "cancelled": 0 },
    "revenue": { "total": 0, "thisMonth": 0, "lastMonth": 0, "growth": 0 },
    "participants": { "total": 0, "thisMonth": 0 }
  },
  "autoPay": {
    "isSetup": true,
    "scheduledPaymentDate": "2025-03-13T00:00:00.000Z",
    "daysUntilPayment": 60,
    "subscriptionActive": true,
    "listingsRemaining": 5
  },
  "subscription": {
    "isActive": true,
    "tripsPublished": 1,
    "tripsLimit": 5,
    "expiresAt": "2025-03-13T00:00:00.000Z",
    "daysRemaining": 60
  },
  "alerts": [],
  "quickActions": [...],
  "recentTrips": [...],
  "recentBookings": []
}
```

---

## 🐛 Common Issues & Troubleshooting

### Issue 1: "Invalid credentials" error
**Solution:**
- Ensure you ran `npm run setup:users:updated`
- Check that you're using the correct email/password
- Clear browser cache and cookies
- Try resetting password via forgot password flow

### Issue 2: Razorpay checkout not loading
**Solution:**
- Verify `RAZORPAY_KEY_ID` is set in `.env`
- Ensure you're using TEST mode credentials
- Check browser console for errors
- Verify Razorpay dashboard is accessible

### Issue 3: Payment verification fails
**Solution:**
- Check Razorpay webhook is configured correctly
- Verify `RAZORPAY_KEY_SECRET` matches your account
- Check server logs for signature verification errors
- Ensure webhook URL is publicly accessible (use ngrok for local testing)

### Issue 4: Auto-pay status not updating
**Solution:**
- Check MongoDB connection
- Verify user document has `autoPay` field
- Check server logs for database errors
- Try refreshing the page
- Logout and login again

### Issue 5: Cron jobs not running
**Solution:**
- Ensure server is running continuously
- Check cron job is initialized in `src/index.ts`
- Verify timezone settings (IST)
- Check server logs for cron execution
- Manually trigger via admin API for testing

---

## 📝 Test Checklist

- [ ] Admin login works
- [ ] Agent login works
- [ ] Demo organizer login works
- [ ] Organizer dashboard loads correctly
- [ ] Auto-pay alert shows on dashboard
- [ ] Auto-pay setup page loads
- [ ] Razorpay checkout integration works
- [ ] Test payment succeeds
- [ ] Auto-pay status updates after payment
- [ ] Subscription info displays correctly
- [ ] Trip creation works with active subscription
- [ ] Booking flow works end-to-end
- [ ] Payment verification by organizer works
- [ ] Auto-pay cancellation works
- [ ] Payment reminders are sent
- [ ] Scheduled payments are processed
- [ ] Subscription renewal works
- [ ] Trips deactivate on expiry
- [ ] Dashboard APIs return correct data
- [ ] All alerts display properly

---

## 🔐 Security Notes

1. **Never commit real Razorpay credentials** to version control
2. **Always use TEST mode** for development and testing
3. **Verify webhook signatures** in production
4. **Store sensitive data encrypted** in database
5. **Use HTTPS** for payment pages in production
6. **Implement rate limiting** on payment endpoints
7. **Log all payment transactions** for audit trail
8. **Monitor for fraudulent activities**

---

## 🚀 Production Deployment Checklist

- [ ] Switch to Razorpay LIVE mode credentials
- [ ] Configure production webhook URL
- [ ] Set up SSL/TLS certificates
- [ ] Enable payment monitoring/alerts
- [ ] Configure backup payment gateway
- [ ] Set up automated daily reports
- [ ] Enable fraud detection
- [ ] Configure payment retry logic
- [ ] Set up customer support system
- [ ] Test all payment scenarios in staging
- [ ] Document all API endpoints
- [ ] Set up logging and monitoring
- [ ] Configure email notifications
- [ ] Test cron jobs in production environment

---

## 📞 Support

For issues or questions:
- Check the logs: `services/api/logs/`
- Review API documentation: `services/api/docs/`
- Contact: Support team or admin

---

**Last Updated:** January 13, 2025
**Version:** 1.0.0
