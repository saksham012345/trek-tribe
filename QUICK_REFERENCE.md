# Trek Tribe - Quick Reference Guide

## 🚀 New Features Quick Access

### 📧 Email OTP Verification

**Endpoints:**
```bash
# Send OTP
POST /api/verify-email/send-otp
Body: { "email": "user@example.com" }

# Verify OTP
POST /api/verify-email/verify-otp
Body: { "email": "user@example.com", "otp": "123456" }

# Resend OTP
POST /api/verify-email/resend-otp
Body: { "email": "user@example.com" }

# Check Status
GET /api/verify-email/status/:email
```

**Environment Variables:**
```bash
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password
EMAIL_OTP_ENABLED=true
```

---

### 🤖 AI Recommendations

**Endpoints:**
```bash
# Personalized (requires auth)
GET /api/recommendations
Headers: { "Authorization": "Bearer TOKEN" }

# Custom preferences
POST /api/recommendations/custom
Body: { 
  "preferences": {
    "budget": 5000,
    "destination": "Himalayas",
    "difficulty": "moderate"
  }
}

# Popular trips
GET /api/recommendations/popular
```

**Frontend Integration:**
```javascript
// Get recommendations button
const getRecommendations = async () => {
  const res = await fetch('/api/recommendations', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  return data.recommendations;
};
```

---

### 🔔 Notifications

**Endpoints:**
```bash
# Get all notifications
GET /api/notifications
Headers: { "Authorization": "Bearer TOKEN" }
Query: ?limit=50&unreadOnly=true

# Unread count
GET /api/notifications/unread-count

# Mark as read
PUT /api/notifications/:id/read

# Mark all as read
PUT /api/notifications/mark-all-read

# Delete notification
DELETE /api/notifications/:id

# Delete all read
DELETE /api/notifications
```

**Frontend Usage:**
```javascript
// Get unread count for badge
const getUnreadCount = async () => {
  const res = await fetch('/api/notifications/unread-count', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const { count } = await res.json();
  return count;
};
```

---

### 🔒 Security Features

**Rate Limiters Available:**
```javascript
import { 
  apiLimiter,      // 100 req/15min
  authLimiter,     // 5 attempts/15min
  otpLimiter,      // 3 req/hour
  paymentLimiter,  // 10 req/hour
  tripCreationLimiter // 20 trips/day
} from './middleware/rateLimiter';

// Usage
app.use('/auth/login', authLimiter);
app.use('/api/verify-email', otpLimiter);
```

**Audit Logging:**
```javascript
import { auditLogService } from './services/auditLogService';

// Log admin action
await auditLogService.logAdminAction(
  adminId,
  'APPROVE',
  'Trip',
  tripId,
  'Trip meets quality standards',
  req
);

// Log payment
await auditLogService.logPayment(
  userId,
  paymentId,
  'CREATE',
  1499,
  req
);

// Get logs
const logs = await auditLogService.getUserLogs(userId, 50);
```

---

### 🧠 AI Training

**Train the Model:**
```bash
cd services/api/scripts
pip install -r requirements-ai.txt
python train_ai_bot.py
```

**Test the Model:**
```bash
python train_ai_bot.py --test
```

**Update Training Data:**
Edit `services/api/src/data/ai_training_data.json`

---

## 📁 File Structure

```
services/api/src/
├── services/
│   ├── emailOtpService.ts       ✅ NEW
│   ├── auditLogService.ts       ✅ NEW
│   └── notificationService.ts   (existing)
├── routes/
│   ├── emailVerification.ts     ✅ NEW
│   ├── recommendations.ts       ✅ NEW
│   └── notifications.ts         ✅ NEW
├── models/
│   ├── AuditLog.ts             ✅ NEW
│   └── User.ts                  (enhanced)
├── middleware/
│   └── rateLimiter.ts          ✅ NEW
├── data/
│   └── ai_training_data.json   ✅ NEW
└── scripts/
    ├── train_ai_bot.py         ✅ NEW
    ├── requirements-ai.txt     ✅ NEW
    └── AI_TRAINING_README.md   ✅ NEW
```

---

## 🧪 Testing Commands

```bash
# Build
npm run build

# Run dev
npm run dev:api

# Test email OTP
curl -X POST http://localhost:4000/api/verify-email/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Test recommendations
curl http://localhost:4000/api/recommendations \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test notifications
curl http://localhost:4000/api/notifications \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🐛 Common Issues

**Issue:** OTP not sending
```bash
# Check Gmail credentials
echo $GMAIL_USER
echo $GMAIL_APP_PASSWORD

# Verify 2FA enabled
# Generate new app password
```

**Issue:** Build fails
```bash
# Clean and rebuild
rm -rf dist node_modules
npm install
npm run build
```

**Issue:** Rate limiting not working
```bash
# Rate limiting only active in production
NODE_ENV=production npm start
```

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| **IMPLEMENTATION_GUIDE.md** | Full implementation details |
| **PROJECT_STATUS.md** | Current status and roadmap |
| **QUICK_REFERENCE.md** | This file |
| **AI_TRAINING_README.md** | AI model training guide |

---

## 🎯 Next Features to Implement

1. **Payment Routes** - `/api/subscriptions/*`
2. **Analytics** - `/api/analytics/*`
3. **Admin Panel** - Enhanced admin routes
4. **Frontend Dashboards** - React components

---

## 💡 Pro Tips

- Use **Postman** or **Thunder Client** for API testing
- Check **console logs** for detailed error messages
- Review **existing routes** for code patterns
- Enable **development mode** for detailed responses
- Use **test notification** endpoint to verify notifications work

---

**Last Updated:** 2025-11-12  
**Build Status:** ✅ PASSING  
**Phase:** 1 Complete | Phase 2 Ready

