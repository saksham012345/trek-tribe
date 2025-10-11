import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { fileHandler, FileError } from '../utils/fileHandler';
import { authenticateJwt } from '../middleware/auth';
import { asyncErrorHandler } from '../utils/errors';
import multer from 'multer';
import { User } from '../models/User';

// Node.js Concept: Express Router for file operations
const router = Router();

// Configure multer for multipart/form-data uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Node.js Concept: Input validation schemas
const uploadBase64Schema = z.object({
  data: z.string().min(1),
  filename: z.string().min(1).max(255),
  mimeType: z.string().regex(/^[a-zA-Z]+\/[a-zA-Z0-9\-\.]+$/),
  tags: z.array(z.string()).optional()
});

const uploadMetadataSchema = z.object({
  originalName: z.string().min(1).max(255),
  tags: z.array(z.string()).optional()
});

// Node.js Concept: File size limit middleware
const fileSizeLimit = (maxSize: number = 10 * 1024 * 1024) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.headers['content-length'];
    
    if (contentLength && parseInt(contentLength) > maxSize) {
      return res.status(413).json({
        error: 'File too large',
        maxSize: `${maxSize / 1024 / 1024}MB`
      });
    }
    
    next();
  };
};

// Node.js Concept: MIME type validation middleware
const validateMimeType = (allowedTypes: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentType = req.headers['content-type'];
    
    if (req.body?.mimeType && !allowedTypes.includes(req.body.mimeType)) {
      return res.status(400).json({
        error: 'Invalid file type',
        allowedTypes
      });
    }
    
    if (contentType && contentType.startsWith('multipart/form-data')) {
      // Will be validated during file processing
      return next();
    }
    
    next();
  };
};

// POST /files/upload - Upload profile photo via multipart/form-data
router.post('/upload',
  authenticateJwt,
  upload.single('photo'),
  asyncErrorHandler(async (req: Request, res: Response) => {
    const file = req.file;
    const userId = (req as any).auth.userId;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      // Save the uploaded file using the fileHandler
      const result = await fileHandler.saveBufferToFile(
        file.buffer,
        `profile_${userId}_${Date.now()}_${file.originalname}`,
        file.mimetype
      );

      // Update user's profile photo in database
      const photoUrl = `${req.protocol}://${req.get('host')}/api/files/${result.filename}`;
      
      await User.findByIdAndUpdate(userId, {
        profilePhoto: photoUrl
      });

      res.json({
        success: true,
        message: 'Profile photo uploaded successfully',
        photoUrl,
        file: result
      });

    } catch (error) {
      if (error instanceof FileError) {
        return res.status(400).json({
          error: error.message,
          code: error.code
        });
      }
      throw error;
    }
  })
);

// POST /files/upload/base64 - Upload file from base64 data
// Node.js Concept: Base64 file upload handling
router.post('/upload/base64',
  authenticateJwt,
  fileSizeLimit(),
  validateMimeType(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'application/pdf']),
  asyncErrorHandler(async (req: Request, res: Response) => {
    const parsed = uploadBase64Schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten()
      });
    }

    const { data, filename, mimeType, tags } = parsed.data;

    try {
      const result = await fileHandler.saveBase64ToFile(data, filename, mimeType);
      
      // You could save file metadata to database here
      // const fileRecord = await FileModel.create({
      //   ...result,
      //   uploadedBy: req.auth.userId,
      //   tags
      // });

      res.status(201).json({
        success: true,
        message: 'File uploaded successfully',
        file: result
      });
    } catch (error) {
      if (error instanceof FileError) {
        return res.status(400).json({
          error: error.message,
          code: error.code
        });
      }
      throw error;
    }
  })
);

// Node.js Concept: Raw body parser for direct binary upload
const rawBodyParser = (req: Request, res: Response, next: NextFunction) => {
  if (req.headers['content-type']?.startsWith('application/octet-stream') ||
      req.headers['content-type']?.startsWith('image/') ||
      req.headers['content-type']?.startsWith('video/')) {
    
    const chunks: Buffer[] = [];
    
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    
    req.on('end', () => {
      (req as any).rawBody = Buffer.concat(chunks);
      next();
    });
    
    req.on('error', (error) => {
      next(error);
    });
  } else {
    next();
  }
};

