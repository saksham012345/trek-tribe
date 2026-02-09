import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import path from 'path';
import { logger } from '../utils/logger';
import cloudinary from '../config/cloudinary';

// Firebase client config (used only for non-storage client-style features)
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID,
};

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;

try {
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    if (!getApps().length) {
      firebaseApp = initializeApp(firebaseConfig);
    } else {
      firebaseApp = getApps()[0] as FirebaseApp;
    }
    firebaseAuth = getAuth(firebaseApp);
    logger.info('Firebase initialized for non-storage features (auth/config). Storage disabled; use Cloudinary for uploads.');
  } else {
    logger.info('Firebase config missing; Firebase non-storage features disabled.');
  }
} catch (e: any) {
  logger.warn('Firebase initialization failed:', e?.message || e);
}

interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

/**
 * FirebaseService now retains only non-storage initialization and feature flags.
 * Storage-related methods are deprecated and instruct use of Cloudinary (`uploadService`).
 */
class FirebaseService {
  /**
   * @deprecated Use uploadService.uploadFile() instead
   */
  async uploadFile(
    file: Buffer | Uint8Array, 
    fileName: string, 
    folder: string = 'uploads',
    contentType?: string
  ): Promise<UploadResult> {
    logger.warn('⚠️ DEPRECATED: FirebaseService.uploadFile() - Use uploadService.uploadFile() instead');
    return {
      success: false,
      error: 'Firebase Storage no longer supported. Use Cloudinary instead.'
    };
  }

  /**
   * @deprecated Use uploadService.uploadProfilePhoto() instead
   */
  async uploadProfilePhoto(file: Buffer, fileName: string, userId: string): Promise<UploadResult> {
    logger.warn('⚠️ DEPRECATED: Use uploadService.uploadProfilePhoto() instead');
    return {
      success: false,
      error: 'Firebase Storage removed. Use uploadService instead.'
    };
  }

  /**
   * @deprecated Use uploadService.uploadCoverPhoto() instead
   */
  async uploadCoverPhoto(file: Buffer, fileName: string, userId: string): Promise<UploadResult> {
    logger.warn('⚠️ DEPRECATED: Use uploadService.uploadCoverPhoto() instead');
    return {
      success: false,
      error: 'Firebase Storage removed. Use uploadService instead.'
    };
  }

  /**
   * @deprecated Use uploadService.uploadTripImages() instead
   */
  async uploadTripImages(files: Buffer[], fileNames: string[], tripId: string): Promise<UploadResult[]> {
    logger.warn('⚠️ DEPRECATED: Use uploadService.uploadTripImages() instead');
    return files.map(() => ({
      success: false,
      error: 'Firebase Storage removed. Use uploadService instead.'
    }));
  }

  /**
   * @deprecated Use uploadService.uploadVerificationDoc() instead
   */
  async uploadVerificationDoc(file: Buffer, fileName: string, userId: string): Promise<UploadResult> {
    logger.warn('⚠️ DEPRECATED: Use uploadService.uploadVerificationDoc() instead');
    return {
      success: false,
      error: 'Firebase Storage removed. Use uploadService instead.'
    };
  }

  /**
   * @deprecated Use uploadService.uploadQRCode() instead
   */
  async uploadQRCode(file: Buffer, fileName: string, userId: string): Promise<UploadResult> {
    logger.warn('⚠️ DEPRECATED: Use uploadService.uploadQRCode() instead');
    return {
      success: false,
      error: 'Firebase Storage removed. Use uploadService instead.'
    };
  }

  /**
   * @deprecated Firebase Storage no longer supported
   */
  async deleteFile(filePath: string): Promise<boolean> {
    logger.warn('⚠️ DEPRECATED: Use uploadService.deleteFile() instead');
    return false;
  }

  /**
   * @deprecated Firebase Storage no longer supported
   */
  async getDownloadURL(filePath: string): Promise<string | null> {
    logger.warn('⚠️ DEPRECATED: Firebase Storage removed');
    return null;
  }

  /**
   * Firebase configuration check
   */
  isConfigured(): boolean {
    return firebaseApp !== null;
  }
}

export const firebaseService = new FirebaseService();
export const getFirebaseApp = (): FirebaseApp | null => firebaseApp;
export const getFirebaseAuth = (): Auth | null => firebaseAuth;
