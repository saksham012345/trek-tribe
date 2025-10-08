import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { getAuth } from 'firebase/auth';
import path from 'path';
import { logger } from '../utils/logger';

// Firebase configuration - these will come from environment variables
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const storage = getStorage(app);
const auth = getAuth(app);

interface UploadResult {
  success: boolean;
  url?: string;
  path?: string;
  error?: string;
}

class FirebaseService {
  /**
   * Upload file to Firebase Storage
   */
  async uploadFile(
    file: Buffer | Uint8Array, 
    fileName: string, 
    folder: string = 'uploads',
    contentType?: string
  ): Promise<UploadResult> {
    try {
      const filePath = `${folder}/${Date.now()}-${fileName}`;
      const storageRef = ref(storage, filePath);
      
      const metadata = contentType ? { contentType } : undefined;
      const snapshot = await uploadBytes(storageRef, file, metadata);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      logger.info('File uploaded to Firebase Storage', { 
        filePath, 
        size: snapshot.metadata.size 
      });
      
      return {
        success: true,
        url: downloadURL,
        path: filePath
      };
    } catch (error: any) {
      logger.error('Error uploading to Firebase Storage', { 
        error: error.message,
        fileName,
        folder
      });
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Upload profile photo
   */
  async uploadProfilePhoto(file: Buffer, fileName: string, userId: string): Promise<UploadResult> {
    const sanitizedFileName = `${userId}-profile-${Date.now()}${path.extname(fileName)}`;
    return this.uploadFile(file, sanitizedFileName, 'profiles', 'image/jpeg');
  }

  /**
   * Upload cover photo
   */
  async uploadCoverPhoto(file: Buffer, fileName: string, userId: string): Promise<UploadResult> {
    const sanitizedFileName = `${userId}-cover-${Date.now()}${path.extname(fileName)}`;
    return this.uploadFile(file, sanitizedFileName, 'covers', 'image/jpeg');
  }

  /**
   * Upload trip images
   */
  async uploadTripImages(files: Buffer[], fileNames: string[], tripId: string): Promise<UploadResult[]> {
    const results = await Promise.all(
      files.map(async (file, index) => {
        const fileName = fileNames[index];
        const sanitizedFileName = `${tripId}-${Date.now()}-${index}${path.extname(fileName)}`;
        return this.uploadFile(file, sanitizedFileName, 'trips', 'image/jpeg');
      })
    );
    
    return results;
  }

  /**
   * Upload verification documents
   */
  async uploadVerificationDoc(file: Buffer, fileName: string, userId: string): Promise<UploadResult> {
    const sanitizedFileName = `${userId}-doc-${Date.now()}${path.extname(fileName)}`;
    const contentType = fileName.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg';
    return this.uploadFile(file, sanitizedFileName, 'documents', contentType);
  }

  /**
   * Upload QR code
   */
  async uploadQRCode(file: Buffer, fileName: string, userId: string): Promise<UploadResult> {
    const sanitizedFileName = `${userId}-qr-${Date.now()}${path.extname(fileName)}`;
    return this.uploadFile(file, sanitizedFileName, 'qr-codes', 'image/png');
  }

  /**
   * Delete file from Firebase Storage
   */
  async deleteFile(filePath: string): Promise<boolean> {
    try {
      const fileRef = ref(storage, filePath);
      await deleteObject(fileRef);
      
      logger.info('File deleted from Firebase Storage', { filePath });
      return true;
    } catch (error: any) {
      logger.error('Error deleting from Firebase Storage', { 
        error: error.message,
        filePath
      });
      return false;
    }
  }

  /**
   * Get file download URL
   */
  async getDownloadURL(filePath: string): Promise<string | null> {
    try {
      const fileRef = ref(storage, filePath);
      const url = await getDownloadURL(fileRef);
      return url;
    } catch (error: any) {
      logger.error('Error getting download URL', { 
        error: error.message,
        filePath
      });
      return null;
    }
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return !!(
      firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.storageBucket
    );
  }
}

export const firebaseService = new FirebaseService();
export { storage, auth };