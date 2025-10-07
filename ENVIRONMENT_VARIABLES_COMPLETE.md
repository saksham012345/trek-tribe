# 🔐 Complete Environment Variables for Trekk Tribe

## ⚠️ **IMPORTANT: Download This File Before Pushing to GitHub!**

This file contains ALL environment variables and secrets needed to run your project. **Save this file locally** before pushing to GitHub, as it won't be included in the repository for security reasons.

---

## 📋 **Backend Environment Variables (.env)**

### **Complete .env File Content:**
```bash
# Trekk Tribe Environment Variables
# This file contains all the secrets and configuration needed to run the project
# ⚠️ NEVER COMMIT THIS FILE TO GIT ⚠️

# ===========================================
# APPLICATION CONFIGURATION
# ===========================================
NODE_ENV=development
PORT=4000

# ===========================================
# DATABASE CONFIGURATION
# ===========================================
# MongoDB connection string for local development
MONGODB_URI=mongodb://localhost:27017/trekktribe

# ===========================================
# AUTHENTICATION & SECURITY
# ===========================================
# JWT secret key (64 characters - SECURE)
JWT_SECRET=7cf6f1cdb36cb131607191543a788defab95449447645a0b6a08ef464630d374

# Session secret for express-session (32 characters - SECURE)
SESSION_SECRET=471a743fbdbf18410a3c0d78908cb61e

# ===========================================
# EMAIL SERVICE (Gmail SMTP)
# ===========================================
# Gmail account credentials for sending emails
# Replace with your actual Gmail credentials
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password

# ===========================================
# WHATSAPP SERVICE
# ===========================================
# WhatsApp Web.js configuration (optional)
WHATSAPP_SESSION_PATH=./.wwebjs_auth

# ===========================================
# FRONTEND CONFIGURATION
# ===========================================
# Frontend URL for CORS and redirects
FRONTEND_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000

# ===========================================
# LOGGING CONFIGURATION
# ===========================================
LOG_LEVEL=info
LOG_DIR=./logs

# ===========================================
# FILE UPLOAD CONFIGURATION
# ===========================================
# Maximum file upload size (in bytes) - 10MB
MAX_FILE_SIZE=10485760
```

---

## 📋 **Frontend Environment Variables (web/.env)**

### **Complete web/.env File Content:**
```bash
# Frontend Environment Variables
# This file contains all the configuration needed for the React frontend
# ⚠️ NEVER COMMIT THIS FILE TO GIT ⚠️

# ===========================================
# API CONFIGURATION
# ===========================================
# Backend API URL
REACT_APP_API_URL=http://localhost:4000

# ===========================================
# APPLICATION CONFIGURATION
# ===========================================
REACT_APP_APP_NAME=Trek Tribe
REACT_APP_VERSION=1.0.0
```

---

## 🔑 **Critical Secrets & Values**

### **Security Secrets (Generated Securely):**
```bash
# JWT Secret (64 characters) - DO NOT SHARE
JWT_SECRET=7cf6f1cdb36cb131607191543a788defab95449447645a0b6a08ef464630d374

# Session Secret (32 characters) - DO NOT SHARE
SESSION_SECRET=471a743fbdbf18410a3c0d78908cb61e
```

### **Database Configuration:**
```bash
# Local Development
MONGODB_URI=mongodb://localhost:27017/trekktribe

# Production (MongoDB Atlas) - Replace with your actual values
# MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/trekktribe
```

### **Email Configuration (Optional):**
```bash
# Gmail SMTP Settings - Replace with your actual values
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password
```

---

## 🚨 **Files Hidden from GitHub (Download These!)**

### **Environment Files (Not in GitHub):**
- ✅ **`.env`** - Backend environment variables
- ✅ **`web/.env`** - Frontend environment variables
- ✅ **`.env.backup`** - Backup of previous environment
- ✅ **`web/.env.backup`** - Backup of previous frontend environment

### **Log Files (Not in GitHub):**
- ✅ **`services/api/logs/2025-10-07.log`** - Application logs
- ✅ **`services/api/logs/2025-10-07-errors.log`** - Error logs
- ✅ **All future log files** - Automatically excluded

