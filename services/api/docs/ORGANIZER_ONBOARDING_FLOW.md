# Organizer Onboarding Flow

## Overview
This document describes the complete onboarding flow for organizers, including mandatory phone verification and auto-pay setup. This applies to both regular registration and Google OAuth login.

## Mandatory Requirements for Organizers

All organizers MUST complete the following before they can use the platform:

1. ✅ **Email Verification** (for regular registration)
2. ✅ **Phone Number** (mandatory)
3. ✅ **Phone Verification** (via OTP)
4. ✅ **Auto-Pay Setup** (payment method)

## Flow 1: Regular Registration (Email/Password)

### Step 1: Register
```bash
POST /auth/register

Request:
{
  "email": "organizer@example.com",
  "password": "securePassword123",
  "name": "John Doe",
  "phone": "+919876543210",  # MANDATORY
  "role": "organizer"
}

Response:
{
  "message": "Registered successfully. Verification code sent to your email.",
  "requiresVerification": true,
  "userId": "user_id_here",
  "email": "organizer@example.com",
  "otp": "123456"  # Only in development mode
}
```

**Key Points:**
- Phone number is now **mandatory** (not optional)
- User cannot proceed without providing a phone number
- Email OTP is sent immediately after registration

### Step 2: Verify Email
```bash
POST /auth/verify-registration-email

Request:
{
  "userId": "user_id_here",
  "email": "organizer@example.com",
  "otp": "123456"
}

Response:
{
  "message": "Email verified successfully. You can now log in."
}
```

### Step 3: Login (First Time)
```bash
POST /auth/login

Request:
{
  "email": "organizer@example.com",
  "password": "securePassword123"
}

Response:
{
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "email": "organizer@example.com",
    "name": "John Doe",
    "role": "organizer",
    "phone": "+919876543210",
    "phoneVerified": false
  },
  "requiresProfileCompletion": true,
  "requiresPhoneVerification": true,
  "requiresAutoPaySetup": true
}
```

**Key Points:**
- First login is tracked in `firstOrganizerLogin` field
- Auto-pay is initialized with payment scheduled for exactly 60 days from first login
- User MUST complete phone verification before proceeding

### Step 4: Verify Phone Number

#### 4a. Send Phone OTP
```bash
POST /auth/verify-phone/send-otp
Authorization: Bearer <jwt_token>

Request:
{
  "phone": "+919876543210"
}

Response:
{
  "message": "OTP sent to your phone number",
  "otp": "123456"  # Only in development mode
}
```

#### 4b. Verify Phone OTP
```bash
POST /auth/verify-phone/verify-otp
Authorization: Bearer <jwt_token>

Request:
{
  "phone": "+919876543210",
  "otp": "123456"
}

Response:
{
  "message": "Phone verified successfully."
}
```

**Key Points:**
- Phone verification is **mandatory** before auto-pay setup
- OTP is valid for 10 minutes
- Maximum 5 verification attempts allowed

### Step 5: Setup Auto-Pay
```bash
POST /api/auto-pay/setup
Authorization: Bearer <jwt_token>

Request:
{
  "razorpayCustomerId": "cust_xxxxx",
  "paymentMethodId": "pm_xxxxx",
  "paymentAmount": 149900
}

Response:
{
  "success": true,
  "message": "Auto-pay setup completed successfully"
}
```

**Key Points:**
- Auto-pay setup is **mandatory** for organizers
- First payment will be deducted after exactly 60 days from first login
- Confirmation email sent with payment schedule details

### Step 6: Complete - Ready to Use Platform
After completing all steps, the organizer can:
- Create trip listings
- Manage bookings
- Access CRM features
- View analytics

---

## Flow 2: Google OAuth Registration

### Step 1: Google OAuth Login
```bash
POST /auth/google

Request:
{
  "credential": "google_id_token_here"
}

Response (New User):
{
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "email": "organizer@gmail.com",
    "name": "John Doe",
    "role": "traveler",  # Default role
    "profilePhoto": "google_profile_pic_url",
    "phone": null,
    "phoneVerified": false
  },
  "requiresProfileCompletion": true,
  "requiresPhoneVerification": true,
  "requiresAutoPaySetup": false  # Will be true after role selection
}
```

**Key Points:**
- New Google users default to 'traveler' role
- Email is automatically verified (Google account is trusted)
- Phone is **null** and must be provided
- Profile completion is required

### Step 2: Verify Phone Number

Google OAuth users **MUST** verify their phone number before completing profile.

#### 2a. Send Phone OTP
```bash
POST /auth/verify-phone/send-otp
Authorization: Bearer <jwt_token>

Request:
{
  "phone": "+919876543210"
}

Response:
{
  "message": "OTP sent to your phone number",
  "otp": "123456"  # Only in development mode
}
```

#### 2b. Verify Phone OTP
```bash
POST /auth/verify-phone/verify-otp
Authorization: Bearer <jwt_token>

Request:
{
  "phone": "+919876543210",
  "otp": "123456"
}

Response:
{
  "message": "Phone verified successfully."
}
```

