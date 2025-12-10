# Trek Tribe - Complete System Architecture

## 🏗️ High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER TIER                                      │
│                                                                          │
│  ┌──────────────────┐                    ┌──────────────────────────┐  │
│  │   Trip Seeker    │                    │   Trip Organizer        │  │
│  │   (Customer)     │                    │   (Subscriber)          │  │
│  └────────┬─────────┘                    └──────────┬───────────────┘  │
│           │                                         │                   │
│           │ Browse/Book/Inquire                     │ Subscribe/Create  │
│           │                                         │ Trips/Manage CRM  │
└───────────┼─────────────────────────────────────────┼──────────────────┘
            │                                         │
            ▼                                         ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                      FRONTEND TIER (React 18)                            │
│                                                                           │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────────┐   │
│  │  Home.tsx       │  │  TripDetails.tsx │  │ AutoPaySetup.tsx     │   │
│  │  (Browse trips) │  │  (Inquiry form)  │  │ (Payment & Plans)    │   │
│  └────────┬────────┘  └────────┬─────────┘  └──────────┬───────────┘   │
│           │                    │                        │                │
│           └────────────────────┼────────────────────────┘                │
│                                │                                         │
│                    ┌───────────▼─────────────┐                          │
│                    │  CRMDashboard.tsx       │                          │
│                    │  - Lead management      │                          │
│                    │  - Status updates       │                          │
│                    │  - Search & filters     │                          │
│                    │  - Stats dashboard      │                          │
│                    │  - Verification        │                          │
│                    └───────────┬─────────────┘                          │
│                                │                                         │
│  Context Layer:                │                                         │
│  ┌──────────────────────────────▼────────────────────────┐              │
│  │ AuthContext                                           │              │
│  │ - JWT token storage                                  │              │
│  │ - User state management                              │              │
│  │ - Login/logout/refresh                               │              │
│  └──────────────────────────────────────────────────────┘              │
│                                │                                         │
│  API Client:                   │                                         │
│  ┌──────────────────────────────▼────────────────────────┐              │
│  │ api.ts (Axios wrapper)                               │              │
│  │ - Base URL configuration                             │              │
│  │ - JWT token injection                                │              │
│  │ - Error handling                                     │              │
│  │ - Request/response interceptors                      │              │
│  └─────────────────────┬────────────────────────────────┘              │
│                        │                                               │
└────────────────────────┼───────────────────────────────────────────────┘
                         │
                    HTTP/REST API
                         │
┌────────────────────────▼───────────────────────────────────────────────┐
│                    BACKEND TIER (Node.js + Express)                    │
│                                                                         │
│  Routes:                                                               │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │ /api/subscriptions                                               │ │
│  │ ├─ POST /subscribe (new subscription)                           │ │
│  │ ├─ GET /my (get user subscription)                              │ │
│  │ ├─ POST /webhook (Razorpay webhook)                             │ │
│  │ └─ GET /verify-crm-access (check CRM eligibility)              │ │
│  │                                                                  │ │
│  │ /api/crm                                                        │ │
│  │ ├─ GET /leads (fetch all leads)                                │ │
│  │ ├─ POST /leads (create lead)                                   │ │
│  │ ├─ PUT /leads/:id (update lead)                                │ │
│  │ ├─ POST /leads/:id/verify (verify lead)                        │ │
│  │ └─ GET /stats (get CRM statistics)                             │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  Controllers:                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │ subscriptionController.ts                                        │ │
│  │ ├─ createSubscription()                                          │ │
│  │ ├─ processWebhook()                                              │ │
│  │ ├─ verifySubscriptionAccess()                                    │ │
│  │ └─ getSubscriptionDetails()                                      │ │
│  │                                                                  │ │
│  │ leadController.ts                                                │ │
│  │ ├─ getLeads()                                                    │ │
│  │ ├─ createLead()                                                  │ │
│  │ ├─ updateLead()                                                  │ │
│  │ ├─ verifyLead()                                                  │ │
│  │ └─ calculateStats()                                              │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  Middleware:                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │ authenticateToken - JWT verification                            │ │
│  │ requireCRMAccess - Check subscription tier                      │ │
│  │ errorHandler - Centralized error handling                       │ │
│  │ requestLogger - Audit logging                                   │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  External Services:                                                    │
│  ┌──────────────────────────────────────────────────────────────────┐ │
│  │ Razorpay Payment Gateway                                         │ │
│  │ ├─ Create Order                                                  │ │
│  │ ├─ Verify Payment                                                │ │
│  │ ├─ Webhook Handler (payment.authorized event)                  │ │
│  │ └─ Signature Verification (HMAC-SHA256)                         │ │
│  │                                                                  │ │
│  │ Email Service                                                    │ │
│  │ ├─ Payment confirmation emails                                  │ │
│  │ └─ Plan upgrade notifications                                   │ │
│  └──────────────────────────────────────────────────────────────────┘ │
│                                                                         │
└────────────────────────────────────┬────────────────────────────────────┘
                                      │
                              MongoDB Queries
                                      │
