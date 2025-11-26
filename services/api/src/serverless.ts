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
import { logger } from './utils/logger';
import errorHandler from './middleware/errorHandler';

// Enhanced error handling middleware
const asyncErrorHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Apply structured logger
app.use(logger.requestLogger());
app.use(helmet({
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({ 
  origin: process.env.NODE_ENV === 'production' ? [
    'https://www.trektribe.in',
    'https://trektribe.in',
    process.env.FRONTEND_URL || 'https://trek-tribe-web.onrender.com',
    process.env.CORS_ORIGIN || 'https://trek-tribe-web.onrender.com',
    'https://trek-tribe-38in.onrender.com',
    'https://trek-tribe.vercel.app'
  ] : '*',
  credentials: true 
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Simple logging function
const logMessage = (level: string, message: string): void => {
  console.log(`${new Date().toISOString()} [${level}] ${message}`);
};

// Use centralized error handler

const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://your-connection-string';

// Enhanced database connection with caching for serverless
let cachedConnection: typeof mongoose | null = null;

const connectToDatabase = async (): Promise<typeof mongoose> => {
  if (cachedConnection && mongoose.connection.readyState === 1) {
    console.log('Using cached database connection');
    return cachedConnection;
  }

  try {
    console.log('🔄 Connecting to MongoDB...');
    const connection = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000, // 5 seconds for serverless
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 2,
    });
    
    cachedConnection = connection;
    console.log('✅ Connected to MongoDB successfully');
    logMessage('INFO', 'Connected to MongoDB successfully');
    return connection;
  } catch (error: any) {
    console.error(`❌ Database connection failed:`, error.message);
    logMessage('ERROR', `Database connection failed: ${error.message}`);
    throw new Error(`Failed to connect to database: ${error.message}`);
  }
};

// Initialize database connection
connectToDatabase().catch(console.error);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/files', fileRoutes);

// Legacy routes (without /api prefix for backward compatibility)
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
    version: process.version,
    environment: process.env.NODE_ENV
  };
  
  res.json(health);
}));

app.get('/api/health', asyncErrorHandler(async (_req: Request, res: Response) => {
  const mongoStatus = mongoose.connection.readyState;
  const statusMap = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: {
      status: statusMap[mongoStatus as keyof typeof statusMap]
    },
    environment: process.env.NODE_ENV
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

// Apply centralized error handler
app.use(errorHandler);

export default app;