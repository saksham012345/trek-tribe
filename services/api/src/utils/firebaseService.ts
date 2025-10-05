import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import path from 'path';

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

class FirebaseService {
  private app: any;
  private storage: any;
  private isConfigured: boolean = false;

  constructor() {
    // Check if Firebase is configured
    if (firebaseConfig.apiKey && 
        firebaseConfig.projectId && 
        firebaseConfig.storageBucket &&
        !firebaseConfig.apiKey.includes('your_firebase')) {
      try {
        this.app = initializeApp(firebaseConfig);
        this.storage = getStorage(this.app);
        this.isConfigured = true;
        console.log('✅ Firebase Service initialized successfully');
      } catch (error) {
        console.warn('⚠️  Firebase Service disabled: Initialization failed');
        this.isConfigured = false;
      }
    } else {
      console.warn('⚠️  Firebase Service disabled: Credentials not configured');
      this.isConfigured = false;
    }
  }

  // Upload file to Firebase Storage
  async uploadFile(
    file: Buffer, 
    fileName: string, 
    folder: string = 'uploads'
  ): Promise<{ url: string; path: string } | null> {
    if (!this.isConfigured) {
      return null;
    }

    try {
      const timestamp = Date.now();
      const fileExtension = path.extname(fileName);
      const baseName = path.basename(fileName, fileExtension);
      const uniqueFileName = `${baseName}_${timestamp}${fileExtension}`;
      
      const filePath = `${folder}/${uniqueFileName}`;
      const storageRef = ref(this.storage, filePath);
      
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      return {
        url: downloadURL,
        path: filePath
      };
    } catch (error: any) {
      console.error('Firebase upload failed:', error.message);
      return null;
    }
  }

  // Upload trip images
  async uploadTripImage(imageBuffer: Buffer, tripId: string, originalName: string): Promise<string | null> {
    const result = await this.uploadFile(imageBuffer, originalName, `trips/${tripId}/images`);
    return result?.url || null;
  }

  // Delete file
  async deleteFile(filePath: string): Promise<boolean> {
    if (!this.isConfigured) return false;

    try {
      const fileRef = ref(this.storage, filePath);
      await deleteObject(fileRef);
      return true;
    } catch (error: any) {
      console.error('Firebase delete failed:', error.message);
      return false;
    }
  }

  // Get download URL for existing file
  async getFileURL(filePath: string): Promise<string | null> {
    if (!this.isConfigured) return null;

    try {
      const fileRef = ref(this.storage, filePath);
      const url = await getDownloadURL(fileRef);
      return url;
    } catch (error: any) {
      console.error('Firebase getFileURL failed:', error.message);
      return null;
    }
  }

  isAvailable(): boolean {
    return this.isConfigured;
  }
}

export const firebaseService = new FirebaseService();
