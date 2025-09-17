import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import mongoose from 'mongoose';
import authRoutes from './routes/auth';
import tripRoutes from './routes/trips';
import reviewRoutes from './routes/reviews';
import wishlistRoutes from './routes/wishlist';
import fileRoutes from './routes/files';

const app = express();

// Enhanced error handling middleware
const asyncErrorHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Request timeout middleware
const timeoutMiddleware = (req: Request, res: Response, next: NextFunction) => {
  req.setTimeout(30000); // 30 seconds timeout
  res.setTimeout(30000);
  next();
};

// Request logging middleware
const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  console.log(`📨 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const emoji = status >= 400 ? '❌' : status >= 300 ? '⚠️' : '✅';
    console.log(`${emoji} ${req.method} ${req.path} - ${status} (${duration}ms)`);
  });
  
  next();
};

// Apply middleware
app.use(requestLogger);
app.use(timeoutMiddleware);
app.use(helmet());
app.use(cors({ 
  origin: process.env.NODE_ENV === 'production' ? 
    ['https://your-frontend-domain.com'] : '*',
  credentials: true 
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Simple logging function
const logMessage = (level: string, message: string): void => {
  console.log(`${new Date().toISOString()} [${level}] ${message}`);
};

// Global error handler
const globalErrorHandler = (error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('🚨 Unhandled error:', error);
  
  // Log error
  logMessage('ERROR', `${req.method} ${req.path} - ${error.message}`);
  
  if (res.headersSent) {
    return next(error);
  }
  
  const statusCode = (error as any).statusCode || 500;
  res.status(statusCode).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
  });
};

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/trekktribe';

// Enhanced database connection with retry logic
const connectToDatabase = async (retries = 5): Promise<void> => {
  for (let i = 1; i <= retries; i++) {
    try {
      console.log(`🔄 Database connection attempt ${i}/${retries}`);
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 10000, // 10 seconds
        socketTimeoutMS: 45000, // 45 seconds
        maxPoolSize: 10,
        minPoolSize: 2,
      });
      console.log('✅ Connected to MongoDB successfully');
      logMessage('INFO', 'Connected to MongoDB successfully');
      return;
    } catch (error: any) {
      console.error(`❌ Database connection attempt ${i} failed:`, error.message);
      logMessage('ERROR', `Database connection attempt ${i} failed: ${error.message}`);
      
      if (i === retries) {
        throw new Error(`Failed to connect to database after ${retries} attempts: ${error.message}`);
      }
      
      // Exponential backoff: wait 2^i seconds before retry
      const waitTime = Math.pow(2, i) * 1000;
      console.log(`⏳ Retrying in ${waitTime / 1000} seconds...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
};

async function start() {
  try {
    console.log('🚀 Starting TrekkTribe API server...');
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📡 Port: ${port}`);
    
    // Connect to database with retry logic
    await connectToDatabase();
    
    // Routes
    app.use('/auth', authRoutes);
    app.use('/trips', tripRoutes);
    app.use('/reviews', reviewRoutes);
    app.use('/wishlist', wishlistRoutes);
    app.use('/files', fileRoutes);
    
    // Health check endpoint with detailed info
    app.get('/health', asyncErrorHandler(async (_req: Request, res: Response) => {
      const mongoStatus = mongoose.connection.readyState;
      const statusMap = {
        0: 'disconnected',
        1: 'connected',
        2: 'connecting',
        3: 'disconnecting'
      };
      
      // Test database operation
      const dbTest = mongoose.connection.db ? await mongoose.connection.db.admin().ping() : false;
      
      const health = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        mongodb: {
          status: statusMap[mongoStatus as keyof typeof statusMap],
          ping: dbTest ? 'successful' : 'failed'
        },
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version
      };
      
      res.json(health);
    }));
    
    // 404 handler
    app.use('*', (req: Request, res: Response) => {
      res.status(404).json({ 
        error: 'Route not found',
        path: req.originalUrl,
        method: req.method
      });
    });
    
    // Apply global error handler
    app.use(globalErrorHandler);
    
    // Start server with error handling
    const server = app.listen(port, () => {
      console.log(`🚀 API listening on http://localhost:${port}`);
      console.log(`📊 Health check: http://localhost:${port}/health`);
      logMessage('INFO', `Server started on port ${port}`);
    });
    
    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n📴 Received ${signal}. Starting graceful shutdown...`);
      logMessage('INFO', `Received ${signal}. Starting graceful shutdown`);
      
      server.close(async (err) => {
        if (err) {
          console.error('❌ Error during server shutdown:', err);
          logMessage('ERROR', `Error during server shutdown: ${err.message}`);
          process.exit(1);
        }
        
        try {
          await mongoose.connection.close();
          console.log('✅ Database connection closed');
          logMessage('INFO', 'Graceful shutdown completed');
          process.exit(0);
        } catch (dbError: any) {
          console.error('❌ Error closing database:', dbError);
          logMessage('ERROR', `Error closing database: ${dbError.message}`);
          process.exit(1);
        }
      });
    };
    
    // Handle process signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (err: any) {
    console.error('❌ Failed to start server:', err);
    logMessage('ERROR', `Failed to start server: ${err.message}`);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  console.error('🚨 Uncaught Exception:', error);
  logMessage('CRITICAL', `Uncaught Exception: ${error.message}`);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  logMessage('CRITICAL', `Unhandled Rejection: ${reason}`);
  process.exit(1);
});

// Start the application
start();


