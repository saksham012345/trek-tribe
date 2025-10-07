# 🚀 Quick Start Guide for Trekk Tribe

## ⚡ **Get Running in 5 Minutes**

### **Step 1: Setup Environment Files**
```bash
# Rename the environment files
mv env-for-development .env
mv web/env-for-development web/.env
```

### **Step 2: Start MongoDB**
```bash
# Option 1: Using Docker (Recommended)
docker run -d -p 27017:27017 --name trekk-mongo mongo:6

# Option 2: Local MongoDB installation
# Make sure MongoDB is running on localhost:27017
```

### **Step 3: Install Dependencies**
```bash
# Install all dependencies
npm run install:all
```

### **Step 4: Start the Application**
```bash
# Start backend (Terminal 1)
npm run dev:api

# Start frontend (Terminal 2)
npm run dev:web
```

### **Step 5: Access the Application**
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **API Health Check**: http://localhost:4000/health

## 🔧 **Environment Variables Included**

Your `.env` file contains:
- ✅ **Secure JWT Secret**: 64-character randomly generated
- ✅ **Secure Session Secret**: 32-character randomly generated
- ✅ **Database URI**: MongoDB localhost connection
- ✅ **All Required Variables**: Ready to run immediately

## 📧 **Optional: Email Setup**

To enable email features (booking confirmations, password reset):

1. **Get Gmail App Password**:
   - Go to Google Account settings
   - Enable 2-factor authentication
   - Generate an "App Password" for Trekk Tribe
   - Use this password (not your regular Gmail password)

2. **Update Environment Variables**:
   ```bash
   # Edit .env file
   GMAIL_USER=your_actual_email@gmail.com
   GMAIL_APP_PASSWORD=your_16_character_app_password
   ```

## 🐛 **Troubleshooting**

### **"JWT_SECRET environment variable is required"**
- Make sure you renamed `env-for-development` to `.env`
- Check that the file is in the project root directory

### **"MONGODB_URI environment variable is required"**
- Make sure MongoDB is running
- Check the connection string in `.env`

### **"Cannot connect to MongoDB"**
- Start MongoDB: `docker run -d -p 27017:27017 --name trekk-mongo mongo:6`
- Or install MongoDB locally

### **Frontend can't connect to backend**
- Make sure backend is running on port 4000
- Check `REACT_APP_API_URL` in `web/.env`

## 🎯 **Default Credentials**

The application comes with sample data. You can:
- **Register new accounts** (recommended)
- **Use demo accounts** (if seeded)

## 🔒 **Security Notes**

- ✅ All secrets are randomly generated and secure
- ✅ Environment files are gitignored
- ✅ No hardcoded credentials
- ✅ Production-ready security

## 📱 **Features Available**

- ✅ User registration and login
- ✅ Trip creation and management
- ✅ Trip booking system
- ✅ Review and rating system
- ✅ Admin dashboard
- ✅ Agent support system
- ✅ File upload system
- ✅ Email notifications (if configured)
- ✅ WhatsApp integration (optional)

## 🚀 **Next Steps**

1. **Explore the application**: Register and create trips
2. **Test features**: Try booking, reviews, admin functions
3. **Customize**: Update branding, colors, content
4. **Deploy**: Use the deployment guides for production

## 📚 **Documentation**

- **Security Setup**: `SECURITY_SETUP.md`
- **Deployment**: `DEPLOYMENT.md`
- **Features**: `FEATURES_ANALYSIS.md`
- **API Documentation**: Check `/health` endpoint

---

**You're all set! Enjoy exploring Trekk Tribe! 🎉**
