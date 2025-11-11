# Twilio SMS Integration Setup Guide

## Overview
This guide will help you set up Twilio for phone number verification in Trek Tribe. Users will receive OTP codes via SMS when completing their profile after Google login.

---

## Step 1: Create a Twilio Account

### 1.1 Sign Up
1. Go to [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Click "Sign up and start building"
3. Fill in your details:
   - Email
   - Password
   - First & Last Name
4. Verify your email address
5. **Important:** You'll get **$15 in free trial credit** 🎉

### 1.2 Verify Your Phone Number
After signing up, Twilio will ask you to verify your own phone number:
1. Enter your phone number (with country code)
2. Receive a verification code via SMS
3. Enter the code to verify

---

## Step 2: Get Your Credentials

### 2.1 Find Your Account SID and Auth Token
1. After logging in, you'll be on the Twilio Console dashboard
2. Look for the "Account Info" section on the right side
3. You'll see:
   - **Account SID** (starts with `AC...`)
   - **Auth Token** (click the eye icon to reveal it)

**Screenshot locations:**
```
Console → Dashboard → Account Info
├── Account SID: ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
└── Auth Token: ********************************
```

### 2.2 Copy These Credentials
**Keep these safe!** You'll need them for your environment variables.

---

## Step 3: Get a Phone Number

### 3.1 Purchase a Phone Number
1. In Twilio Console, go to: **Phone Numbers → Manage → Buy a number**
   - URL: https://console.twilio.com/us1/develop/phone-numbers/manage/search
2. Select your country (e.g., United States, India, etc.)
3. Check the "SMS" capability checkbox
4. Click "Search"
5. Choose a number from the list
6. Click "Buy" (it's free with trial credit!)
7. Confirm the purchase

**Trial Account Limitations:**
- You can only send SMS to verified phone numbers
- To verify additional numbers: **Console → Phone Numbers → Verified Caller IDs**

### 3.2 Copy Your Phone Number
After purchase, you'll see your number (e.g., `+12345678901`)
Copy this for your environment variables.

---

## Step 4: Configure Environment Variables

### 4.1 Update Your `.env` File
Navigate to `services/api/.env` and add:

```env
# Twilio SMS Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_actual_auth_token_here
TWILIO_PHONE_NUMBER=+12345678901
```

**Replace with your actual values:**
- `TWILIO_ACCOUNT_SID`: From Step 2.1
- `TWILIO_AUTH_TOKEN`: From Step 2.1
- `TWILIO_PHONE_NUMBER`: From Step 3.2

### 4.2 Example Configuration
```env
# Example (DO NOT use these values - they won't work!)
TWILIO_ACCOUNT_SID=AC1234567890abcdef1234567890abcd
TWILIO_AUTH_TOKEN=abc123def456ghi789jkl012mno345pq
TWILIO_PHONE_NUMBER=+15551234567
```

---

## Step 5: Install Dependencies

### 5.1 Install Twilio SDK
```bash
cd services/api
npm install
```

This will install the `twilio` package that was added to `package.json`.

---

## Step 6: Test the Integration

### 6.1 Development Mode Testing
If Twilio is **NOT configured**, the system runs in dev mode:
- OTPs are logged to console
- OTPs are returned in API responses
- No actual SMS is sent

### 6.2 Production Mode Testing
Once you've added your Twilio credentials:

1. **Start the API server:**
   ```bash
   cd services/api
   npm run dev
   ```

2. **Check the logs:**
   Look for:
   ```
   ✅ Twilio SMS service initialized successfully
   ```

3. **Test phone verification:**
   - Register/login with Google
   - Enter a phone number in the profile completion modal
   - Click "Send Verification Code"
   - You should receive an SMS!

### 6.3 Verify Test Numbers (Trial Account)
For trial accounts, you can only send to verified numbers:

1. Go to: **Console → Phone Numbers → Manage → Verified Caller IDs**
2. Click "+ Add a new Caller ID"
3. Enter the phone number you want to test
4. Verify it via SMS/call
5. Now you can send OTPs to this number!

---

## Step 7: Production Deployment

### 7.1 Environment Variables on Render
1. Go to your Render dashboard
2. Select your API service
3. Go to "Environment" tab
4. Add the three Twilio variables:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`
5. Click "Save Changes"
6. Your service will automatically redeploy

### 7.2 Upgrade Your Twilio Account (Optional)
For production use:
1. Go to Twilio Console
2. Click "Upgrade" in the top menu
3. Add payment method
4. Remove trial restrictions (can send to any phone number)

---

## Pricing

### Free Trial
- **$15 credit** upon signup
- Can send ~500-750 SMS (depending on country)
- Must verify recipient numbers

### Pay-as-you-go (After Upgrade)
- **United States:** $0.0079 per SMS
- **India:** $0.0077 per SMS
- **UK:** $0.052 per SMS
- **Other countries:** [View pricing](https://www.twilio.com/en-us/sms/pricing)

### Cost Examples
For 1,000 users signing up:
- **US:** ~$8 USD
- **India:** ~$8 USD
- **Average:** $10-15 USD

---

## Features Implemented

### 1. SMS Service (`services/api/src/services/smsService.ts`)
✅ Singleton service for sending SMS
✅ Automatic dev mode fallback
✅ Error handling with user-friendly messages
✅ Support for custom messages
✅ Balance checking (optional)

### 2. OTP Flow
✅ 6-digit OTP generation
✅ 10-minute expiration
✅ 5 attempt limit
✅ Rate limiting (60 seconds between requests)
✅ Secure OTP hashing in database

### 3. Error Handling
The service handles common Twilio errors:
- Invalid phone number format
- Phone doesn't support SMS
- Number is blocked/unsubscribed
- Invalid region
- Unreachable number
- Landline detection

---

## Troubleshooting

### Issue: "SMS service not configured"
**Solution:** Check your `.env` file has all three Twilio variables set correctly.

### Issue: "Unable to create record: The number is unverified"
**Solution (Trial Account):** 
1. Go to Twilio Console → Phone Numbers → Verified Caller IDs
2. Verify the recipient's phone number
3. Try again

**Solution (Paid Account):** Upgrade your Twilio account.

### Issue: "Invalid phone number format"
**Solution:** Phone numbers must include country code (e.g., `+919876543210` not `9876543210`)

### Issue: SMS not received
**Check:**
1. Phone number is correct and includes country code
2. Phone can receive SMS (not a landline)
3. Check Twilio Console → Monitor → Logs for delivery status
4. Verify your Twilio account has credit

### Issue: "Phone number does not receive SMS"
**Solution:** The number might be a landline or VoIP number. Use a mobile number.

---

## Testing Checklist

- [ ] Twilio credentials added to `.env`
- [ ] API server restarted
- [ ] Check logs for "Twilio SMS service initialized successfully"
- [ ] Test phone number verified in Twilio Console (trial accounts)
- [ ] Google login completed
- [ ] Profile completion modal appears
- [ ] Phone number entered with country code
- [ ] "Send Verification Code" clicked
- [ ] SMS received within 30 seconds
- [ ] OTP entered correctly
- [ ] Profile completed successfully
- [ ] User logged in with verified phone

---

## Support & Resources

### Twilio Resources
- **Documentation:** https://www.twilio.com/docs/sms
- **Console:** https://console.twilio.com
- **Pricing:** https://www.twilio.com/en-us/sms/pricing
- **Support:** https://support.twilio.com

### Trek Tribe Resources
- **SMS Service Code:** `services/api/src/services/smsService.ts`
- **Auth Routes:** `services/api/src/routes/auth.ts`
- **Environment Config:** `services/api/.env.example`

---

## Security Best Practices

✅ **Never commit `.env` files** to version control
✅ **Rotate Auth Tokens** periodically
✅ **Use environment variables** for all credentials
✅ **Monitor usage** to detect anomalies
✅ **Implement rate limiting** (already done)
✅ **Hash OTPs** in database (already done)
✅ **Set OTP expiration** (already set to 10 min)

---

## Next Steps

After setup:
1. Test thoroughly in development
2. Deploy to production
3. Monitor Twilio usage in Console
4. Consider upgrading for production use
5. Add monitoring/alerts for failed SMS

---

## Quick Reference

### Environment Variables
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
```

### API Endpoints
- **Send OTP:** `POST /auth/verify-phone/send-otp`
- **Verify OTP:** `POST /auth/verify-phone/verify-otp`
- **Complete Profile:** `POST /auth/complete-profile`

### Important Files
- SMS Service: `services/api/src/services/smsService.ts`
- Auth Routes: `services/api/src/routes/auth.ts`
- User Model: `services/api/src/models/User.ts`
- Frontend Modal: `web/src/components/CompleteProfileModal.tsx`

---

## Summary

🎉 **You're all set!** Once you've added your Twilio credentials, users will receive real SMS OTPs during registration.

**Need help?** Check the troubleshooting section or reach out to Twilio support.
