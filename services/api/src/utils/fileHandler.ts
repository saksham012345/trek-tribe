import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * File handling utility to demonstrate async file operations
 * Handles creating, reading, writing, and deleting files asynchronously
 */

// Base directory for file operations
const FILE_BASE_DIR = path.join(__dirname, '../../uploads');

/**
 * Initialize the file storage directory
 * @returns Promise<void>
 */
export const initializeFileStorage = async (): Promise<void> => {
  try {
    await fs.access(FILE_BASE_DIR);
    console.log('📂 File storage directory exists');
  } catch (error) {
    try {
      await fs.mkdir(FILE_BASE_DIR, { recursive: true });
      console.log('📂 Created file storage directory');
    } catch (mkdirError) {
      console.error('❌ Failed to create file storage directory:', mkdirError);
      throw new Error(`Failed to create upload directory: ${(mkdirError as Error).message}`);
    }
  }
};

/**
 * Save a base64 encoded file to the file system
 * @param base64Data - The base64 encoded file data
 * @param fileName - The original file name
 * @param prefix - Optional prefix for the file name
 * @returns Promise<string> - The path to the saved file
 */
export const saveBase64File = async (
  base64Data: string,
  fileName: string,
  prefix = 'file'
): Promise<string> => {
  await initializeFileStorage();
  
  // Extract file extension
  const extension = path.extname(fileName).toLowerCase();
  
  // Generate a unique file name
  const randomString = crypto.randomBytes(8).toString('hex');
  const timestamp = Date.now();
  const newFileName = `${prefix}-${timestamp}-${randomString}${extension}`;
  const filePath = path.join(FILE_BASE_DIR, newFileName);
  
  // Remove the base64 prefix (e.g., "data:image/jpeg;base64,")
  const base64Content = base64Data.split(';base64,').pop() || '';
  if (!base64Content) {
    throw new Error('Invalid base64 data');
  }
  
  // Write the file
  try {
    await fs.writeFile(filePath, Buffer.from(base64Content, 'base64'));
    return newFileName; // Return just the filename, not the full path
  } catch (error) {
    console.error('❌ Failed to save file:', error);
    throw new Error(`Failed to save file: ${(error as Error).message}`);
  }
};

/**
 * Read a file from the file system
 * @param fileName - The name of the file to read
 * @returns Promise<Buffer> - The file contents
 */
export const readFile = async (fileName: string): Promise<Buffer> => {
  const filePath = path.join(FILE_BASE_DIR, fileName);
  
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    console.error('❌ Failed to read file:', error);
    throw new Error(`Failed to read file: ${(error as Error).message}`);
  }
};

/**
 * Delete a file from the file system
 * @param fileName - The name of the file to delete
 * @returns Promise<void>
 */
export const deleteFile = async (fileName: string): Promise<void> => {
  const filePath = path.join(FILE_BASE_DIR, fileName);
  
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.error('❌ Failed to delete file:', error);
    throw new Error(`Failed to delete file: ${(error as Error).message}`);
  }
};

/**
 * List all files in the file storage directory
 * @returns Promise<string[]> - Array of file names
 */
export const listFiles = async (): Promise<string[]> => {
  try {
    return await fs.readdir(FILE_BASE_DIR);
  } catch (error) {
    console.error('❌ Failed to list files:', error);
    throw new Error(`Failed to list files: ${(error as Error).message}`);
  }
};

/**
 * Get stats for a file
 * @param fileName - The name of the file
 * @returns Promise<fs.Stats> - File stats
 */
export const getFileStats = async (fileName: string): Promise<fs.Stats> => {
  const filePath = path.join(FILE_BASE_DIR, fileName);
  
  try {
    return await fs.stat(filePath);
  } catch (error) {
    console.error('❌ Failed to get file stats:', error);
    throw new Error(`Failed to get file stats: ${(error as Error).message}`);
  }
};

/**
 * Check if a file exists
 * @param fileName - The name of the file to check
 * @returns Promise<boolean> - Whether the file exists
 */
export const fileExists = async (fileName: string): Promise<boolean> => {
  const filePath = path.join(FILE_BASE_DIR, fileName);
  
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

/**
 * Move a file to a different location
 * @param sourceFileName - The name of the source file
 * @param destinationFileName - The name of the destination file
 * @returns Promise<void>
 */
export const moveFile = async (
  sourceFileName: string,
  destinationFileName: string
): Promise<void> => {
  const sourcePath = path.join(FILE_BASE_DIR, sourceFileName);
  const destinationPath = path.join(FILE_BASE_DIR, destinationFileName);
  
  try {
    await fs.rename(sourcePath, destinationPath);
  } catch (error) {
    console.error('❌ Failed to move file:', error);
    throw new Error(`Failed to move file: ${(error as Error).message}`);
  }
};

/**
 * Process a text file line by line (demonstration of async generators)
 * @param fileName - The name of the text file to process
 * @param processor - Function to process each line
 * @returns Promise<void>
 */
export const processTextFileLineByLine = async (
  fileName: string,
  processor: (line: string, lineNumber: number) => Promise<void>
): Promise<void> => {
  const filePath = path.join(FILE_BASE_DIR, fileName);
  
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      await processor(lines[i], i + 1);
    }
  } catch (error) {
    console.error('❌ Failed to process file:', error);
    throw new Error(`Failed to process file: ${(error as Error).message}`);
  }
};

/**
 * Example asynchronous function that demonstrates Promise.all for parallel file operations
 * @param fileNames - Array of file names to process in parallel
 * @returns Promise<{ [key: string]: Buffer }> - Object with file contents
 */
export const readMultipleFilesInParallel = async (
  fileNames: string[]
): Promise<{ [key: string]: Buffer }> => {
  try {
    const filePromises = fileNames.map(async (fileName) => {
      const content = await readFile(fileName);
      return { fileName, content };
    });
    
    const results = await Promise.all(filePromises);
    
    // Convert array of results to an object
    return results.reduce((acc, { fileName, content }) => {
      acc[fileName] = content;
      return acc;
    }, {} as { [key: string]: Buffer });
  } catch (error) {
    console.error('❌ Failed to read multiple files:', error);
    throw new Error(`Failed to read multiple files: ${(error as Error).message}`);
  }
};
