import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../config/firebase";

/**
 * Uploads a file to Firebase Storage and returns the download URL.
 * @param file The file to upload
 * @returns Promise resolving to the file URL
 */
export const uploadFileToServer = async (file: File): Promise<string> => {
    try {
        // Create a unique filename to prevent collisions
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const uniqueName = `${timestamp}_${sanitizedName}`;

        // Create a storage reference
        const storageRef = ref(storage, `uploads/${uniqueName}`);

        // Upload the file
        const snapshot = await uploadBytes(storageRef, file);

        // Get the download URL
        const downloadURL = await getDownloadURL(snapshot.ref);

        return downloadURL;
    } catch (error) {
        console.error('Error uploading file to Firebase:', error);
        throw error;
    }
};
