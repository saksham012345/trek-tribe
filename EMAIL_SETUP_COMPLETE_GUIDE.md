# 📧 Email Notifications - Complete Setup Guide

## Current Status

✅ **Email Service:** Fully implemented and ready  
⚠️ **Configuration:** NOT configured (missing Gmail credentials)  
✅ **Integration:** Now added to booking flow  

---

## What I Did

### ✅ Added Email Notifications To:

1. **Booking Creation** (`services/api/src/routes/bookings.ts`)
   - Sends email when booking is created
   - Includes booking details and organizer info
   - CC's organizer on the email

2. **Payment Verification** (`services/api/src/routes/bookings.ts`)
   - Sends confirmation when payment is verified
   - Final confirmation to user
   - Confirms their spot on the trip

3. **Import Added** (`services/api/src/routes/organizer.ts`)
   - Ready for future organizer notifications

---

## What You Need to Do

### Step 1: Create Gmail App Password (5 minutes)

**Option A: Use Existing Gmail**
1. Go to https://myaccount.google.com/security
2. Click "2-Step Verification" (enable if not already)
3. Scroll to "App passwords"
4. Click "App passwords"
5. Select app: "Mail"
6. Select device: "Other (Custom name)"
7. Enter: "Trek Tribe Notifications"
8. Click "Generate"
9. **Copy the 16-character password** (e.g., `abcd efgh ijkl mnop`)
10. **Remove all spaces:** `abcdefghijklmnop`

**Option B: Create Dedicated Gmail (Recommended)**
1. Create new Gmail: `trektribe.notifications@gmail.com`
2. Enable 2-Step Verification
3. Follow steps above to create app password
4. More professional for business use

---

### Step 2: Configure on Render (2 minutes)

1. Go to https://dashboard.render.com
2. Select your `trek-tribe-38in` service
3. Click "Environment" tab
4. Add these two variables:

```
Key: GMAIL_USER
Value: your-email@gmail.com

Key: GMAIL_APP_PASSWORD  
Value: abcdefghijklmnop (16 characters, no spaces)
```

5. Click "Save Changes"
6. Service will auto-restart

---

### Step 3: Verify It Works

**Check Email Service Status:**
```bash
# If logged in, you can check:
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://trek-tribe-38in.onrender.com/api/bookings/email-status

# Should return:
{
  "isReady": true,
  "hasCredentials": true,
  "lastTest": true
}
```

**Check Backend Logs:**
After restart, look for:
```
✅ Email service initialized successfully with Gmail SMTP
```

If you see this instead:
```
⚠️  Gmail credentials not configured. Email service will be disabled.
```
Then environment variables are not set correctly.

---

## When Emails Are Sent

### 1. **Booking Created** 
```
Trigger: User submits booking
Sent To: User + CC: Organizer
Subject: "🎯 Booking Confirmed - [Trip Title]"
Content:
  - Booking details
  - Trip information
  - Organizer contact
  - Booking ID
  - Important reminders
```

### 2. **Payment Verified**
```
Trigger: Organizer verifies payment
Sent To: User + CC: Organizer
Subject: "🎯 Booking Confirmed - [Trip Title]"
Content:
  - Final confirmation
  - Trip is confirmed
  - All booking details
  - What to prepare
```

### 3. **Password Reset**
```
Trigger: User requests password reset
Sent To: User
Subject: "🔐 Reset Your Trek Tribe Password"
Content:
  - Secure reset link
  - 1-hour expiration
  - Security notice
```

---

## Sample Email Preview

**Subject:** 🎯 Booking Confirmed - Himalayan Trek Adventure

```html
🌲 Trek Tribe
Booking Confirmed!

Hello John Doe! 👋

Great news! Your adventure booking has been confirmed. 
Get ready for an amazing experience!

🎒 Trip Details
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Adventure:    Himalayan Trek Adventure
Destination:  📍 Manali, Himachal Pradesh
Dates:        📅 Nov 15, 2025 to Nov 20, 2025
Travelers:    👥 2
Total Amount: 💰 ₹17,000
Booking ID:   HTB123456789

🗺️ Your Trip Organizer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Trek Master
📧 organizer@example.com
📞 +91-9876543210

📝 Important Information:
• Save your Booking ID: HTB123456789 for future reference
• You will receive further trip details via email and WhatsApp
• Contact your organizer for any specific questions
• Prepare your documents and equipment as per itinerary

Have an amazing adventure! 🎉

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Trek Tribe - Your Adventure Awaits
```

