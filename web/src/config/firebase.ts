import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAnalytics, Analytics } from "firebase/analytics";
import { getStorage, FirebaseStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
    measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase safely
let app: FirebaseApp;
let analytics: Analytics | null = null;
let storage: FirebaseStorage;

try {
    // Check if any config is missing (basic check)
    if (!firebaseConfig.apiKey) {
        console.warn('⚠️ Firebase config missing. Some features may not work.');
    }

    // Initialize only if not already initialized
    if (!getApps().length) {
        app = initializeApp(firebaseConfig);
    } else {
        app = getApps()[0];
    }

    // Analytics (optional, might fail in some envs)
    try {
        if (typeof window !== 'undefined') {
            analytics = getAnalytics(app);
        }
    } catch (e) {
        console.warn('⚠️ Firebase Analytics failed to load:', e);
    }

    storage = getStorage(app);
} catch (error) {
    console.error('❌ Critical: Firebase initialization failed:', error);
    // Create a dummy app/storage to prevent immediate crash on import, 
    // but operations will fail if called.
    const dummyApp = { name: '[DEFAULT]', options: {} } as FirebaseApp;
    app = dummyApp;
    storage = {} as FirebaseStorage; // This will likely crash if used, but prevents import crash
}

export { app, analytics, storage };
