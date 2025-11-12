# 🔧 Complete Environment Variables Guide

## Backend Environment Variables (services/api/.env)

### 🔴 Required (Must Have)

```bash
# ============================================
# CORE CONFIGURATION
# ============================================

# Server Configuration
PORT=4000
NODE_ENV=development

# Database (MongoDB)
MONGODB_URI=mongodb://127.0.0.1:27017/trekktribe
# Production: mongodb+srv://username:password@cluster.mongodb.net/trekktribe

# JWT Secret (CRITICAL - Generate secure key)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your_super_secure_jwt_secret_key_minimum_32_characters_long

# ============================================
# PAYMENT GATEWAY (Razorpay)
# ============================================

RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
RAZORPAY_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxx

# ============================================
# FRONTEND & CORS
# ============================================

FRONTEND_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# ============================================
# EMAIL SERVICE (Gmail SMTP)
# ============================================

# Gmail App Password (not regular password!)
# Setup: Google Account → Security → 2-Step Verification → App passwords
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your_16_character_app_password

# ============================================
# SMS SERVICE (Twilio)
# ============================================

# Get from: https://www.twilio.com/console
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890
DEFAULT_COUNTRY_CODE=91
```

### 🟡 Optional (Recommended)

```bash
# ============================================
# AI FEATURES (OpenAI)
# ============================================

# Get from: https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# ============================================
# WHATSAPP INTEGRATION
# ============================================

# WhatsApp Web.js (QR code based, no API key needed)
WHATSAPP_ENABLED=true
# Note: Scan QR code on first run to authenticate

# ============================================
# TELEGRAM INTEGRATION
# ============================================

# Get from: https://t.me/BotFather
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_ENABLED=false

# ============================================
# FIREBASE (File Storage)
# ============================================

FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789012
FIREBASE_APP_ID=1:123456789012:web:abcdef123456

# ============================================
# GOOGLE OAUTH
# ============================================

# Get from: https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# ============================================
# FILE UPLOAD
# ============================================

MAX_FILE_SIZE=10485760
UPLOAD_DIR=uploads

# ============================================
# LOGGING & MONITORING
# ============================================

LOG_LEVEL=info
# Options: error, warn, info, debug

# ============================================
# RATE LIMITING
# ============================================

# Enable in production
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

---

## Frontend Environment Variables (web/.env)

### 🔴 Required

```bash
# ============================================
# API CONNECTION
# ============================================

REACT_APP_API_URL=http://localhost:4000
# Production: https://your-api-domain.com

# ============================================
# RAZORPAY (Frontend)
# ============================================

REACT_APP_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx
```

### 🟡 Optional

```bash
# ============================================
# FIREBASE (Frontend)
# ============================================

REACT_APP_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
REACT_APP_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
REACT_APP_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=123456789012
REACT_APP_FIREBASE_APP_ID=1:123456789012:web:abcdef123456

# ============================================
# GOOGLE OAUTH (Frontend)
# ============================================

REACT_APP_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com

# ============================================
# ANALYTICS
# ============================================

REACT_APP_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
REACT_APP_SENTRY_DSN=https://xxxxx@sentry.io/xxxxx

# ============================================
# FEATURE FLAGS
# ============================================

REACT_APP_ENABLE_AI_CHAT=true
REACT_APP_ENABLE_SOCIAL_LOGIN=true
REACT_APP_ENABLE_WHATSAPP=true
```

---

## Production Environment Variables

### Backend (Render/Railway/etc.)

```bash
# ============================================
# PRODUCTION BACKEND
# ============================================

NODE_ENV=production
PORT=10000

# MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/trekktribe?retryWrites=true&w=majority

# JWT Secret (MUST be different from development)
JWT_SECRET=<generate_new_64_character_hex_string>

# Razorpay Live Keys
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=<live_secret>
RAZORPAY_WEBHOOK_SECRET=<live_webhook_secret>

# Production URLs
FRONTEND_URL=https://trek-tribe.com
CORS_ORIGIN=https://trek-tribe.com,https://www.trek-tribe.com
ALLOWED_ORIGINS=https://trek-tribe.com,https://www.trek-tribe.com

# Production Email (use real SMTP service)
GMAIL_USER=noreply@trek-tribe.com
GMAIL_APP_PASSWORD=<app_password>

# Twilio Production
TWILIO_ACCOUNT_SID=<production_sid>
TWILIO_AUTH_TOKEN=<production_token>
TWILIO_PHONE_NUMBER=<production_number>

# OpenAI Production
OPENAI_API_KEY=sk-<production_key>

# WhatsApp Production
WHATSAPP_ENABLED=true

# Rate Limiting (Enable in production)
RATE_LIMIT_ENABLED=true

