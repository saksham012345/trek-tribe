# 🚀 CRM Render Deployment Guide

## ✅ Deployment Status: **READY**

Your CRM system is fully compatible with Render's auto-deploy! No configuration changes needed.

---

## 🎯 What's Already Configured

### ✅ Your Existing Setup (Perfect!)
```yaml
services:
  - type: web
    name: trek-tribe-api
    buildCommand: npm install && npm run build  ← Compiles TypeScript + CRM
    startCommand: npm start                     ← Runs compiled code
    healthCheckPath: /health                    ← Already works!
```

### ✅ CRM Integration
- All CRM files are TypeScript (`.ts`)
- They compile to `dist/` folder automatically
- No additional build steps needed
- Socket.io already in dependencies

---

## 🚢 Deployment Process

### **Option 1: Auto-Deploy (Recommended)**

Simply push your changes to Git:

```bash
git add .
git commit -m "Add CRM system integration"
git push origin main
```

**Render will automatically:**
1. ✅ Detect the changes
2. ✅ Run `npm install` (installs all dependencies)
3. ✅ Run `npm run build` (compiles TypeScript + CRM)
4. ✅ Deploy with `npm start`
5. ✅ Health check at `/health`

**No manual intervention needed!** 🎉

---

### **Option 2: Manual Deploy (via Render Dashboard)**

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Find `trek-tribe-api` service
3. Click **"Manual Deploy"** → **"Deploy latest commit"**

---

## 🧪 Verify Deployment

### 1. Check Health Endpoint
```bash
curl https://trek-tribe-api.onrender.com/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-11T...",
  "mongodb": {
    "status": "connected"
  },
  "socketIO": {
    "isInitialized": true
  }
}
```

### 2. Test CRM Endpoint
```bash
curl https://trek-tribe-api.onrender.com/api/crm/notifications \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Expected (if no notifications):
```json
{
  "success": true,
  "data": [],
  "unreadCount": 0
}
```

### 3. Check Logs
In Render Dashboard:
- Go to your service → **Logs**
- Look for: `✅ CRM routes mounted at /api/crm`
- Look for: `✅ CRM Chat service initialized`

---

## 🌐 Production URLs

### API Endpoints
**Base URL:** `https://trek-tribe-api.onrender.com`

**CRM Routes:**
- `https://trek-tribe-api.onrender.com/api/crm/leads`
- `https://trek-tribe-api.onrender.com/api/crm/tickets`
- `https://trek-tribe-api.onrender.com/api/crm/verifications`
- `https://trek-tribe-api.onrender.com/api/crm/subscriptions`
- `https://trek-tribe-api.onrender.com/api/crm/analytics/organizer`
- `https://trek-tribe-api.onrender.com/api/crm/notifications`

### WebSocket (Real-time Chat)
**URL:** `wss://trek-tribe-api.onrender.com`

Frontend example:
```javascript
import io from 'socket.io-client';

const socket = io('https://trek-tribe-api.onrender.com', {
  auth: { token: yourJwtToken },
  transports: ['websocket', 'polling']  // Important for Render!
});
```

---

## 📝 Environment Variables (Already Set)

Your existing Render config includes:
```yaml
envVars:
  - key: NODE_ENV
    value: production        ✅ CRM uses this
  - key: JWT_SECRET
    generateValue: true      ✅ CRM uses this
  - key: MONGODB_URI
    sync: false              ✅ CRM models use this
  - key: FRONTEND_URL
    value: https://...       ✅ CORS configured
```

**No additional env vars needed!** All CRM features use existing configuration.

---

## 🔄 Continuous Deployment

Your workflow is now:

```
┌─────────────────────────────────────────────────────┐
│  1. Make changes locally                            │
│     cd services/api                                 │
│     npm run build  ← Test locally                   │
│     npm run dev                                     │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│  2. Commit and push                                 │
│     git add .                                       │
│     git commit -m "Update CRM feature"              │
│     git push origin main                            │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│  3. Render auto-deploys                             │
│     ✅ npm install                                   │
│     ✅ npm run build (compiles CRM)                  │
│     ✅ npm start                                     │
│     ✅ Health check                                  │
└─────────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────────┐
│  4. CRM live in production! 🎉                      │
│     https://trek-tribe-api.onrender.com/api/crm/*   │
└─────────────────────────────────────────────────────┘
```

---

## 🎨 Frontend Integration (Vercel)

