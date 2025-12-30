# Firebase Environment Variables

## 🔥 Required Firebase Environment Variables

Firebase is used for file storage (profile photos, trip images, verification documents, QR codes) in the backend API service.

### Backend Environment Variables (`services/api/.env`)

Add these variables to your `services/api/.env` file:

```bash
# Firebase Configuration (Required for file uploads)
FIREBASE_API_KEY=your-firebase-api-key
FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
FIREBASE_APP_ID=your-app-id
FIREBASE_MEASUREMENT_ID=your-measurement-id
```

## 📋 Variable Descriptions

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `FIREBASE_API_KEY` | ✅ Yes | Firebase API key for your project | `AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `FIREBASE_AUTH_DOMAIN` | ✅ Yes | Firebase authentication domain | `my-project.firebaseapp.com` |
| `FIREBASE_PROJECT_ID` | ✅ Yes | Your Firebase project ID | `my-project-12345` |
| `FIREBASE_STORAGE_BUCKET` | ✅ Yes | Firebase Storage bucket name | `my-project-12345.appspot.com` |
| `FIREBASE_MESSAGING_SENDER_ID` | ✅ Yes | Firebase Cloud Messaging sender ID | `123456789012` |
| `FIREBASE_APP_ID` | ✅ Yes | Firebase app ID | `1:123456789012:web:abcdef123456` |
| `FIREBASE_MEASUREMENT_ID` | ⚠️ Optional | Google Analytics measurement ID | `G-XXXXXXXXXX` |

## 🔍 Where to Find These Values

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Select your project** (or create a new one)
3. **Click the gear icon** ⚙️ next to "Project Overview"
4. **Select "Project settings"**
5. **Scroll down to "Your apps"** section
6. **If you don't have a web app, click "Add app"** and select the web icon `</>`
7. **Copy the config values** from the Firebase SDK setup:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyB...",           // → FIREBASE_API_KEY
  authDomain: "project.firebaseapp.com",  // → FIREBASE_AUTH_DOMAIN
  projectId: "my-project-12345",   // → FIREBASE_PROJECT_ID
  storageBucket: "my-project-12345.appspot.com", // → FIREBASE_STORAGE_BUCKET
  messagingSenderId: "123456789012", // → FIREBASE_MESSAGING_SENDER_ID
  appId: "1:123456789012:web:abc", // → FIREBASE_APP_ID
  measurementId: "G-XXXXXXXXXX"   // → FIREBASE_MEASUREMENT_ID (optional)
};
```

## 🚀 Setup Instructions

### 1. Create Firebase Project (if you don't have one)

1. Go to https://console.firebase.google.com/
2. Click "Add project"
3. Enter project name (e.g., "trek-tribe")
4. Follow the setup wizard
5. Enable **Firebase Storage** in the Firebase Console:
   - Go to "Storage" in the left sidebar
   - Click "Get started"
   - Choose "Start in test mode" (for development) or set up security rules
   - Select a location for your storage bucket

### 2. Enable Firebase Storage

Firebase Storage is required for file uploads. Make sure it's enabled:

1. In Firebase Console, go to **Storage**
2. Click **Get started**
3. Choose security rules:
   - **Test mode** (for development): Allows read/write for 30 days
   - **Production mode**: Set up proper security rules

### 3. Add Environment Variables

Add the Firebase config to your backend `.env` file:

```bash
# In services/api/.env
FIREBASE_API_KEY=AIzaSyBxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FIREBASE_AUTH_DOMAIN=trek-tribe-12345.firebaseapp.com
FIREBASE_PROJECT_ID=trek-tribe-12345
FIREBASE_STORAGE_BUCKET=trek-tribe-12345.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789012
FIREBASE_APP_ID=1:123456789012:web:abcdef123456
FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

### 4. Restart Backend Server

After adding the environment variables, restart your backend server:

```bash
cd services/api
npm run dev
```

## ✅ Verification

To verify Firebase is configured correctly:

1. **Check backend logs** - Should see Firebase initialized successfully
2. **Test file upload** - Try uploading a profile photo or trip image
3. **Check Firebase Console** - Files should appear in Storage

## 🔒 Security Rules (Production)

For production, set up proper Firebase Storage security rules:

```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Allow authenticated users to upload their own files
    match /profiles/{userId}/{fileName} {
      allow read: if true; // Public read
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /trips/{tripId}/{fileName} {
      allow read: if true; // Public read
      allow write: if request.auth != null;
    }
    
    match /documents/{userId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /qr-codes/{userId}/{fileName} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 📝 What Firebase is Used For

Firebase Storage is used for:

- ✅ **Profile Photos** - User profile pictures
- ✅ **Cover Photos** - User cover images
- ✅ **Trip Images** - Trip listing photos
- ✅ **Verification Documents** - ID verification uploads
- ✅ **QR Codes** - Payment QR code images

## ⚠️ Important Notes

1. **Firebase is optional** - The app will work without it, but file uploads will fail
2. **Free tier available** - Firebase offers a generous free tier for storage
3. **Costs** - After free tier, you pay per GB stored and downloaded
4. **Security** - Always set up proper security rules for production

## 🆘 Troubleshooting

### Issue: "Firebase app not initialized"
**Solution:** Check that all required environment variables are set correctly

### Issue: "Permission denied" errors
**Solution:** Check Firebase Storage security rules in Firebase Console

### Issue: Files not uploading
**Solution:** 
- Verify Firebase Storage is enabled
- Check storage bucket name matches `FIREBASE_STORAGE_BUCKET`
- Verify network connectivity

### Issue: "Invalid API key"
**Solution:** 
- Regenerate API key in Firebase Console
- Make sure you're using the correct project's credentials

## 📚 Additional Resources

- [Firebase Console](https://console.firebase.google.com/)
- [Firebase Storage Documentation](https://firebase.google.com/docs/storage)
- [Firebase Security Rules](https://firebase.google.com/docs/storage/security)

