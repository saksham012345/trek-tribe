# Twilio Quick Start

## What I Need From You

Please provide these 3 values from your Twilio account:

### 1. Account SID
```
TWILIO_ACCOUNT_SID=AC________________________________
```
**Where to find:** Twilio Console → Dashboard → Account Info

### 2. Auth Token
```
TWILIO_AUTH_TOKEN=________________________________
```
**Where to find:** Twilio Console → Dashboard → Account Info (click eye icon to reveal)

### 3. Phone Number
```
TWILIO_PHONE_NUMBER=+__________
```
**Where to find:** Twilio Console → Phone Numbers → Manage → Active Numbers

---

## Quick Setup Steps

### 1. Get Twilio Account (5 minutes)
```
1. Go to: https://www.twilio.com/try-twilio
2. Sign up (you get $15 free credit!)
3. Verify your email and phone
4. Copy Account SID and Auth Token
5. Buy a phone number (free with credit)
```

### 2. Install Dependencies
```bash
cd services/api
npm install
```

### 3. Add to .env File
```bash
# In services/api/.env add:
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

### 4. Start & Test
```bash
# Start API
npm run dev

# Look for this log:
# ✅ Twilio SMS service initialized successfully

# Test the flow:
# - Login with Google
# - Complete profile with phone number
# - Receive SMS OTP!
```

---

## Trial Account Notes

⚠️ **Trial accounts can only send SMS to verified numbers**

To verify test numbers:
1. Go to: Console → Phone Numbers → Verified Caller IDs
2. Click "+ Add a new Caller ID"
3. Verify the number
4. Now you can test!

---

## What's Implemented

✅ SMS service with Twilio integration
✅ OTP generation and verification
✅ Error handling for all common issues
✅ Dev mode fallback (works without Twilio)
✅ Rate limiting and security

---

## Cost

- **Trial:** $15 credit = ~500-750 SMS
- **Production:** ~$0.0079 per SMS (US)
- **1000 users:** ~$8-10 USD

---

## Files Changed

- ✅ `services/api/package.json` - Added twilio dependency
- ✅ `services/api/src/services/smsService.ts` - NEW: SMS service
- ✅ `services/api/src/routes/auth.ts` - Integrated SMS sending
- ✅ `services/api/.env.example` - Added Twilio variables

---

## Need Help?

📖 Full guide: `TWILIO_SETUP_GUIDE.md`
🔧 Troubleshooting: See guide above
💬 Twilio Support: https://support.twilio.com
