# Trek-Tribe CRM System Architecture

## 🏛️ System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ User         │  │ Organizer    │  │ Admin        │         │
│  │ Dashboard    │  │ Dashboard    │  │ Dashboard    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
│         │                  │                  │                 │
│         └──────────────────┴──────────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway / Routes                        │
│                      /api/crm/*                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ↓                     ↓                     ↓
┌──────────────┐      ┌──────────────┐      ┌──────────────┐
│ Middleware   │      │ Controllers  │      │  Services    │
├──────────────┤      ├──────────────┤      ├──────────────┤
│ • Auth       │→────→│ • Lead       │→────→│ • Analytics  │
│ • RoleCheck  │      │ • Ticket     │      │ • Notify     │
│ • CRMAccess  │      │ • Verify     │      │ • Chat       │
│ • TripVerify │      │ • Subscribe  │      └──────────────┘
└──────────────┘      └──────────────┘              │
                              │                     │
                              ↓                     ↓
┌─────────────────────────────────────────────────────────────────┐
│                      Database Layer (MongoDB)                    │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐        │
│  │ Lead │ │Ticket│ │ Chat │ │Verify│ │ Sub  │ │ Notif│        │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘        │
└─────────────────────────────────────────────────────────────────┘
        │
        ↓
┌─────────────────────────────────────────────────────────────────┐
│                   External Services                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Email        │  │ Payment      │  │ File Storage │         │
│  │ (SMTP)       │  │ (Razorpay)   │  │ (S3/Cloud)   │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
```

## 📊 Data Flow Examples

### 1. Lead Creation Flow
```
User views trip page
     ↓
Frontend: POST /api/crm/leads
     ↓
Middleware: Auth + RoleCheck
     ↓
Controller: leadController.createLead()
     ↓
Model: Lead.save()
     ↓
Service: UserActivity.track()
     ↓
Response: { success: true, data: lead }
```

### 2. Support Ticket Flow
```
User creates ticket
     ↓
POST /api/crm/tickets
     ↓
Middleware: Auth
     ↓
Controller: ticketController.createTicket()
     ↓
Model: Ticket.save() (auto-generate ticket #)
     ↓
Service: notificationService.notify(admins)
     ↓
Response: { ticketNumber: "TKT-xxx" }
```

### 3. Real-time Chat Flow
```
User connects → Socket.io
     ↓
socket.emit('authenticate')
     ↓
ChatService.onlineUsers.set(userId)
     ↓
socket.emit('message:send')
     ↓
ChatMessage.save()
     ↓
io.to(conversationId).emit('message:new')
     ↓
Recipient receives message
```

### 4. Trip Verification Flow
```
Organizer submits trip
     ↓
POST /api/crm/verifications
     ↓
Middleware: Auth + requireOrganizerOrAdmin
     ↓
Controller: verificationController.submit()
     ↓
Model: TripVerification.save()
     ↓
Service: notify(admins)
     ↓
Admin reviews → PUT /verifications/trip/:id/status
     ↓
Service: notify(organizer)
```

## 🔐 Security Layers

```
Request
   ↓
┌─────────────────────┐
│ CORS + Helmet       │ ← Security headers
└─────────────────────┘
   ↓
┌─────────────────────┐
│ JWT Auth            │ ← Verify token
│ req.user populated  │
└─────────────────────┘
   ↓
┌─────────────────────┐
│ Role Check          │ ← requireAdmin/requireOrganizerOrAdmin
└─────────────────────┘
   ↓
┌─────────────────────┐
│ CRM Access Check    │ ← Subscription validation
└─────────────────────┘
   ↓
┌─────────────────────┐
│ Controller Logic    │ ← Business logic
└─────────────────────┘
   ↓
Response
```

## 💾 Database Schema Relationships

```
User ─────────┬─────→ Lead (userId)
              │
              ├─────→ Ticket (requesterId)
              │
              ├─────→ ChatMessage (senderId/recipientId)
              │
              ├─────→ UserActivity (userId)
              │
              └─────→ Notification (userId)

Organizer ────┬─────→ CRMSubscription (organizerId)
              │
              ├─────→ TripVerification (organizerId)
              │
              └─────→ Lead (assignedTo)

Trip ─────────┬─────→ Lead (tripId)
              │
              ├─────→ TripVerification (tripId)
              │
              └─────→ Ticket (tripId)
```

## 🔄 State Management Flow

### Lead Lifecycle
```
new → contacted → interested → converted ✓
                           ↓
                    not_interested
                           ↓
                         lost ✗
```

### Ticket Status Flow
```
pending → in_progress → resolved → closed ✓
            ↓
    waiting_customer
            ↓
        cancelled ✗
```

### Trip Verification Flow
```
pending → under_review → verified ✓
              ↓
       revision_required → (back to pending)
              ↓
          rejected ✗
```

### Subscription Flow
```
trial (2 months) → active → expired
                      ↓
                  cancelled
```

## 📡 WebSocket Events Architecture

```
Client                          Server
  │                               │
  ├─ authenticate ─────────────→ │ Store userId → socketId
  │                               │
  ├─ join:conversation ─────────→│ socket.join(room)
  │                               │
  ├─ message:send ──────────────→│ Save to DB
  │                               │ ├─→ io.to(room).emit('message:new')
  │                               │ └─→ notificationService (if offline)
  │                               │
  ├─ typing:start ──────────────→│ io.to(room).emit('typing:indicator')
  │                               │
  ├─ message:read ──────────────→│ Update DB
  │                               │ └─→ io.to(room).emit('message:read')
  │                               │
  │←───────────── disconnect ─── │ Remove from onlineUsers
  │                               │ └─→ io.emit('user:offline')
```

## 🎯 API Route Organization

```
/api/crm/
├── /leads
│   ├── POST    /                    Create lead
│   ├── GET     /                    List leads
│   ├── GET     /:id                 Get lead
│   ├── PUT     /:id                 Update lead
│   ├── POST    /:id/interactions    Add interaction
│   └── POST    /:id/convert         Convert lead
│
├── /tickets
│   ├── POST    /                    Create ticket
│   ├── GET     /                    List tickets
│   ├── GET     /:id                 Get ticket
│   ├── PUT     /:id/status          Update status
│   ├── POST    /:id/messages        Add message
│   ├── PUT     /:id/assign          Assign ticket
│   └── POST    /:id/resolve         Resolve ticket
│
├── /verifications
│   ├── POST    /                    Submit verification
│   ├── GET     /                    List verifications
│   ├── GET     /trip/:tripId        Get by trip
│   ├── PUT     /trip/:tripId/status Update status
│   └── PUT     /trip/:tripId/checklist Update checklist
│
├── /subscriptions
│   ├── POST    /trial               Create trial
│   ├── POST    /purchase/trip-package Buy trips
│   ├── POST    /purchase/crm-bundle Buy CRM
│   ├── GET     /my                  Get my subscription
│   └── GET     /                    List all (admin)
│
├── /analytics
│   ├── GET     /organizer           Organizer dashboard
│   ├── GET     /user                User dashboard
│   ├── GET     /admin               Admin dashboard
│   ├── GET     /lead-sources        Lead breakdown
│   └── GET     /ticket-categories   Ticket breakdown
│
└── /notifications
    ├── GET     /                    List notifications
    ├── PUT     /:id/read            Mark as read
    └── PUT     /read-all            Mark all as read
```

## 🔧 Middleware Stack

```
Request → [authenticate] → [roleCheck] → [crmAccess] → Controller
                ↓               ↓             ↓
            JWT verify    Admin/Org?    Subscription?
                                              ↓
                                        Trip slots?
```

## 📈 Analytics Pipeline

```
User Activity
    ↓
UserActivity.track()
    ↓
MongoDB Aggregation
    ↓
analyticsService
    ↓
┌──────────────────────┐
│ • Leads              │
│ • Conversions        │
│ • Tickets            │
│ • Revenue            │
│ • Support metrics    │
└──────────────────────┘
    ↓
Dashboard API
    ↓
Frontend Charts
```

## 🚀 Deployment Architecture

```
                    ┌─────────────┐
                    │   Vercel    │
                    │  (Frontend) │
                    └──────┬──────┘
                           │
                           ↓
                    ┌─────────────┐
                    │   Render    │
                    │  (API + WS) │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         ↓                 ↓                  ↓
  ┌────────────┐   ┌────────────┐   ┌────────────┐
  │ MongoDB    │   │   SMTP     │   │  Storage   │
  │  Atlas     │   │ (SendGrid) │   │    (S3)    │
  └────────────┘   └────────────┘   └────────────┘
```

## 💡 Key Design Patterns

1. **MVC Architecture**: Models, Controllers, Services separation
2. **Middleware Chain**: Auth → Role → Access → Controller
3. **Service Layer**: Reusable business logic
4. **Event-Driven**: Socket.io for real-time features
5. **Repository Pattern**: Models abstract database operations
6. **Factory Pattern**: Notification creation
7. **Singleton Pattern**: Services (analyticsService, chatService)

## 🎨 Recommended Tech Stack

**Backend:**
- Node.js + Express + TypeScript
- MongoDB + Mongoose
- Socket.io
- JWT for auth

**Frontend:**
- React + TypeScript
- TanStack Query (React Query)
- Socket.io-client
- Chart.js or Recharts
- Tailwind CSS or Material-UI

**DevOps:**
- Docker
- GitHub Actions
- Render/Railway for API
- Vercel for frontend
- MongoDB Atlas

---

**This architecture is scalable, secure, and production-ready!** 🚀
