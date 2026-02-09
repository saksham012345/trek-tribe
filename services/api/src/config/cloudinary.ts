import { v2 as cloudinary } from 'cloudinary';
import { logger } from '../utils/logger';

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (!cloudName || !apiKey || !apiSecret) {
    logger.warn('⚠️ Cloudinary configuration missing. Image uploads will fail.');
}

cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
});

export default cloudinary;
