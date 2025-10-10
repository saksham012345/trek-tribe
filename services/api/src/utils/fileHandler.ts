// Node.js Concept: File system operations with streams and buffers
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { pipeline } from 'stream/promises';

// Node.js Concept: Custom error classes for file operations
export class FileError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'FileError';
  }
}

// Node.js Concept: Type definitions for file operations
export interface FileUploadResult {
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  path: string;
  url: string;
  checksum: string;
}

export interface FileMetadata {
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
  checksum: string;
  tags?: string[];
}

export class FileHandler {
  private uploadDir: string;
  private maxFileSize: number;
  private allowedMimeTypes: Set<string>;

  // Node.js Concept: Constructor with configuration
  constructor(
    uploadDir: string = path.join(process.cwd(), 'uploads'),
    maxFileSize: number = 10 * 1024 * 1024, // 10MB
    allowedMimeTypes: string[] = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'video/mp4',
      'video/webm',
      'application/pdf'
    ]
  ) {
    this.uploadDir = uploadDir;
    this.maxFileSize = maxFileSize;
    this.allowedMimeTypes = new Set(allowedMimeTypes);
    this.initializeUploadDirectory();
  }

  // Helper method to generate complete URL
  private generateFileUrl(filename: string): string {
    const baseUrl = process.env.NODE_ENV === 'production' 
      ? process.env.API_URL || 'https://trek-tribe-38in.onrender.com'
      : `http://localhost:${process.env.PORT || 4000}`;
    
    return `${baseUrl}/files/${filename}`;
  }

  // Node.js Concept: Async directory creation with error handling
  private async initializeUploadDirectory(): Promise<void> {
    try {
      await fs.access(this.uploadDir);
      console.log('📂 Upload directory exists:', this.uploadDir);
    } catch (error) {
      try {
        await fs.mkdir(this.uploadDir, { recursive: true });
        console.log('📂 Created upload directory:', this.uploadDir);

        // Create subdirectories for organization
        const subdirs = ['images', 'videos', 'documents', 'temp'];
        await Promise.all(
          subdirs.map(subdir => 
            fs.mkdir(path.join(this.uploadDir, subdir), { recursive: true })
          )
        );
        console.log('📂 Created upload subdirectories:', subdirs.join(', '));

      } catch (mkdirError) {
        throw new FileError(`Failed to create upload directory: ${mkdirError}`);
      }
    }
  }

  // Node.js Concept: Generate unique filename with crypto
  private generateFilename(originalName: string, mimeType: string): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(8).toString('hex');
    const ext = this.getFileExtension(mimeType, originalName);
    return `${timestamp}_${random}${ext}`;
  }

  // Node.js Concept: MIME type to extension mapping
  private getFileExtension(mimeType: string, originalName: string): string {
    const mimeToExt: { [key: string]: string } = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'application/pdf': '.pdf'
    };

    // Use MIME type mapping first
    if (mimeToExt[mimeType]) {
      return mimeToExt[mimeType];
    }

    // Fallback to original extension
    const ext = path.extname(originalName);
    return ext || '.bin';
  }

  // Node.js Concept: Determine subdirectory based on MIME type
  private getSubdirectory(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'images';
    if (mimeType.startsWith('video/')) return 'videos';
    return 'documents';
  }

  // Node.js Concept: File validation
  private validateFile(size: number, mimeType: string): void {
    if (size > this.maxFileSize) {
      throw new FileError(
        `File too large. Maximum size is ${this.maxFileSize / 1024 / 1024}MB`,
        'FILE_TOO_LARGE'
      );
    }

    if (!this.allowedMimeTypes.has(mimeType)) {
      throw new FileError(
        `File type ${mimeType} is not allowed`,
        'INVALID_FILE_TYPE'
      );
    }
  }

  // Node.js Concept: Buffer to file conversion with checksum calculation
  async saveBufferToFile(
    buffer: Buffer,
    originalName: string,
    mimeType: string
  ): Promise<FileUploadResult> {
    try {
      // Validate file
      this.validateFile(buffer.length, mimeType);

      // Generate filename and path
      const filename = this.generateFilename(originalName, mimeType);
      const subdir = this.getSubdirectory(mimeType);
      const relativePath = path.join(subdir, filename);
      const fullPath = path.join(this.uploadDir, relativePath);

      // Calculate checksum
      const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

      // Write file
      await fs.writeFile(fullPath, buffer);

      // Create result object
      const result: FileUploadResult = {
        filename,
        originalName,
        size: buffer.length,
        mimeType,
        path: relativePath,
        url: this.generateFileUrl(filename),
        checksum
      };

      console.log(`✅ File saved: ${filename} (${buffer.length} bytes)`);
      return result;

    } catch (error) {
      console.error('❌ Failed to save file:', error);
      throw error instanceof FileError ? error : new FileError(`Failed to save file: ${error}`);
    }
  }

  // Node.js Concept: Base64 string to file conversion
  async saveBase64ToFile(
    base64Data: string,
    originalName: string,
    mimeType: string
  ): Promise<FileUploadResult> {
    try {
      // Remove data URL prefix if present
      const base64String = base64Data.replace(/^data:[^;]+;base64,/, '');
      
      // Convert to buffer
      const buffer = Buffer.from(base64String, 'base64');
      
      return await this.saveBufferToFile(buffer, originalName, mimeType);
    } catch (error) {
      throw new FileError(`Failed to process base64 data: ${error}`);
    }
  }

  // Node.js Concept: Stream-based file upload for large files
  async saveStreamToFile(
    stream: NodeJS.ReadableStream,
    originalName: string,
    mimeType: string
  ): Promise<FileUploadResult> {
    const filename = this.generateFilename(originalName, mimeType);
    const subdir = this.getSubdirectory(mimeType);
    const relativePath = path.join(subdir, filename);
    const fullPath = path.join(this.uploadDir, relativePath);

    try {
      // Create write stream
      const writeStream = createWriteStream(fullPath);
      
      // Create hash stream for checksum
      const hash = crypto.createHash('sha256');
      let size = 0;

      // Process stream data
      stream.on('data', (chunk: Buffer) => {
        size += chunk.length;
        
        // Validate size during upload
        if (size > this.maxFileSize) {
          writeStream.destroy();
          throw new FileError(
            `File too large. Maximum size is ${this.maxFileSize / 1024 / 1024}MB`,
            'FILE_TOO_LARGE'
          );
        }
        
        hash.update(chunk);
      });

      // Use pipeline for proper stream handling
      await pipeline(stream, writeStream);

      // Validate final file
      this.validateFile(size, mimeType);

      const checksum = hash.digest('hex');

      const result: FileUploadResult = {
        filename,
        originalName,
        size,
        mimeType,
        path: relativePath,
        url: this.generateFileUrl(filename),
        checksum
      };

      console.log(`✅ Stream file saved: ${filename} (${size} bytes)`);
      return result;

    } catch (error) {
      // Clean up file if upload failed
      try {
        await fs.unlink(fullPath);
      } catch (unlinkError) {
        console.warn('⚠️  Failed to cleanup failed upload:', unlinkError);
      }

      throw error instanceof FileError ? error : new FileError(`Failed to save stream: ${error}`);
    }
  }

  // Node.js Concept: File reading operations
  async readFile(filename: string): Promise<Buffer> {
    try {
      const relativePath = await this.findFileInSubdirectories(filename);
      if (!relativePath) {
        throw new FileError('File not found', 'FILE_NOT_FOUND');
      }
      
      const fullPath = path.join(this.uploadDir, relativePath);
      await this.validateFilePath(fullPath);
      return await fs.readFile(fullPath);
    } catch (error) {
      if (error instanceof FileError) {
        throw error;
      }
      throw new FileError(`Failed to read file: ${error}`);
    }
  }

  async readFileAsStream(filename: string): Promise<NodeJS.ReadableStream> {
    try {
      const relativePath = await this.findFileInSubdirectories(filename);
      if (!relativePath) {
        throw new FileError('File not found', 'FILE_NOT_FOUND');
      }
      
      const fullPath = path.join(this.uploadDir, relativePath);
      await this.validateFilePath(fullPath);
      return createReadStream(fullPath);
    } catch (error) {
      if (error instanceof FileError) {
        throw error;
      }
      throw new FileError(`Failed to create file stream: ${error}`);
    }
  }

  // Node.js Concept: File metadata operations
  async getFileMetadata(filename: string): Promise<FileMetadata> {
    try {
      const relativePath = await this.findFileInSubdirectories(filename);
      if (!relativePath) {
        throw new FileError('File not found', 'FILE_NOT_FOUND');
      }
      
      const fullPath = path.join(this.uploadDir, relativePath);
      await this.validateFilePath(fullPath);
      
      const stats = await fs.stat(fullPath);
      const buffer = await fs.readFile(fullPath);
      const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

      // Try to determine MIME type from extension
      const ext = path.extname(filename).toLowerCase();
      const extToMime: { [key: string]: string } = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.pdf': 'application/pdf'
      };

      return {
        filename,
        originalName: filename, // This would be stored separately in a real app
        size: stats.size,
        mimeType: extToMime[ext] || 'application/octet-stream',
        uploadedAt: stats.birthtime,
        checksum
      };
    } catch (error) {
      if (error instanceof FileError) {
        throw error;
      }
      throw new FileError(`Failed to get file metadata: ${error}`);
    }
  }

  // Helper method to find file in subdirectories
  private async findFileInSubdirectories(filename: string): Promise<string | null> {
    const subdirs = ['images', 'videos', 'documents', 'temp', ''];
    
    for (const subdir of subdirs) {
      try {
        const filePath = subdir ? path.join(this.uploadDir, subdir, filename) : path.join(this.uploadDir, filename);
        await fs.access(filePath);
        return subdir ? path.join(subdir, filename) : filename;
      } catch (error) {
        // Continue searching in other subdirectories
      }
    }
    
    return null;
  }

  // Node.js Concept: Security - Path validation to prevent directory traversal
  private async validateFilePath(fullPath: string): Promise<void> {
    const normalizedPath = path.normalize(fullPath);
    const uploadDirNormalized = path.normalize(this.uploadDir);

    if (!normalizedPath.startsWith(uploadDirNormalized)) {
      throw new FileError('Invalid file path - directory traversal detected', 'INVALID_PATH');
    }

    try {
      await fs.access(normalizedPath);
    } catch (error) {
      throw new FileError('File not found', 'FILE_NOT_FOUND');
    }
  }

  // Node.js Concept: File deletion
  async deleteFile(filename: string): Promise<void> {
    try {
      const relativePath = await this.findFileInSubdirectories(filename);
      if (!relativePath) {
        throw new FileError('File not found', 'FILE_NOT_FOUND');
      }
      
      const fullPath = path.join(this.uploadDir, relativePath);
      await this.validateFilePath(fullPath);
      await fs.unlink(fullPath);
      console.log(`🗑️  Deleted file: ${filename}`);
    } catch (error) {
      if (error instanceof FileError) {
        throw error;
      }
      throw new FileError(`Failed to delete file: ${error}`);
    }
  }

  // Node.js Concept: Batch file operations
  async deleteMultipleFiles(filenames: string[]): Promise<{
    deleted: string[];
    failed: { filename: string; error: string }[];
  }> {
    const deleted: string[] = [];
    const failed: { filename: string; error: string }[] = [];

    // Use Promise.allSettled for parallel processing
    const results = await Promise.allSettled(
      filenames.map(filename => this.deleteFile(filename))
    );

    results.forEach((result, index) => {
      const filename = filenames[index];
      if (result.status === 'fulfilled') {
        deleted.push(filename);
      } else {
        failed.push({
          filename,
          error: result.reason.message || 'Unknown error'
        });
      }
    });

    return { deleted, failed };
  }

  // Node.js Concept: File listing with filtering
  async listFiles(options: {
    subdirectory?: string;
    mimeType?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{
    files: FileMetadata[];
    total: number;
    hasMore: boolean;
  }> {
    const { subdirectory, mimeType, limit = 50, offset = 0 } = options;
    
    try {
      const searchDir = subdirectory 
        ? path.join(this.uploadDir, subdirectory)
        : this.uploadDir;

      const files = await fs.readdir(searchDir, { withFileTypes: true });
      const fileList = files
        .filter(dirent => dirent.isFile())
        .map(dirent => dirent.name);

      // Filter by MIME type if specified
      let filteredFiles = fileList;
      if (mimeType) {
        const ext = this.getFileExtension(mimeType, '');
        filteredFiles = fileList.filter(filename => 
          filename.toLowerCase().endsWith(ext.toLowerCase())
        );
      }

      // Apply pagination
      const paginatedFiles = filteredFiles.slice(offset, offset + limit);

      // Get metadata for each file
      const filesWithMetadata = await Promise.all(
        paginatedFiles.map(async filename => {
          try {
            const relativePath = subdirectory 
              ? path.join(subdirectory, filename)
              : filename;
            return await this.getFileMetadata(relativePath);
          } catch (error) {
            console.warn(`⚠️  Failed to get metadata for ${filename}:`, error);
            return null;
          }
        })
      );

      const validFiles = filesWithMetadata.filter(file => file !== null) as FileMetadata[];

      return {
        files: validFiles,
        total: filteredFiles.length,
        hasMore: offset + limit < filteredFiles.length
      };
    } catch (error) {
      throw new FileError(`Failed to list files: ${error}`);
    }
  }

  // Node.js Concept: File cleanup utilities
  async cleanupTempFiles(): Promise<number> {
    try {
      const tempDir = path.join(this.uploadDir, 'temp');
      const files = await fs.readdir(tempDir);
      let cleanedCount = 0;

      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);

      for (const file of files) {
        const fullPath = path.join(tempDir, file);
        const stats = await fs.stat(fullPath);
        
        if (stats.mtime.getTime() < oneDayAgo) {
          await fs.unlink(fullPath);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} temporary files`);
      }

      return cleanedCount;
    } catch (error) {
      console.error('❌ Failed to cleanup temp files:', error);
      return 0;
    }
  }

  // Node.js Concept: File duplicate detection using checksums
  async findDuplicates(): Promise<{ [checksum: string]: string[] }> {
    try {
      const { files } = await this.listFiles({ limit: 1000 });
      const checksumMap: { [checksum: string]: string[] } = {};

      files.forEach(file => {
        if (!checksumMap[file.checksum]) {
          checksumMap[file.checksum] = [];
        }
        checksumMap[file.checksum].push(file.filename);
      });

      // Filter to only return duplicates
      const duplicates: { [checksum: string]: string[] } = {};
      Object.entries(checksumMap).forEach(([checksum, filenames]) => {
        if (filenames.length > 1) {
          duplicates[checksum] = filenames;
        }
      });

      return duplicates;
    } catch (error) {
      throw new FileError(`Failed to find duplicates: ${error}`);
    }
  }

  // Node.js Concept: Storage statistics
  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    sizeByType: { [mimeType: string]: number };
    oldestFile: string | null;
    newestFile: string | null;
  }> {
    try {
      const { files } = await this.listFiles({ limit: 10000 });
      
      let totalSize = 0;
      const sizeByType: { [mimeType: string]: number } = {};
      let oldestFile: string | null = null;
      let newestFile: string | null = null;
      let oldestTime = Number.MAX_SAFE_INTEGER;
      let newestTime = 0;

      files.forEach(file => {
        totalSize += file.size;
        sizeByType[file.mimeType] = (sizeByType[file.mimeType] || 0) + file.size;

        const uploadTime = file.uploadedAt.getTime();
        if (uploadTime < oldestTime) {
          oldestTime = uploadTime;
          oldestFile = file.filename;
        }
        if (uploadTime > newestTime) {
          newestTime = uploadTime;
          newestFile = file.filename;
        }
      });

      return {
        totalFiles: files.length,
        totalSize,
        sizeByType,
        oldestFile,
        newestFile
      };
    } catch (error) {
      throw new FileError(`Failed to get storage stats: ${error}`);
    }
  }
}

// Node.js Concept: Module exports with singleton pattern
export const fileHandler = new FileHandler();

export default FileHandler;