# Logging
LOG_LEVEL=warn
```

### Frontend (Vercel/Netlify/etc.)

```bash
# ============================================
# PRODUCTION FRONTEND
# ============================================

REACT_APP_API_URL=https://api.trek-tribe.com

# Razorpay Live
REACT_APP_RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxxxx

# Firebase Production
REACT_APP_FIREBASE_API_KEY=<production_key>
REACT_APP_FIREBASE_AUTH_DOMAIN=trek-tribe.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=trek-tribe
REACT_APP_FIREBASE_STORAGE_BUCKET=trek-tribe.appspot.com

# Google OAuth Production
REACT_APP_GOOGLE_CLIENT_ID=<production_client_id>

# Analytics
REACT_APP_GOOGLE_ANALYTICS_ID=G-XXXXXXXXXX
```

---

## Environment Variable Setup Instructions

### Backend Setup

1. **Copy .env.example:**
   ```bash
   cd services/api
   cp .env.example .env
   ```

2. **Generate JWT Secret:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Get Razorpay Keys:**
   - Go to [Razorpay Dashboard](https://dashboard.razorpay.com)
   - Settings → API Keys
   - Copy Key ID and Secret
   - Settings → Webhooks → Create webhook
   - Copy webhook secret

4. **Gmail Setup:**
   - Enable 2FA on Gmail
   - Generate App Password: [App Passwords](https://myaccount.google.com/apppasswords)
   - Use this instead of regular password

5. **Twilio Setup:**
   - Sign up at [Twilio](https://www.twilio.com/try-twilio)
   - Get Account SID, Auth Token from Console
   - Buy a phone number

6. **OpenAI Setup (Optional):**
   - Go to [OpenAI](https://platform.openai.com/api-keys)
   - Create API key

### Frontend Setup

1. **Copy .env.example:**
   ```bash
   cd web
   cp .env.example .env
   ```

2. **Set API URL:**
   ```bash
   REACT_APP_API_URL=http://localhost:4000
   ```

3. **Add Razorpay Key:**
   ```bash
   REACT_APP_RAZORPAY_KEY_ID=rzp_test_xxxxxx
   ```

---

## Verification Checklist

### Backend
- [ ] MongoDB connection string is correct
- [ ] JWT_SECRET is at least 32 characters
- [ ] Razorpay keys are from correct environment (test/live)
- [ ] Gmail App Password (not regular password)
- [ ] Twilio credentials are valid
- [ ] FRONTEND_URL matches your frontend URL
- [ ] All required variables are set

### Frontend
- [ ] REACT_APP_API_URL points to backend
- [ ] REACT_APP_RAZORPAY_KEY_ID matches backend
- [ ] Firebase config is complete (if using)
- [ ] Google Client ID matches backend (if using OAuth)

---

## Testing Environment Variables

### Test Backend Variables

```bash
# Run this to verify all required vars are set
cd services/api
npm run dev
```

**Look for errors about missing environment variables.**

### Test Frontend Variables

```bash
# Run this to verify frontend can connect
cd web
npm start
```

**Check console for connection errors.**

---

## Common Issues

### Issue: "JWT_SECRET must be at least 32 characters"
**Solution:** Generate a longer secret using crypto

### Issue: "Failed to connect to MongoDB"
**Solution:** Check MONGODB_URI format and network access

### Issue: "Razorpay authentication failed"
**Solution:** Verify Key ID and Secret match your dashboard

### Issue: "Gmail authentication failed"
**Solution:** Use App Password, not regular password

### Issue: "CORS error in frontend"
**Solution:** Ensure FRONTEND_URL in backend matches actual frontend URL

---

## Security Best Practices

1. **Never commit .env files** to Git
2. **Use different keys** for development and production
3. **Rotate secrets regularly** (every 90 days)
4. **Use strong JWT secrets** (64+ characters)
5. **Enable rate limiting** in production
6. **Use HTTPS** in production
7. **Restrict CORS origins** to known domains
8. **Enable 2FA** on all service accounts

---

## Quick Reference

| Variable | Required | Where to Get | Purpose |
|----------|----------|--------------|---------|
| JWT_SECRET | ✅ Yes | Generate with crypto | Authentication |
| MONGODB_URI | ✅ Yes | MongoDB Atlas | Database |
| RAZORPAY_KEY_ID | ✅ Yes | Razorpay Dashboard | Payments |
| GMAIL_USER | ✅ Yes | Gmail Account | Emails |
| TWILIO_ACCOUNT_SID | ✅ Yes | Twilio Console | SMS |
| OPENAI_API_KEY | ⚠️ Optional | OpenAI Platform | AI Features |
| FRONTEND_URL | ✅ Yes | Your domain | CORS |

---

**Last Updated:** November 12, 2025  
**Version:** 3.0.0