Update your frontend to use production URLs:

```javascript
// In your React app (.env.production or .env)
REACT_APP_API_URL=https://trek-tribe-api.onrender.com
REACT_APP_SOCKET_URL=https://trek-tribe-api.onrender.com
```

### Example API Call
```javascript
// services/api.js
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

export const fetchLeads = async (token) => {
  const response = await fetch(`${API_URL}/api/crm/leads`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return response.json();
};
```

### Socket.io Connection
```javascript
// services/socket.js
import io from 'socket.io-client';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:4000';

export const initSocket = (token) => {
  return io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 5
  });
};
```

---

## 🔥 Render Free Tier Considerations

### Spin Down (Free Tier)
- Render spins down after 15 minutes of inactivity
- First request after spin down takes ~30-60 seconds
- Subsequent requests are fast

### Keep Alive (Optional)
If you want to prevent spin down, add a cron job to ping your API:

**Using UptimeRobot (Free):**
1. Sign up at [uptimerobot.com](https://uptimerobot.com)
2. Add monitor: `https://trek-tribe-api.onrender.com/health`
3. Check interval: 5 minutes

**Using Render Cron (Paid):**
```yaml
- type: cron
  name: keep-alive
  schedule: "*/10 * * * *"
  buildCommand: echo "Ping"
  startCommand: curl https://trek-tribe-api.onrender.com/health
```

---

## 🐛 Troubleshooting

### Issue: "CRM routes not found"
**Check:**
1. Did TypeScript compile successfully?
   ```bash
   npm run build
   ```
2. Are CRM files in `dist/` folder?
3. Check Render logs for errors

**Fix:** Usually resolved by redeploying

---

### Issue: "Socket.io connection failed"
**Check:**
1. Frontend using `wss://` (not `ws://`)
2. Transports include both `websocket` and `polling`
3. CORS configured correctly

**Fix:**
```javascript
const socket = io('https://trek-tribe-api.onrender.com', {
  transports: ['websocket', 'polling'],  // Add this!
  reconnection: true
});
```

---

### Issue: "Authentication errors"
**Check:**
1. JWT token is valid
2. Token includes `Bearer ` prefix
3. Token not expired

**Test:**
```bash
# Get token first
TOKEN=$(curl -X POST https://trek-tribe-api.onrender.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}' \
  | jq -r '.token')

# Use token
curl https://trek-tribe-api.onrender.com/api/crm/notifications \
  -H "Authorization: Bearer $TOKEN"
```

---

### Issue: "Database connection errors"
**Check:**
1. MONGODB_URI is set correctly in Render dashboard
2. MongoDB Atlas whitelist includes `0.0.0.0/0` for Render
3. Database user has correct permissions

---

## 📊 Monitoring

### Render Dashboard Metrics
- **Response Time** - Should be <500ms for CRM endpoints
- **Error Rate** - Should be <1%
- **Memory Usage** - Monitor if increased (CRM adds ~50MB)

### Key Logs to Monitor
```
✅ Connected to MongoDB successfully
✅ Socket.IO service initialized
✅ CRM Chat service initialized
✅ CRM routes mounted at /api/crm
🚀 API listening on http://localhost:10000
```

---

## 🎊 Success Checklist

After deployment, verify:

- [ ] Health endpoint responds: `/health`
- [ ] CRM routes work: `/api/crm/notifications`
- [ ] Socket.io connects successfully
- [ ] MongoDB connection stable
- [ ] No errors in Render logs
- [ ] CORS working from frontend
- [ ] Authentication working with JWT

---

## 🚀 Deploy Now!

Everything is ready. Just push your code:

```bash
# From services/api/ or root directory
git add .
git commit -m "Integrate CRM system"
git push origin main
```

**Render will handle the rest automatically!** 🎉

---

## 📞 Support

**Render Issues:** Check [Render Status](https://status.render.com/)
**CRM Issues:** See `CRM_README.md` for API documentation
**Integration Issues:** See `CRM_INTEGRATION_COMPLETE.md`

---

## 🎯 Post-Deployment

Once deployed:

1. ✅ Test all CRM endpoints
2. ✅ Update frontend environment variables
3. ✅ Deploy frontend to Vercel (auto-deploys)
4. ✅ Test end-to-end flow
5. ✅ Set up monitoring (optional)

---

**Your CRM is production-ready and will auto-deploy to Render! 🚀**

No configuration changes needed - just push and it works!
