# 🚀 CRM Deployment Checklist

## ✅ Pre-Deployment Verification

Run these commands to ensure everything is ready:

### 1. Verify TypeScript Compilation
```bash
cd C:\Users\hp\Development\trek-tribe\services\api
npm run build
```

**Expected:** ✅ No errors, CRM files compiled to `dist/`

---

### 2. Check Git Status
```bash
cd C:\Users\hp\Development\trek-tribe
git status
```

**Should show:**
```
Modified:
  services/api/src/index.ts
  services/api/src/services/socketService.ts

New files:
  services/api/src/models/Lead.ts
  services/api/src/models/Ticket.ts
  services/api/src/models/ChatMessage.ts
  services/api/src/models/TripVerification.ts
  services/api/src/models/CRMSubscription.ts
  services/api/src/models/Notification.ts
  services/api/src/models/UserActivity.ts
  services/api/src/controllers/leadController.ts
  services/api/src/controllers/ticketController.ts
  services/api/src/controllers/verificationController.ts
  services/api/src/controllers/subscriptionController.ts
  services/api/src/services/notificationService.ts
  services/api/src/services/analyticsService.ts
  services/api/src/services/chatService.ts
  services/api/src/middleware/roleCheck.ts
  services/api/src/middleware/crmAccess.ts
  services/api/src/middleware/tripVerifier.ts
  services/api/src/routes/crm.ts
  CRM_*.md files
```

---

### 3. Test Locally (Optional but Recommended)
```bash
cd services\api
npm run dev
```

Open another terminal:
```bash
# Test health
curl http://localhost:4000/health

# Test CRM (after getting auth token)
curl http://localhost:4000/api/crm/notifications ^
  -H "Authorization: Bearer YOUR_TOKEN"
```

Press `Ctrl+C` to stop the server.

---

## 🚢 Deployment Commands

### Option A: Deploy Everything (Recommended)

```bash
cd C:\Users\hp\Development\trek-tribe

# Add all CRM files
git add .

# Commit with descriptive message
git commit -m "Add enterprise CRM system

- Lead management with auto-scoring
- Support ticketing system
- Trip verification workflow
- Payment subscription management (trial, trip package, CRM bundle)
- Real-time chat support via Socket.io
- Analytics dashboards for users, organizers, and admins
- Notification system (in-app + email)
- Complete API with 50+ endpoints

All integrated with existing auth system and Render auto-deploy ready."

# Push to trigger Render deployment
git push origin main
```

---

### Option B: Deploy Backend Only (Selective)

If you want to commit only backend changes:

```bash
cd C:\Users\hp\Development\trek-tribe

# Add only backend files
git add services/api/src/
git add services/api/package.json

# Documentation (optional)
git add CRM_README.md CRM_QUICKSTART.md CRM_ARCHITECTURE.md

# Commit
git commit -m "Integrate CRM system backend"

# Push
git push origin main
```

---

## 🔍 Monitor Deployment

### 1. Watch Render Build Logs

1. Go to: https://dashboard.render.com/
2. Click on **trek-tribe-api** service
3. Go to **Logs** tab
4. Watch for:
   ```
   ==> Building...
   npm install
   npm run build
   > tsc
   
   ==> Build succeeded!
   
   ==> Starting service...
   ✅ Connected to MongoDB successfully
   ✅ Socket.IO service initialized
   ✅ CRM Chat service initialized
   ✅ CRM routes mounted at /api/crm
   🚀 API listening on http://localhost:10000
   ```

---

### 2. Wait for "Live" Status

Deployment typically takes **3-5 minutes**:
- **Building:** 2-3 minutes
- **Starting:** 30-60 seconds
- **Health Check:** 10-20 seconds

---

### 3. Test Production Endpoints

Once deployment shows **"Live"**:

```bash
# Test health
curl https://trek-tribe-api.onrender.com/health

# Should return:
{
  "status": "ok",
  "socketIO": {
    "isInitialized": true
  }
}
```

```bash
# Test CRM (with valid JWT)
curl https://trek-tribe-api.onrender.com/api/crm/notifications ^
  -H "Authorization: Bearer YOUR_PROD_TOKEN"
```