┌─────────────────────────────────────▼────────────────────────────────────┐
│                    DATABASE TIER (MongoDB)                               │
│                                                                           │
│  Collections:                                                            │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ organizersubscriptions                                          │   │
│  │                                                                 │   │
│  │ {                                                               │   │
│  │   _id: ObjectId,                                                │   │
│  │   userId: "user_123",                    ◄── Organizer User   │   │
│  │   planType: "PROFESSIONAL",              ◄── 5 tiers         │   │
│  │   price: 2199,                           ◄── In INR          │   │
│  │   trips: 6,                              ◄── Trip slots      │   │
│  │   tripsUsed: 2,                          ◄── Usage tracking  │   │
│  │   crmAccess: true,                       ◄── Feature flag    │   │
│  │   leadCapture: true,                                          │   │
│  │   phoneNumbers: true,                                         │   │
│  │   status: "active",                      ◄── Payment status  │   │
│  │   paymentId: "pay_xxx",                  ◄── Razorpay ID    │   │
│  │   createdAt: ISODate("2024-01-15"),                           │   │
│  │   expiresAt: ISODate("2024-02-15")                            │   │
│  │ }                                                               │   │
│  │                                                                 │   │
│  │ Indexes:                                                        │   │
│  │ - { userId: 1, status: 1 }  [Fast user lookup]               │   │
│  │ - { userId: 1, planType: 1 }  [Plan queries]                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ leads                                                           │   │
│  │                                                                 │   │
│  │ {                                                               │   │
│  │   _id: ObjectId,                                                │   │
│  │   organizerId: "user_123",               ◄── Organizer ref   │   │
│  │   name: "John Doe",                      ◄── Contact name    │   │
│  │   email: "john@example.com",             ◄── Contact email   │   │
│  │   phone: "9999999999",                   ◄── Contact phone   │   │
│  │   tripId: "trip_456",                    ◄── Trip reference  │   │
│  │   tripName: "Himalayas Trek",                                  │   │
│  │   status: "interested",                  ◄── 5 statuses      │   │
│  │   verified: true,                        ◄── Verification    │   │
│  │   verifiedAt: ISODate("2024-01-16"),                          │   │
│  │   notes: "Customer very interested",     ◄── Internal notes  │   │
│  │   createdAt: ISODate("2024-01-15"),                           │   │
│  │   updatedAt: ISODate("2024-01-16")                            │   │
│  │ }                                                               │   │
│  │                                                                 │   │
│  │ Indexes:                                                        │   │
│  │ - { organizerId: 1, createdAt: -1 }  [Fast lead lookup]      │   │
│  │ - { organizerId: 1, status: 1 }  [Status filtering]          │   │
│  │ - { email: 1 }  [Email uniqueness]                           │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ payments                                                        │   │
│  │                                                                 │   │
│  │ {                                                               │   │
│  │   _id: ObjectId,                                                │   │
│  │   userId: "user_123",                                           │   │
│  │   amount: 2199,                                                 │   │
│  │   currency: "INR",                                              │   │
│  │   planType: "PROFESSIONAL",                                     │   │
│  │   paymentId: "pay_xxx",                  ◄── Razorpay ID    │   │
│  │   orderId: "order_yyy",                  ◄── Order ID       │   │
│  │   status: "completed",                   ◄── Payment status  │   │
│  │   method: "card",                        ◄── Payment method  │   │
│  │   createdAt: ISODate("2024-01-15")                            │   │
│  │ }                                                               │   │
│  │                                                                 │   │
│  │ Indexes:                                                        │   │
│  │ - { userId: 1, createdAt: -1 }                                │   │
│  │ - { paymentId: 1 } [Unique]                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ useractivity                                                    │   │
│  │                                                                 │   │
│  │ {                                                               │   │
│  │   _id: ObjectId,                                                │   │
│  │   userId: "user_123",                                           │   │
│  │   activityType: "trip_creation",         ◄── Activity type   │   │
│  │   description: "Created Himalayas Trek",                        │   │
│  │   metadata: { tripId: "trip_456" },     ◄── Additional data  │   │
│  │   createdAt: ISODate("2024-01-15")                            │   │
│  │ }                                                               │   │
│  │                                                                 │   │
│  │ Indexes:                                                        │   │
│  │ - { userId: 1, createdAt: -1 }                                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Diagrams

