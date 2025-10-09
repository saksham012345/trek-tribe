# Vercel Environment Variables Configuration

## 🌐 **Required Environment Variables for Vercel Deployment**

When deploying to Vercel, add these environment variables in your Vercel project dashboard:

### **🔗 API Configuration (REQUIRED)**
```
REACT_APP_API_URL=https://trek-tribe-38in.onrender.com
```

### **📱 App Configuration**
```
REACT_APP_APP_NAME=Trek Tribe
REACT_APP_VERSION=1.0.0
```

### **⚙️ Build Optimization**
```
GENERATE_SOURCEMAP=false
TSC_COMPILE_ON_ERROR=true
ESLINT_NO_DEV_ERRORS=true
```

### **🔌 Real-time Features**
```
REACT_APP_SOCKET_URL=https://trek-tribe-38in.onrender.com
```

### **🚀 Feature Flags**
```
REACT_APP_ENABLE_REAL_TIME_CHAT=true
REACT_APP_ENABLE_AI_SUPPORT=true
REACT_APP_ENABLE_QR_PAYMENTS=true
```

---

## 📋 **How to Add Environment Variables in Vercel**

1. **Go to your Vercel project dashboard**
2. **Click on "Settings"**
3. **Click on "Environment Variables"**
4. **Add each variable:**
   - **Key**: `REACT_APP_API_URL`
   - **Value**: `https://trek-tribe-38in.onrender.com`
   - **Environment**: Select "Production", "Preview", and "Development"

5. **Repeat for all variables above**

---

## ✅ **Environment Variable Checklist**

- [ ] `REACT_APP_API_URL` - **CRITICAL** - Your backend API URL
- [ ] `REACT_APP_APP_NAME` - App display name
- [ ] `REACT_APP_VERSION` - App version
- [ ] `GENERATE_SOURCEMAP` - Build optimization (false for production)
- [ ] `TSC_COMPILE_ON_ERROR` - Allow build with TypeScript warnings
- [ ] `ESLINT_NO_DEV_ERRORS` - Treat ESLint issues as warnings
- [ ] `REACT_APP_SOCKET_URL` - WebSocket/Socket.IO server URL
- [ ] `REACT_APP_ENABLE_REAL_TIME_CHAT` - Enable chat features
- [ ] `REACT_APP_ENABLE_AI_SUPPORT` - Enable AI support features
- [ ] `REACT_APP_ENABLE_QR_PAYMENTS` - Enable QR payment features

---

## 🔧 **Local Development**

Your local `.env` file is already configured with the correct values. To run locally:

```bash
npm start
```

The app will connect to your deployed backend at `https://trek-tribe-38in.onrender.com`.

---

## 🚨 **Important Notes**

1. **REACT_APP_API_URL** is the most critical variable - without it, your app won't work
2. All environment variables starting with `REACT_APP_` are embedded into the client-side bundle
3. **Never put sensitive secrets** in React environment variables (they're visible to users)
4. After adding/changing variables in Vercel, **redeploy** your app for changes to take effect

---

## 🎯 **Quick Copy-Paste for Vercel**

```
REACT_APP_API_URL=https://trek-tribe-38in.onrender.com
REACT_APP_APP_NAME=Trek Tribe
REACT_APP_VERSION=1.0.0
GENERATE_SOURCEMAP=false
TSC_COMPILE_ON_ERROR=true
ESLINT_NO_DEV_ERRORS=true
REACT_APP_SOCKET_URL=https://trek-tribe-38in.onrender.com
REACT_APP_ENABLE_REAL_TIME_CHAT=true
REACT_APP_ENABLE_AI_SUPPORT=true
REACT_APP_ENABLE_QR_PAYMENTS=true
```