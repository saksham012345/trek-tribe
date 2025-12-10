# 🚀 Render Deployment Guide - Trek Tribe

## ✅ Pre-Deployment Verification Complete

### Build Status:
- ✅ **Backend**: Compiled successfully (0 TypeScript errors)
- ✅ **Frontend**: Built successfully (minor warnings only - non-critical)
- ✅ **AI Service**: Verified and functional
- ✅ **Database Models**: All updated and compatible
- ✅ **API Routes**: All endpoints registered

## 📦 Deployment to Render

### Step 1: Push to GitHub

```bash
# Make sure all changes are committed
git status
git add .
git commit -m "Fix TypeScript errors, enhance AI service accuracy, add verification features"
git push origin main
```

### Step 2: Deploy Backend on Render

#### A. Create New Web Service
1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository: `trek-tribe`
4. Configure the service:

**Service Details:**
```
Name: trek-tribe-api
Environment: Node
Region: Singapore (or closest to your users)
Branch: main
Root Directory: services/api
```

**Build & Deploy:**
```
Build Command: npm install && npm run build
Start Command: npm run start:render
```

**Instance Type:**
- Free tier: Select **"Free"**
- Production: Select **"Starter"** ($7/month) or higher

#### B. Environment Variables

Click **"Advanced"** → **"Add Environment Variable"**

**Required Variables:**
```bash
NODE_ENV=production
PORT=4000

# Database (CRITICAL - Get from MongoDB Atlas)
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/trek-tribe?retryWrites=true&w=majority

# JWT Authentication (CRITICAL - Generate a strong secret)
JWT_SECRET=your-super-secret-jwt-key-min-32-chars-recommended

# CORS (Replace with your actual frontend URL after frontend deployment)
CORS_ORIGIN=https://trek-tribe-web.onrender.com
FRONTEND_URL=https://trek-tribe-web.onrender.com

# Email Service (For notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password

# Razorpay (For payments)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_secret

# OpenAI (Optional but RECOMMENDED for AI features)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
GENERAL_AI_MODEL=gpt-3.5-turbo
RAG_MODEL=gpt-3.5-turbo

# Optional Performance Settings
AI_PUBLIC_FALLBACK=true
ENABLE_CACHING=true
```

**How to Generate JWT_SECRET:**
```bash
# Run in terminal
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

#### C. Health Check Configuration
```
Health Check Path: /health
Health Check Timeout: 30 seconds
```

### Step 3: Deploy Frontend on Render

#### A. Create New Static Site
1. In Render Dashboard, click **"New +"** → **"Static Site"**
2. Connect same GitHub repository
3. Configure:

**Service Details:**
```
Name: trek-tribe-web
Branch: main
Root Directory: web
```

**Build Settings:**
```
Build Command: npm install && npm run build
Publish Directory: build
```

**Environment Variables:**
```bash
# Replace with your actual backend URL after backend deployment
REACT_APP_API_URL=https://trek-tribe-api.onrender.com
REACT_APP_BACKEND_URL=https://trek-tribe-api.onrender.com
```

### Step 4: Update CORS After Deployment

⚠️ **IMPORTANT**: After both services are deployed:

1. Get your frontend URL (e.g., `https://trek-tribe-web.onrender.com`)
2. Go to **Backend Service** → **Environment**
3. Update these variables:
   ```bash
   CORS_ORIGIN=https://trek-tribe-web.onrender.com
   FRONTEND_URL=https://trek-tribe-web.onrender.com
   ```
4. **Redeploy backend** for changes to take effect

### Step 5: Database Setup (MongoDB Atlas)

If you haven't already:

1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a free cluster
3. Click **"Connect"** → **"Connect your application"**
4. Copy connection string
5. Replace `<password>` with your database password
6. Add to Render environment variables as `MONGODB_URI`

**Allow Render IP Access:**
- In MongoDB Atlas → **Network Access**
- Click **"Add IP Address"**
- Select **"Allow access from anywhere"** (0.0.0.0/0)
- Or add specific Render IP ranges

## 🔍 Post-Deployment Verification

### 1. Check Backend Health
```bash
curl https://trek-tribe-api.onrender.com/health
# Expected: { "status": "ok", "timestamp": "..." }
```

### 2. Check Frontend
Open browser: `https://trek-tribe-web.onrender.com`
- Should load without errors
- Check browser console for any errors

