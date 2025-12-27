# Google OAuth Login with Role Selection

## 🔐 Overview

Google OAuth login flow with an intuitive **role selection modal** for new users:
- User signs in with Google
- If new user → **Modal appears** to select role and complete profile
- If existing user → Direct login ✅

---

## 🔄 Complete Workflow

### Step 1: User Clicks "Sign in with Google"
```tsx
<GoogleLoginButton 
  onSuccess={() => navigate('/home')}
  onError={(error) => setError(error)}
/>
```

### Step 2: Google Authentication
- User selects Google account
- Google returns ID token with:
  - ✅ Email (verified)
  - ✅ Name
  - ✅ Profile picture
  - ✅ Google ID

### Step 3: Backend Processing

**Endpoint:** `POST /auth/google`

```typescript
// Check if user exists
let user = await User.findOne({ email });

if (user) {
  // Existing user - update profile photo and login
  user.emailVerified = true;
  user.lastActive = new Date();
  await user.save();
} else {
  // New user - create with Google info
  user = await User.create({
    email,
    name,
    passwordHash: randomHash, // Won't be used
    role: 'traveler', // Default role (will be updated)
    profilePhoto: picture,
    emailVerified: true
  });
}

// Return JWT token + profile completion flag
return {
  token,
  user,
  requiresProfileCompletion: !user.phone // NEW USER
};
```

### Step 4: Frontend Modal (New Users Only)

**Modal appears if `requiresProfileCompletion: true`**

#### **Phase 1: Role Selection**

```
┌─────────────────────────────────┐
│  Complete Your Profile          │
│  user@gmail.com                 │
├─────────────────────────────────┤
│  ● Role  →  Phone  →  Verify   │
├─────────────────────────────────┤
│  How do you want to join?       │
│                                  │
│  ┌──────────┐  ┌──────────┐    │
│  │  🎒      │  │  🗺️      │    │
│  │ Adventure│  │ Organizer │    │
│  │  Join    │  │  Create   │    │
│  │  Treks   │  │  Trips    │    │
│  └──────────┘  └──────────┘    │
│                                  │
│  [Organizer Details] (if chosen)│
│  Experience: [____________]     │
│  Years: [____]                  │
│  Specialties: [____________]    │
│                                  │
│           [Next →]               │
└─────────────────────────────────┘
```

#### **Phase 2: Phone Number**

```
┌─────────────────────────────────┐
│  Complete Your Profile          │
│  user@gmail.com                 │
├─────────────────────────────────┤
│  ✓ Role  ●  Phone  →  Verify   │
├─────────────────────────────────┤
│  Enter your phone number        │
│                                  │
│  Phone: [+91 __________]        │
│                                  │
│  We'll send a verification code │
│                                  │
│        [Send OTP →]              │
└─────────────────────────────────┘
```

#### **Phase 3: OTP Verification**

```
┌─────────────────────────────────┐
│  Complete Your Profile          │
│  user@gmail.com                 │
├─────────────────────────────────┤
│  ✓ Role  ✓  Phone  ●  Verify   │
├─────────────────────────────────┤
│  Enter verification code        │
│  sent to +91 98765 43210        │
│                                  │
│  OTP: [_] [_] [_] [_] [_] [_]  │
│                                  │
│  Didn't receive? Resend in 42s  │
│                                  │
│        [Verify & Continue]       │
└─────────────────────────────────┘
```

### Step 5: Complete Profile (Backend)

**Endpoint:** `POST /auth/complete-profile`

```typescript
{
  "role": "organizer",
  "phone": "+919876543210",
  "organizerProfile": {
    "experience": "Mountain guide for 5 years",
    "yearsOfExperience": 5,
    "specialties": ["Trekking", "Rock Climbing"],
    "languages": ["English", "Hindi"],
    "bio": "Passionate about mountains"
  }
}
```

**Backend Actions:**
1. ✅ Verify phone is verified
2. ✅ Update user role
3. ✅ Add phone number
4. ✅ Initialize organizer profile (if organizer)
5. ✅ Set `organizerVerificationStatus: 'pending'`
6. ✅ Create VerificationRequest for admin
7. ✅ Return success

### Step 6: Post-Completion Flow

**For Travelers:**
- ✅ Profile complete
- ✅ Redirect to home
- ✅ Can browse and book trips

**For Organizers:**
- ✅ Profile complete
- ⏳ Verification status: **Pending**
- ❌ **Cannot create trips yet** (blocked by middleware)
- 📧 **Admin receives verification request**
- ⏳ **Waiting for admin approval**

---

## 🎯 Key Features

### 1. **Seamless Google Login**
- One-click authentication
- No password needed
- Email automatically verified
- Profile photo imported

### 2. **Progressive Profile Completion**
- 3-step wizard (Role → Phone → Verify)
- Progress indicator
- Can't skip steps
- Clear visual feedback

