// Node.js Concept: File system operations and custom logging implementation
import fs from 'fs/promises';
import path from 'path';
import { createWriteStream, WriteStream } from 'fs';

// Node.js Concept: Enum for type safety
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

// Node.js Concept: Interface for structured logging
export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  meta?: any;
  stack?: string;
  requestId?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
}

export class Logger {
  private logLevel: LogLevel;
  private logDirectory: string;
  private fileStreams: Map<string, WriteStream> = new Map();
  private requestId: string | null = null;

  // Node.js Concept: Constructor with default parameters
  constructor(
    logLevel: LogLevel = LogLevel.INFO,
    logDirectory: string = path.join(process.cwd(), 'logs')
  ) {
    this.logLevel = logLevel;
    this.logDirectory = logDirectory;
    this.initializeLogDirectory();
  }

  // Node.js Concept: Async file system operations
  private async initializeLogDirectory(): Promise<void> {
    try {
      await fs.access(this.logDirectory);
    } catch (error) {
      try {
        await fs.mkdir(this.logDirectory, { recursive: true });
        console.log(`📂 Created log directory: ${this.logDirectory}`);
      } catch (mkdirError) {
        console.error('❌ Failed to create log directory:', mkdirError);
      }
    }
  }

  // Node.js Concept: Stream management for file writing
  private getFileStream(filename: string): WriteStream {
    if (!this.fileStreams.has(filename)) {
      const filePath = path.join(this.logDirectory, filename);
      const stream = createWriteStream(filePath, { flags: 'a' });
      
      // Handle stream errors
      stream.on('error', (error) => {
        console.error(`❌ Log file stream error for ${filename}:`, error);
      });

      this.fileStreams.set(filename, stream);
    }
    
    return this.fileStreams.get(filename)!;
  }

  // Node.js Concept: Date formatting utilities
  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  private formatTimestamp(date: Date): string {
    return date.toISOString();
  }

  // Node.js Concept: Structured log formatting
  private formatLogEntry(level: string, message: string, meta?: any): LogEntry {
    const entry: LogEntry = {
      timestamp: this.formatTimestamp(new Date()),
      level: level.toUpperCase(),
      message,
      ...(meta && { meta }),
      ...(this.requestId && { requestId: this.requestId })
    };

    return entry;
  }

  // Node.js Concept: Console output with colors (using ANSI codes)
  private formatConsoleOutput(entry: LogEntry): string {
    const colors = {
      ERROR: '\x1b[31m', // Red
      WARN: '\x1b[33m',  // Yellow
      INFO: '\x1b[36m',  // Cyan
      DEBUG: '\x1b[37m', // White
      RESET: '\x1b[0m'   // Reset
    };

    const color = colors[entry.level as keyof typeof colors] || colors.INFO;
    const levelEmoji = {
      ERROR: '🚨',
      WARN: '⚠️ ',
      INFO: 'ℹ️ ',
      DEBUG: '🐛'
    };

    const emoji = levelEmoji[entry.level as keyof typeof levelEmoji] || '';
    
    return `${color}${emoji} [${entry.timestamp}] ${entry.level}: ${entry.message}${colors.RESET}${
      entry.meta ? `\n${JSON.stringify(entry.meta, null, 2)}` : ''
    }${entry.stack ? `\n${entry.stack}` : ''}`;
  }

  // Node.js Concept: File writing with streams
  private async writeToFile(entry: LogEntry): Promise<void> {
    try {
      const date = this.formatDate(new Date());
      const filename = `${date}.log`;
      const stream = this.getFileStream(filename);
      
      const logLine = JSON.stringify(entry) + '\n';
      stream.write(logLine);

      // Also write errors to separate error log
      if (entry.level === 'ERROR') {
        const errorFilename = `${date}-errors.log`;
        const errorStream = this.getFileStream(errorFilename);
        errorStream.write(logLine);
      }
    } catch (error) {
      console.error('❌ Failed to write to log file:', error);
    }
  }

  // Core logging method
  private async log(level: LogLevel, levelName: string, message: string, meta?: any): Promise<void> {
    if (level > this.logLevel) {
      return; // Skip if log level is too verbose
    }

    const entry = this.formatLogEntry(levelName, message, meta);

    // Console output
    console.log(this.formatConsoleOutput(entry));

    // File output (async, non-blocking)
    this.writeToFile(entry).catch(error => {
      console.error('❌ Log file write failed:', error);
    });
  }

  // Public logging methods
  async error(message: string, meta?: any): Promise<void> {
    // Add stack trace for errors
    if (meta instanceof Error) {
      const errorMeta = {
        name: meta.name,
        message: meta.message,
        stack: meta.stack,
        ...(meta as any).details
      };
      return this.log(LogLevel.ERROR, 'error', message, errorMeta);
    }
    return this.log(LogLevel.ERROR, 'error', message, meta);
  }

