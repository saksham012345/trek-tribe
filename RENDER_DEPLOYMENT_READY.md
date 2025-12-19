# 🚀 Render Deployment Guide - Trek Tribe

## ✅ Pre-Deployment Status

Your project is **READY FOR RENDER DEPLOYMENT** with the following configuration:

- ✅ 3 services configured (API, AI, Web)
- ✅ All Dockerfiles ready
- ✅ Health checks configured
- ✅ Environment variables mapped
- ✅ Build commands set

---

## 📋 What You Need Before Starting

### 1. **External Services** (Get these ready first)

#### MongoDB Atlas (Free Tier)
1. Go to https://www.mongodb.com/cloud/atlas
2. Create free cluster (512MB, perfect for starting)
3. Get connection string: `mongodb+srv://username:password@cluster.mongodb.net/trektribe`
4. Whitelist IP: `0.0.0.0/0` (allow from anywhere)

#### Upstash Redis (Free Tier - Optional but Recommended)
1. Go to https://upstash.com
2. Create free database (10K requests/day)
3. Get connection string: `rediss://default:password@host.upstash.io:6379`

#### Razorpay (Test Mode)
1. Sign up at https://razorpay.com
2. Get Test Keys:
   - `RAZORPAY_KEY_ID`: `rzp_test_xxxxx`
   - `RAZORPAY_KEY_SECRET`: `your_secret`
   - `RAZORPAY_WEBHOOK_SECRET`: Generate in dashboard

#### Gmail SMTP (For emails)
1. Enable 2FA on your Gmail
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Note: `GMAIL_USER` and `GMAIL_APP_PASSWORD`

#### Generate Encryption Key
```powershell
# 32 character key for bank data encryption
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
```

---

## 🚀 Step-by-Step Deployment

### Step 1: Deploy to Render (Blueprint)

1. **Push to GitHub** (if not already):
   ```bash
   git add .
   git commit -m "Production ready"
   git push origin main
   ```

2. **Go to Render Dashboard**:
   - https://dashboard.render.com
   - Click **"New +"** → **"Blueprint"**

3. **Connect Repository**:
   - Connect your GitHub account
   - Select `trek-tribe` repository
   - Click **"Connect"**

4. **Render reads `render.yaml`**:
   - Will create 3 services automatically:
     - `trek-tribe-api` (Node.js)
     - `trek-tribe-ai-service` (Docker)
     - `trek-tribe-web` (Static)

5. **Click "Apply"** - Render will start creating services

---

### Step 2: Configure Environment Variables

Render will ask you to provide values for `sync: false` variables:

#### For **trek-tribe-api** service:

| Variable | Value | Where to Get |
|----------|-------|--------------|
| `MONGODB_URI` | `mongodb+srv://...` | MongoDB Atlas connection string |
| `AI_SERVICE_KEY` | Generate secure | `openssl rand -base64 32` |
| `RAZORPAY_KEY_ID` | `rzp_test_xxxxx` | Razorpay Dashboard |
| `RAZORPAY_KEY_SECRET` | Your secret | Razorpay Dashboard |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook secret | Razorpay Dashboard |
| `ENCRYPTION_KEY` | 32 char string | Generated above |
| `REDIS_URL` | `rediss://...` | Upstash Redis (optional) |
| `GMAIL_USER` | `your@gmail.com` | Your Gmail |
| `GMAIL_APP_PASSWORD` | 16 char code | Gmail App Passwords |

**Note**: `JWT_SECRET` and `SESSION_SECRET` auto-generate (no input needed)

#### For **trek-tribe-ai-service**:

| Variable | Value | Note |
|----------|-------|------|
| `AI_SERVICE_KEY` | **Same as API** | MUST match the one above! |
| `REDIS_URL` | Same as API | Optional |

**Note**: All other AI variables are pre-configured in `render.yaml`

#### For **trek-tribe-web**:

| Variable | Value | Where to Get |
|----------|-------|--------------|
| `REACT_APP_RAZORPAY_KEY_ID` | `rzp_test_xxxxx` | Same as API (public key) |

**Note**: All other frontend variables are pre-configured

---

### Step 3: Wait for Deployment

