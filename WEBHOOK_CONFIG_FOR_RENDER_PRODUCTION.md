# Razorpay Webhooks Configuration for Trek Tribe

## 🚀 Your Deployment Architecture

```
Frontend:  https://trek-tribe-9zk3.vercel.app/ (Vercel)
Backend:   https://trekktribe.onrender.com (Render)
Database:  MongoDB Atlas
Payments:  Razorpay
```

---

## 📋 Webhook Setup for Production

### Single Webhook Configuration

**Webhook URL:**
```
https://trekktribe.onrender.com/api/webhooks/razorpay
```

**Alert Email:**
```
tanejasaksham44@gmail.com
```

**Active Events to Select (Minimum Required):**
```
✅ payment.authorized
✅ payment.failed
✅ payment.captured
✅ refund.created
✅ refund.failed
```

---

## 🔧 Step-by-Step Setup in Razorpay Dashboard

### 1. Go to Razorpay Dashboard
```
https://dashboard.razorpay.com
```

### 2. Navigate to Webhooks
```
Settings (⚙️) → Webhooks
```

### 3. Click "Add New Webhook"

Fill in the form:

```
┌─────────────────────────────────────────────────────────┐
│ Webhook URL (Required)                                  │
│ https://trekktribe.onrender.com/api/webhooks/razorpay  │
│                                                         │
│ Secret (Optional but RECOMMENDED)                       │
│ [This will be auto-generated or you can paste yours]    │
│                                                         │
│ Alert Email (Optional)                                  │
│ tanejasaksham44@gmail.com                               │
│                                                         │
│ Active Events (Required - Select these 5)               │
│ ☑ payment.authorized                                    │
│ ☑ payment.failed                                        │
│ ☑ payment.captured                                      │
│ ☑ refund.created                                        │
│ ☑ refund.failed                                         │
│                                                         │
│ [Create Webhook]                                        │
└─────────────────────────────────────────────────────────┘
```

### 4. After Creation - Copy the Webhook Secret

Razorpay will show:
```
✅ Webhook created successfully!

Webhook ID: 1234567890abcd
Webhook Secret: whsec_xxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 🔐 Environment Variables

### Add to Render Environment Variables

**Dashboard:** https://dashboard.render.com → trek-tribe-api → Environment

```
RAZORPAY_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxx
```

Or add to your `.env` file locally:
```bash
# services/api/.env

# Razorpay Payment Gateway
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxx
```

---

## ✅ Production Webhook Flow

```
User on Frontend (Vercel)
  ↓
https://trek-tribe-9zk3.vercel.app/
  ↓
Clicks "Pay with Razorpay"
  ↓
Razorpay Payment Gateway Opens
  ↓
User completes payment
  ↓
Razorpay sends WEBHOOK to your Backend (Render)
  ↓
POST https://trekktribe.onrender.com/api/webhooks/razorpay
  ↓
Your backend processes payment
  ↓
Updates database
  ↓
Sends confirmation email to user
  ↓
Frontend polls or websocket receives update
  ↓
Shows booking confirmation on Vercel
```

---

## 🧪 Testing Production Webhooks

### Method 1: Make Real Test Payment

```
1. Go to frontend: https://trek-tribe-9zk3.vercel.app/
2. Initiate a booking
3. Click "Pay with Razorpay"
4. Use test card: 4111 1111 1111 1111
5. Any expiry (future date): 12/25
6. Any CVV: 123
7. Click Pay
8. Check Razorpay Dashboard → Webhooks → View Logs
   - Should show successful delivery to your Render URL
```

### Method 2: Razorpay Dashboard Test Webhook

```
1. Go to: https://dashboard.razorpay.com/app/settings/webhooks
2. Click on your webhook
3. Click "Test Webhook" or "Send Test Event"
4. Select event: payment.authorized
5. Click "Send Test Event"
6. Check logs:
   - Razorpay dashboard shows "Delivered"
   - Your Render logs show webhook received
```

---

## 📊 Webhook Events Your System Handles

| Event | What Triggers | Your Action |
|-------|--------------|------------|
| **payment.authorized** | User pays successfully | Mark booking as CONFIRMED, send email |
| **payment.failed** | Payment fails/declined | Mark booking as FAILED, notify user |
| **payment.captured** | Amount confirmed captured | Log transaction, send receipt |
| **refund.created** | Cancellation refund started | Update booking status, log refund |
| **refund.failed** | Refund couldn't process | Alert admin, requires manual action |

---

## 🔍 Verify Webhook Delivery

### In Razorpay Dashboard:
```
Settings → Webhooks → [Your Webhook] → View Logs
```

You should see:
```
✅ Delivered
Status: 200 OK
Timestamp: 2025-12-10 15:30:45 UTC
Event: payment.authorized
Response: {"success": true}
```

### In Render Logs:
```
Dashboard → trek-tribe-api → Logs

Look for:
✅ Webhook verified and processed
📊 Event: payment.authorized
🔒 Payment ID: pay_1234567890
💾 Updated booking: booking_xyz
📧 Email sent to: user@example.com
```

---

## 🚨 Common Issues & Solutions

### ❌ Webhook Shows "Failed Delivery"

**Cause:** Render backend is unavailable

**Solutions:**
```
1. Check Render service is running:
   Dashboard → trek-tribe-api → should be "Live"