### Step 3: Complete Profile with Role Selection
```bash
POST /auth/complete-profile
Authorization: Bearer <jwt_token>

Request:
{
  "role": "organizer",
  "phone": "+919876543210",  # MANDATORY
  "organizerProfile": {
    "bio": "Experienced trek organizer",
    "experience": "5 years organizing treks",
    "yearsOfExperience": 5,
    "specialties": ["Mountain Trekking", "Adventure Tours"],
    "languages": ["English", "Hindi"]
  }
}

Response:
{
  "message": "Profile completed successfully",
  "user": {
    "id": "user_id",
    "email": "organizer@gmail.com",
    "name": "John Doe",
    "role": "organizer",
    "phone": "+919876543210",
    "phoneVerified": true
  },
  "requiresAutoPaySetup": true
}
```

**Important Validation:**
- User **MUST** have verified phone before calling this endpoint
- If `phoneVerified: false`, endpoint returns error:
  ```json
  {
    "error": "Please verify your phone number first",
    "requiresPhoneVerification": true
  }
  ```
- When role is set to 'organizer', auto-pay is automatically initialized
- Payment scheduled for exactly 60 days from profile completion

### Step 4: Setup Auto-Pay
```bash
POST /api/auto-pay/setup
Authorization: Bearer <jwt_token>

Request:
{
  "razorpayCustomerId": "cust_xxxxx",
  "paymentMethodId": "pm_xxxxx",
  "paymentAmount": 149900
}

Response:
{
  "success": true,
  "message": "Auto-pay setup completed successfully"
}
```

### Step 5: Complete - Ready to Use Platform
Same as regular registration flow.

---

## Validation Rules

### Phone Number Format
- Must match regex: `/^[+]?[1-9]\d{1,14}$/`
- Examples:
  - ✅ `+919876543210` (with country code)
  - ✅ `9876543210` (without country code)
  - ❌ `+0123456789` (cannot start with 0 after +)
  - ❌ `abc1234567` (contains non-digits)

### Phone Verification
- OTP expires in **10 minutes**
- Maximum **5 verification attempts**
- Must wait **60 seconds** between OTP resends
- Phone must be unique (no duplicate phone numbers)

### Auto-Pay Setup
- Minimum payment amount: **100 paise** (₹1)
- Default payment: **149900 paise** (₹1,499)
- Razorpay customer ID required
- Payment method ID required

---

## User Journey Flowchart

```
┌─────────────────────────────────────────────────────────────┐
│                    ORGANIZER ONBOARDING                       │
└─────────────────────────────────────────────────────────────┘

Regular Registration              Google OAuth
        │                              │
        ▼                              ▼
  [1] Register                   [1] Google Login
  (with phone)                   (email auto-verified)
        │                              │
        ▼                              │
  [2] Verify Email                     │
        │                              │
        ▼                              ▼
  [3] Login (First Time)         [2] Verify Phone
        │                         (send + verify OTP)
        ▼                              │
  [4] Verify Phone                     ▼
  (send + verify OTP)            [3] Complete Profile
        │                         (select role = organizer)
        │                              │
        └──────────┬───────────────────┘
                   │
                   ▼
            [Auto-Pay Initialized]
         (scheduled for 60 days)
                   │
                   ▼
           [5] Setup Auto-Pay
        (provide payment method)
                   │
                   ▼
           ✅ ONBOARDING COMPLETE
         (ready to use platform)
```

---

## Frontend Implementation Guide

### Recommended UI Flow

#### For Regular Registration:

1. **Registration Form**
   - Email (required)
   - Password (required)
   - Name (required)
   - Phone (required) ← **Show as required field**
   - Role (select: traveler/organizer)

2. **Email Verification Screen**
   - Show OTP input
   - "Resend OTP" button (with countdown)
   - Validate 6-digit OTP

3. **Login Screen**
   - After email verification, redirect to login

4. **Phone Verification Screen** (After First Login)
   - Show phone number (read-only if already provided)
   - "Send OTP" button
   - OTP input field
   - "Verify" button

5. **Auto-Pay Setup Screen** (For Organizers Only)
   - Explanation of auto-pay (60 days, ₹1,499, 5 trips)
   - Razorpay integration for payment method
   - "Setup Auto-Pay" button
   - Link to documentation/FAQs

6. **Dashboard**
   - Show "Welcome" message
   - Quick start guide for organizers

#### For Google OAuth:

1. **Google Sign-In Button**
   - One-click Google authentication

2. **Profile Completion Screen** (New Users)
   - Pre-filled: Name, Email, Photo (from Google)
   - Required: Phone number ← **Show as required**
   - Required: Role selection (traveler/organizer)
   - Optional: Additional profile details for organizers

3. **Phone Verification Screen**
   - Must complete **before** profile submission
   - "Send OTP to +91XXXXXXXXXX" button
   - OTP input field
   - "Verify" button
   - Disable "Complete Profile" until phone verified

