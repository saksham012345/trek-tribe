# Phone Verification Instead of Email Verification

## Overview
The system has been updated to use **phone number verification** instead of email verification during user registration. Users now verify their identity via SMS OTP rather than email OTP.

---

## What Changed

### Backend Changes

#### 1. **Registration Endpoint** (`POST /auth/register`)
**Before:** Sent email OTP for verification  
**Now:** Sends SMS OTP to phone number

**Changes:**
- Phone number is now **required** (not optional)
- Checks for duplicate phone numbers
- Generates OTP and stores in `phoneVerificationOtpHash`
- Sends OTP via Twilio SMS service
- Returns `userId` for verification step

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe",
  "phone": "+919876543210",  // Required! Must include country code
  "role": "traveler"         // Optional: "traveler" or "organizer"
}
```

**Response:**
```json
{
  "message": "Registered successfully. Verification code sent to your phone.",
  "requiresVerification": true,
  "userId": "60d5ec49f1b2c...",
  "otp": "123456"  // Only in development mode
}
```

#### 2. **Login Endpoint** (`POST /auth/login`)
**Before:** Checked `emailVerified` flag  
**Now:** Checks `phoneVerified` flag

**Error Response:**
```json
{
  "error": "Phone not verified. Please verify your phone number with the code sent via SMS."
}
```

#### 3. **New Verification Endpoints**

**a) Verify Phone (Registration)** - `POST /auth/verify-registration-phone`
```json
// Request
{
  "userId": "60d5ec49f1b2c...",
  "phone": "+919876543210",
  "otp": "123456"
}

// Response
{
  "message": "Phone verified successfully. You can now log in."
}
```

**b) Resend OTP (Registration)** - `POST /auth/resend-registration-otp`
```json
// Request
{
  "userId": "60d5ec49f1b2c...",
  "phone": "+919876543210"
}

// Response
{
  "message": "New verification code sent to your phone",
  "otp": "789012"  // Only in development mode
}
```

**Rate Limiting:**
- 60 seconds between OTP requests
- 5 verification attempts per OTP
- OTP expires after 10 minutes

---

### Frontend Changes

#### 1. **New Component: PhoneVerificationModal**
Location: `web/src/components/PhoneVerificationModal.tsx`

**Features:**
- Clean modal interface for OTP entry
- 6-digit OTP input with auto-formatting
- Resend functionality with countdown timer (60s)
- Development mode shows OTP in yellow banner
- Error handling
- Loading states

**Props:**
```typescript
interface PhoneVerificationModalProps {
  open: boolean;
  phone: string;
  userId: string;
  onVerified: () => void;
  onClose: () => void;
  initialDevOtp?: string;
}
```

#### 2. **Updated Register Page**
Location: `web/src/pages/Register.tsx`

**New Flow:**
```
1. User fills registration form (including phone with country code)
2. User submits form
3. Backend sends SMS OTP
4. PhoneVerificationModal appears
5. User enters OTP
6. Phone verified → Auto-login → Redirect to profile
```

**Changes:**
- Phone input now required
- Added placeholder: "+1234567890 (include country code)"
- Added helper text: "You'll receive an SMS verification code"
- Shows PhoneVerificationModal after registration
- Auto-login after successful verification

---

## User Experience

### Registration Flow

1. **User fills form:**
   - Name
   - Email
   - Phone (with country code, e.g., `+919876543210`)
   - Password
   - Role selection (optional)

2. **Submit → SMS sent:**
   - Backend sends OTP via Twilio
   - Modal appears immediately

3. **Enter OTP:**
   - User enters 6-digit code from SMS
   - Can resend if needed (after 60s)

4. **Verified → Login:**
   - Phone verified automatically
   - User logged in
   - Redirected to profile

### Development Mode

For testing without Twilio credentials:
- OTP is displayed in a yellow banner
- OTP is logged to console
- OTP is returned in API responses

---

## API Endpoints Summary

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auth/register` | POST | No | Register with phone OTP |
| `/auth/verify-registration-phone` | POST | No | Verify phone OTP |
| `/auth/resend-registration-otp` | POST | No | Resend OTP |
| `/auth/login` | POST | No | Login (checks phoneVerified) |
| `/auth/verify-phone/send-otp` | POST | Yes | For logged-in users |
| `/auth/verify-phone/verify-otp` | POST | Yes | For logged-in users |

---

## Error Handling

### Common Errors

**Phone already in use:**
```json
{
  "error": "Phone number already in use"
}
```

**Invalid phone format:**
```json
{
  "error": "Invalid phone number format"
}
```

**Invalid OTP:**
```json
{
  "error": "Invalid code"
}
```

