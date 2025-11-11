# 🔐 Trek-Tribe Secure Setup Guide

**Purpose:** Reset database with secure admin/agent accounts and test authentication

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Reset Database with Secure Users

Run this command from your project root:

```bash
cd C:\Users\hp\Development\trek-tribe\services\api
npm run tsx src/scripts/secure-reset-users.ts
```

**What this does:**
- ⚠️ Deletes ALL existing users from MongoDB
- ✅ Creates secure admin account
- ✅ Creates secure agent account
- 📋 Displays login credentials

**Expected Output:**
```
✅ Connected to MongoDB
🗑️  Deleting all existing users...
✅ Deleted X users from database

👑 Creating secure admin user...
✅ Admin user created successfully!

🎧 Creating secure agent user...
✅ Agent user created successfully!

════════════════════════════════════════════════════════════
✨ SECURE USER SETUP COMPLETE

🔐 LOGIN CREDENTIALS:

👑 ADMIN ACCESS:
   Email: admin@trektribe.com
   Password: SecureAdmin@2024
   Dashboard: /admin

🎧 AGENT ACCESS:
   Email: agent@trektribe.com
   Password: SecureAgent@2024
   Dashboard: /agent
════════════════════════════════════════════════════════════
```

---

## 🧪 Step 2: Test Admin Login

### Option A: From Your Deployed Website
1. Go to your website: `https://yourdomain.com/login`
2. Enter admin credentials:
   - **Email:** `admin@trektribe.com`
   - **Password:** `SecureAdmin@2024`
3. You should be logged in and redirected to home
4. Navigate to `/admin` to access admin dashboard

### Option B: Using API Directly (Testing)
```bash
# From PowerShell or Terminal
curl -X POST https://trek-tribe-38in.onrender.com/api/auth/login `
  -H "Content-Type: application/json" `
  -d '{"email":"admin@trektribe.com","password":"SecureAdmin@2024"}'
```

**Expected Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "...",
    "email": "admin@trektribe.com",
    "name": "TrekTribe Admin",
    "role": "admin",
    "createdAt": "..."
  }
}
```

---

## 🧪 Step 3: Test Agent Login

### From Website
1. Go to `/login`
2. Enter agent credentials:
   - **Email:** `agent@trektribe.com`
   - **Password:** `SecureAgent@2024`
3. Navigate to `/agent` to access agent dashboard

---

## 👥 Step 4: Create Test Traveler and Organizer Accounts

### Method 1: Register via Website (Recommended)
1. Go to `/register`
2. Fill in the form:
   - **Name:** Test Traveler
   - **Email:** traveler@test.com
   - **Password:** Test@1234
   - **Phone:** +911234567890
   - **Role:** Traveler
3. You'll receive SMS OTP (or see it in console if in dev mode)
4. Verify phone number
5. Login and test booking flow

**Repeat for Organizer:**
- Name: Test Organizer
- Email: organizer@test.com
- Password: Test@1234
- Phone: +919876543210
- Role: Organizer

### Method 2: Direct API Call (Faster for Testing)
```bash
# Create Traveler
curl -X POST https://trek-tribe-38in.onrender.com/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{
    "email": "traveler@test.com",
    "password": "Test@1234",
    "name": "Test Traveler",
    "phone": "+911234567890",
    "role": "traveler"
  }'

# Create Organizer
curl -X POST https://trek-tribe-38in.onrender.com/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{
    "email": "organizer@test.com",
    "password": "Test@1234",
    "name": "Test Organizer",
    "phone": "+919876543210",
    "role": "organizer"
  }'
