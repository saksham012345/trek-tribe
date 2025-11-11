# CRM Quick Start Guide

## ⚡ 5-Minute Integration

### 1. Register Routes (in your main server file)
```typescript
// services/api/src/index.ts or server.ts
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

// Initialize chat
chatService.initializeSocketIO(io);

// Mount CRM routes
app.use('/api/crm', crmRoutes);

// Use 'server' instead of 'app' for listening
server.listen(PORT);
```

### 2. Test API Endpoints
```bash
# Health check
curl http://localhost:5000/api/crm/notifications

# Create trial subscription (organizer)
curl -X POST http://localhost:5000/api/crm/subscriptions/trial \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get analytics
curl http://localhost:5000/api/crm/analytics/organizer \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 3. Frontend Chat Integration
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

socket.emit('authenticate', {
  userId: currentUser.id,
  userType: currentUser.role
});

socket.on('message:new', (message) => {
  console.log('New message:', message);
});
```

## 📂 File Structure Created

```
services/api/src/
├── models/
│   ├── Lead.ts
│   ├── Ticket.ts
│   ├── ChatMessage.ts
│   ├── TripVerification.ts
│   ├── CRMSubscription.ts
│   ├── Notification.ts
│   └── UserActivity.ts
│
├── controllers/
│   ├── leadController.ts
│   ├── ticketController.ts
│   ├── verificationController.ts
│   └── subscriptionController.ts
│
├── services/
│   ├── notificationService.ts
│   ├── analyticsService.ts
│   └── chatService.ts
│
├── middleware/
│   ├── roleCheck.ts
│   ├── crmAccess.ts
│   └── tripVerifier.ts
│
└── routes/
    └── crm.ts
```

## 🎯 Key API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/crm/leads` | POST | Create lead |
| `/api/crm/tickets` | POST | Create support ticket |
| `/api/crm/verifications` | POST | Submit trip for verification |
| `/api/crm/subscriptions/trial` | POST | Start 2-month trial |
| `/api/crm/subscriptions/purchase/trip-package` | POST | Buy 5 trips (₹1499) |
| `/api/crm/subscriptions/purchase/crm-bundle` | POST | Buy CRM access (₹2100) |
| `/api/crm/analytics/organizer` | GET | Organizer dashboard |
| `/api/crm/analytics/user` | GET | User dashboard |
| `/api/crm/analytics/admin` | GET | Admin dashboard |
| `/api/crm/notifications` | GET | Get notifications |

## 🔐 Authentication

All routes except chat require JWT authentication. Add to your existing auth middleware:

```typescript
// Ensure your JWT middleware sets req.user with:
{
  id: string;
  email: string;
  role: 'user' | 'organizer' | 'admin';
  organizerId?: string; // For organizers
}
```

## 💳 Payment Plans

- **Trial**: 2 months free + 5 trips (auto-created for new organizers)
- **Trip Package**: ₹1499 for 5 additional trips
- **CRM Bundle**: ₹2100 for full CRM access (leads, tickets, chat, analytics)

## 🎨 Frontend Components Needed

### 1. Organizer Dashboard
- Display analytics (leads, conversions, tickets)
- Show remaining trip slots
- List recent activities

### 2. Support Ticket Interface
- Create ticket form
- View ticket list
- Chat/messaging within tickets

### 3. Lead Management UI
- Lead list with filters
- Lead detail view
- Add interactions/notes

### 4. Chat Interface
- Real-time messaging
- Conversation list
- Typing indicators
- Read receipts

### 5. Trip Verification
- Upload documents
- View verification status
- Admin review interface

### 6. Subscription Management
- View current plan
- Purchase options
- Billing history

## 🚀 Next Steps

1. **Test the API**: Use the curl commands or Postman
2. **Build Frontend Components**: Use the React examples in `CRM_README.md`
3. **Customize Styling**: Match your design system
4. **Add Payment Gateway**: Integrate Razorpay or Stripe
5. **Email Templates**: Customize notification emails
6. **Deploy**: Follow deployment instructions in `CRM_README.md`

## 📚 Full Documentation

See `CRM_README.md` for complete documentation including:
- Detailed API reference
- Socket.io events
- Security best practices
- Frontend integration examples
- Deployment guide

## 🆘 Common Issues

**Issue**: Routes not found (404)
- **Fix**: Ensure `app.use('/api/crm', crmRoutes)` is registered

**Issue**: Socket.io not connecting
- **Fix**: Use `http.createServer(app)` and listen on `server`, not `app`

**Issue**: Authentication errors
- **Fix**: Check JWT middleware is setting `req.user` correctly

**Issue**: TypeScript errors
- **Fix**: Run `npm run build` to compile

---

**Ready to build! Start with the analytics endpoint to test everything works.** 🎉