### 3. **Role-Specific Fields**
- **Traveler:** Just phone verification
- **Organizer:** Additional fields
  - Experience description
  - Years of experience
  - Specialties (tags)
  - Languages spoken
  - Bio

### 4. **Phone Verification**
- OTP sent via SMS
- 60-second countdown
- Resend functionality
- Dev mode shows OTP in UI

### 5. **Automatic Admin Notification**
- VerificationRequest created for organizers
- Status: `pending`
- Admin can review via dashboard
- Trust score initialized at 0

---

## 📁 Code Structure

### Backend Files

**`services/api/src/routes/auth.ts`**

```typescript
// Google OAuth endpoint
router.post('/google', async (req, res) => {
  // Verify Google token
  // Create or update user
  // Return requiresProfileCompletion flag
});

// Complete profile endpoint
router.post('/complete-profile', authenticateJwt, async (req, res) => {
  // Validate phone is verified
  // Update user role and profile
  // Create VerificationRequest for organizers
  // Return success
});
```

### Frontend Files

**`web/src/components/GoogleLoginButton.tsx`**

```tsx
const GoogleLoginButton = () => {
  const handleGoogleResponse = async (response) => {
    const { token, user, requiresProfileCompletion } = await api.post('/auth/google', {
      credential: response.credential
    });
    
    if (requiresProfileCompletion) {
      setShowCompleteProfile(true); // Show modal
    } else {
      onSuccess(); // Direct login
    }
  };
  
  return (
    <>
      <div ref={buttonRef} /> {/* Google button */}
      {showCompleteProfile && (
        <CompleteProfileModal 
          open={showCompleteProfile}
          onComplete={handleProfileComplete}
          userEmail={userEmail}
        />
      )}
    </>
  );
};
```

**`web/src/components/CompleteProfileModal.tsx`**

```tsx
const CompleteProfileModal = ({ open, onComplete, userEmail }) => {
  const [step, setStep] = useState<'role' | 'phone' | 'verify'>('role');
  const [role, setRole] = useState<'traveler' | 'organizer' | null>(null);
  
  // Step 1: Role selection
  // Step 2: Phone entry & OTP send
  // Step 3: OTP verification & profile completion
  
  return (
    <div className="modal">
      {step === 'role' && <RoleSelection />}
      {step === 'phone' && <PhoneEntry />}
      {step === 'verify' && <OtpVerification />}
    </div>
  );
};
```

---

## 🔧 Configuration

### Environment Variables

```env
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_IDS=id1,id2,id3  # Multiple IDs (web, mobile, etc.)

# Frontend
REACT_APP_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

### Google Cloud Console Setup

1. **Enable Google+ API**
2. **Create OAuth 2.0 credentials**
3. **Add authorized JavaScript origins:**
   - `http://localhost:3000`
   - `https://yourdomain.com`
4. **Add authorized redirect URIs:**
   - `http://localhost:3000`
   - `https://yourdomain.com`

---

## 🧪 Testing Workflow

### Test Case 1: New Traveler

```
1. Click "Sign in with Google"
2. Select Google account
3. Modal appears: "How do you want to join?"
4. Select "🎒 Adventurer"
5. Click "Next"
6. Enter phone: +91 98765 43210
7. Click "Send OTP"
8. Enter OTP: 123456
9. Click "Verify & Continue"
10. ✅ Profile complete → Redirect to home
```

**Database State:**
```javascript
{
  email: "user@gmail.com",
  name: "John Doe",
  role: "traveler",
  phone: "+919876543210",
  phoneVerified: true,
  emailVerified: true,
  profilePhoto: "https://google.com/photo.jpg"
}
```

### Test Case 2: New Organizer

```
1. Click "Sign in with Google"
2. Select Google account
3. Modal appears: "How do you want to join?"
4. Select "🗺️ Organizer"
5. Fill organizer details:
   - Experience: "Mountain guide"
   - Years: 5
   - Specialties: "Trekking, Climbing"
   - Bio: "Love mountains"
6. Click "Next"
7. Enter phone: +91 98765 43210
8. Click "Send OTP"
9. Enter OTP: 123456
10. Click "Verify & Continue"
11. ✅ Profile complete
12. ⚠️ Message: "Your account is awaiting admin verification"
```

**Database State:**
```javascript
{
  email: "organizer@gmail.com",
  name: "Jane Smith",
  role: "organizer",
  phone: "+919876543210",
  phoneVerified: true,
  emailVerified: true,
  profilePhoto: "https://google.com/photo.jpg",
  organizerVerificationStatus: "pending",
  organizerProfile: {
    experience: "Mountain guide",
    yearsOfExperience: 5,
    specialties: ["Trekking", "Climbing"],
    bio: "Love mountains",
    trustScore: { overall: 0, ... },
    verificationBadge: "none",
    routingEnabled: false
  }
}
```

