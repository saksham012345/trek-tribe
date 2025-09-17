// Node.js Concept: Creating custom error classes for better error handling
// This demonstrates inheritance, custom properties, and error categorization

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public errorCode?: string;
  public details?: any;
  public timestamp: Date;

  constructor(
    message: string,
    statusCode: number = 500,
    errorCode?: string,
    details?: any,
    isOperational: boolean = true
  ) {
    super(message);
    
    // Node.js Concept: Maintaining proper prototype chain
    Object.setPrototypeOf(this, AppError.prototype);
    
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errorCode = errorCode;
    this.details = details;
    this.timestamp = new Date();

    // Node.js Concept: Capturing stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  // Serialize error for JSON responses
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      errorCode: this.errorCode,
      details: this.details,
      timestamp: this.timestamp,
      ...(process.env.NODE_ENV !== 'production' && {
        stack: this.stack
      })
    };
  }
}

// Specific error types for different scenarios
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT');
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 500, 'DATABASE_ERROR', details, false);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message?: string) {
    super(
      message || `External service ${service} is unavailable`,
      503,
      'EXTERNAL_SERVICE_ERROR',
      { service }
    );
  }
}

// Node.js Concept: Error handling utilities and helper functions
export class ErrorHandler {
  // Convert mongoose validation errors to our custom format
  static handleMongooseValidationError(error: { errors: Record<string, any> }): ValidationError {
    const errors = Object.values(error.errors).map((err: any) => ({
      field: err.path,
      message: err.message,
      value: err.value
    }));

    return new ValidationError(
      'Validation failed',
      { fields: errors }
    );
  }

  // Handle MongoDB duplicate key errors
  static handleMongoDuplicateKeyError(error: { keyValue: Record<string, any> }): ConflictError {
    const field = Object.keys(error.keyValue)[0];
    const value = error.keyValue[field];
    
    return new ConflictError(
      `${field} '${value}' already exists`,
      { field, value }
    );
  }

  // Handle MongoDB cast errors (invalid ObjectId, etc.)
  static handleMongoCastError(error: { path: string; value: any }): ValidationError {
    return new ValidationError(
      `Invalid ${error.path}: ${error.value}`,
      { path: error.path, value: error.value }
    );
  }

  // Handle JWT errors
  static handleJWTError(error: { name: string }): AuthenticationError {
    if (error.name === 'JsonWebTokenError') {
      return new AuthenticationError('Invalid token');
    }
    if (error.name === 'TokenExpiredError') {
      return new AuthenticationError('Token expired');
    }
    return new AuthenticationError('Authentication failed');
  }

  // Central error processing
  static processError(error: Error & { name?: string; code?: number; errors?: any; keyValue?: any; path?: string; value?: any }): AppError {
    // If it's already our custom error, return as-is
    if (error instanceof AppError) {
      return error;
    }

    // Handle specific error types with type guards
    if (error.name === 'ValidationError' && error.errors) {
      return this.handleMongooseValidationError(error);
    }

    if (error.code === 11000 && error.keyValue) {
      return this.handleMongoDuplicateKeyError(error);
    }

    if (error.name === 'CastError' && error.path && error.value !== undefined) {
      return this.handleMongoCastError(error);
    }

    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return this.handleJWTError(error);
    }

    // Default to generic server error
    return new AppError(
      process.env.NODE_ENV === 'production' 
        ? 'Something went wrong!' 
        : error.message,
      500,
      'INTERNAL_SERVER_ERROR',
      process.env.NODE_ENV !== 'production' ? {
        originalError: error.message,
        stack: error.stack
      } : undefined,
      false
    );
  }
}

// Node.js Concept: Async error wrapper for Express routes
export const asyncErrorHandler = (fn: (...args: any[]) => Promise<any>) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Node.js Concept: Development error logging with detailed information
export const logError = (error: AppError, req?: any) => {
  const timestamp = new Date().toISOString();
  
  const errorInfo = {
    timestamp,
    name: error.name,
    message: error.message,
    statusCode: error.statusCode,
    errorCode: error.errorCode,
    isOperational: error.isOperational,
    ...(req && {
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.auth?.userId
    }),
    ...(process.env.NODE_ENV !== 'production' && {
      stack: error.stack,
      details: error.details
    })
  };

  // Log different levels based on error type
  if (error.statusCode >= 500) {
    console.error('🚨 Server Error:', errorInfo);
  } else if (error.statusCode >= 400) {
    console.warn('⚠️  Client Error:', errorInfo);
  } else {
    console.log('ℹ️  Info:', errorInfo);
  }

  return errorInfo;
};

// Node.js Concept: Global error handler for Express
export const globalErrorHandler = (error: Error, req: any, res: any, next: any) => {
  const processedError = ErrorHandler.processError(error);
  
  // Log the error
  logError(processedError, req);

  // Don't send response if headers are already sent
  if (res.headersSent) {
    return next(processedError);
  }

  // Send error response
  res.status(processedError.statusCode).json({
    success: false,
    error: {
      message: processedError.message,
      code: processedError.errorCode,
      timestamp: processedError.timestamp,
      ...(processedError.details && { details: processedError.details }),
      ...(process.env.NODE_ENV !== 'production' && {
        stack: processedError.stack
      })
    }
  });
};

// Node.js Concept: Graceful shutdown handling
export class GracefulShutdown {
  private server: any;
  private connections: Set<any> = new Set();

  constructor(server: any) {
    this.server = server;
    this.setupConnectionTracking();
    this.setupSignalHandlers();
  }

  private setupConnectionTracking() {
    this.server.on('connection', (connection: any) => {
      this.connections.add(connection);
      
      connection.on('close', () => {
        this.connections.delete(connection);
      });
    });
  }

  private setupSignalHandlers() {
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT', () => this.shutdown('SIGINT'));
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      console.error('🚨 Uncaught Exception:', error);
      logError(new AppError(error.message, 500, 'UNCAUGHT_EXCEPTION', {
        stack: error.stack
      }, false));
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
      logError(new AppError(
        reason?.message || String(reason), 
        500, 
        'UNHANDLED_REJECTION',
        { reason, promise: promise.toString() },
        false
      ));
      process.exit(1);
    });
  }

  private async shutdown(signal: string) {
    console.log(`\n📴 Received ${signal}. Starting graceful shutdown...`);

    // Stop accepting new connections
    this.server.close(() => {
      console.log('✅ Server closed to new connections');
    });

    // Close existing connections
    for (const connection of this.connections) {
      connection.destroy();
    }

    // Close database connections, etc.
    try {
      const mongoose = require('mongoose');
      await mongoose.connection.close();
      console.log('✅ Database connections closed');
    } catch (error) {
      console.error('❌ Error closing database:', error);
    }

    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  }
}

// Default export
export default AppError;