// POST /files/upload/binary - Upload file as binary data
// Node.js Concept: Binary file upload with streams
router.post('/upload/binary',
  authenticateJwt,
  fileSizeLimit(),
  rawBodyParser,
  asyncErrorHandler(async (req: Request, res: Response) => {
    const rawBody = (req as any).rawBody;
    if (!rawBody) {
      return res.status(400).json({
        error: 'No binary data received'
      });
    }

    const contentType = req.headers['content-type'] || 'application/octet-stream';
    const filename = (req.headers['x-filename'] as string) || 'upload.bin';

    try {
      const result = await fileHandler.saveBufferToFile(rawBody, filename, contentType);
      
      res.status(201).json({
        success: true,
        message: 'Binary file uploaded successfully',
        file: result
      });
    } catch (error) {
      if (error instanceof FileError) {
        return res.status(400).json({
          error: error.message,
          code: error.code
        });
      }
      throw error;
    }
  })
);

// GET /files/:filename - Download/serve file
// Node.js Concept: File serving with proper headers
router.get('/:filename',
  asyncErrorHandler(async (req: Request, res: Response) => {
    const { filename } = req.params;

    try {
      // Get file metadata first
      const metadata = await fileHandler.getFileMetadata(filename);
      
      // Set appropriate headers
      res.setHeader('Content-Type', metadata.mimeType);
      res.setHeader('Content-Length', metadata.size);
      res.setHeader('Content-Disposition', `inline; filename="${metadata.originalName}"`);
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
      res.setHeader('ETag', metadata.checksum);

      // Check if client has cached version
      const clientETag = req.headers['if-none-match'];
      if (clientETag === metadata.checksum) {
        return res.status(304).send();
      }

      // Stream file to response
      const fileStream = await fileHandler.readFileAsStream(filename);
      fileStream.pipe(res);
      
      fileStream.on('error', (error) => {
        console.error('File stream error:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to serve file' });
        }
      });

    } catch (error) {
      if (error instanceof FileError && error.code === 'FILE_NOT_FOUND') {
        return res.status(404).json({ error: 'File not found' });
      }
      throw error;
    }
  })
);

// GET /files/:filename/info - Get file metadata
router.get('/:filename/info',
  authenticateJwt,
  asyncErrorHandler(async (req: Request, res: Response) => {
    const { filename } = req.params;

    try {
      const metadata = await fileHandler.getFileMetadata(filename);
      res.json({
        success: true,
        metadata
      });
    } catch (error) {
      if (error instanceof FileError && error.code === 'FILE_NOT_FOUND') {
        return res.status(404).json({ error: 'File not found' });
      }
      throw error;
    }
  })
);

// DELETE /files/:filename - Delete file
router.delete('/:filename',
  authenticateJwt,
  asyncErrorHandler(async (req: Request, res: Response) => {
    const { filename } = req.params;
    const userRole = (req as any).auth.role;

    // Only allow admins and organizers to delete files
    if (!['admin', 'organizer'].includes(userRole)) {
      return res.status(403).json({
        error: 'Insufficient permissions to delete files'
      });
    }

    try {
      await fileHandler.deleteFile(filename);
      res.json({
        success: true,
        message: 'File deleted successfully'
      });
    } catch (error) {
      if (error instanceof FileError && error.code === 'FILE_NOT_FOUND') {
        return res.status(404).json({ error: 'File not found' });
      }
      throw error;
    }
  })
);

// GET /files - List files with filtering and pagination
// Node.js Concept: Query parameter processing for file listing
router.get('/',
  authenticateJwt,
  asyncErrorHandler(async (req: Request, res: Response) => {
    const {
      subdirectory,
      mimeType,
      limit = '50',
      offset = '0'
    } = req.query;

    const options = {
      subdirectory: subdirectory as string,
      mimeType: mimeType as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    };

    try {
      const result = await fileHandler.listFiles(options);
      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      throw error;
    }
  })
);