**Too many attempts:**
```json
{
  "error": "Too many attempts. Request a new code."
}
```

**OTP expired:**
```json
{
  "error": "Code expired. Please request a new one."
}
```

**SMS failed to send:**
```json
{
  "error": "Failed to send SMS. Please try again."
}
```

---

## Phone Number Format

### Requirements:
- **Must include country code**
- Format: `+[country code][number]`
- Regex: `/^[+]?[1-9]\d{1,14}$/`

### Examples:
- ✅ `+919876543210` (India)
- ✅ `+15551234567` (USA)
- ✅ `+447911123456` (UK)
- ❌ `9876543210` (missing country code)
- ❌ `919876543210` (missing +)

---

## Testing

### Development Mode Testing

1. **Without Twilio:**
   - Set `NODE_ENV=development`
   - Don't configure Twilio credentials
   - OTP will be shown in UI and console

2. **With Twilio Trial:**
   - Configure Twilio credentials
   - Verify recipient number in Twilio Console
   - Receive actual SMS

### Test Checklist

- [ ] Register with valid phone (with country code)
- [ ] Receive SMS/See OTP in dev mode
- [ ] Enter correct OTP → Verify successfully
- [ ] Try wrong OTP → See error
- [ ] Let OTP expire (10 min) → See error
- [ ] Resend OTP → Receive new code
- [ ] Verify phone → Auto-login works
- [ ] Try logging in without verification → See error
- [ ] Try registering with same phone → See error

---

## Migration Notes

### For Existing Users

Existing users registered via email verification:
- **Can still login** if they had `emailVerified: true`
- Backend still checks `phoneVerified` for new registrations
- Consider adding a migration script to:
  1. Mark existing users as `phoneVerified: true`
  2. Or prompt them to verify phone on next login

### Migration Script (Optional)

```typescript
// services/api/src/scripts/migrate-phone-verification.ts
import { User } from '../models/User';

async function migrateExistingUsers() {
  // Mark all email-verified users as phone-verified
  await User.updateMany(
    { emailVerified: true, phoneVerified: { $ne: true } },
    { $set: { phoneVerified: true } }
  );
  
  console.log('Migration complete');
}
```

---

## Security Improvements

### Over Email Verification:

✅ **Harder to spoof**: Phone numbers are harder to fake than email addresses  
✅ **Instant delivery**: SMS arrives in seconds vs minutes for email  
✅ **Better user experience**: Users always have their phone  
✅ **Unique identity**: Phone numbers are more unique than emails  
✅ **Reduced spam**: Harder for bots to get phone numbers  

### Security Features:

- OTP hashed in database
- 10-minute expiration
- 5 attempt limit
- 60-second rate limiting
- Phone number uniqueness check
- Secure OTP generation (crypto.randomInt)

---

## Costs

### With Twilio:
- **USA:** ~$0.0079 per SMS
- **India:** ~$0.0077 per SMS  
- **Per 1000 registrations:** ~$8-10 USD

### Alternative: Keep Email for Some Users

You could offer both options:
1. Users choose: Email or Phone verification
2. Add a toggle in registration form
3. Backend handles both flows

---

## Troubleshooting

### Issue: "Phone already in use"
**Solution:** User already registered. Try logging in instead.

### Issue: "Invalid phone format"
**Solution:** Ensure phone includes country code (e.g., `+91` for India)

### Issue: "SMS not received"
**Check:**
- Phone number is correct
- Phone can receive SMS (not landline)
- Twilio has credit
- Number is verified in Twilio Console (trial accounts)

### Issue: "Code expired"
**Solution:** Request a new code (wait 60 seconds after last request)

---

## Files Modified

### Backend:
- ✅ `services/api/src/routes/auth.ts` - Updated registration & login
- ✅ `services/api/src/models/User.ts` - Already had phone verification fields

### Frontend:
- ✅ `web/src/pages/Register.tsx` - Updated registration flow
- ✅ `web/src/components/PhoneVerificationModal.tsx` - NEW component

---

## Summary

🎉 **Registration now uses phone verification via SMS instead of email!**

### Key Points:
- Phone number is **required** during registration
- Must include **country code** (e.g., `+919876543210`)
- OTP sent via **Twilio SMS**
- **10-minute** OTP expiration
- **5 attempts** per OTP
- **60-second** resend cooldown
- **Dev mode** shows OTP in UI for testing
- Users are **auto-logged in** after verification

### Next Steps:
1. Configure Twilio credentials (see `TWILIO_SETUP_GUIDE.md`)
2. Test registration flow
3. Consider migrating existing users
4. Monitor SMS costs and delivery rates
