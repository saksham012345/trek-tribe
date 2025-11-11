# Trek-Tribe CRM System Documentation

## 📋 Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Installation](#installation)
- [Database Models](#database-models)
- [API Routes](#api-routes)
- [Real-time Chat](#real-time-chat)
- [Payment Plans](#payment-plans)
- [Security](#security)
- [Frontend Integration](#frontend-integration)

---

## 🎯 Overview

This is a complete, enterprise-grade CRM system built for Trek-Tribe that supports both users and organizers. It provides comprehensive lead management, support ticketing, trip verification, subscription management, and real-time chat support.

### Key Capabilities
- ✅ Lead tracking and management
- ✅ Support ticket system with SLA tracking
- ✅ Trip verification workflow
- ✅ Payment plan management (₹1499/5 trips, ₹2100 CRM bundle)
- ✅ Real-time chat support (Socket.io)
- ✅ Analytics dashboards for all user types
- ✅ Role-based access control (User, Organizer, Admin)
- ✅ Notification system (in-app + email)
- ✅ Activity tracking

---

## 🚀 Features

### For Users
- Create support tickets
- Real-time chat with organizers
- View trip booking history
- Track inquiries and leads
- Receive notifications

### For Organizers
- **Lead Management**: Track potential customers, score leads, manage interactions
- **Trip Verification**: Submit trips for admin approval with document uploads
- **CRM Dashboard**: View analytics, conversion rates, and business insights
- **Support Ticketing**: Respond to customer queries
- **Chat Support**: Direct messaging with users
- **Subscription Management**: Manage trip packages and CRM access

### For Admins
- **Complete CRM Oversight**: Manage all leads, tickets, and verifications
- **Trip Verification**: Review and approve organizer submissions
- **Analytics Dashboard**: System-wide metrics and KPIs
- **User Management**: Full CRUD operations
- **Revenue Tracking**: Payment and subscription analytics

---

## 🏗️ Architecture

```
trek-tribe/
└── services/
    └── api/
        └── src/
            ├── models/              # Database schemas
            │   ├── Lead.ts
            │   ├── Ticket.ts
            │   ├── ChatMessage.ts
            │   ├── TripVerification.ts
            │   ├── CRMSubscription.ts
            │   ├── Notification.ts
            │   └── UserActivity.ts
            │
            ├── controllers/         # Business logic
            │   ├── leadController.ts
            │   ├── ticketController.ts
            │   ├── verificationController.ts
            │   └── subscriptionController.ts
            │
            ├── services/            # Service layer
            │   ├── notificationService.ts
            │   ├── analyticsService.ts
            │   └── chatService.ts
            │
            ├── middleware/          # Security & validation
            │   ├── roleCheck.ts
            │   ├── crmAccess.ts
            │   └── tripVerifier.ts
            │
            └── routes/
                └── crm.ts           # API endpoints
```

---

## 📦 Installation

### Prerequisites
- Node.js v18+
- MongoDB v5+
- TypeScript

### Step 1: Install Dependencies
```bash
cd services/api
npm install
```

### Step 2: Environment Variables
Add to your `.env` file:
```env
MONGODB_URI=mongodb://localhost:27017/trek-tribe
JWT_SECRET=your_jwt_secret
NODE_ENV=development
PORT=5000

# Email Configuration (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

### Step 3: Update Main Server File
Add CRM routes to your main `index.ts` or `server.ts`:

```typescript path=null start=null
import crmRoutes from './routes/crm';
import chatService from './services/chatService';
import { Server } from 'socket.io';
import http from 'http';

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Initialize chat service
chatService.initializeSocketIO(io);

// Register CRM routes
app.use('/api/crm', crmRoutes);

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

### Step 4: Compile TypeScript
```bash
npm run build
```

### Step 5: Start Server
```bash
# Development
npm run dev

# Production
npm start
```

---

## 💾 Database Models

### 1. Lead
Tracks potential customers and their interactions.

**Key Fields:**
- `email`, `phone`, `name`
- `source`: 'trip_view' | 'inquiry' | 'partial_booking' | 'chat' | 'form'
- `status`: 'new' | 'contacted' | 'interested' | 'converted' | 'lost'
- `leadScore`: Calculated automatically (0-100)
- `interactions[]`: Track all touchpoints

### 2. Ticket
Support ticket system with conversation threads.

**Key Fields:**
- `ticketNumber`: Auto-generated (e.g., TKT-1234567890-00001)
- `category`: 'booking' | 'payment' | 'verification' | 'technical' | 'inquiry'
- `status`: 'pending' | 'in_progress' | 'resolved' | 'closed'
- `conversation[]`: Message thread
- `responseTime`, `resolutionTime`: SLA metrics

### 3. TripVerification
Admin verification workflow for trip submissions.

**Key Fields:**
- `status`: 'pending' | 'under_review' | 'verified' | 'rejected'
- `documents[]`: License, insurance, permits, etc.
- `verificationChecklist[]`: Customizable approval checklist
- `reviewHistory[]`: Complete audit trail

### 4. CRMSubscription
Payment and subscription management.

**Pricing:**
- Trip Package: ₹1499 for 5 trips
- CRM Bundle: ₹2100 for full access
- Trial: 2 months free for new organizers

**Key Fields:**
- `planType`: 'trip_package' | 'crm_bundle' | 'trial'
- `tripPackage`: { totalTrips, usedTrips, remainingTrips }
- `crmBundle`: { hasAccess, price, features[] }
- `trial`: { isActive, startDate, endDate }

---

## 🔌 API Routes

Base URL: `/api/crm`

### Lead Management
```
POST   /leads                          Create/update lead
GET    /leads                          Get all leads (filtered)
GET    /leads/:id                      Get lead by ID
PUT    /leads/:id                      Update lead
POST   /leads/:id/interactions         Add interaction
POST   /leads/:id/convert              Mark as converted
```

### Support Tickets
```
POST   /tickets                        Create ticket
GET    /tickets                        Get all tickets (filtered)
GET    /tickets/:id                    Get ticket details
PUT    /tickets/:id/status             Update status (admin)
POST   /tickets/:id/messages           Add message
PUT    /tickets/:id/assign             Assign to agent (admin)
POST   /tickets/:id/resolve            Resolve ticket (admin)
```

### Trip Verification
```
POST   /verifications                  Submit for verification
GET    /verifications                  Get all verifications
GET    /verifications/trip/:tripId     Get by trip ID
PUT    /verifications/trip/:tripId/status    Update status (admin)
PUT    /verifications/trip/:tripId/checklist Update checklist (admin)
```

### Subscriptions & Payments
```
POST   /subscriptions/trial            Start 2-month trial
POST   /subscriptions/purchase/trip-package  Buy 5 trips (₹1499)
POST   /subscriptions/purchase/crm-bundle    Buy CRM access (₹2100)
GET    /subscriptions/my               Get my subscription
GET    /subscriptions                  Get all (admin)
```

### Analytics
```
GET    /analytics/organizer            Organizer dashboard
GET    /analytics/user                 User dashboard
GET    /analytics/admin                Admin dashboard
GET    /analytics/lead-sources         Lead source breakdown
GET    /analytics/ticket-categories    Ticket category breakdown
```

### Notifications
```
GET    /notifications                  Get user notifications
PUT    /notifications/:id/read         Mark as read
PUT    /notifications/read-all         Mark all as read
```

---

## 💬 Real-time Chat

### Socket.io Events

#### Client → Server
```javascript
// Authenticate user
socket.emit('authenticate', {
  userId: '123',
  userType: 'organizer'
});

// Join conversation
socket.emit('join:conversation', 'conv_123_456');

// Send message
socket.emit('message:send', {
  conversationId: 'conv_123_456',
  senderId: '123',
  senderType: 'organizer',
  recipientId: '456',
  message: 'Hello!',
  attachments: []
});

// Typing indicator
socket.emit('typing:start', {
  conversationId: 'conv_123_456',
  userId: '123',
  userName: 'John'
});

socket.emit('typing:stop', {
  conversationId: 'conv_123_456',
  userId: '123'
});

// Mark as read
socket.emit('message:read', {
  conversationId: 'conv_123_456',
  messageId: 'msg_123'
});
```

#### Server → Client
```javascript
// New message received
socket.on('message:new', (data) => {
  console.log('New message:', data);
});

// User online/offline
socket.on('user:online', ({ userId }) => {});
socket.on('user:offline', ({ userId }) => {});

// Typing indicator
socket.on('typing:indicator', ({ userId, userName, isTyping }) => {});

// Message read receipt
socket.on('message:read', ({ messageId, readAt }) => {});
```

### Frontend Chat Integration Example
```javascript path=null start=null
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

// Authenticate
socket.emit('authenticate', {
  userId: currentUser.id,
  userType: currentUser.role
});

// Join conversation
socket.emit('join:conversation', conversationId);

// Listen for messages
socket.on('message:new', (message) => {
  setMessages(prev => [...prev, message]);
});

// Send message
const sendMessage = (text) => {
  socket.emit('message:send', {
    conversationId,
    senderId: currentUser.id,
    senderType: currentUser.role,
    recipientId: otherUser.id,
    message: text
  });
};
```

---

## 💳 Payment Plans

### Trial Period
- **Duration**: 2 months free
- **Includes**: 5 trip slots
- **Auto-created** for new organizers

### Trip Package
- **Price**: ₹1499
- **Includes**: 5 trip creation slots
- **Renewable**: Can purchase multiple packages

### CRM Bundle
- **Price**: ₹2100
- **Includes**: Full CRM features
  - Lead Management
  - Support Ticketing
  - Chat Support
  - Analytics Dashboard
  - Trip Verification
  - Customer Insights

### Payment Integration
```javascript path=null start=null
// Purchase trip package
const response = await fetch('/api/crm/subscriptions/purchase/trip-package', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    transactionId: 'txn_123456',
    paymentMethod: 'razorpay'
  })
});
```

---

## 🔒 Security

### Role-Based Access Control (RBAC)

#### Middleware Usage
```typescript path=null start=null
import { requireAdmin, requireOrganizerOrAdmin, requireRole } from './middleware/roleCheck';
import { requireCRMAccess, requireTripSlots } from './middleware/crmAccess';

// Admin only
router.get('/admin/stats', requireAdmin, controller.getStats);

// Organizer or Admin
router.get('/leads', requireOrganizerOrAdmin, controller.getLeads);

// Check CRM subscription
router.get('/crm/dashboard', requireCRMAccess, controller.getDashboard);

// Check trip slots before creation
router.post('/trips', requireTripSlots, controller.createTrip);
```

### Best Practices
- ✅ All routes require authentication (JWT)
- ✅ Role-based permissions enforced
- ✅ Subscription validation for CRM features
- ✅ Input validation using express-validator
- ✅ Rate limiting recommended (express-rate-limit)
- ✅ CORS configured
- ✅ Helmet for security headers

---

## 🎨 Frontend Integration

### React Dashboard Example

```jsx path=null start=null
import React, { useEffect, useState } from 'react';

function OrganizerDashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [leads, setLeads] = useState([]);
  const [tickets, setTickets] = useState([]);

  useEffect(() => {
    // Fetch analytics
    fetch('/api/crm/analytics/organizer', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setAnalytics(data.data));

    // Fetch leads
    fetch('/api/crm/leads?status=new&limit=10', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setLeads(data.data));

    // Fetch tickets
    fetch('/api/crm/tickets?status=pending&limit=10', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setTickets(data.data));
  }, []);

  return (
    <div className="dashboard">
      <h1>CRM Dashboard</h1>
      
      {/* Stats Cards */}
      <div className="stats-grid">
        <StatCard 
          title="Total Leads" 
          value={analytics?.leads?.total || 0}
          trend="+12%"
        />
        <StatCard 
          title="Conversion Rate" 
          value={`${analytics?.leads?.conversionRate || 0}%`}
        />
        <StatCard 
          title="Pending Tickets" 
          value={analytics?.support?.pendingTickets || 0}
          urgent={true}
        />
        <StatCard 
          title="Remaining Trips" 
          value={analytics?.subscription?.remainingTrips || 0}
        />
      </div>

      {/* Leads Table */}
      <section className="leads-section">
        <h2>Recent Leads</h2>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Source</th>
              <th>Score</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads.map(lead => (
              <tr key={lead._id}>
                <td>{lead.name}</td>
                <td>{lead.email}</td>
                <td>{lead.source}</td>
                <td>{lead.leadScore}</td>
                <td><Badge status={lead.status} /></td>
                <td>
                  <button onClick={() => viewLead(lead._id)}>View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Tickets */}
      <section className="tickets-section">
        <h2>Open Tickets</h2>
        {tickets.map(ticket => (
          <TicketCard key={ticket._id} ticket={ticket} />
        ))}
      </section>
    </div>
  );
}
```

### Subscription Management
```jsx path=null start=null
function SubscriptionPage() {
  const purchaseTripPackage = async () => {
    // Integrate with Razorpay or payment gateway
    const paymentResult = await initiatePayment(1499);
    
    if (paymentResult.success) {
      await fetch('/api/crm/subscriptions/purchase/trip-package', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          transactionId: paymentResult.transactionId,
          paymentMethod: 'razorpay'
        })
      });
      
      alert('Trip package purchased successfully!');
    }
  };

  return (
    <div className="subscription-page">
      <h1>Manage Subscription</h1>
      
      <div className="plans-grid">
        <PlanCard
          title="Trip Package"
          price="₹1,499"
          features={['5 trip creation slots', 'Valid for 6 months']}
          onPurchase={purchaseTripPackage}
        />
        <PlanCard
          title="CRM Bundle"
          price="₹2,100"
          features={[
            'Lead Management',
            'Support Ticketing',
            'Chat Support',
            'Analytics Dashboard',
            'Trip Verification'
          ]}
          onPurchase={purchaseCRMBundle}
        />
      </div>
    </div>
  );
}
```

---

## 📊 Analytics & Reporting

### Available Metrics

**Organizer Dashboard:**
- Total leads & conversion rate
- Trip creation stats
- Support ticket metrics
- Recent activity log
- Subscription status

**User Dashboard:**
- Booking history
- Support tickets
- Trip interests
- Activity timeline

**Admin Dashboard:**
- System-wide revenue
- Active subscriptions
- Pending verifications
- Support load & avg response time
- Lead source breakdown
- Ticket category analysis

---

## 🧪 Testing

### Example API Tests
```bash
# Create lead
curl -X POST http://localhost:5000/api/crm/leads \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "tripId": "trip_123",
    "source": "trip_view",
    "metadata": { "tripViewCount": 1 }
  }'

# Get analytics
curl http://localhost:5000/api/crm/analytics/organizer \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create ticket
curl -X POST http://localhost:5000/api/crm/tickets \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Payment issue",
    "description": "Unable to complete payment",
    "category": "payment",
    "priority": "high"
  }'
```

---

## 🚀 Deployment

### Environment Variables (Production)
```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/trek-tribe
JWT_SECRET=your_strong_production_secret
FRONTEND_URL=https://yourdomain.com
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
```

### Build for Production
```bash
npm run build
npm start
```

---

## 📝 License

Proprietary - Trek-Tribe CRM System

---

## 🆘 Support

For issues or questions:
- Check API documentation above
- Review error logs
- Contact development team

---

**Built with ❤️ for Trek-Tribe**
