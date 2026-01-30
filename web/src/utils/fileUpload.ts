import api from '../config/api';

/**
 * Uploads a file to the server and returns the file URL.
 * @param file The file to upload
 * @returns Promise resolving to the file URL
 */
export const uploadFileToServer = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await api.post('/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });

        if (response.data && response.data.url) {
            return response.data.url;
        } else {
            throw new Error('Upload failed: No URL returned');
        }
    } catch (error) {
        console.error('Error uploading file:', error);
        throw error;
    }
};