2. Check webhook URL is correct:
   https://trekktribe.onrender.com/api/webhooks/razorpay
   (NOT https://trek-tribe-9zk3.vercel.app/)

3. Check backend logs for errors:
   Render → trek-tribe-api → Logs

4. Test connectivity:
   curl https://trekktribe.onrender.com/api/webhooks/razorpay
   (Should give 405 Method Not Allowed - GET not supported)
```

### ❌ Webhook Received but Booking Not Updated

**Cause:** Signature verification failed or database error

**Solutions:**
```
1. Verify webhook secret in .env:
   RAZORPAY_WEBHOOK_SECRET=whsec_xxxxx
   (must match Razorpay dashboard)

2. Check booking ID is passed in payment:
   Payment notes should include booking_id

3. Check database connection:
   MongoDB Atlas is accessible from Render

4. View error logs:
   Render → trek-tribe-api → Logs → search "webhook"
```

### ❌ Signature Verification Error

**Cause:** RAZORPAY_WEBHOOK_SECRET not set correctly

**Solution:**
```
1. Copy exact secret from Razorpay:
   Settings → Webhooks → [Webhook] → "Show Secret"

2. Paste into Render environment variables:
   Add: RAZORPAY_WEBHOOK_SECRET=whsec_xxxxx

3. Restart Render service:
   Dashboard → trek-tribe-api → "Restart Service"

4. Verify in logs:
   ✅ Webhook verified and processed
```

---

## 📋 Production Checklist

- [ ] **Razorpay Dashboard Setup**
  - [ ] Created webhook with URL: https://trekktribe.onrender.com/api/webhooks/razorpay
  - [ ] Selected 5 events (payment.authorized, payment.failed, payment.captured, refund.created, refund.failed)
  - [ ] Copied webhook secret
  - [ ] Alert email set to: tanejasaksham44@gmail.com

- [ ] **Render Backend Configuration**
  - [ ] Added RAZORPAY_WEBHOOK_SECRET to environment variables
  - [ ] Service is running and showing "Live"
  - [ ] Logs show "✅ Using pure JavaScript embeddings"
  - [ ] MongoDB connection is active

- [ ] **Testing**
  - [ ] Made test payment on frontend (Vercel)
  - [ ] Checked Razorpay webhook logs show "Delivered"
  - [ ] Checked Render logs show "✅ Webhook verified and processed"
  - [ ] Verified booking status updated in database
  - [ ] Confirmed email sent to user

- [ ] **Frontend (Vercel)**
  - [ ] CORS configured to allow requests from https://trekktribe.onrender.com
  - [ ] Environment variables point to https://trekktribe.onrender.com

---

## 🔗 Important URLs for Your Setup

| Service | URL |
|---------|-----|
| **Frontend** | https://trek-tribe-9zk3.vercel.app/ |
| **Backend API** | https://trekktribe.onrender.com |
| **Webhook Endpoint** | https://trekktribe.onrender.com/api/webhooks/razorpay |
| **Razorpay Dashboard** | https://dashboard.razorpay.com |
| **Razorpay Webhooks** | https://dashboard.razorpay.com/app/settings/webhooks |
| **Render Dashboard** | https://dashboard.render.com |

---

## 📊 Example Payment Flow

```
1. USER INITIATES PAYMENT
   Location: https://trek-tribe-9zk3.vercel.app/booking/pay
   
2. FRONTEND CALLS RAZORPAY
   window.Razorpay.open(options)
   
3. USER COMPLETES PAYMENT
   Card/UPI/Wallet payment processed
   
4. RAZORPAY SENDS WEBHOOK (Real-time)
   POST https://trekktribe.onrender.com/api/webhooks/razorpay
   Headers: x-razorpay-signature: xxxxx
   Body: {
     "event": "payment.authorized",
     "payload": {...}
   }
   
5. RENDER BACKEND PROCESSES
   ✓ Verifies signature using RAZORPAY_WEBHOOK_SECRET
   ✓ Updates booking to "CONFIRMED"
   ✓ Sends confirmation email
   ✓ Returns 200 OK to Razorpay
   
6. RAZORPAY MARKS DELIVERED
   Dashboard shows: ✅ Delivered (200 OK)
   
7. USER SEES CONFIRMATION
   Frontend refreshes → shows "Booking Confirmed"
```

---

## 🎯 Quick Copy-Paste for Razorpay

**When creating webhook, use:**
```
URL: https://trekktribe.onrender.com/api/webhooks/razorpay
Alert Email: tanejasaksham44@gmail.com

Events to check:
☑ payment.authorized
☑ payment.failed
☑ payment.captured
☑ refund.created
☑ refund.failed
```

**After creation, copy this to Render environment:**
```
RAZORPAY_WEBHOOK_SECRET=whsec_[copy_from_dashboard]
```

---

## ✅ Status

**Configuration:** ✅ Ready to implement  
**Backend:** ✅ Deployed on Render  
**Frontend:** ✅ Deployed on Vercel  
**Webhook Support:** ✅ Already implemented in code  
**Next Step:** Create webhook in Razorpay dashboard with above details

---

**Last Updated:** December 10, 2025  
**Deployment:** Production (Render + Vercel)
