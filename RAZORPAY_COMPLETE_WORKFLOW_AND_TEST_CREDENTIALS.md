# 🔄 Razorpay Complete Workflow & Test Credentials Guide

**Last Updated:** December 2025
**Status:** ✅ Production Ready
**Version:** 1.0

---

## 📋 Table of Contents

1. [Complete Razorpay Workflow](#complete-razorpay-workflow)
2. [Payment Flow Architecture](#payment-flow-architecture)
3. [Test Credentials](#test-credentials)
4. [KYC Details](#kyc-details)
5. [API Integration Guide](#api-integration-guide)
6. [Settlement & Payouts](#settlement--payouts)
7. [Webhook Handling](#webhook-handling)
8. [Error Codes & Solutions](#error-codes--solutions)
9. [Testing Procedures](#testing-procedures)

---

## 🔄 Complete Razorpay Workflow

### Step-by-Step Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. USER INITIATES PAYMENT (Frontend)                             │
│    - User selects plan                                           │
│    - Clicks "Subscribe" button                                   │
│    - Frontend sends: {planId, name, email, phone}               │
└────────────────────────┬──────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. CREATE ORDER (Backend)                                        │
│    - POST /api/subscriptions/create-order                       │
│    - Backend validates request                                  │
│    - Creates order in Razorpay API                              │
│    - Response: {order_id, amount, key_id}                       │
└────────────────────────┬──────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. OPEN PAYMENT MODAL (Frontend)                                 │
│    - Display Razorpay payment modal                             │
│    - User enters card/bank/UPI details                          │
│    - Modal handles payment process                              │
│    - User confirms payment                                      │
└────────────────────────┬──────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. RAZORPAY PROCESSES PAYMENT                                    │
│    - Charge card/account                                        │
│    - Process payment gateway                                    │
│    - Generate payment ID                                        │
│    - Generate signature                                         │
└────────────────────────┬──────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. FRONTEND SENDS VERIFICATION (Frontend)                        │
│    - POST /api/subscriptions/verify-payment                     │
│    - Send: {order_id, payment_id, signature}                    │
│    - Modal closes                                               │
└────────────────────────┬──────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 6. VERIFY SIGNATURE (Backend)                                    │
│    - Verify Razorpay signature                                  │
│    - Check: HMAC-SHA256(order_id|payment_id, secret)           │
│    - If invalid: Return 402 Payment Required                    │
│    - If valid: Proceed to subscription creation                 │
└────────────────────────┬──────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 7. CREATE SUBSCRIPTION (Backend)                                 │
│    - Save OrganizerSubscription to MongoDB:                      │
│      * organizerId                                              │
│      * paymentId                                                │
│      * orderId                                                  │
│      * plan (STARTER|BASIC|PROFESSIONAL|PREMIUM|ENTERPRISE)    │
│      * amount                                                   │
│      * status: 'active'                                         │
│      * createdAt                                                │
│      * expiresAt (1 month from now)                            │
└────────────────────────┬──────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 8. SEND CONFIRMATION (Backend → Frontend)                        │
│    - Return: {success: true, subscription}                       │
│    - Send confirmation email                                    │
│    - Log transaction                                            │
└────────────────────────┬──────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────────────┐
│ 9. USER DASHBOARD UPDATE (Frontend)                              │
│    - Show: Subscription active                                  │
│    - Show: Plan details                                         │
│    - Show: Expiry date                                          │
│    - Enable: Organizer features                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ 10. SETTLEMENT (Razorpay Automatic)                              │
│     - T+1 Day: Payment settled                                  │
│     - T+2 Days: Funds available for payout                      │
│     - Setup: Razorpay Routes for automatic payouts              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 💳 Payment Flow Architecture

### Frontend Flow

```typescript
// 1. User clicks Subscribe button
const handleSubscribe = async (planId: string) => {
  // 2. Create order on backend
  const orderResponse = await api.post('/subscriptions/create-order', {
    planId,
    name: user.name,
    email: user.email,
    phone: user.phone
  });
  
  // 3. Get Razorpay details
  const { order_id, amount, key_id } = orderResponse.data;
  
  // 4. Open Razorpay modal
  const options = {
    key: key_id,
    amount: amount,
    currency: 'INR',
    order_id: order_id,
    handler: async (response) => {
      // 5. Payment successful, verify on backend
      const verifyResponse = await api.post('/subscriptions/verify-payment', {
        razorpay_order_id: response.razorpay_order_id,
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_signature: response.razorpay_signature
      });
      
      // 6. Update UI
      if (verifyResponse.data.success) {
        setSubscription(verifyResponse.data.subscription);
        showSuccessMessage('Subscription activated!');
      }
    }
  };
  
  // 7. Trigger payment modal
  window.Razorpay(options).open();
};
```

### Backend Flow

```typescript
// Step 1: Create Order Endpoint
app.post('/api/subscriptions/create-order', async (req, res) => {
  const { planId, name, email, phone } = req.body;
  
  // Validate plan
  const plan = PLANS[planId];
  if (!plan) return res.status(400).json({ error: 'Invalid plan' });
  
  // Create Razorpay order
  const order = await razorpay.orders.create({
    amount: plan.price * 100, // Convert to paise
    currency: 'INR',
    receipt: `subscription_${Date.now()}`,
    notes: {
      userId: req.user.id,
      planId: planId,
      email: email,
      name: name
    }
  });
  
  // Return order details
  res.json({
    order_id: order.id,
    amount: order.amount,
    key_id: process.env.RAZORPAY_KEY_ID
  });
});

// Step 2: Verify Payment Endpoint
app.post('/api/subscriptions/verify-payment', async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  
  // Create signature to verify
  const signature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
  
  // Verify signature
  if (signature !== razorpay_signature) {
    return res.status(402).json({ error: 'Payment verification failed' });
  }
  
  // Get order details from Razorpay
  const order = await razorpay.orders.fetch(razorpay_order_id);
  const plan = PLANS[order.notes.planId];
  
  // Create subscription in database
  const subscription = await OrganizerSubscription.create({
    organizerId: req.user.id,
    planId: order.notes.planId,
    plan: plan.name,
    amount: order.amount / 100,
    paymentId: razorpay_payment_id,
    orderId: razorpay_order_id,
    status: 'active',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    createdAt: new Date()
  });
  
  // Return success
  res.json({
    success: true,
    subscription: subscription
  });
});
```

---

## 💾 Test Credentials

### Credit/Debit Card Test Details

#### ✅ Success Scenarios

**Card 1: Standard Success**
```
Card Number:    4111 1111 1111 1111
Expiry Month:   12
Expiry Year:    25 (or any future year)
CVV:            123 (any 3 digits)
OTP:            123456 (when prompted)
Result:         ✅ Payment Succeeds
Amount:         Any amount works
```

**Card 2: International Success (3D Secure)**
```
Card Number:    5555 5555 5555 4444
Expiry:         12/25
CVV:            123
OTP:            123456
Result:         ✅ Payment Succeeds
Note:           Simulates 3D Secure flow
```

**Card 3: Recurring Payment**
```
Card Number:    6011 1111 1111 1117
Expiry:         12/25
CVV:            123
Result:         ✅ Succeeds for recurring
```

#### ❌ Failure Scenarios

**Card 4: Payment Declined**
```
Card Number:    4000 0000 0000 0002
Expiry:         12/25
CVV:            123
Result:         ❌ Declined
Error:          Payment declined by issuer
```

**Card 5: Insufficient Funds**
```
Card Number:    4000 0000 0000 0069
Expiry:         12/25
CVV:            123
Result:         ❌ Insufficient Funds
Error:          Not sufficient funds
```

**Card 6: Lost/Stolen Card**
```
Card Number:    4000 0000 0000 0010
Expiry:         12/25
CVV:            123
Result:         ❌ Card Blocked
Error:          Card lost or stolen
```

**Card 7: Invalid CVV**
```
Card Number:    4111 1111 1111 1111
Expiry:         12/25
CVV:            999
Result:         ❌ Invalid CVV
Error:          Invalid security code
```

### Bank Account Test Details (for Routes/Payouts)

#### Valid Test Bank Accounts

**Account 1: HDFC Bank**
```
Account Number:         123456789012
Account Holder Name:    Saksham Kumar
IFSC Code:              HDFC0001234
Bank Name:              HDFC Bank
Account Type:           Savings
Business Type:          Proprietorship
Status:                 ✅ Valid
```

**Account 2: ICICI Bank**
```
Account Number:         987654321098
Account Holder Name:    Rajesh Sharma
IFSC Code:              ICIC0000001
Bank Name:              ICICI Bank
Account Type:           Current
Business Type:          Pvt Ltd
Status:                 ✅ Valid
```

**Account 3: State Bank of India**
```
Account Number:         555555555555
Account Holder Name:    Priya Patel
IFSC Code:              SBIN0001234
Bank Name:              State Bank of India
Account Type:           Savings
Business Type:          Partnership
Status:                 ✅ Valid
```

**Account 4: AXIS Bank**
```
Account Number:         666666666666
Account Holder Name:    Vikram Singh
IFSC Code:              AXIS0001234
Bank Name:              AXIS Bank
Account Type:           Current
Business Type:          LLP
Status:                 ✅ Valid
```

### UPI Test Details

**UPI 1: Success**
```
UPI ID:         success@razorpay
VPA:            success@upi
Result:         ✅ Payment Succeeds
Amount:         Any amount
```

**UPI 2: Declined**
```
UPI ID:         fail@razorpay
VPA:            fail@upi
Result:         ❌ Transaction Declined
Error:          User declined transaction
```

### Wallet Test Details

**Wallet 1: Success**
```
Wallet:         Razorpay Test Wallet
Amount:         ₹10,000 (test balance)
Result:         ✅ Payment Succeeds
```

---

## 👤 KYC Details

### Individual (Proprietorship)

#### Sample 1: Trek Explorer Services
```
Full Name:              Saksham Kumar
Date of Birth:          January 15, 1992
Gender:                 Male
Nationality:            Indian

Address:
  Street:               456 Adventure Road
  City:                 Pune
  State:                Maharashtra
  Postal Code:          411001
  Country:              India

Aadhar Number:          123456789012
PAN:                    ABCDE1234F
Mobile:                 +91 98765 43210
Email:                  saksham.kumar@trekexplorers.com

Business Details:
  Business Type:        Proprietorship
  Legal Name:           Trek Explorer Services
  Business Address:     Same as residential
  GST Number:           18AABCT1234H1Z0
  Annual Turnover:      ₹25,00,000

Bank Account:
  Account Number:       123456789012
  IFSC Code:            HDFC0001234
  Account Holder:       Saksham Kumar
  Account Type:         Savings
```

#### Sample 2: Adventure Trips India
```
Full Name:              Rajesh Sharma
Date of Birth:          March 22, 1988
Gender:                 Male
Nationality:            Indian

Address:
  Street:               789 Explorer Lane
  City:                 Bangalore
  State:                Karnataka
  Postal Code:          560001
  Country:              India

Aadhar Number:          234567890123
PAN:                    BCDEF2345G
Mobile:                 +91 97654 32109
Email:                  rajesh@adventuretripsindia.com

Business Details:
  Business Type:        Proprietorship
  Legal Name:           Adventure Trips India
  Business Address:     Same as residential
  GST Number:           29AABCT2345H2Z0
  Annual Turnover:      ₹40,00,000

Bank Account:
  Account Number:       987654321098
  IFSC Code:            ICIC0000001
  Account Holder:       Rajesh Sharma
  Account Type:         Current
```

### Partnership

#### Sample 3: Mountain Expeditions Partners
```
Partnership Name:       Mountain Expeditions Partners
Partnership Type:       Partnership
Number of Partners:     2

Partner 1:
  Name:                 Priya Patel
  DOB:                  May 10, 1990
  Mobile:               +91 96543 21098
  Email:                priya@mountainexp.com

Partner 2:
  Name:                 Vikram Singh
  DOB:                  July 25, 1989
  Mobile:               +91 95432 10987
  Email:                vikram@mountainexp.com

Address:
  Street:               321 Peak View
  City:                 Manali
  State:                Himachal Pradesh
  Postal Code:          175131
  Country:              India

Partnership Deed:       Filed with Registrar
Registration Number:    HP-123-4567
PAN:                    AABCP1234H
GST Number:             02AABCP1234H1Z0

Bank Account:
  Account Number:       555555555555
  IFSC Code:            SBIN0001234
  Account Holder:       Mountain Expeditions Partners
  Account Type:         Savings
```

### Private Limited Company

#### Sample 4: Himalayan Ventures Pvt Ltd
```
Company Name:           Himalayan Ventures Pvt Ltd
Company Type:           Private Limited
CIN:                    U79900DL2020PTC000123
Incorporation Date:     January 15, 2020

Directors:
  Director 1:
    Name:               Arjun Reddy
    DIN:                12345678
    Mobile:             +91 94321 09876
    Email:              arjun.reddy@himalayanventures.com

  Director 2:
    Name:               Neha Gupta
    DIN:                23456789
    Mobile:             +91 93210 98765
    Email:              neha.gupta@himalayanventures.com

Registered Address:
  Street:               567 Corporate Park
  City:                 Delhi
  State:                Delhi
  Postal Code:          110001
  Country:              India

PAN:                    AABCH1234H
GST Number:             07AABCH1234H1Z0
Annual Turnover:        ₹1,00,00,000

Bank Account:
  Account Number:       666666666666
  IFSC Code:            AXIS0001234
  Account Holder:       Himalayan Ventures Pvt Ltd
  Account Type:         Current
  Authorized Signatory: Arjun Reddy
```

### Limited Liability Partnership (LLP)

#### Sample 5: Adventure Trails LLP
```
LLP Name:               Adventure Trails LLP
LLP Identification Number: AAP-0123456
Registration Date:      June 20, 2019

Designated Partners:
  Partner 1:
    Name:               Neetu Malhotra
    DIN:                34567890
    Mobile:             +91 92109 87654
    Email:              neetu@adventuretrails.com

  Partner 2:
    Name:               Sanjay Verma
    DIN:                45678901
    Mobile:             +91 91098 76543
    Email:              sanjay@adventuretrails.com

Registered Office:
  Street:               890 Business Hub
  City:                 Mumbai
  State:                Maharashtra
  Postal Code:          400001
  Country:              India

PAN:                    AABCL1234H
GST Number:             27AABCL1234H1Z0
Annual Turnover:        ₹75,00,000

Bank Account:
  Account Number:       777777777777
  IFSC Code:            HDFC0002345
  Account Holder:       Adventure Trails LLP
  Account Type:         Current
```

---

## 🔗 API Integration Guide

### Step 1: Install Razorpay SDK

```bash
npm install razorpay
```

### Step 2: Initialize Razorpay

```typescript
import Razorpay from 'razorpay';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});
```

### Step 3: Create Order

```typescript
const order = await razorpay.orders.create({
  amount: 49900, // ₹499 in paise
  currency: 'INR',
  receipt: `subscription_${Date.now()}`,
  notes: {
    userId: user_id,
    planId: 'STARTER',
    email: user_email
  }
});
```

### Step 4: Generate Signature

```typescript
import crypto from 'crypto';

const generateSignature = (order_id: string, payment_id: string): string => {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  const message = `${order_id}|${payment_id}`;
  
  const signature = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');
  
  return signature;
};
```

### Step 5: Verify Payment

```typescript
const verifyPayment = (
  razorpay_order_id: string,
  razorpay_payment_id: string,
  razorpay_signature: string
): boolean => {
  const signature = generateSignature(razorpay_order_id, razorpay_payment_id);
  return signature === razorpay_signature;
};
```

---

## 💰 Settlement & Payouts (Razorpay Routes)

### How Settlement Works

```
Day 0 (Payment Day):
  └─ Customer pays ₹499
  └─ Razorpay processes payment
  └─ Money goes to Razorpay escrow account

Day 1:
  └─ Settlement initiated
  └─ Razorpay charges fee (1.85%)
  └─ Amount settled: ₹489.77

Day 2:
  └─ Funds transferred to bank account
  └─ Organizer receives money
  └─ Transaction complete ✅
```

### Routes Integration (Automatic Payouts)

```typescript
// Step 1: Create Route for Organizer

const createRoute = async (organizerId: string, bankDetails: any) => {
  const route = await razorpay.transfers.recipient({
    account_number: bankDetails.accountNumber,
    ifsc: bankDetails.ifscCode,
    name: bankDetails.accountHolderName,
    email: user.email,
    contact: user.phone,
    type: 'bank_account'
  });
  
  return route;
};

// Step 2: Setup Automatic Payouts

const setupAutomaticPayout = async (
  paymentId: string,
  routeId: string,
  amount: number
) => {
  // Create transfer from Razorpay account to organizer
  const transfer = await razorpay.transfers.create({
    account: routeId,
    amount: amount * 100, // in paise
    currency: 'INR',
    source: 'payment',
    source_id: paymentId,
    recipient_settlement_id: 'settlement_id'
  });
  
  return transfer;
};

// Step 3: Track Payout Status

const getPayoutStatus = async (transferId: string) => {
  const transfer = await razorpay.transfers.fetch(transferId);
  
  return {
    status: transfer.status, // 'created' | 'processed' | 'failed'
    amount: transfer.amount / 100,
    createdAt: transfer.created_at,
    processedAt: transfer.processed_at
  };
};
```

### Payout Statuses

```
'created':   Transfer created, pending settlement
'processed': Transfer settled, money in bank account
'failed':    Transfer failed, requires action
'reversed':  Transfer reversed, money returned
```

---

## 🔔 Webhook Handling

### Setup Webhook Endpoint

```typescript
app.post('/api/webhooks/razorpay', (req: any, res: any) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = req.headers['x-razorpay-signature'];
  const body = req.rawBody; // Must be raw body, not parsed
  
  // Verify webhook signature
  const hash = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
  
  if (hash !== signature) {
    return res.status(400).json({ error: 'Invalid signature' });
  }
  
  const event = req.body.event;
  const data = req.body.payload.payment.entity;
  
  switch (event) {
    case 'payment.authorized':
      handlePaymentAuthorized(data);
      break;
    case 'payment.failed':
      handlePaymentFailed(data);
      break;
    case 'payment.captured':
      handlePaymentCaptured(data);
      break;
    case 'settlement.processed':
      handleSettlementProcessed(data);
      break;
    case 'transfer.processed':
      handleTransferProcessed(data);
      break;
  }
  
  res.json({ received: true });
});
```

### Webhook Events to Listen

```
payment.authorized    - Payment authorized
payment.failed        - Payment failed
payment.captured      - Payment captured (money received)
settlement.processed  - Settlement completed
transfer.processed    - Payout transfer processed
subscription.created  - Subscription created
subscription.paused   - Subscription paused
subscription.resumed  - Subscription resumed
subscription.cancelled - Subscription cancelled
```

---

## ⚠️ Error Codes & Solutions

### Payment Errors

| Error Code | Error Message | Solution |
|-----------|---------------|----------|
| BAD_REQUEST_ERROR | Invalid request | Check parameter names and values |
| GATEWAY_ERROR | Gateway error | Retry payment, contact support |
| INVALID_CARD | Invalid card | Try different card |
| INSUFFICIENT_FUNDS | Insufficient funds | Use card with sufficient balance |
| CARD_DECLINED | Card declined | Contact bank, try different card |
| AUTHENTICATION_ERROR | Authentication failed | Enter correct OTP/3D Secure |
| NETWORK_ERROR | Network error | Check internet connection, retry |
| TIMEOUT_ERROR | Request timed out | Retry payment |

### Signature Verification Errors

| Error | Cause | Solution |
|-------|-------|----------|
| Signature mismatch | Order/Payment ID changed | Ensure exact IDs are sent |
| Invalid secret | Wrong key secret | Verify RAZORPAY_KEY_SECRET env var |
| Order not found | Order ID doesn't exist | Ensure order was created first |
| Payment not found | Payment ID doesn't exist | Wait for payment to be processed |

### Routes/Payout Errors

| Error | Cause | Solution |
|-------|-------|----------|
| Invalid account number | Wrong account format | Check account number format |
| Invalid IFSC code | Invalid IFSC | Use correct 11-char IFSC code |
| Account verification failed | Account details mismatch | Verify exact account holder name |
| Bank error | Bank rejected transfer | Contact bank, verify account |
| Insufficient balance | Not enough funds to transfer | Fund Razorpay account |

---

## 🧪 Testing Procedures

### Complete Payment Test Flow

**Duration:** 5 minutes

```
Step 1: Create Order
  POST /api/subscriptions/create-order
  Body: {
    planId: 'PROFESSIONAL',
    name: 'Test User',
    email: 'test@example.com',
    phone: '+919999999999'
  }
  Expected: 200 OK with order_id
  ✅ Verify: order_id exists, amount correct

Step 2: Get Payment Modal Details
  Response contains: order_id, amount, key_id
  ✅ Verify: All three values present

Step 3: Open Razorpay Modal
  - Initialize with: order_id, amount, key_id
  - Use test card: 4111 1111 1111 1111
  - Expiry: 12/25, CVV: 123
  ✅ Verify: Modal opens, payment form shows

Step 4: Complete Payment
  - Enter card details
  - Submit payment
  - Enter OTP: 123456 (if prompted)
  ✅ Verify: Modal closes, success callback fires

Step 5: Verify Payment
  POST /api/subscriptions/verify-payment
  Body: {
    razorpay_order_id: 'order_id_from_payment',
    razorpay_payment_id: 'payment_id_from_payment',
    razorpay_signature: 'signature_from_payment'
  }
  Expected: 200 OK with {success: true, subscription}
  ✅ Verify: Signature valid, subscription created

Step 6: Check Database
  GET /api/subscriptions/my-subscription
  Expected: Subscription record with:
    - status: 'active'
    - plan: 'PROFESSIONAL'
    - expiresAt: Future date
  ✅ Verify: All fields correct
```

### Subscription Lifecycle Test

```
Test 1: Trial Activation
  Action: Click "Start Trial"
  Expected: Trial subscription created (0 payment)
  Status: 'trial'
  isTrialActive: true
  ✅ Pass

Test 2: Trial to Paid Conversion
  Action: From trial, click "Upgrade to Paid"
  Expected: Old trial cancelled, new paid created
  Status: 'active'
  ✅ Pass

Test 3: Check Organizer Features
  Action: Login as organizer with active subscription
  Expected: Can access:
    - CRM (if PROFESSIONAL or higher)
    - Analytics (if PROFESSIONAL or higher)
    - Route Onboarding
  ✅ Pass

Test 4: Check Traveller Access
  Action: Login as traveller
  Expected: Cannot see subscription options
    - All features visible (no paywall)
  ✅ Pass
```

### Payout Test Flow

```
Step 1: Setup Bank Account (Route Onboarding)
  POST /api/marketplace/organizer/onboard
  Body: {
    legalBusinessName: 'Trek Explorer Services',
    businessType: 'proprietorship',
    bankAccount: {
      accountNumber: '123456789012',
      ifscCode: 'HDFC0001234',
      accountHolderName: 'Saksham Kumar',
      bankName: 'HDFC Bank'
    }
  }
  Expected: 200 OK with {success: true, accountId}
  ✅ Verify: Account linked to Razorpay

Step 2: Simulate Payment & Settlement
  - Process payment from traveller
  - Razorpay automatically initiates settlement
  - T+1 day: Settlement processed
  ✅ Verify: Transfer status = 'processed'

Step 3: Check Payout Status
  GET /api/payouts/status
  Expected: Shows payout transfers
    - Amount: ₹[amount - fees]
    - Status: 'processed'
    - Date: Settlement date
  ✅ Verify: Organizer received funds
```

---

## 📊 Sample Request/Response Examples

### Create Order Request

```bash
curl -X POST http://localhost:5000/api/subscriptions/create-order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [token]" \
  -d '{
    "planId": "PROFESSIONAL",
    "name": "Saksham Kumar",
    "email": "saksham@example.com",
    "phone": "+919876543210"
  }'
```

### Create Order Response

```json
{
  "success": true,
  "data": {
    "order_id": "order_00000000000001",
    "amount": 219900,
    "currency": "INR",
    "key_id": "rzp_test_XXXXXXXXXX",
    "plan": "PROFESSIONAL",
    "amount_display": "₹2,199"
  }
}
```

### Verify Payment Request

```bash
curl -X POST http://localhost:5000/api/subscriptions/verify-payment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [token]" \
  -d '{
    "razorpay_order_id": "order_00000000000001",
    "razorpay_payment_id": "pay_00000000000001",
    "razorpay_signature": "9ef4dffbfd84f1318f6739a3ce19f9d85851857ae648f114332d8401e0949a3d"
  }'
```

### Verify Payment Response

```json
{
  "success": true,
  "data": {
    "subscription": {
      "_id": "sub_00000000000001",
      "organizerId": "user_123",
      "plan": "PROFESSIONAL",
      "planId": "PROFESSIONAL",
      "amount": 2199,
      "status": "active",
      "paymentId": "pay_00000000000001",
      "orderId": "order_00000000000001",
      "createdAt": "2025-12-13T10:30:00Z",
      "expiresAt": "2026-01-13T10:30:00Z"
    }
  }
}
```

### Route Onboarding Request

```bash
curl -X POST http://localhost:5000/api/marketplace/organizer/onboard \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [token]" \
  -d '{
    "legalBusinessName": "Trek Explorer Services",
    "businessType": "proprietorship",
    "bankAccount": {
      "accountNumber": "123456789012",
      "ifscCode": "HDFC0001234",
      "accountHolderName": "Saksham Kumar",
      "bankName": "HDFC Bank"
    }
  }'
```

### Route Onboarding Response

```json
{
  "success": true,
  "data": {
    "accountId": "acc_1234567890abcdef",
    "status": "created",
    "kycStatus": "pending_verification",
    "accountDetails": {
      "accountNumber": "123456789012",
      "ifscCode": "HDFC0001234",
      "accountHolderName": "Saksham Kumar"
    }
  }
}
```

---

## 🔐 Environment Variables Required

```env
# Razorpay Keys (Test/Production)
RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXX
RAZORPAY_KEY_SECRET=XXXXXXXXXXXXXXXX

# Razorpay Webhook
RAZORPAY_WEBHOOK_SECRET=XXXXXXXXXXXXXXXX

# Database
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/database

# JWT
JWT_SECRET=your_jwt_secret_key

# Email (Optional)
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

---

## 📚 Quick Reference Commands

### Test Payment with curl

```bash
# 1. Create Order
curl -X POST http://localhost:5000/api/subscriptions/create-order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"planId":"PROFESSIONAL","name":"Test","email":"test@test.com","phone":"+919999999999"}'

# 2. Verify Payment (after payment)
curl -X POST http://localhost:5000/api/subscriptions/verify-payment \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"razorpay_order_id":"order_id","razorpay_payment_id":"pay_id","razorpay_signature":"signature"}'

# 3. Check Subscription Status
curl -X GET http://localhost:5000/api/subscriptions/my-subscription \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## ✅ Final Checklist

Before going live:

- [ ] Razorpay test keys configured
- [ ] Test payment processed successfully
- [ ] Bank account linked via Routes
- [ ] Signature verification working
- [ ] Webhook endpoint configured
- [ ] Settlement date confirmed (T+1)
- [ ] Payout account verified
- [ ] All error codes handled
- [ ] Confirmation emails sending
- [ ] Subscription status shows correctly

---

## 📞 Support & Documentation

**Razorpay Official Docs:** https://razorpay.com/docs/
**Razorpay Dashboard:** https://dashboard.razorpay.com
**Test Credentials:** https://razorpay.com/docs/payments/payment-gateway/test-card-numbers/
**Routes Documentation:** https://razorpay.com/docs/route/getting-started/

---

**Last Updated:** December 2025
**Status:** Production Ready
**Version:** 1.0

🚀 Ready to process payments securely!