```

**Note:** Regular users (traveler/organizer) WILL need phone verification, but admin/agent don't.

---

## 🔑 Key Changes Made

### 1. **Authentication Update**
- ✅ Admin and Agent can now login **without phone verification**
- ✅ Last active timestamp updated on login
- ✅ Travelers and Organizers still require phone verification (security)

**Code Change Location:** `services/api/src/routes/auth.ts` (line 93-95)

```typescript
// Admin and agent users don't require phone verification
if (!user.phoneVerified && user.role !== 'admin' && user.role !== 'agent') {
  return res.status(403).json({ error: 'Phone not verified.' });
}
```

### 2. **Secure Reset Script**
- ✅ New script: `services/api/src/scripts/secure-reset-users.ts`
- ✅ Deletes all users
- ✅ Creates admin with `phoneVerified: true`
- ✅ Creates agent with `phoneVerified: true`

---

## 🎯 Access Levels After Setup

| Role      | Login Required | Phone Verification | Access Path | Permissions |
|-----------|---------------|-------------------|-------------|-------------|
| **Admin** | ✅ Yes | ❌ No | `/admin` | Full system access |
| **Agent** | ✅ Yes | ❌ No | `/agent` | CRM, tickets, support |
| **Organizer** | ✅ Yes | ✅ Yes | `/home` | Create trips, manage bookings |
| **Traveler** | ✅ Yes | ✅ Yes | `/home` | Browse trips, book, review |

---

## 🔐 Login Credentials Summary

### Pre-created Accounts

```
┌─────────────────────────────────────────────────────┐
│ 👑 ADMIN                                            │
├─────────────────────────────────────────────────────┤
│ Email:     admin@trektribe.com                      │
│ Password:  SecureAdmin@2024                         │
│ Access:    /admin                                   │
│ Phone Verification: NOT REQUIRED                    │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ 🎧 AGENT                                            │
├─────────────────────────────────────────────────────┤
│ Email:     agent@trektribe.com                      │
│ Password:  SecureAgent@2024                         │
│ Access:    /agent                                   │
│ Phone Verification: NOT REQUIRED                    │
└─────────────────────────────────────────────────────┘
```

### You'll Create These
```
┌─────────────────────────────────────────────────────┐
│ 👤 TRAVELER (Example)                               │
├─────────────────────────────────────────────────────┤
│ Email:     traveler@test.com                        │
│ Password:  Test@1234                                │
│ Phone:     +911234567890                            │
│ Phone Verification: REQUIRED (via SMS OTP)          │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ 🗺️ ORGANIZER (Example)                              │
├─────────────────────────────────────────────────────┤
│ Email:     organizer@test.com                       │
│ Password:  Test@1234                                │
│ Phone:     +919876543210                            │
│ Phone Verification: REQUIRED (via SMS OTP)          │
└─────────────────────────────────────────────────────┘
```

---

## 🧪 Complete Testing Workflow

### 1. Test Admin Workflow
```
1. Login as admin (admin@trektribe.com)
2. Navigate to /admin
3. View dashboard statistics
4. Check user list
5. Check trip verification requests
6. View CRM analytics
```

### 2. Test Agent Workflow
```
1. Login as agent (agent@trektribe.com)
2. Navigate to /agent
3. View ticket dashboard
4. Create a test ticket
5. Assign ticket to yourself
6. Send WhatsApp message (if configured)
7. View performance metrics
```

### 3. Test Organizer Workflow
```
1. Register as organizer (organizer@test.com)
2. Verify phone with OTP
3. Login
4. Navigate to /create-trip
5. Create a sample trip
6. View your trips
7. Manage bookings (when travelers book)
```

### 4. Test Traveler Workflow
```
1. Register as traveler (traveler@test.com)
2. Verify phone with OTP
3. Login
4. Browse trips
5. Search for trips
6. View trip details
7. Book a trip (QR code payment)
8. View booking history at /my-bookings
```

---

## 🚨 Common Issues & Solutions

### Issue: "Phone not verified" error for admin/agent
**Solution:** You need to re-deploy the updated auth route. Run:
```bash
cd C:\Users\hp\Development\trek-tribe
git add services/api/src/routes/auth.ts
git commit -m "Fix: Allow admin/agent login without phone verification"
git push origin main
```
Wait 3-5 minutes for Render to redeploy.

### Issue: Script fails with "Cannot find module"
**Solution:** Install dependencies first:
```bash
cd services/api
npm install
```

### Issue: Can't connect to MongoDB
**Solution:** Check your `.env` file has correct `MONGODB_URI`:
```bash
# services/api/.env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/trek-tribe
```

### Issue: Admin can't access /admin route
**Solution:** 
1. Check browser console for errors
2. Verify JWT token is stored in localStorage
3. Make sure user object has `role: 'admin'`
4. Clear browser cache and re-login

---

## 📋 Pre-Deployment Checklist

Before deploying to production:

- [ ] Change admin password in script (line 23)
- [ ] Change agent password in script (line 28)
- [ ] Run secure reset script once
- [ ] Test admin login end-to-end
- [ ] Test agent login end-to-end
- [ ] Test traveler registration + phone verification
- [ ] Test organizer registration + phone verification
- [ ] Deploy updated auth.ts to Render
- [ ] Verify no secrets in GitHub
- [ ] Change passwords via admin panel after first login

---

## 🔒 Security Notes

1. **Default Passwords:** The passwords in the script (`SecureAdmin@2024`, `SecureAgent@2024`) are for initial setup only. **Change them immediately after first login** via profile settings.

2. **Phone Verification:** While admin and agent bypass phone verification for convenience, travelers and organizers still require it to prevent spam registrations.

3. **Password Strength:** Default passwords meet minimum requirements (8+ chars, uppercase, lowercase, number, special char). Change to even stronger passwords in production.

4. **Environment Variables:** Never commit `.env` files. They're already in `.gitignore`.

5. **JWT Expiry:** Tokens expire after 7 days. Users will need to login again after that.

---

## 📞 Need Help?

If something doesn't work:

1. Check Render logs: https://dashboard.render.com
2. Check MongoDB Atlas logs
3. Check browser console (F12)
4. Check network tab for API errors
5. Review `WEBSITE_COMPLETION_ASSESSMENT.md` for known issues

---

## ✅ Next Steps After Setup

Once everything is working:

1. **Deploy Payment Gateway** (Biggest priority - see assessment doc)
2. Test booking flow end-to-end with real users
3. Monitor error logs for issues
4. Set up analytics to track user behavior
5. Create marketing materials for launch

---

**Last Updated:** January 2025  
**Script Location:** `services/api/src/scripts/secure-reset-users.ts`  
**Auth Updated:** `services/api/src/routes/auth.ts` (line 93-106)