// POST /files/batch-delete - Delete multiple files
// Node.js Concept: Batch operations with Promise.allSettled
router.post('/batch-delete',
  authenticateJwt,
  asyncErrorHandler(async (req: Request, res: Response) => {
    const userRole = (req as any).auth.role;
    
    if (!['admin', 'organizer'].includes(userRole)) {
      return res.status(403).json({
        error: 'Insufficient permissions to delete files'
      });
    }

    const { filenames } = req.body;
    
    if (!Array.isArray(filenames) || filenames.length === 0) {
      return res.status(400).json({
        error: 'filenames must be a non-empty array'
      });
    }

    try {
      const result = await fileHandler.deleteMultipleFiles(filenames);
      res.json({
        success: true,
        message: `Deleted ${result.deleted.length} files`,
        ...result
      });
    } catch (error) {
      throw error;
    }
  })
);

// GET /files/admin/stats - Get storage statistics (admin only)
// Node.js Concept: Administrative endpoints with role-based access
router.get('/admin/stats',
  authenticateJwt,
  asyncErrorHandler(async (req: Request, res: Response) => {
    const userRole = (req as any).auth.role;
    
    if (userRole !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required'
      });
    }

    try {
      const stats = await fileHandler.getStorageStats();
      res.json({
        success: true,
        stats
      });
    } catch (error) {
      throw error;
    }
  })
);

// GET /files/admin/duplicates - Find duplicate files
router.get('/admin/duplicates',
  authenticateJwt,
  asyncErrorHandler(async (req: Request, res: Response) => {
    const userRole = (req as any).auth.role;
    
    if (userRole !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required'
      });
    }

    try {
      const duplicates = await fileHandler.findDuplicates();
      res.json({
        success: true,
        duplicates,
        count: Object.keys(duplicates).length
      });
    } catch (error) {
      throw error;
    }
  })
);

// POST /files/admin/cleanup - Cleanup temporary files
router.post('/admin/cleanup',
  authenticateJwt,
  asyncErrorHandler(async (req: Request, res: Response) => {
    const userRole = (req as any).auth.role;
    
    if (userRole !== 'admin') {
      return res.status(403).json({
        error: 'Admin access required'
      });
    }

    try {
      const cleanedCount = await fileHandler.cleanupTempFiles();
      res.json({
        success: true,
        message: `Cleaned up ${cleanedCount} temporary files`,
        cleanedCount
      });
    } catch (error) {
      throw error;
    }
  })
);

// Node.js Concept: File upload demonstration endpoint
router.post('/demo/upload',
  authenticateJwt,
  asyncErrorHandler(async (req: Request, res: Response) => {
    const { type = 'base64', filename = 'demo.txt', content = 'Hello, World!' } = req.body;

    try {
      let result;

      switch (type) {
        case 'base64':
          const base64Content = Buffer.from(content).toString('base64');
          result = await fileHandler.saveBase64ToFile(
            base64Content,
            filename,
            'text/plain'
          );
          break;

        case 'buffer':
          const buffer = Buffer.from(content, 'utf-8');
          result = await fileHandler.saveBufferToFile(
            buffer,
            filename,
            'text/plain'
          );
          break;

        default:
          return res.status(400).json({
            error: 'Invalid upload type. Use "base64" or "buffer"'
          });
      }

      res.status(201).json({
        success: true,
        message: 'Demo file uploaded successfully',
        file: result,
        downloadUrl: `${req.protocol}://${req.get('host')}/files/${result.filename}`
      });
    } catch (error) {
      if (error instanceof FileError) {
        return res.status(400).json({
          error: error.message,
          code: error.code
        });
      }
      throw error;
    }
  })
);

// Node.js Concept: Error handling middleware for file routes
router.use((error: any, req: Request, res: Response, next: NextFunction) => {
  console.error('File route error:', error);

  if (error instanceof FileError) {
    return res.status(400).json({
      error: error.message,
      code: error.code
    });
  }

  if (error.code === 'ENOENT') {
    return res.status(404).json({
      error: 'File not found'
    });
  }

  if (error.code === 'EMFILE' || error.code === 'ENFILE') {
    return res.status(503).json({
      error: 'Server is temporarily unable to handle file operations'
    });
  }

  // Pass to global error handler
  next(error);
});

export default router;