### 3. Test AI Service
```bash
curl -X POST https://trek-tribe-api.onrender.com/chat/message \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What trips do you have?",
    "context": {}
  }'
```

### 4. Check Logs
- Render Dashboard → Your Service → **Logs**
- Look for:
  - ✅ "Server running on port 4000"
  - ✅ "Database connected successfully"
  - ✅ "Trek Tribe AI initialized"
  - ❌ Any error messages

## 🐛 Troubleshooting

### Issue: "Cannot connect to database"
**Solution:**
- Verify `MONGODB_URI` is correct
- Check MongoDB Atlas Network Access allows Render IPs
- Ensure database user has read/write permissions

### Issue: "CORS error" in browser
**Solution:**
- Verify `CORS_ORIGIN` matches your frontend URL exactly
- No trailing slash in URL
- Redeploy backend after changing CORS settings

### Issue: "AI service not configured"
**Solution:**
- Add `OPENAI_API_KEY` to environment variables
- Or check that knowledge base fallback is working
- AI will work without OpenAI but with reduced accuracy

### Issue: "500 Internal Server Error"
**Solution:**
- Check Render logs for specific error
- Verify all required environment variables are set
- Check if any services (email, payment) need API keys

### Issue: Frontend shows "Network Error"
**Solution:**
- Update `REACT_APP_API_URL` in frontend environment variables
- Ensure backend is running and accessible
- Check browser console for actual error message

## 📊 Monitoring

### Render Built-in Metrics
- **Dashboard** shows:
  - Response times
  - Memory usage
  - CPU usage
  - Request counts

### Custom Metrics Endpoint
```bash
# Prometheus-format metrics
curl https://trek-tribe-api.onrender.com/metrics
```

### Log Aggregation
- Enable log streaming: Dashboard → Service → Logs → **"Stream Logs"**
- Download logs for analysis

## 💰 Cost Optimization

### Free Tier Limitations:
- **Backend (Free)**: Spins down after 15 min inactivity
- **Frontend (Free)**: Always available
- **First Request**: May take 30-60s to wake up
- **Recommendation**: Upgrade to Starter ($7/mo) for production

### Upgrade Benefits:
- No spin-down
- Faster response times
- More memory/CPU
- Custom domain support
- Better for production

## 🔒 Security Checklist

- ✅ JWT_SECRET is strong and unique
- ✅ Database credentials are secure
- ✅ API keys are set as environment variables (not in code)
- ✅ CORS is configured correctly
- ✅ HTTPS is enabled (automatic with Render)
- ✅ Rate limiting is enabled in production
- ✅ Helmet.js security headers are active

## 🎯 Performance Tips

### Backend Optimization:
1. **Enable caching**: `ENABLE_CACHING=true` (already set)
2. **Use OpenAI**: For best AI accuracy
3. **Monitor logs**: Watch for slow queries
4. **Database indexes**: Ensure proper indexing in MongoDB

### Frontend Optimization:
1. **Static assets**: Automatically optimized by Render
2. **CDN**: Consider Cloudflare if needed
3. **Image optimization**: Compress images before upload
4. **Code splitting**: Already handled by React build

## 📝 Deployment Checklist

Before going live:

- [ ] All environment variables configured
- [ ] Database connection tested
- [ ] CORS settings updated with frontend URL
- [ ] Email service credentials valid
- [ ] Payment gateway (Razorpay) credentials valid
- [ ] Frontend API URL points to backend
- [ ] Health endpoints responding
- [ ] AI service functional
- [ ] Test user registration
- [ ] Test trip booking flow
- [ ] Test payment flow
- [ ] Monitor logs for errors

## 🚀 You're Ready!

Your application is now deployed and ready for users. Monitor the logs and metrics, and iterate based on user feedback.

### Quick Links:
- **Backend**: `https://trek-tribe-api.onrender.com`
- **Frontend**: `https://trek-tribe-web.onrender.com`
- **Render Dashboard**: `https://dashboard.render.com`

### Support Resources:
- Render Docs: https://render.com/docs
- MongoDB Atlas Docs: https://docs.atlas.mongodb.com
- OpenAI Docs: https://platform.openai.com/docs

---

**Last Updated**: December 10, 2025
**Status**: ✅ Deployment Ready
**TypeScript Errors**: 0
**Build Status**: Success