### **Upload Directories (Not in GitHub):**
- ✅ **`services/api/uploads/documents/`** - User uploaded documents
- ✅ **`services/api/uploads/images/`** - User uploaded images
- ✅ **`services/api/uploads/temp/`** - Temporary upload files
- ✅ **`services/api/uploads/videos/`** - User uploaded videos

### **WhatsApp Session Data (Not in GitHub):**
- ✅ **`.wwebjs_auth/`** - WhatsApp authentication data
- ✅ **`.wwebjs_cache/`** - WhatsApp cache data

### **Build Artifacts (Not in GitHub):**
- ✅ **`dist/`** - Compiled backend code
- ✅ **`build/`** - Compiled frontend code
- ✅ **`node_modules/`** - Dependencies (reinstalled via npm)

---

## 📥 **Pre-Push Download Checklist**

### **Before Pushing to GitHub, Download:**

#### **🔐 Critical Files:**
- [ ] **`.env`** - Backend environment variables
- [ ] **`web/.env`** - Frontend environment variables
- [ ] **This file** - `ENVIRONMENT_VARIABLES_COMPLETE.md`

#### **📁 Important Directories:**
- [ ] **`services/api/logs/`** - All log files
- [ ] **`services/api/uploads/`** - All upload directories
- [ ] **`.wwebjs_auth/`** - WhatsApp session data (if exists)

#### **🔧 Development Files:**
- [ ] **`env-for-development`** - Environment template
- [ ] **`web/env-for-development`** - Frontend template
- [ ] **`setup-project.ps1`** - Setup script

---

## 🚀 **How to Restore After GitHub Clone**

### **Step 1: Clone Repository**
```bash
git clone https://github.com/yourusername/trek-tribe.git
cd trek-tribe
```

### **Step 2: Restore Environment Files**
```bash
# Create backend .env file
echo "NODE_ENV=development
PORT=4000
MONGODB_URI=mongodb://localhost:27017/trekktribe
JWT_SECRET=7cf6f1cdb36cb131607191543a788defab95449447645a0b6a08ef464630d374
SESSION_SECRET=471a743fbdbf18410a3c0d78908cb61e
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_gmail_app_password
WHATSAPP_SESSION_PATH=./.wwebjs_auth
FRONTEND_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000
LOG_LEVEL=info
LOG_DIR=./logs
MAX_FILE_SIZE=10485760" > .env

# Create frontend .env file
echo "REACT_APP_API_URL=http://localhost:4000
REACT_APP_APP_NAME=Trek Tribe
REACT_APP_VERSION=1.0.0" > web/.env
```

### **Step 3: Install Dependencies**
```bash
npm run install:all
```

### **Step 4: Start Application**
```bash
# Start MongoDB
docker run -d -p 27017:27017 --name trekk-mongo mongo:6

# Start backend
npm run dev:api

# Start frontend (new terminal)
npm run dev:web
```

---

## 🔒 **Security Notes**

### **What's Protected:**
- ✅ **All secrets** are in environment variables
- ✅ **No hardcoded credentials** in source code
- ✅ **Environment files** are gitignored
- ✅ **Log files** are excluded from repository
- ✅ **Upload directories** are excluded from repository
- ✅ **Session data** is excluded from repository

### **What's Safe to Push:**
- ✅ **Source code** - No secrets included
- ✅ **Configuration templates** - Safe examples only
- ✅ **Documentation** - No real credentials
- ✅ **Setup scripts** - No hardcoded secrets

---

## 📞 **Support Information**

### **If You Lose This File:**
1. **Check your local backups** - Look for `.env` files
2. **Regenerate secrets** - Use the setup scripts
3. **Contact support** - Use the documentation guides

### **Emergency Recovery:**
```bash
# Regenerate JWT secret
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Regenerate session secret
node -e "console.log('SESSION_SECRET=' + require('crypto').randomBytes(16).toString('hex'))"
```

---

## ⚠️ **FINAL REMINDER**

**SAVE THIS FILE LOCALLY BEFORE PUSHING TO GITHUB!**

This file contains:
- 🔐 **All your secrets and passwords**
- 📁 **Complete environment configuration**
- 🚀 **Setup instructions for new environments**
- 🔒 **Security information**

**Without this file, you won't be able to run your project after cloning from GitHub!**

---

**Created:** $(date)  
**Project:** Trekk Tribe  
**Status:** GitHub-Ready with Security Hardening  
**Version:** 1.0.0