### Flow 1: Payment & Subscription Creation

```
User Registration
    │
    ▼
Organizer views plans
    │
    ├─── STARTER (₹599) ───────────────────────┐
    ├─── BASIC (₹1299) ─────────────────────┐  │
    ├─── PROFESSIONAL (₹2199) ──┐ CRM Access│  │ No CRM
    ├─── PREMIUM (₹3999) ───────┤ Enabled   │  │
    ├─── ENTERPRISE (₹9999) ─┐  │           │  │
    │                        │  ▼           ▼  ▼
    │                        └─→ Razorpay Payment
    │                           Gateway
    │                           │
    │                           ▼
    │                     Card verification
    │                           │
    │                    ┌──────┴──────┐
    │                    │             │
    │              Success         Failure
    │                │                │
    │                ▼                ▼
    │         Razorpay sends    Error notification
    │         webhook event           │
    │              │                  │
    │              ▼                  ▼
    │    Backend validates      User can retry
    │    signature & status
    │              │
    │              ▼
    │    Create subscription
    │    in MongoDB
    │              │
    │              ▼
    │    Grant CRM access
    │    (if PROFESSIONAL+)
    │              │
    │              ▼
    │    Send confirmation email
    │              │
    │              ▼
    └──────────→ User redirected to
                 organizer dashboard
```

### Flow 2: Lead Creation & Management

```
Customer views trip details
    │
    ▼
Customer submits inquiry
    │
    ▼
Backend creates lead
    │
    ├─ Check organizer has CRM access
    │
    ├─ If NO → Lead stored (CRM disabled)
    │
    └─ If YES (PROFESSIONAL+) → Lead visible in CRM
                    │
                    ▼
          CRM Dashboard loads
                    │
                    ▼
          Display leads table
          ├─ Status: new
          ├─ Search by name/email/phone
          ├─ Filter by status
          │
                    ▼
          Organizer clicks lead
                    │
          ┌─────────┼─────────┐
          │         │         │
          ▼         ▼         ▼
       Update    Verify    Add Notes
       Status     Lead
          │         │         │
    ┌─────┴─────────┴─────────┘
    │
    ▼
API call to backend
    │
    ├─ PUT /api/crm/leads/:id
    │ └─ Update status/notes
    │
    ├─ POST /api/crm/leads/:id/verify
    │ └─ Mark as verified
    │
    └─ Backend updates MongoDB
                    │
                    ▼
         Stats dashboard updates
         ├─ Total leads: +1
         ├─ Lead status breakdown
         └─ Conversion rate: (qualified/total)*100
```

### Flow 3: Trip Limit Enforcement

```
Organizer clicks "Create Trip"
    │
    ▼
Backend checks subscription
    │
    ├─ Query: SELECT trips, tripsUsed FROM subscription
    │
    ▼
Compare tripsUsed < trips
    │
    ├─── YES (available slots)
    │    │
    │    ▼
    │  Trip creation form
    │    │
    │    ▼
    │  User submits trip
    │    │
    │    ▼
    │  Backend creates trip +
    │  Increments tripsUsed
    │    │
    │    ▼
    │  SUCCESS
    │
    └─── NO (no slots available)
         │
         ▼
      Show error message:
      "Upgrade your plan to create more trips"
         │
         ▼
      Button to upgrade
```

---

## 🔐 Security Architecture

```
Request comes in (HTTP)
    │
    ▼
HTTPS/TLS encryption
    │
    ▼
Extract JWT token from header
    │
    ▼
Verify JWT signature & expiry
    │
    ├─ Invalid → Return 401 Unauthorized
    │
    └─ Valid → Continue
         │
         ▼
    Extract user ID from token
    │
    ▼
Check route requires CRM access?
    │
    ├─ YES → Query DB for CRM permission
    │        ├─ No CRM access → Return 403 Forbidden
    │        └─ Has CRM access → Continue
    │
    └─ NO → Continue
         │
         ▼
    Execute controller method
         │
    ┌────┴──────────────────┐
    │                       │
    ▼                       ▼
  If Razorpay     If regular CRUD
  webhook            │
    │                ▼
    ▼         Database operation
Verify HMAC    (Get leads, update
signature      lead status, etc.)
(SHA256)           │
    │              ▼
    ├─ Invalid   Return success
    │ → Reject   response
    │
    └─ Valid
      → Process
        webhook
```

---

## 📊 Payment Processing Architecture

