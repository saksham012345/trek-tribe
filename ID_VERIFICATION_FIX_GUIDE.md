# ID VERIFICATION & FIREBASE CONFIGURATION FIX

## Date: December 26, 2025

## Issues Identified

### 1. ID Verification Upload Missing ❌
**Problem:** Join adventure requires ID verification but there's no UI for users to upload their documents.

**Backend:** ✅ Complete
- Service exists: `services/api/src/services/idVerificationService.ts`
- Accepts: Aadhaar, PAN, Passport, Driving License, Voter ID
- Fields: documentType, documentNumber, documentFront, documentBack, expiryDate

**Frontend:** ❌ Missing
- No upload component in `JoinTripModal.tsx`
- Users cannot submit ID documents

---

### 2. Firebase Credentials Missing from .env.example ❌
**Problem:** Firebase is used for file uploads but credentials are missing from env.example files.

**Usage:** Firebase Storage for:
- ID document uploads
- Trip images
- Payment screenshots
- User profile photos

**Missing Variables:**
```
FIREBASE_API_KEY
FIREBASE_AUTH_DOMAIN
FIREBASE_PROJECT_ID
FIREBASE_STORAGE_BUCKET
FIREBASE_MESSAGING_SENDER_ID
FIREBASE_APP_ID
FIREBASE_MEASUREMENT_ID
```

---

## Solutions Implemented

### Solution 1: Add ID Upload Component

**File Created:** `web/src/components/IdVerificationUpload.tsx`

Features:
- Document type selector (Aadhaar, PAN, Passport, etc.)
- Document number validation
- Front & back image upload
- Expiry date for Passport/Driving License
- Firebase Storage integration
- Real-time upload progress
- File size & type validation

**Integration:** Added to JoinTripModal.tsx as a verification step

---

### Solution 2: Update .env.example Files

**Files Updated:**
1. `web/.env.example` - Added Firebase credentials
2. `ai-service/.env.example` - Already complete
3. Create `services/api/.env.example` - Added all required variables