4. **Auto-Pay Setup Screen** (If Organizer)
   - Same as regular flow

5. **Dashboard**
   - Same as regular flow

---

## Error Handling

### Common Errors

#### 1. Phone Not Verified
```json
{
  "error": "Please verify your phone number first",
  "requiresPhoneVerification": true
}
```
**Action:** Redirect user to phone verification flow

#### 2. Phone Already in Use
```json
{
  "error": "Phone number already in use"
}
```
**Action:** Ask user to provide different phone number

#### 3. Auto-Pay Not Setup
```json
{
  "error": "Auto-pay setup required for organizers",
  "requiresAutoPaySetup": true
}
```
**Action:** Redirect to auto-pay setup screen

#### 4. OTP Expired
```json
{
  "error": "Code expired. Please request a new one."
}
```
**Action:** Show "Resend OTP" button

#### 5. Too Many Attempts
```json
{
  "error": "Too many attempts. Request a new code."
}
```
**Action:** Reset OTP and show "Resend OTP" button

---

## Backend Response Flags

All login/auth responses include these flags to help frontend determine next steps:

```typescript
{
  token: string,
  user: User,
  requiresProfileCompletion: boolean,    // Profile not complete
  requiresPhoneVerification: boolean,    // Phone not verified
  requiresAutoPaySetup: boolean          // Auto-pay not setup (organizers only)
}
```

**Frontend Logic:**
```javascript
const response = await login(email, password);

if (response.requiresPhoneVerification) {
  navigate('/verify-phone');
} else if (response.requiresProfileCompletion) {
  navigate('/complete-profile');
} else if (response.requiresAutoPaySetup) {
  navigate('/setup-auto-pay');
} else {
  navigate('/dashboard');
}
```

---

## Testing Checklist

### Regular Registration Flow
- [ ] Cannot register without phone number
- [ ] Phone format validation works
- [ ] Email OTP is sent and validated
- [ ] Phone OTP is sent and validated
- [ ] First login initializes auto-pay (60 days)
- [ ] Cannot complete auto-pay without phone verification
- [ ] Auto-pay setup confirmation email received
- [ ] Dashboard accessible after all steps completed

### Google OAuth Flow
- [ ] Google login creates user with null phone
- [ ] Cannot complete profile without phone
- [ ] Cannot complete profile without phone verification
- [ ] Role selection to 'organizer' initializes auto-pay
- [ ] Auto-pay scheduled for 60 days from profile completion
- [ ] All subsequent flows same as regular registration

### Validation Tests
- [ ] Invalid phone format rejected
- [ ] Duplicate phone numbers rejected
- [ ] OTP expires after 10 minutes
- [ ] Maximum 5 OTP attempts enforced
- [ ] 60-second cooldown between OTP resends
- [ ] Auto-pay minimum amount validated

---

## Security Considerations

1. **Phone Verification:**
   - OTP hashed before storage
   - Rate limiting on OTP requests
   - Attempt tracking to prevent brute force

2. **Payment Method:**
   - Stored via Razorpay tokenization
   - No raw card data stored
   - PCI DSS compliant

3. **Data Privacy:**
   - Phone numbers encrypted at rest (if applicable)
   - Sensitive data only transmitted over HTTPS
   - GDPR compliant data handling

---

## Support & FAQs

### Why is phone mandatory?
Phone verification ensures:
- User authenticity
- Security for payment setup
- Communication channel for critical notifications
- Compliance with payment regulations

### What if organizer doesn't want auto-pay?
Auto-pay is mandatory for organizers to ensure:
- Uninterrupted service
- Consistent trip listing availability
- Fair pricing model

Organizers can cancel auto-pay later, but initial setup is required.

### Can organizer change phone number later?
Yes, but will require re-verification of new phone number.

---

## API Endpoints Summary

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/auth/register` | POST | No | Register new user (phone required) |
| `/auth/verify-registration-email` | POST | No | Verify email OTP |
| `/auth/login` | POST | No | Login user |
| `/auth/google` | POST | No | Google OAuth login |
| `/auth/verify-phone/send-otp` | POST | Yes | Send phone OTP |
| `/auth/verify-phone/verify-otp` | POST | Yes | Verify phone OTP |
| `/auth/complete-profile` | POST | Yes | Complete profile (Google users) |
| `/api/auto-pay/setup` | POST | Yes | Setup auto-pay |
| `/api/auto-pay/status` | GET | Yes | Get auto-pay status |
| `/api/auto-pay/cancel` | POST | Yes | Cancel auto-pay |

---

## Next Steps for Development

1. **Frontend Implementation:**
   - Update registration form to make phone required
   - Add phone verification screen
   - Create auto-pay setup screen with Razorpay integration
   - Implement progress indicator showing onboarding steps

2. **Testing:**
   - Write integration tests for complete flow
   - Test with actual Razorpay test credentials
   - User acceptance testing (UAT)

3. **Documentation:**
   - API documentation (Swagger/OpenAPI)
   - User-facing help docs
   - Video tutorial for organizers
