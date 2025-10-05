import { Router, Request, Response } from 'express';
import { fileAccessController } from '../utils/fileAccessController';
import { authenticateJwt } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// All routes require authentication
router.use(authenticateJwt);

// Schema for file access requests
const fileAccessSchema = z.object({
  filePath: z.string().min(1),
  fileType: z.enum(['profile', 'trip_image', 'document', 'verification', 'general']),
  resourceId: z.string().optional() // tripId, userId, etc.
});

/**
 * Secure file serving endpoint
 * GET /secure-files/serve?filePath=users/123/profile/pic.jpg&fileType=profile
 */
router.get('/serve', async (req: Request, res: Response) => {
  try {
    const parsed = fileAccessSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid parameters',
        details: parsed.error.flatten()
      });
    }

    const { filePath, fileType, resourceId } = parsed.data;
    const authUser = (req as any).auth;

    // Create access context
    const context = {
      userId: authUser.userId,
      userRole: authUser.role,
      fileType,
      resourceId
    };

    // Try to serve the file securely
    const result = await fileAccessController.serveFile(context, filePath);

    if (!result.success) {
      // Log access denial
      fileAccessController.logFileAccess(context, filePath, 'denied');
      
      return res.status(403).json({
        success: false,
        error: result.error
      });
    }

    // Log successful access
    fileAccessController.logFileAccess(context, filePath, 'granted');

    // If Firebase redirect
    if (result.error === 'redirect_to_firebase') {
      // In a real implementation, you'd return a signed URL from Firebase
      // For now, return success with content type
      return res.json({
        success: true,
        message: 'File available via Firebase',
        contentType: result.contentType
      });
    }

    // Serve local file
    if (result.fileBuffer && result.contentType) {
      res.setHeader('Content-Type', result.contentType);
      res.setHeader('Cache-Control', 'private, max-age=3600'); // Cache for 1 hour
      res.send(result.fileBuffer);
    } else {
      res.status(404).json({
        success: false,
        error: 'File not found'
      });
    }

  } catch (error: any) {
    console.error('Secure file serving error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * Check file access permissions without serving
 * GET /secure-files/check-access?filePath=...&fileType=...
 */
router.get('/check-access', async (req: Request, res: Response) => {
  try {
    const parsed = fileAccessSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid parameters'
      });
    }

    const { filePath, fileType, resourceId } = parsed.data;
    const authUser = (req as any).auth;

    const context = {
      userId: authUser.userId,
      userRole: authUser.role,
      fileType,
      resourceId
    };

    const hasAccess = await fileAccessController.canAccessFile(context, filePath);

    res.json({
      success: true,
      hasAccess,
      filePath,
      userRole: authUser.role
    });

  } catch (error: any) {
    console.error('Access check error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * List files user can access (for a specific context)
 * GET /secure-files/list?fileType=trip_image&resourceId=tripId
 */
router.get('/list', async (req: Request, res: Response) => {
  try {
    const { fileType, resourceId } = req.query;
    const authUser = (req as any).auth;

    if (!fileType) {
      return res.status(400).json({
        success: false,
        error: 'fileType parameter required'
      });
    }

    // This would typically query your database for files
    // For now, return a placeholder response
    res.json({
      success: true,
      message: 'File listing endpoint - to be implemented with database integration',
      context: {
        userId: authUser.userId,
        userRole: authUser.role,
        fileType,
        resourceId
      }
    });

  } catch (error: any) {
    console.error('File listing error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export default router;