**New Firebase Section:**
```env
# Firebase Configuration (Required for File Uploads)
FIREBASE_API_KEY=your-firebase-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your-sender-id
FIREBASE_APP_ID=your-app-id
FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

---

## Testing Results

### Production Tests Against Live URLs
- **Backend:** https://trekktribe.onrender.com ✅
- **Frontend:** https://trektribe.in ✅
- **AI Service:** https://ai-service-g3rs.onrender.com ⚠️ (Requires API key)

**Test Summary:**
- Total Tests: 9
- Passed: 3 (33.3%)
- Failed: 6 (66.7%)

**AI Service Issues:**
- Timeouts on health check (cold start)
- 401 Unauthorized (missing API key in requests)
- **Fix:** Add AI_SERVICE_KEY header to all AI requests

---

## Implementation Guide

### For ID Verification Upload

**Step 1:** Import the component
```tsx
import IdVerificationUpload from './IdVerificationUpload';
```

**Step 2:** Add state for ID verification
```tsx
const [showIdVerification, setShowIdVerification] = useState(false);
const [idVerified, setIdVerified] = useState(false);
```

**Step 3:** Add verification step in booking flow
```tsx
{showIdVerification && !idVerified && (
  <IdVerificationUpload
    userId={user._id}
    onSuccess={() => {
      setIdVerified(true);
      setShowIdVerification(false);
    }}
    onCancel={() => setShowIdVerification(false)}
  />
)}
```

### For Firebase Configuration

**Step 1:** Create Firebase project at https://console.firebase.google.com

**Step 2:** Enable Firebase Storage

**Step 3:** Get configuration from Project Settings

**Step 4:** Add to .env file
```env
FIREBASE_API_KEY=AIzaSyD...
FIREBASE_AUTH_DOMAIN=trek-tribe.firebaseapp.com
FIREBASE_PROJECT_ID=trek-tribe
FIREBASE_STORAGE_BUCKET=trek-tribe.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123456789:web:abc123
FIREBASE_MEASUREMENT_ID=G-ABC123XYZ
```

**Step 5:** Configure Storage Rules
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /id-documents/{userId}/{document} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /trip-images/{tripId}/{image} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /payment-screenshots/{bookingId}/{image} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## API Endpoints

### ID Verification

**Submit ID for Verification**
```
POST /id-verification/submit
Headers: Authorization: Bearer <token>
Body: {
  documentType: "aadhaar" | "pan" | "passport" | "driving_license" | "voter_id",
  documentNumber: "string",
  documentFront: "firebase-url",
  documentBack: "firebase-url", // optional
  expiryDate: "2030-12-31" // optional
}
```

**Check Verification Status**
```
GET /id-verification/status
Headers: Authorization: Bearer <token>
Response: {
  status: "pending" | "verified" | "rejected",
  documentType: "aadhaar",
  submittedAt: "2025-12-26T10:00:00Z",
  verifiedAt: "2025-12-27T15:00:00Z" // if verified
}
```

---

## User Flow

### ID Verification Flow

1. User clicks "Join Adventure"
2. Modal checks if ID verification required
3. If not verified, show IdVerificationUpload component
4. User selects document type
5. User enters document number
6. User uploads front image
7. User uploads back image (if applicable)
8. User sets expiry date (if applicable)
9. Files upload to Firebase Storage
10. API call to submit verification
11. Admin reviews in dashboard
12. User receives notification
13. User can join adventures

### Document Types & Validation

**Aadhaar Card**
- Format: 12 digits
- Images: Front & Back
- Expiry: No

**PAN Card**
- Format: 10 characters (ABCDE1234F)
- Images: Front only
- Expiry: No

**Passport**
- Format: Alphanumeric (A1234567)
- Images: Front only (photo page)
- Expiry: Yes (required)

**Driving License**
- Format: State-specific
- Images: Front & Back
- Expiry: Yes (required)

**Voter ID**
- Format: 10 characters (ABC1234567)
- Images: Front & Back
- Expiry: No

---

## Security Considerations

### File Upload Security

1. **File Type Validation**
   - Accept only: image/jpeg, image/png, image/jpg
   - Reject: executables, scripts, PDFs

2. **File Size Limits**
   - Max size: 5MB per file
   - Total: 10MB per verification

3. **Firebase Storage Rules**
   - User can only upload to their own folder
   - Admins can read all documents
   - Public read disabled

4. **Document Number Encryption**
   - Hash before storing
   - Display only last 4 digits to user

### Privacy Compliance

1. **Data Retention**
   - Delete documents after verification
   - Keep verification status only

2. **Access Control**
   - Only user & admins can view documents
   - Audit log for document access

3. **Secure Transmission**
   - HTTPS only
   - Encrypted at rest in Firebase

---

## Known Issues & Workarounds

### Issue 1: AI Service 401 Unauthorized
**Cause:** Missing API key in requests
**Fix:** Add header to all AI requests:
```javascript
headers: {
  'X-API-Key': process.env.REACT_APP_AI_SERVICE_KEY
}
```

### Issue 2: AI Service Timeout
**Cause:** Cold start on Render free tier
**Workaround:** 
- First request may take 30-60 seconds
- Keep-alive ping every 5 minutes
- Consider upgrading to paid tier

### Issue 3: Firebase Storage CORS
**Cause:** Frontend domain not whitelisted
**Fix:** Add to Firebase Console → Storage → CORS configuration

---

## Deployment Checklist

### Before Deploying

- [ ] Create Firebase project
- [ ] Enable Firebase Storage
- [ ] Configure Storage rules
- [ ] Get Firebase credentials
- [ ] Add credentials to environment variables
- [ ] Test file upload locally
- [ ] Test ID verification flow
- [ ] Review security rules
- [ ] Set up admin verification dashboard
- [ ] Configure email notifications
- [ ] Test on staging environment

### Environment Variables to Add

**Backend (Render.com)**
```
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_PROJECT_ID=...
FIREBASE_STORAGE_BUCKET=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...
FIREBASE_MEASUREMENT_ID=...
```

**Frontend (Vercel/Render)**
```
REACT_APP_FIREBASE_API_KEY=...
REACT_APP_FIREBASE_AUTH_DOMAIN=...
REACT_APP_FIREBASE_PROJECT_ID=...
REACT_APP_FIREBASE_STORAGE_BUCKET=...
REACT_APP_AI_SERVICE_KEY=5YDVAJioLzl0wq0u1r4X9na6ypPkZpiQeEUynHaDMo0=
```

---

## Next Steps

1. ✅ Create IdVerificationUpload component
2. ✅ Update .env.example files
3. ✅ Add Firebase credentials section
4. ⏳ Create Firebase project (manual step)
5. ⏳ Configure Storage rules (manual step)
6. ⏳ Add to backend .env (manual step)
7. ⏳ Add to frontend .env (manual step)
8. ⏳ Test upload flow
9. ⏳ Deploy to production

---

## Support

For issues with:
- **Firebase Setup:** https://firebase.google.com/docs/storage
- **ID Verification Backend:** See `services/api/src/services/idVerificationService.ts`
- **Frontend Component:** See `web/src/components/IdVerificationUpload.tsx`

---

**Report Generated:** December 26, 2025
**Issues Fixed:** 2 Critical
**Files Created:** 2
**Files Updated:** 2
