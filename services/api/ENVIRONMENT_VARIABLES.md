# 🔧 Trek Tribe Environment Variables Reference

## 📋 Environment Files Structure

Your project now has a secure environment setup:

```
services/api/
├── .env                      # Safe template (tracked in git)
├── .env.local               # Real secrets (ignored by git)
├── .env.example             # Public template (tracked in git)
├── .env.production.template # Production template (tracked in git)
└── .gitignore              # Updated to exclude secrets
```

## 🔐 Security Status

✅ **SECURED**: Real Firebase secrets moved to `.env.local`
✅ **PROTECTED**: `.env.local` is ignored by git
✅ **SAFE**: Only template values are tracked in git
✅ **READY**: Production template ready for deployment

## 📊 Environment Variables by Category

### 🖥️ **Server Configuration (Required)**
```env
PORT=4000                    # Server port (auto-set by Render)
NODE_ENV=development         # Environment mode
LOG_LEVEL=info              # Logging level
```

### 🗄️ **Database (Required)**
```env
# Local Development
MONGODB_URI=mongodb://127.0.0.1:27017/trekktribe

# Production (MongoDB Atlas)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/trekktribe
```

### 🔒 **Security (Required)**
```env
JWT_SECRET=your_super_secure_jwt_secret  # Auto-generated in production
```

### 🌐 **CORS & Frontend (Required)**
```env
# Development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
FRONTEND_URL=http://localhost:3000

# Production
ALLOWED_ORIGINS=https://trektribe.in,https://www.trektribe.in
FRONTEND_URL=https://trektribe.in
```

### 📧 **Email Service (Required for OTP)**
```env
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com          # Use Gmail app password
EMAIL_PASSWORD=your-app-password         # NOT regular password
EMAIL_FROM_NAME=Trek Tribe
EMAIL_FROM_ADDRESS=your-email@gmail.com
```

### 🔥 **Firebase Storage (Optional - For Cloud Backup)**
```env
FIREBASE_API_KEY=your_firebase_api_key
FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
FIREBASE_MESSAGING_SENDER_ID=your_sender_id
FIREBASE_APP_ID=your_app_id
```

### 🔐 **Google OAuth (Optional)**
```env
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:4000/auth/google/callback
```

### 📱 **SMS Services (Optional)**
```env
# Twilio SMS
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# WhatsApp Business API
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token
WHATSAPP_PHONE_NUMBER_ID=your_whatsapp_phone_number_id
```

### ⚙️ **OTP Configuration**
```env
OTP_EXPIRY_MINUTES=10          # OTP validity period
OTP_RATE_LIMIT_MINUTES=1       # Rate limit between requests
MAX_OTP_ATTEMPTS=3             # Max verification attempts
```

### 📁 **File Upload Configuration**
```env
MAX_FILE_SIZE=10485760         # 10MB in bytes
UPLOAD_DIR=uploads             # Upload directory
```

### 💳 **Payment Configuration**
```env
UPI_ID=support@trektribe.in    # Your UPI ID
MERCHANT_NAME=Trek Tribe       # Business name
```

## 🏗️ Environment Setup by Platform

### **Local Development**
1. Copy `.env.example` to `.env`
2. Add real secrets to `.env.local`
3. Use `npm run dev`

### **Render Production**
Set these in Render dashboard:
```env
MONGODB_URI=mongodb+srv://...
EMAIL_USER=noreply@trektribe.in
EMAIL_PASSWORD=your_gmail_app_password
FIREBASE_API_KEY=AIza...
FIREBASE_AUTH_DOMAIN=trek-tribe-5cdb0.firebaseapp.com
# ... other Firebase vars
```

### **Railway/Vercel/Other**
Use the `.env.production.template` as reference

## 🚨 Critical Security Notes

### ❌ **NEVER commit these to git:**
- Real API keys (Firebase, Twilio, Google)
- Database passwords
- JWT secrets
- Email passwords
- Any token with actual values

### ✅ **Safe to commit:**
- Template files with placeholder values
- Configuration without secrets
- Documentation
- Example values

## 🔧 How Environment Loading Works

```typescript
// Your app loads environment variables in this order:
1. .env.local          // Real secrets (ignored by git)
2. .env                // Safe template (tracked by git)
3. .env.example        // Fallback template
```

## 📱 Quick Reference

### **Minimum Required for Basic Functionality:**
- `MONGODB_URI` - Database connection
- `JWT_SECRET` - Authentication
- `EMAIL_USER` & `EMAIL_PASSWORD` - OTP system

### **Optional for Enhanced Features:**
- Firebase - Cloud file storage
- Google OAuth - Social login
- Twilio - SMS verification
- WhatsApp - Message notifications

## 🛠️ Testing Your Setup

```bash
# Check if environment is loaded correctly
curl http://localhost:4000/health

# Test email OTP (requires EMAIL_USER & EMAIL_PASSWORD)
curl -X POST http://localhost:4000/otp/send \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","type":"signup"}'
```

---

Your Trek Tribe backend is now secure and ready for deployment! 🚀