**VerificationRequest Created:**
```javascript
{
  organizerId: "org_123",
  organizerName: "Jane Smith",
  organizerEmail: "organizer@gmail.com",
  requestType: "initial",
  status: "pending",
  priority: "medium",
  kycDetails: {
    phone: "+919876543210",
    businessName: "Jane Smith"
  }
}
```

### Test Case 3: Existing User

```
1. Click "Sign in with Google"
2. Select Google account (already registered)
3. ✅ Instant login → Redirect to home
4. ❌ No modal (profile already complete)
```

---

## 🚀 User Experience Highlights

### **New User Journey**
```
Google Sign In
     ↓
Modal Appears
     ↓
Choose Role (Traveler/Organizer)
     ↓
[If Organizer] Fill Details
     ↓
Enter Phone
     ↓
Verify OTP
     ↓
✅ Profile Complete!
     ↓
[Traveler] → Home
[Organizer] → Pending Verification
```

### **Returning User Journey**
```
Google Sign In
     ↓
✅ Instant Login
     ↓
Home Dashboard
```

---

## 🛡️ Security Features

1. **Google Token Verification**
   - Verifies ID token signature
   - Checks token issuer
   - Validates email verification
   - Prevents token replay

2. **Phone Verification**
   - Mandatory for all users
   - OTP validation
   - 60-second cooldown
   - Rate limiting

3. **Organizer Protection**
   - Admin verification required
   - Cannot create trips until approved
   - Middleware blocks unverified organizers
   - Audit trail maintained

---

## 📊 API Response Examples

### Google Login (New User)

**Request:**
```http
POST /auth/google
Content-Type: application/json

{
  "credential": "google_id_token_here"
}
```

**Response:**
```json
{
  "token": "jwt_token_here",
  "user": {
    "id": "user_123",
    "email": "newuser@gmail.com",
    "name": "New User",
    "role": "traveler",
    "profilePhoto": "https://google.com/photo.jpg",
    "phone": null,
    "phoneVerified": false
  },
  "requiresProfileCompletion": true,
  "requiresPhoneVerification": true,
  "requiresAutoPaySetup": false
}
```

### Complete Profile

**Request:**
```http
POST /auth/complete-profile
Authorization: Bearer jwt_token
Content-Type: application/json

{
  "role": "organizer",
  "phone": "+919876543210",
  "organizerProfile": {
    "experience": "5 years trekking guide",
    "yearsOfExperience": 5,
    "specialties": ["Trekking", "Mountain Climbing"],
    "languages": ["English", "Hindi"],
    "bio": "Passionate mountain guide"
  }
}
```

**Response:**
```json
{
  "message": "Profile completed successfully",
  "user": {
    "id": "user_123",
    "email": "organizer@gmail.com",
    "name": "Organizer Name",
    "role": "organizer",
    "phone": "+919876543210",
    "phoneVerified": true
  },
  "requiresAutoPaySetup": false
}
```

---

## ✅ Implementation Status

### Completed ✅
- [x] Google OAuth backend endpoint
- [x] Profile completion endpoint
- [x] Google login button component
- [x] Complete profile modal (3-step wizard)
- [x] Role selection UI
- [x] Phone verification flow
- [x] OTP validation
- [x] Organizer profile fields
- [x] VerificationRequest creation for organizers
- [x] Trust score initialization
- [x] Admin verification workflow integration

### Working Features ✅
- ✅ One-click Google sign-in
- ✅ Automatic profile photo import
- ✅ Email verification bypass
- ✅ Progressive profile completion
- ✅ Role-specific fields
- ✅ Phone OTP verification
- ✅ Organizer admin approval workflow
- ✅ Middleware protection for unverified organizers

---

## 🎯 Next Steps (Optional Enhancements)

1. **Social Onboarding**
   - Show tutorial after profile completion
   - Highlight key features based on role
   - Quick tour of dashboard

2. **Profile Enrichment**
   - Import more Google data (location, timezone)
   - LinkedIn integration for organizers
   - Upload additional documents

3. **Smart Defaults**
   - Pre-fill fields based on Google data
   - Suggest specialties based on profile
   - Auto-detect timezone/language

4. **Analytics**
   - Track conversion rates
   - Monitor completion times
   - A/B test modal designs

---

## 📞 Support

**Existing user signs in with Google:**
- ✅ Works instantly
- ✅ Updates profile photo
- ✅ No modal shown

**New user signs in with Google:**
- ✅ Modal appears
- ✅ Completes in 3 steps
- ✅ Full profile created

**Organizer via Google:**
- ✅ Additional fields collected
- ✅ Verification request created
- ✅ Admin notification sent
- ⏳ Pending approval

---

**Status:** ✅ Fully Implemented & Production Ready  
**Last Updated:** December 26, 2025
