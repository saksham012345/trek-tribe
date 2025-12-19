# 🚀 Quick Test Guide - Payment Workflow

## ⚡ 5-Minute Verification

### Prerequisites
```bash
# Set Razorpay test credentials (optional for trial test)
RAZORPAY_KEY_ID=rzp_test_XXXXXXXX
RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXX
```

### Start Backend
```bash
cd services/api
npm run dev
```

### Run Automated Test
```bash
.\test-payment-workflow.ps1
```

---

## 📋 Manual Quick Test (Postman/Thunder Client)

### 1️⃣ Register (No auth needed)
```http
POST http://localhost:5003/api/auth/register
Content-Type: application/json

{
  "name": "Test Org",
  "email": "test@example.com",
  "password": "Test123!",
  "role": "organizer"
}
```
**Expected**: `{ token, user }` ✅  
**Save**: `token` for next requests

---

### 2️⃣ Try Trip Creation - Should FAIL ❌
```http
POST http://localhost:5003/api/trips
Authorization: Bearer <YOUR_TOKEN>
Content-Type: application/json

{
  "title": "Test Trek",
  "destination": "Manali",
  "price": 5000,
  "capacity": 10,
  "startDate": "2025-02-01",
  "endDate": "2025-02-05"
}
```
**Expected**: `402 Payment Required` ❌  
**Message**: `"Subscription required"`

---

### 3️⃣ Start Free Trial
```http
POST http://localhost:5003/api/subscriptions/start-trial
Authorization: Bearer <YOUR_TOKEN>
Content-Type: application/json

{
  "plan": "BASIC"
}
```
**Expected**: 
```json
{
  "subscription": {
    "status": "trial",
    "plan": "BASIC",
    "tripsPerCycle": 4,
    "tripsUsed": 0,
    "isTrialActive": true
  }
}
```
✅ Trial activated!

---

### 4️⃣ Create Trip - Should SUCCEED ✅
```http
POST http://localhost:5003/api/trips
Authorization: Bearer <YOUR_TOKEN>
Content-Type: application/json

{
  "title": "Himalayan Adventure",
  "destination": "Manali",
  "price": 12000,
  "capacity": 15,
  "startDate": "2025-02-01",
  "endDate": "2025-02-06",
  "categories": ["Adventure", "Trekking"]
}
```
**Expected**: `201 Created` ✅  
**Response**: `{ _id, title, ... }`

---

### 5️⃣ Check Subscription Status
```http
GET http://localhost:5003/api/subscriptions/my
Authorization: Bearer <YOUR_TOKEN>
```
**Expected**:
```json
{
  "plan": "BASIC",
  "status": "trial",
  "tripsUsed": 1,           ← Should be 1!
  "tripsPerCycle": 4,
  "tripsRemaining": 3       ← Should be 3!
}
```
✅ Counter incremented!

---

### 6️⃣ Create Razorpay Order
```http
POST http://localhost:5003/api/subscriptions/create-order
Authorization: Bearer <YOUR_TOKEN>
Content-Type: application/json

{
  "plan": "PREMIUM"
}
```
**Expected**:
```json
{
  "razorpayOrderId": "order_XXXXXXXX",
  "amount": 399900,
  "currency": "INR",
  "plan": "PREMIUM"
}
```
✅ Order created!

---

### 7️⃣ Test CRM Access (Should Fail - Not Premium Yet)
```http
GET http://localhost:5003/api/crm/leads
Authorization: Bearer <YOUR_TOKEN>
```
**Expected**: `403 Forbidden` ❌  
**Message**: `"CRM access denied"` or similar

---

## ✅ Success Criteria

| Step | Expected Result | Status |
|------|----------------|--------|
| 1. Register | Token received | ✅ |
| 2. Trip creation (no sub) | 402 error | ✅ |
| 3. Start trial | Trial active | ✅ |
| 4. Trip creation (trial) | 201 success | ✅ |
| 5. Counter check | tripsUsed = 1 | ✅ |
| 6. Razorpay order | Order ID received | ✅ |
| 7. CRM access | 403 (not Premium) | ✅ |

---

## 🧪 Test with Multiple Trips

Create 4 trips (BASIC plan limit), then try a 5th:

```http
# Trip 2
POST http://localhost:5003/api/trips
Authorization: Bearer <YOUR_TOKEN>
{ "title": "Trek 2", ... }
# Expected: ✅ Success

# Trip 3
POST http://localhost:5003/api/trips
{ "title": "Trek 3", ... }
# Expected: ✅ Success

# Trip 4
POST http://localhost:5003/api/trips
{ "title": "Trek 4", ... }
# Expected: ✅ Success

# Trip 5 - Should FAIL
POST http://localhost:5003/api/trips
{ "title": "Trek 5", ... }
# Expected: ❌ 403 "Trip limit reached"
```

---

## 🎯 Quick Troubleshooting

### ❌ "Subscription required" after starting trial
**Fix**: Check subscription status - trial might not be active
```http
GET /api/subscriptions/my
```

### ❌ Trip counter not incrementing
**Fix**: Check logs in backend terminal - should show:
```
✅ Trip count incremented. Used: 1/4. Remaining: 3
```

### ❌ CRM access works on BASIC plan
**Fix**: Should NOT work - CRM requires Premium/Enterprise

### ❌ Backend not starting
**Fix**: Check MongoDB connection and port 5003 availability

---

## 📊 Expected Database State After Test

### OrganizerSubscription Document
```javascript
{
  organizerId: ObjectId("..."),
  plan: "BASIC",
  status: "trial",
  tripsPerCycle: 4,
  tripsUsed: 1,              // ← Should increment
  isTrialActive: true,
  trialEndDate: ISODate("..."), // 60 days from now
  payments: []               // Empty for trial
}
```

### Trip Document
```javascript
{
  _id: ObjectId("..."),
  title: "Himalayan Adventure",
  organizerId: ObjectId("..."), // Same as subscription
  status: "pending",
  price: 12000,
  capacity: 15,
  participants: []
}
```

---

## 🔗 Full Documentation

- **Complete Guide**: [docs/PAYMENT_WORKFLOW.md](docs/PAYMENT_WORKFLOW.md)
- **Implementation Summary**: [PAYMENT_IMPLEMENTATION_COMPLETE.md](PAYMENT_IMPLEMENTATION_COMPLETE.md)
- **Visual Flow**: [WORKFLOW_VERIFICATION_SUMMARY.md](WORKFLOW_VERIFICATION_SUMMARY.md)

---

## 💡 Pro Tips

1. **Use Postman Collections**: Save these requests for repeated testing
2. **Check Backend Logs**: Watch for subscription check logs
3. **Test with Different Plans**: Try STARTER (2 trips) vs PREMIUM (15 trips)
4. **Test Expiry**: Set `trialEndDate` to past date in DB to test expiry
5. **Test Admin Bypass**: Login as admin - should skip all checks

---

**Last Updated**: December 19, 2025  
**Test Duration**: 5 minutes  
**Status**: ✅ Ready to Test
