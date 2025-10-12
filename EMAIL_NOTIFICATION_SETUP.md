# 📧 Email Notification Setup Guide

## Current Status: ⚠️ NOT CONFIGURED

The email service is **implemented and ready** but **not configured** with Gmail credentials. It's also **not being called** in the booking flow.

---

## What I Need From You

### 1. Gmail Account Setup (5 minutes)

You need to provide:

#### **GMAIL_USER**
Your Gmail address (e.g., `trektribe.notifications@gmail.com`)

#### **GMAIL_APP_PASSWORD** 
A 16-character app password (NOT your Gmail password!)

**How to get Gmail App Password:**

1. Go to your Google Account: https://myaccount.google.com/
2. Click "Security" in the left menu
3. Under "How you sign in to Google", click "2-Step Verification"
4. Enable 2-Step Verification if not already enabled
5. Scroll down and click "App passwords"
6. Select "Mail" for app type
7. Select "Other (Custom name)" for device
8. Enter name: "Trek Tribe Notifications"
9. Click "Generate"
10. Copy the 16-character password (e.g., `abcd efgh ijkl mnop`)
11. **Remove spaces:** `abcdefghijklmnop`

---

## Configuration Steps

### Option 1: Using Render Dashboard (Recommended)

1. Go to https://dashboard.render.com
2. Select your `trek-tribe-38in` service
3. Click "Environment" tab
4. Add these environment variables:

```bash
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your16digitapppassword
```

5. Click "Save Changes"
6. Service will auto-restart

### Option 2: Using .env File (Local Development)

Create or edit `services/api/.env`:
```bash
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your16digitapppassword
```

---

## What Emails Will Be Sent

Once configured, the system will automatically send:

### 1. **Booking Confirmation Email**
- **Sent to:** User + Organizer
- **When:** After payment is verified
- **Includes:**
  - Trip details
  - Booking ID
  - Traveler count
  - Total amount
  - Organizer contact info
  - Important reminders

### 2. **Password Reset Email**
- **Sent to:** User
- **When:** User requests password reset
- **Includes:**
  - Secure reset link
  - 1-hour expiration
  - Security notice

### 3. **Trip Update Email**
- **Sent to:** All trip participants
- **When:** Organizer updates trip details
- **Includes:**
  - Update message
  - Trip title
  - Organizer info

---

## Code Integration Needed

The email service is imported but not called. I'll add it to the booking flow now.

### Current Booking Flow:
```typescript
// Create booking
const groupBooking = new GroupBooking({ ... });
await groupBooking.save();

// Return response
res.status(201).json({ ... });
```

### Enhanced Flow (What I'll Add):
```typescript
// Create booking
const groupBooking = new GroupBooking({ ... });
await groupBooking.save();

// ✅ Send email notification (NEW!)
if (emailService.isServiceReady()) {
  await emailService.sendBookingConfirmation({
    userName: user.name,
    userEmail: user.email,
    tripTitle: trip.title,
    tripDestination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    totalTravelers: numberOfTravelers,
    totalAmount: groupBooking.finalAmount,
    organizerName: trip.organizerId.name,
    organizerEmail: trip.organizerId.email,
    organizerPhone: trip.organizerId.phone,
    bookingId: groupBooking._id
  });
}

// Return response
res.status(201).json({ ... });
```

---

## Let Me Add Email Notifications Now

I'll integrate email notifications into:
1. ✅ Booking creation (send confirmation)
2. ✅ Payment verification (send confirmation)
3. ✅ Booking cancellation (send notification)

---

## Testing Email Service

### Check if credentials are configured:
```bash
# Using curl
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://trek-tribe-38in.onrender.com/api/bookings/email-status

# Expected response:
{
  "isReady": true,
  "hasCredentials": true,
  "lastTest": true
}
```

### If not configured:
```json
{
  "isReady": false,
  "hasCredentials": false,
  "lastTest": false
}
```

---

## Recommended Gmail Account

### Option 1: Create Dedicated Account (Best Practice)
- Create new Gmail: `trektribe.notifications@gmail.com`
- Use only for notifications
- Enable 2FA and app password
- More professional

### Option 2: Use Personal Account
- Use your existing Gmail
- Create app password
- Works fine for testing/small scale

---

## What You Need to Provide

Just send me (or set on Render):

```
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop
```

**That's it!** Once you provide these, I'll:
1. ✅ Verify they're correct format
2. ✅ Add email sending to booking flow
3. ✅ Add email sending to payment verification
4. ✅ Test the integration
5. ✅ Provide testing guide

---

## Security Notes

✅ **App passwords are safe:**
- Not your actual Gmail password
- Can be revoked anytime
- Limited to sending emails only

✅ **Environment variables:**
- Never committed to Git
- Stored securely on Render
- Not exposed to frontend

✅ **Email content:**
- No sensitive data exposed
- Professional templates
- User-friendly format

---

## Sample Email Preview

**Subject:** 🎯 Booking Confirmed - Himalayan Trek Adventure

**Body:**
```
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
• Save your Booking ID for future reference
• You will receive further trip details via email and WhatsApp
• Contact your organizer for any specific questions
• Prepare your documents and equipment as per itinerary

Have an amazing adventure! 🎉

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Trek Tribe - Your Adventure Awaits
```

---

## Next Steps

**Please provide:**
1. Gmail address you want to use
2. Gmail App Password (16 characters)

**I will:**
1. Integrate email sending into booking/payment flows
2. Test the configuration
3. Provide testing guide

**Or** you can:
1. Set the environment variables directly on Render
2. I'll integrate the email calls
3. We test together

---

## Benefits Once Configured

✅ **Users get instant confirmation** - Professional booking emails  
✅ **Organizers get notified** - CC'd on all bookings  
✅ **Better user experience** - Email trail for bookings  
✅ **Password resets work** - Users can reset passwords via email  
✅ **Trip updates** - Notify all participants of changes  

---

**Status:** ⏸️ **Waiting for Gmail Credentials**

Let me know your Gmail credentials and I'll complete the integration! 📧

