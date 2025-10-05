import { User } from '../models/User';
import { Trip } from '../models/Trip';
import { firebaseService } from './firebaseService';
import { FileHandler } from './fileHandler';
import fs from 'fs/promises';
import path from 'path';

interface FileAccessContext {
  userId: string;
  userRole: 'traveler' | 'organizer' | 'admin' | 'agent';
  fileType: 'profile' | 'trip_image' | 'document' | 'verification' | 'general';
  resourceId?: string; // tripId, userId, etc.
}

class FileAccessController {
  private fileHandler: FileHandler;

  constructor() {
    this.fileHandler = new FileHandler();
  }

  /**
   * Check if user can access a specific file
   */
  async canAccessFile(context: FileAccessContext, filePath: string): Promise<boolean> {
    try {
      // Admins can access everything (but we'll log it)
      if (context.userRole === 'admin') {
        console.log(`🔍 Admin ${context.userId} accessing file: ${filePath}`);
        return true;
      }

      // Agents can access files for support purposes
      if (context.userRole === 'agent') {
        console.log(`🛠️ Agent ${context.userId} accessing file for support: ${filePath}`);
        return true;
      }

      // Check specific permissions based on file type
      switch (context.fileType) {
        case 'profile':
          return await this.canAccessProfileFile(context, filePath);
        
        case 'trip_image':
          return await this.canAccessTripFile(context, filePath);
        
        case 'document':
          return await this.canAccessDocument(context, filePath);
        
        case 'verification':
          return await this.canAccessVerificationFile(context, filePath);
        
        default:
          return false;
      }
    } catch (error) {
      console.error('Error checking file access:', error);
      return false;
    }
  }

  /**
   * Secure file serving with permission checks
   */
  async serveFile(context: FileAccessContext, filePath: string): Promise<{
    success: boolean;
    fileBuffer?: Buffer;
    contentType?: string;
    error?: string;
  }> {
    try {
      // Check permissions first
      const hasAccess = await this.canAccessFile(context, filePath);
      
      if (!hasAccess) {
        console.warn(`🚫 Access denied: User ${context.userId} (${context.userRole}) tried to access ${filePath}`);
        return {
          success: false,
          error: 'Access denied'
        };
      }

      // Try to get file from Firebase first (if available)
      if (firebaseService.isAvailable()) {
        try {
          const fileUrl = await firebaseService.getFileURL(filePath);
          if (fileUrl) {
            // Return Firebase URL for direct access (more secure)
            return {
              success: true,
              error: 'redirect_to_firebase',
              contentType: this.getContentType(filePath)
            };
          }
        } catch (firebaseError) {
          console.warn('Firebase access failed, trying local storage');
        }
      }

      // Fallback to local file
      const localPath = path.join(process.cwd(), 'uploads', filePath);
      const fileBuffer = await fs.readFile(localPath);
      
      console.log(`✅ File served securely: ${filePath} to user ${context.userId}`);
      
      return {
        success: true,
        fileBuffer,
        contentType: this.getContentType(filePath)
      };

    } catch (error: any) {
      console.error('Error serving file:', error);
      return {
        success: false,
        error: 'File not found'
      };
    }
  }

  /**
   * Check profile file access (users can only access their own)
   */
  private async canAccessProfileFile(context: FileAccessContext, filePath: string): Promise<boolean> {
    // Extract user ID from file path (assuming format: users/{userId}/profile/...)
    const pathParts = filePath.split('/');
    const fileOwnerId = pathParts[1]; // users/{userId}/profile/file.jpg
    
    // Users can only access their own profile files
    return context.userId === fileOwnerId;
  }

  /**
   * Check trip file access (participants + organizer)
   */
  private async canAccessTripFile(context: FileAccessContext, filePath: string): Promise<boolean> {
    if (!context.resourceId) return false;

    try {
      const trip = await Trip.findById(context.resourceId);
      if (!trip) return false;

      // Organizer can always access their trip files
      if (trip.organizerId.toString() === context.userId) {
        return true;
      }

      // Check if user is a participant
      const isParticipant = trip.participants?.some(
        (p: any) => p.userId?.toString() === context.userId
      );

      return isParticipant || false;
    } catch (error) {
      console.error('Error checking trip access:', error);
      return false;
    }
  }

  /**
   * Check document access (only owner + admin/agent)
   */
  private async canAccessDocument(context: FileAccessContext, filePath: string): Promise<boolean> {
    // Documents are private - only owner can access
    const pathParts = filePath.split('/');
    const fileOwnerId = pathParts[1]; // users/{userId}/documents/...
    
    return context.userId === fileOwnerId;
  }

  /**
   * Check verification file access (admin/agent only)
   */
  private async canAccessVerificationFile(context: FileAccessContext, filePath: string): Promise<boolean> {
    // Only admin and agents can access verification documents
    return context.userRole === 'admin' || context.userRole === 'agent';
  }

  /**
   * Get content type from file extension
   */
  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    const contentTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg', 
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.pdf': 'application/pdf'
    };

    return contentTypes[ext] || 'application/octet-stream';
  }

  /**
   * Log file access for security audit
   */
  logFileAccess(context: FileAccessContext, filePath: string, action: 'granted' | 'denied') {
    const logEntry = {
      timestamp: new Date().toISOString(),
      userId: context.userId,
      userRole: context.userRole,
      filePath,
      action,
      fileType: context.fileType,
      resourceId: context.resourceId
    };

    // In production, you'd save this to a database or log file
    console.log('📊 File Access Log:', JSON.stringify(logEntry));
  }
}

export const fileAccessController = new FileAccessController();