---

## 🎯 Post-Deployment Tasks

### 1. Update Frontend Environment Variables

If using Vercel for frontend:

```bash
# Set environment variables in Vercel dashboard or CLI
vercel env add REACT_APP_API_URL production
# Value: https://trek-tribe-api.onrender.com

vercel env add REACT_APP_SOCKET_URL production
# Value: https://trek-tribe-api.onrender.com
```

Or create/update `web/.env.production`:
```env
REACT_APP_API_URL=https://trek-tribe-api.onrender.com
REACT_APP_SOCKET_URL=https://trek-tribe-api.onrender.com
```

---

### 2. Deploy Frontend

```bash
cd web
git add .env.production  # if you created it
git commit -m "Update API URLs for CRM integration"
git push origin main
```

Vercel will auto-deploy!

---

### 3. Test End-to-End

1. **Login** to your frontend
2. **Navigate** to any CRM feature (if UI built)
3. **Verify** API calls work
4. **Test** real-time chat (Socket.io)
5. **Check** browser console for errors

---

## ✅ Verification Checklist

After deployment, verify each feature:

### Backend
- [ ] Health endpoint: `GET /health` ✅
- [ ] CRM routes: `GET /api/crm/notifications` ✅
- [ ] Socket.io: WebSocket connection works ✅
- [ ] MongoDB: Database connected ✅
- [ ] Logs: No errors in Render logs ✅

### CRM Features
- [ ] Leads: Can create/view leads ✅
- [ ] Tickets: Can create support tickets ✅
- [ ] Verification: Can submit trips for verification ✅
- [ ] Subscriptions: Can create trial subscription ✅
- [ ] Analytics: Can fetch dashboard data ✅
- [ ] Notifications: Can retrieve notifications ✅
- [ ] Chat: Real-time messaging works ✅

### Security
- [ ] Authentication: JWT required for all routes ✅
- [ ] Authorization: Role-based access working ✅
- [ ] CORS: Frontend can make requests ✅

---

## 🐛 Rollback (If Needed)

If something goes wrong:

### Option 1: Rollback in Render Dashboard
1. Go to Render Dashboard
2. Click **trek-tribe-api**
3. Go to **Events** tab
4. Find previous successful deploy
5. Click **"Rollback to this version"**

### Option 2: Git Revert
```bash
# Find commit hash before CRM integration
git log --oneline

# Revert to previous commit
git revert HEAD
git push origin main
```

---

## 📊 Expected Changes After Deployment

### Memory Usage
- **Before:** ~150-200 MB
- **After:** ~200-250 MB (+50 MB for CRM)

### Response Time
- **Health Check:** <100ms
- **CRM Endpoints:** 100-300ms (database queries)
- **Socket.io:** Real-time (<50ms)

### Database
- **New Collections:**
  - `leads`
  - `tickets`
  - `chatmessages`
  - `tripverifications`
  - `crmsubscriptions`
  - `notifications`
  - `useractivities`

---

## 🎊 Success!

If all checks pass:

✅ **Backend deployed** - Render auto-deploy successful
✅ **CRM active** - All 50+ endpoints live
✅ **Socket.io running** - Real-time chat enabled
✅ **Database updated** - New collections created
✅ **Frontend compatible** - CORS and auth working

---

## 📞 Support & Documentation

| Issue | Resource |
|-------|----------|
| Deployment fails | Check `CRM_RENDER_DEPLOY.md` |
| API not working | See `CRM_API_REFERENCE.md` |
| Integration issues | Read `CRM_INTEGRATION_COMPLETE.md` |
| General docs | Full guide in `CRM_README.md` |

---

## 🚀 Ready to Deploy?

**Final command to deploy:**

```bash
cd C:\Users\hp\Development\trek-tribe
git add .
git commit -m "Add enterprise CRM system"
git push origin main
```

Then monitor at: https://dashboard.render.com/

**Deployment ETA: 3-5 minutes** ⏱️

---

**Good luck! Your CRM will be live shortly! 🎉**
