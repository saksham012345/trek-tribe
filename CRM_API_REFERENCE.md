# CRM API Quick Reference

## 🔑 Authentication
All endpoints require: `Authorization: Bearer <JWT_TOKEN>`

## 📍 Base URL
```
http://localhost:4000/api/crm
```

---

## 📊 Lead Management

### Create Lead
```http
POST /api/crm/leads
Content-Type: application/json

{
  "email": "user@example.com",
  "tripId": "trip_id_here",
  "source": "trip_view",
  "name": "John Doe",
  "phone": "+91-9876543210",
  "metadata": {
    "tripViewCount": 1,
    "inquiryMessage": "Interested in this trip"
  }
}
```

### Get All Leads
```http
GET /api/crm/leads?status=new&page=1&limit=20
```

### Convert Lead
```http
POST /api/crm/leads/:leadId/convert
```

---

## 🎫 Support Tickets

### Create Ticket
```http
POST /api/crm/tickets
Content-Type: application/json

{
  "subject": "Payment issue",
  "description": "Unable to complete payment",
  "category": "payment",
  "priority": "high",
  "tripId": "optional_trip_id"
}
```

### Get My Tickets
```http
GET /api/crm/tickets?status=pending
```

### Add Message to Ticket
```http
POST /api/crm/tickets/:ticketId/messages
Content-Type: application/json

{
  "message": "I need help with this issue"
}
```

### Resolve Ticket (Admin)
```http
POST /api/crm/tickets/:ticketId/resolve
Content-Type: application/json

{
  "resolutionNote": "Issue resolved by refunding payment"
}
```

---

## ✅ Trip Verification

### Submit Trip for Verification
```http
POST /api/crm/verifications
Content-Type: application/json

{
  "tripId": "trip_id_here",
  "documents": [
    {
      "type": "license",
      "filename": "license.pdf",
      "url": "https://..."
    }
  ],
  "verificationChecklist": [
    {
      "itemName": "Valid tour operator license",
      "status": "pending"
    }
  ]
}
```

### Get Verification Status
```http
GET /api/crm/verifications/trip/:tripId
```

### Update Status (Admin)
```http
PUT /api/crm/verifications/trip/:tripId/status
Content-Type: application/json

{
  "status": "verified",
  "notes": "All documents verified"
}
```

---

## 💳 Subscriptions

### Start Trial (Organizer)
```http
POST /api/crm/subscriptions/trial
```
Response:
```json
{
  "success": true,
  "data": {
    "planType": "trial",
    "status": "active",
    "tripPackage": {
      "totalTrips": 5,
      "remainingTrips": 5
    },
    "trial": {
      "isActive": true,
      "monthsRemaining": 2,
      "endDate": "2025-03-11T..."
    }
  }
}
```

### Purchase Trip Package (₹1499)
```http
POST /api/crm/subscriptions/purchase/trip-package
Content-Type: application/json

{
  "transactionId": "razorpay_txn_123",
  "paymentMethod": "razorpay"
}
```

### Purchase CRM Bundle (₹2100)
```http
POST /api/crm/subscriptions/purchase/crm-bundle
Content-Type: application/json

{
  "transactionId": "razorpay_txn_456",
  "paymentMethod": "razorpay"
}
```

### Get My Subscription
```http
GET /api/crm/subscriptions/my
```

---

## 📈 Analytics

### Organizer Dashboard
```http
GET /api/crm/analytics/organizer
```
Response:
```json
{
  "success": true,
  "data": {
    "leads": {
      "total": 45,
      "converted": 12,
      "conversionRate": "26.67"
    },
    "support": {
      "totalTickets": 8,
      "resolvedTickets": 6,
      "pendingTickets": 2
    },
    "subscription": {
      "planType": "trip_package",
      "remainingTrips": 3
    }
  }
}
```

### User Dashboard
```http
GET /api/crm/analytics/user
```

### Admin Dashboard
```http
GET /api/crm/analytics/admin?startDate=2025-01-01&endDate=2025-02-01
```

### Lead Sources
```http
GET /api/crm/analytics/lead-sources
```

---

## 🔔 Notifications

### Get My Notifications
```http
GET /api/crm/notifications?limit=50&unreadOnly=true
```

### Mark as Read
```http
PUT /api/crm/notifications/:notificationId/read
```

### Mark All as Read
```http
PUT /api/crm/notifications/read-all
```

---

## 💬 Real-time Chat (WebSocket)

### Connect
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:4000', {
  auth: { token: yourJwtToken }
});
```

### Authenticate
```javascript
socket.emit('authenticate', {
  userId: currentUser.id,
  userType: 'organizer' // or 'user', 'admin'
});
```

### Join Conversation
```javascript
socket.emit('join:conversation', 'conv_user1_user2');
```

### Send Message
```javascript
socket.emit('message:send', {
  conversationId: 'conv_user1_user2',
  senderId: currentUser.id,
  senderType: 'organizer',
  recipientId: recipientId,
  recipientType: 'user',
  message: 'Hello! How can I help you?'
});
```

### Listen for Messages
```javascript
socket.on('message:new', (message) => {
  console.log('New message:', message);
  // Update UI
});

socket.on('typing:indicator', ({ userId, isTyping }) => {
  // Show/hide typing indicator
});

socket.on('user:online', ({ userId }) => {
  // Update user online status
});
```

---

## 🎭 Role Access Matrix

| Endpoint | Traveler | Organizer | Admin |
|----------|----------|-----------|-------|
| Create Lead | ❌ | ✅ | ✅ |
| View Leads | ❌ | ✅ (own) | ✅ (all) |
| Create Ticket | ✅ | ✅ | ✅ |
| Resolve Ticket | ❌ | ❌ | ✅ |
| Submit Verification | ❌ | ✅ | ✅ |
| Approve Verification | ❌ | ❌ | ✅ |
| Purchase Subscription | ❌ | ✅ | ✅ |
| View Analytics | ✅ (own) | ✅ (own) | ✅ (all) |

---

## 🚦 Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not Found |
| 500 | Server Error |

---

## 📝 Common Response Format

### Success
```json
{
  "success": true,
  "message": "Operation completed",
  "data": { ... }
}
```

### Error
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

### Paginated
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "pages": 8
  }
}
```

---

## 🔍 Query Parameters

### Pagination
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20)

### Filtering
- `status` - Filter by status
- `priority` - Filter by priority
- `category` - Filter by category
- `source` - Filter by lead source

### Date Range
- `startDate` - Start date (ISO 8601)
- `endDate` - End date (ISO 8601)

---

## 📮 Postman Collection

Import this into Postman:
```json
{
  "info": { "name": "Trek-Tribe CRM API" },
  "item": [
    {
      "name": "Get Notifications",
      "request": {
        "method": "GET",
        "header": [
          { "key": "Authorization", "value": "Bearer {{token}}" }
        ],
        "url": "{{baseUrl}}/api/crm/notifications"
      }
    }
  ],
  "variable": [
    { "key": "baseUrl", "value": "http://localhost:4000" },
    { "key": "token", "value": "your_jwt_token_here" }
  ]
}
```

---

## 🎯 Quick Start Commands

### Test Health
```bash
curl http://localhost:4000/health
```

### Login (get token)
```bash
curl -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}'
```

### Test CRM Endpoint
```bash
curl http://localhost:4000/api/crm/notifications \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

**For complete documentation, see `CRM_README.md`**