```
Payment Request
    │
    ▼
Create Razorpay Order
    ├─ amount: 2199 (₹)
    ├─ currency: "INR"
    ├─ customer_id: organizer_123
    └─ metadata: { planType: "PROFESSIONAL" }
    │
    ▼
Return Order ID + Key to frontend
    │
    ▼
Frontend shows Razorpay checkout
    │
    ├─ User enters card details
    │
    ▼
User clicks "Pay"
    │
    ▼
Razorpay processes payment
    │
    ├─────────────────────┬─────────────────────┐
    │                     │                     │
    ▼                     ▼                     ▼
  AUTHORIZED         FAILED             DECLINED
    │                   │                   │
    ▼                   ▼                   ▼
Send webhook:    Error page        Error page
payment.       "Try again"        "Card declined"
authorized        │                   │
    │              ▼                   ▼
    ▼        Frontend retries    Frontend retries
Backend         payment           payment
receives
webhook
    │
    ▼
Verify signature:
HMAC-SHA256(
  webhook_body,
  secret_key
)
    │
    ├─ Signature invalid → Log & discard
    │
    └─ Signature valid
         │
         ▼
      Verify payment status
      in Razorpay API
         │
         ├─ Status != "captured" → End
         │
         └─ Status == "captured"
              │
              ▼
          Create subscription
          ├─ organizersubscriptions.insert({
          │    userId, planType, price, trips,
          │    crmAccess, status, createdAt,
          │    expiresAt
          │  })
          │
          ▼
        Send confirmation email
              │
              ▼
          Log to audit trail
              │
              ▼
        SUCCESS - Organizer has
        active subscription + CRM
        access (if PROFESSIONAL+)
```

---

## 🗄️ Database Relationships

```
┌──────────────────────┐
│      Users           │
│                      │
│ _id                  │
│ email                │
│ role: organizer      │
│ createdAt            │
└──────────┬───────────┘
           │ (1 user → many subscriptions)
           │
           ▼
┌──────────────────────────────────┐
│  OrganizerSubscriptions          │
│                                  │
│ _id                              │
│ userId (FK → Users)              │
│ planType (PROFESSIONAL, etc.)    │
│ price (2199)                     │
│ trips (6)                        │
│ tripsUsed (2)                    │
│ crmAccess (true/false)           │
│ status (active, expired)         │
│ paymentId (from Razorpay)        │
│ expiresAt                        │
└──────┬─────────────────────┬─────┘
       │                     │
       │ (1 subscription     │
       │  → many leads)      │ (1 subscription
       │                     │  → many payments)
       ▼                     ▼
┌────────────────────┐  ┌──────────────────┐
│    Leads           │  │    Payments      │
│                    │  │                  │
│ _id                │  │ _id              │
│ organizerId (FK)   │  │ userId (FK)      │
│ name               │  │ amount (2199)    │
│ email              │  │ planType         │
│ phone              │  │ paymentId        │
│ tripId             │  │ orderId          │
│ status             │  │ status           │
│ verified           │  │ method           │
│ notes              │  │ createdAt        │
│ createdAt          │  └──────────────────┘
│ updatedAt          │
└────────────────────┘
```

---

## 🎯 API Endpoint Summary

### Subscription Endpoints
```
POST   /api/subscriptions/create
       ├─ Body: { planType, amount }
       └─ Response: { orderId, paymentUrl }

POST   /api/subscriptions/webhook
       ├─ Body: Razorpay webhook payload
       ├─ Verify: HMAC-SHA256 signature
       └─ Action: Create subscription in DB

GET    /api/subscriptions/verify-crm-access
       └─ Response: { hasCRMAccess, planType }

GET    /api/subscriptions/my
       └─ Response: { planType, trips, expiresAt }
```

### CRM Endpoints
```
GET    /api/crm/leads
       └─ Response: Array of leads for organizer

GET    /api/crm/leads?status=interested
       └─ Response: Filtered leads by status

POST   /api/crm/leads
       ├─ Body: { name, email, phone, tripId }
       └─ Response: { leadId, status }

PUT    /api/crm/leads/:id
       ├─ Body: { status, notes }
       └─ Response: Updated lead object

POST   /api/crm/leads/:id/verify
       └─ Response: Lead with verified: true

GET    /api/crm/stats
       └─ Response: { totalLeads, newLeads, ... }
```

---

This architecture ensures:
✅ **Security**: JWT + HMAC verification
✅ **Scalability**: Indexed MongoDB queries
✅ **Reliability**: Webhook retry logic
✅ **Usability**: Clear separation of concerns
✅ **Maintainability**: Documented data flows