**Build Times** (approximate):
- 🟢 **API**: 3-5 minutes
- 🟠 **AI Service**: 8-12 minutes (downloads model ~900MB)
- 🟢 **Web**: 3-5 minutes

**Watch Logs**:
- Click each service
- View "Logs" tab
- Watch for "Deploy succeeded" ✅

---

### Step 4: Verify Deployment

#### Test API Health:
```bash
curl https://trek-tribe-api.onrender.com/health
# Expected: {"status":"ok","mongodb":"connected",...}
```

#### Test AI Service Health:
```bash
curl https://trek-tribe-ai-service.onrender.com/health
# Expected: {"status":"healthy","model_loaded":true}
```

#### Test Web:
Open: https://trek-tribe-web.onrender.com

---

### Step 5: Setup Demo Database (Production)

```bash
# SSH into API service or run locally with production MONGODB_URI
MONGODB_URI="mongodb+srv://..." node services/api/dist/scripts/setup-demo-database.js
```

Or use Render Shell:
1. Go to **trek-tribe-api** service
2. Click **"Shell"** tab
3. Run:
   ```bash
   node dist/scripts/setup-demo-database.js
   ```

This creates your 5 demo users in production.

---

## 🔐 Security Checklist

Before going live:

- [ ] Changed all default passwords
- [ ] Set strong `JWT_SECRET` (32+ chars)
- [ ] Set strong `ENCRYPTION_KEY` (32 chars)
- [ ] Set strong `AI_SERVICE_KEY` (32+ chars)
- [ ] MongoDB IP whitelist: `0.0.0.0/0` OR Render IPs
- [ ] Razorpay: Using test keys (switch to live when ready)
- [ ] Gmail: Using App Password (not real password)
- [ ] CORS: Limited to your domain only
- [ ] Health checks: All passing

---

## 📊 Render Free Tier Limits

**Per Service:**
- ✅ 750 hours/month (enough for 1 service 24/7)
- ✅ Sleeps after 15 min inactivity
- ✅ Cold start: ~30 seconds
- ⚠️ 3 services = shares 750 hours (not all 24/7)

**Recommendation for Free Tier:**
- Keep API and Web running 24/7
- AI Service sleeps when not used (acceptable cold start)

**OR upgrade API to $7/month Starter** for always-on + faster

---

## 🔄 Post-Deployment Updates

Whenever you push to GitHub:
1. Render auto-detects changes
2. Auto-deploys affected services
3. Zero downtime for static (web)
4. Brief restart for API/AI

**Manual Deploy**:
- Go to service → Click "Manual Deploy" → "Deploy latest commit"

---

## 🐛 Troubleshooting

### Build Fails
- Check "Logs" tab for errors
- Verify `package.json` scripts exist
- Ensure all dependencies in `package.json`

### API can't connect to MongoDB
- Check `MONGODB_URI` format
- Verify IP whitelist in MongoDB Atlas
- Check MongoDB cluster is running

### AI Service crashes
- Check memory usage (free tier: 512MB)
- Model too large? Switch to smaller: `google/flan-t5-small`
- Disable if not needed: Remove from `render.yaml`

### Frontend shows API errors
- Check `REACT_APP_API_URL` matches API service URL
- Check CORS settings in API
- Verify API is running (health check)

---

## 📞 Support

- **Render Docs**: https://render.com/docs
- **MongoDB Atlas**: https://docs.atlas.mongodb.com
- **Razorpay**: https://razorpay.com/docs

---

## ✅ Quick Deploy Checklist

- [ ] MongoDB Atlas cluster created
- [ ] Connection string ready
- [ ] Redis URL ready (optional)
- [ ] Razorpay test keys ready
- [ ] Gmail App Password ready
- [ ] Encryption key generated
- [ ] Code pushed to GitHub
- [ ] Render Blueprint deployed
- [ ] Environment variables configured
- [ ] All 3 services show "Live"
- [ ] Health checks passing
- [ ] Demo database setup run
- [ ] Test login works
- [ ] Payment flow tested (test mode)

---

**Status**: 🟢 **READY TO DEPLOY**

**Estimated Time**: 30 minutes (excluding external service setup)
