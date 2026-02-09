
/**
 * Uploads a file to Cloudinary and returns the secure URL.
 * Uses Unsigned Uploads (Client-side).
 * 
 * @param file The file to upload
 * @returns Promise resolving to the file URL
 */
export const uploadFileToServer = async (file: File): Promise<string> => {
    const cloudName = process.env.REACT_APP_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
        console.error('Missing Cloudinary configuration');
        throw new Error('Cloudinary configuration is missing. Check .env file.');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);
    // Optional: Add folder, tags, etc.
    // formData.append('folder', 'trektribe_uploads');

    try {
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || 'Upload failed');
        }

        const data = await response.json();
        return data.secure_url;
    } catch (error) {
        console.error('Error uploading file to Cloudinary:', error);
        throw error;
    }
};