---

## Testing After Setup

### Test 1: Check Service Status
```bash
# Method 1: Via API
curl https://trek-tribe-38in.onrender.com/api/bookings/email-status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Method 2: Check Render Logs
# Look for:
✅ Email service initialized successfully with Gmail SMTP
```

### Test 2: Create a Test Booking
1. Join any trip
2. Fill booking form
3. Submit booking
4. Check your email inbox
5. Should receive booking confirmation email

### Test 3: Verify Payment
1. As organizer, verify a payment
2. Check user's email
3. Should receive final confirmation email

---

## Troubleshooting

### Issue: "Email service not configured"

**Cause:** Environment variables not set  
**Solution:** 
1. Double-check Render environment variables
2. Ensure no extra spaces in values
3. Restart service after adding variables

### Issue: "Failed to send email"

**Possible Causes:**
1. **Invalid Gmail credentials**
   - Solution: Verify email and app password are correct
   
2. **App password not generated**
   - Solution: Make sure you used "App passwords" not regular password
   
3. **2FA not enabled**
   - Solution: Enable 2-Step Verification first
   
4. **Gmail blocking**
   - Solution: Check Gmail security settings
   - Allow "Less secure app access" (if needed)

### Issue: Emails going to spam

**Solutions:**
1. Add sender to contacts
2. Mark as "Not spam"
3. Check SPF/DKIM records (advanced)
4. Use dedicated email domain (advanced)

---

## Environment Variables Summary

### Required for Email:
```bash
GMAIL_USER=trektribe.notifications@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop
```

### Already Required (existing):
```bash
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret-key
```

### Optional (for CORS - already set in code):
```bash
FRONTEND_URL=https://www.trektribe.in
CORS_ORIGIN=https://www.trektribe.in
```

---

## Backend Logs to Monitor

### Success Indicators:
```
✅ Email service initialized successfully with Gmail SMTP
📧 Booking confirmation email sent { bookingId: '...' }
📧 Payment verification email sent { bookingId: '...' }
```

### Warning Indicators:
```
⚠️  Gmail credentials not configured. Email service will be disabled.
⚠️  Email service not configured - skipping booking confirmation email
```

### Error Indicators:
```
❌ Failed to initialize email service { error: '...' }
❌ Failed to send booking confirmation email { error: '...' }
```

---

## Quick Test Email Service

Once configured, you can test by creating a simple booking:

1. **Backend deployed with credentials**
2. **Create a booking from frontend**
3. **Check backend logs:**
   ```
   ✅ Email service initialized successfully
   📧 Booking confirmation email sent
   ```
4. **Check your email:**
   - Should receive booking confirmation
   - Professional HTML format
   - All booking details included

---

## What You Get

### ✅ After Configuration:
- Instant booking confirmations
- Payment verification emails
- Password reset emails
- Professional HTML templates
- CC to organizers
- Automated notifications
- Better user experience

### ⚠️ Without Configuration:
- System works fine
- No emails sent
- Users don't get email confirmations
- Manual communication needed

---

## Files Modified

1. ✅ `services/api/src/routes/bookings.ts` - Added email integration
2. ✅ `services/api/src/routes/organizer.ts` - Added emailService import

**Email Service Files (Already Implemented):**
- `services/api/src/services/emailService.ts` - Complete service
- Beautiful HTML templates included
- Error handling built-in
- Logging integrated

---

## Summary

**Current Status:** ⚠️ **Email notifications are NOT working** because Gmail credentials are not configured.

**What I Need From You:**
```
1. Gmail email address
2. Gmail app password (16 characters)
```

**What I've Done:**
✅ Integrated email sending into booking flow  
✅ Added email sending on payment verification  
✅ Added comprehensive logging  
✅ Non-blocking (won't fail bookings if email fails)  

**Next Steps:**
1. You provide Gmail credentials
2. Set them on Render dashboard
3. Deploy backend changes (git push)
4. Test by creating a booking
5. Check email inbox for confirmation

**Time to Configure:** ~10 minutes  
**Status:** ✅ Code ready, waiting for credentials  

---

Would you like me to:
1. ✅ Wait for you to provide credentials (then I'll verify setup)
2. ✅ Create a test endpoint to verify email service
3. ✅ Add more email notifications (trip updates, etc.)
4. ✅ Create email templates customization guide

**Let me know your Gmail credentials and I'll help verify the setup!** 📧

