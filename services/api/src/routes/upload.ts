import { Router } from 'express';
import { upload } from '../services/uploadService';
import { authenticateJwt } from '../middleware/auth';

const router = Router();

// POST /api/upload
// Authenticated route for uploading single image
router.post('/', authenticateJwt, upload.single('file'), (req: any, res: any) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    // Return Cloudinary URL and other metadata
    res.json({
        url: req.file.path,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
    });
});

export default router;
