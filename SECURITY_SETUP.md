# 🔒 Security Setup Guide for Trekk Tribe

## 🚨 **CRITICAL: Before First Run**

This project has been configured with **enhanced security measures**. You **MUST** set up environment variables before running the application.

## 📋 **Quick Setup**

### 1. **Create Environment Files**
```bash
# Copy the template
cp env.example .env

# For frontend (if needed)
cp web/env.example web/.env
```

### 2. **Required Environment Variables**

#### **Backend (.env)**
```bash
# Application
NODE_ENV=development
PORT=4000

# Database (REQUIRED)
MONGODB_URI=mongodb://localhost:27017/trekktribe

# Security (REQUIRED)
JWT_SECRET=your_super_secure_jwt_secret_here
SESSION_SECRET=your_session_secret_here

# Email Service (Optional)
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password

# Frontend URLs
FRONTEND_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
```

#### **Frontend (.env)**
```bash
REACT_APP_API_URL=http://localhost:4000
REACT_APP_APP_NAME=Trek Tribe
REACT_APP_VERSION=1.0.0
```

### 3. **Generate Secure Secrets**

#### **JWT Secret (32+ characters)**
```bash
# Option 1: Use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Option 2: Use OpenSSL
openssl rand -hex 32

# Option 3: Use online generator
# Visit: https://generate-secret.vercel.app/32
```

#### **Session Secret**
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

## 🛡️ **Security Features Implemented**

### ✅ **Environment Variable Validation**
- Application will **fail to start** without required environment variables
- No default secrets or credentials
- Clear error messages for missing variables

### ✅ **Enhanced .gitignore**
- Excludes all sensitive files and directories
- Prevents accidental commits of secrets
- Comprehensive coverage of common sensitive files

### ✅ **Pre-commit Security Checks**
- Automated security validation before commits
- Prevents committing sensitive data
- Warns about potential security issues

### ✅ **Secure Defaults**
- No hardcoded passwords or secrets
- Required environment variables
- Production-ready security configurations

## 🔧 **Environment Setup by Use Case**

### **Local Development**
```bash
# .env
NODE_ENV=development
PORT=4000
MONGODB_URI=mongodb://localhost:27017/trekktribe
JWT_SECRET=dev_secret_32_chars_minimum_length
FRONTEND_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
```

### **Production (Render.com)**
```bash
# Environment variables in Render dashboard
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/trekktribe
JWT_SECRET=production_secret_32_chars_minimum_length
FRONTEND_URL=https://your-frontend-domain.onrender.com
CORS_ORIGIN=https://your-frontend-domain.onrender.com
GMAIL_USER=your_production_email@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password
```

### **Production (Vercel)**
```bash
# Environment variables in Vercel dashboard
NODE_ENV=production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/trekktribe
JWT_SECRET=production_secret_32_chars_minimum_length
FRONTEND_URL=https://your-frontend-domain.vercel.app
CORS_ORIGIN=https://your-frontend-domain.vercel.app
```

## 🚫 **What's Protected**

### **Files Never Committed**
- `.env` files
- Log files (`*.log`, `logs/`)
- Upload directories (`uploads/`)
- WhatsApp session data (`.wwebjs_auth/`)
- Build artifacts (`dist/`, `build/`)
- Database files (`*.db`, `*.sqlite`)
- SSL certificates (`*.pem`, `*.key`)

### **Secrets Never in Code**
- Database passwords
- JWT secrets
- API keys
- Email passwords
- Session secrets
- OAuth credentials

## 🔍 **Security Validation**

### **Pre-commit Check**
```bash
# Run security check before committing
.\pre-commit-check.ps1

# Or manually check for secrets
git diff --cached | grep -i "password\|secret\|key"
```

### **Environment Validation**
```bash
# Check if required variables are set
node -e "
require('dotenv').config();
const required = ['MONGODB_URI', 'JWT_SECRET'];
const missing = required.filter(key => !process.env[key]);
if (missing.length) {
  console.error('❌ Missing:', missing.join(', '));
  process.exit(1);
}
console.log('✅ All required environment variables are set');
"
```

## 🆘 **Troubleshooting**

### **"JWT_SECRET environment variable is required"**
```bash
# Add to .env file
JWT_SECRET=your_super_secure_jwt_secret_here
```

### **"MONGODB_URI environment variable is required"**
```bash
# Add to .env file
MONGODB_URI=mongodb://localhost:27017/trekktribe
```

### **"Gmail credentials not configured"**
```bash
# Optional - add to .env file for email features
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password
```

### **WhatsApp Service Issues**
- WhatsApp service is optional
- App will run without it
- Check logs for initialization errors

## 📚 **Security Best Practices**

### **Environment Variables**
- Use strong, unique secrets (32+ characters)
- Different secrets for development/production
- Rotate secrets regularly
- Never share secrets in chat/email

### **Database Security**
- Use authentication in connection strings
- Enable SSL/TLS for production
- Use strong database passwords
- Limit access by IP address

### **Code Security**
- Never hardcode secrets
- Use environment variables
- Validate all inputs
- Keep dependencies updated

## 🔄 **Migration from Insecure Version**

If you're upgrading from a version with hardcoded secrets:

1. **Backup your data**
2. **Update environment variables**
3. **Remove old .env files from git history**:
   ```bash
   git filter-branch --force --index-filter 'git rm --cached --ignore-unmatch .env' --prune-empty --tag-name-filter cat -- --all
   ```
4. **Test the application**
5. **Deploy with new environment variables**

## 📞 **Support**

If you encounter security issues:

1. **Check environment variables**
2. **Review error messages**
3. **Consult this guide**
4. **Check logs for details**

## ⚠️ **Final Reminder**

**This application will NOT start without proper environment variables. This is by design for security.**

Make sure to:
- ✅ Create `.env` file from template
- ✅ Set all required variables
- ✅ Use strong, unique secrets
- ✅ Never commit `.env` files

---

**Security is everyone's responsibility. Stay vigilant!** 🛡️
