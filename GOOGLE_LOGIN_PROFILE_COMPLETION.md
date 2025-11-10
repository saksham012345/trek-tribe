# Google Login with Profile Completion Feature

## Overview
When users log in with Google, they are now prompted to complete their profile by:
1. Selecting a role (Adventurer or Organizer)
2. Providing a phone number
3. Verifying the phone number with OTP

## Changes Made

### Backend Changes

#### 1. **User Model** (`services/api/src/models/User.ts`)
Added phone verification fields:
- `phoneVerified`: Boolean flag for phone verification status
- `phoneVerificationOtpHash`: Hashed OTP for phone verification
- `phoneVerificationExpires`: Expiration time for OTP
- `phoneVerificationAttempts`: Counter for failed attempts
- `phoneVerificationLastSentAt`: Timestamp of last OTP sent (for rate limiting)

#### 2. **Auth Routes** (`services/api/src/routes/auth.ts`)

**Updated Google OAuth endpoint (`/auth/google`):**
- Now returns `requiresProfileCompletion` flag for new users
- Checks if user has phone number to determine if profile is complete
- Returns user data including phone status

**New endpoints added:**

a) **Send Phone OTP** (`POST /auth/verify-phone/send-otp`)
- Requires authentication
- Generates 6-digit OTP
- In development mode, returns OTP in response for testing
- Rate limited to 1 request per 60 seconds
- TODO: Integrate with SMS service (Twilio, AWS SNS, etc.)

```javascript
// Request
{
  "phone": "+1234567890"  // Must include country code
}

// Response
{
  "message": "OTP sent to your phone number",
  "otp": "123456"  // Only in development mode
}
```

b) **Verify Phone OTP** (`POST /auth/verify-phone/verify-otp`)
- Requires authentication
- Verifies the OTP
- Limits to 5 attempts before requiring new OTP
- Marks phone as verified and saves phone number

```javascript
// Request
{
  "phone": "+1234567890",
  "otp": "123456"
}

// Response
{
  "message": "Phone verified successfully."
}
```

c) **Complete Profile** (`POST /auth/complete-profile`)
- Requires authentication
- Updates user role and profile information
- For organizers, saves additional profile details
- Requires phone to be verified first

```javascript
// Request
{
  "role": "traveler" | "organizer",
  "phone": "+1234567890",
  "organizerProfile": {  // Optional, only for organizers
    "experience": "Led 20+ treks in Himalayas",
    "yearsOfExperience": 5,
    "specialties": ["Mountain trekking", "Rock climbing"],
    "languages": ["English", "Hindi"],
    "bio": "Passionate trekking guide..."
  }
}

// Response
{
  "message": "Profile completed successfully",
  "user": {
    "id": "...",
    "email": "...",
    "name": "...",
    "role": "organizer",
    "phone": "+1234567890"
  }
}
```

### Frontend Changes

#### 1. **CompleteProfileModal Component** (`web/src/components/CompleteProfileModal.tsx`)
New modal component with 3-step wizard:

**Step 1: Role Selection**
- Choose between Adventurer (traveler) or Organizer
- If Organizer selected, show additional fields:
  - Experience description
  - Years of experience
  - Specialties (comma-separated)
  - Languages (comma-separated)
  - Bio

**Step 2: Phone Number**
- Input field for phone number (with country code)
- Validation and helpful hints
- Back button to return to role selection

**Step 3: OTP Verification**
- 6-digit OTP input
- Shows development OTP in dev mode
- 60-second countdown for resend
- Loading states during verification

Features:
- Progress indicator showing current step
- Error handling with user-friendly messages
- Responsive design matching Trek Tribe theme
- Auto-format OTP input (numbers only, max 6 digits)

#### 2. **GoogleLoginButton Component** (`web/src/components/GoogleLoginButton.tsx`)
Updated to handle profile completion flow:

- Intercepts Google login response
- Checks `requiresProfileCompletion` flag from backend
- Shows `CompleteProfileModal` for incomplete profiles
- Handles profile completion callback
- Refreshes user data after completion

**Flow:**
```
User clicks "Sign in with Google"
  → Google authentication
  → Backend checks if profile complete
  → If incomplete: Show CompleteProfileModal
  → User completes profile (role + phone + OTP)
  → Profile saved
  → User redirected to app
```

## Testing

### Development Mode
In development, the OTP is:
1. Logged in server console
2. Returned in API response (for easy testing)
3. Displayed in a yellow banner in the UI

### Test Flow
1. Clear your browser's localStorage
2. Visit the login/register page
3. Click "Continue with Google"
4. Complete Google authentication
5. You should see the "Complete Your Profile" modal
6. Select a role (try both Adventurer and Organizer)
7. Enter a phone number (e.g., `+919876543210`)
8. Click "Send Verification Code"
9. Check the console or UI for the OTP
10. Enter the OTP
11. Click "Verify & Complete"
12. You should be logged in with your selected role

## Production Considerations

### SMS Integration
The phone OTP currently logs to console in development. For production:

1. **Choose an SMS provider:**
   - Twilio
   - AWS SNS
   - Vonage (formerly Nexmo)
   - Firebase Phone Authentication

2. **Add environment variables:**
```env
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_number
```

3. **Create SMS service** (`services/api/src/services/smsService.ts`):
```typescript
export class SMSService {
  async sendOTP(phone: string, otp: string) {
    // Implement SMS sending logic
  }
}
```

4. **Update the auth route** to use the SMS service instead of logging.

### Security Best Practices
- ✅ OTP expires after 10 minutes
- ✅ Limited to 5 verification attempts
- ✅ Rate limited to prevent spam (60 seconds between requests)
- ✅ OTPs are hashed in database
- ✅ Phone verification required before profile completion
- ⚠️ TODO: Add phone number validation (check if already in use)
- ⚠️ TODO: Add IP-based rate limiting for OTP requests

## UI/UX Features
- **Progress Indicator**: Shows which step user is on (1-2-3)
- **Validation**: Real-time feedback on input errors
- **Loading States**: Visual feedback during API calls
- **Error Handling**: Clear error messages for all failure scenarios
- **Accessibility**: Proper labels, placeholders, and ARIA attributes
- **Responsive**: Works on mobile, tablet, and desktop
- **Theme Consistency**: Matches Trek Tribe's forest/nature theme

## API Endpoints Summary

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/auth/google` | POST | No | Google OAuth login |
| `/auth/verify-phone/send-otp` | POST | Yes | Send OTP to phone |
| `/auth/verify-phone/verify-otp` | POST | Yes | Verify phone OTP |
| `/auth/complete-profile` | POST | Yes | Complete profile after Google signup |

## Error Handling

The system handles various error scenarios:
- Invalid phone number format
- Expired OTP
- Too many verification attempts
- Network failures
- Already verified phone
- Rate limit exceeded

All errors are displayed to users in a clear, actionable format.

## Next Steps

1. **SMS Integration**: Implement actual SMS sending for production
2. **Phone Number Uniqueness**: Add validation to prevent duplicate phone numbers
3. **International Phone Support**: Enhance phone validation for different countries
4. **Analytics**: Track completion rates and drop-off points
5. **A/B Testing**: Test different UX flows for optimal conversion