  async warn(message: string, meta?: any): Promise<void> {
    return this.log(LogLevel.WARN, 'warn', message, meta);
  }

  async info(message: string, meta?: any): Promise<void> {
    return this.log(LogLevel.INFO, 'info', message, meta);
  }

  async debug(message: string, meta?: any): Promise<void> {
    return this.log(LogLevel.DEBUG, 'debug', message, meta);
  }

  // Node.js Concept: Request context tracking
  setRequestId(requestId: string): void {
    this.requestId = requestId;
  }

  clearRequestId(): void {
    this.requestId = null;
  }

  // Express middleware for request logging
  // Node.js Concept: Middleware factory pattern
  requestLogger() {
    return (req: any, res: any, next: any) => {
      const requestId = req.headers['x-request-id'] || 
                       Math.random().toString(36).substring(2, 15);
      
      this.setRequestId(requestId);
      req.requestId = requestId;

      const start = Date.now();
      const originalJson = res.json;

      // Override res.json to log response
      res.json = function(body: any) {
        const duration = Date.now() - start;
        const statusCode = res.statusCode;

        const logData = {
          method: req.method,
          url: req.originalUrl,
          statusCode,
          duration: `${duration}ms`,
          ip: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent'),
          userId: req.auth?.userId,
          requestId
        };

        if (statusCode >= 400) {
          logger.warn(`Request failed: ${req.method} ${req.originalUrl}`, logData);
        } else {
          logger.info(`Request completed: ${req.method} ${req.originalUrl}`, logData);
        }

        return originalJson.call(this, body);
      };

      next();
    };
  }

  // Node.js Concept: Resource cleanup
  async close(): Promise<void> {
    const closePromises = Array.from(this.fileStreams.values()).map(stream => {
      return new Promise<void>((resolve, reject) => {
        stream.end((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    });

    try {
      await Promise.all(closePromises);
      this.fileStreams.clear();
      console.log('✅ All log streams closed');
    } catch (error) {
      console.error('❌ Error closing log streams:', error);
    }
  }

  // Utility methods
  // Node.js Concept: File system operations for log management
  async getLogFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.logDirectory);
      return files.filter(file => file.endsWith('.log'));
    } catch (error) {
      console.error('❌ Failed to read log directory:', error);
      return [];
    }
  }

  async readLogFile(filename: string): Promise<LogEntry[]> {
    try {
      const filePath = path.join(this.logDirectory, filename);
      const content = await fs.readFile(filePath, 'utf-8');
      
      return content
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          try {
            return JSON.parse(line);
          } catch (error) {
            return {
              timestamp: new Date().toISOString(),
              level: 'ERROR',
              message: 'Failed to parse log entry',
              meta: { originalLine: line, parseError: error }
            };
          }
        });
    } catch (error) {
      console.error(`❌ Failed to read log file ${filename}:`, error);
      return [];
    }
  }

  // Clean up old log files
  async cleanupOldLogs(daysToKeep: number = 30): Promise<void> {
    try {
      const files = await this.getLogFiles();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      for (const file of files) {
        const filePath = path.join(this.logDirectory, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          console.log(`🗑️  Deleted old log file: ${file}`);
        }
      }
    } catch (error) {
      console.error('❌ Failed to cleanup old logs:', error);
    }
  }

  // Get log statistics
  async getLogStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    oldestLog: string | null;
    newestLog: string | null;
  }> {
    try {
      const files = await this.getLogFiles();
      let totalSize = 0;
      let oldestLog: string | null = null;
      let newestLog: string | null = null;
      let oldestTime = Number.MAX_SAFE_INTEGER;
      let newestTime = 0;

      for (const file of files) {
        const filePath = path.join(this.logDirectory, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;

        const mtime = stats.mtime.getTime();
        if (mtime < oldestTime) {
          oldestTime = mtime;
          oldestLog = file;
        }
        if (mtime > newestTime) {
          newestTime = mtime;
          newestLog = file;
        }
      }

      return {
        totalFiles: files.length,
        totalSize,
        oldestLog,
        newestLog
      };
    } catch (error) {
      console.error('❌ Failed to get log stats:', error);
      return {
        totalFiles: 0,
        totalSize: 0,
        oldestLog: null,
        newestLog: null
      };
    }
  }
}

// Node.js Concept: Singleton pattern for global logger instance
export const logger = new Logger(
  process.env.LOG_LEVEL ? parseInt(process.env.LOG_LEVEL) : LogLevel.INFO,
  process.env.LOG_DIR || path.join(process.cwd(), 'logs')
);

// Export for use in other modules
export default logger;
