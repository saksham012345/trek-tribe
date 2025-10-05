import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import helmet from 'helmet';
import cors from 'cors';
import mongoose from 'mongoose';
import ChatServer from './socket/chatServer';
import authRoutes from './routes/auth';
import tripRoutes from './routes/trips';
import reviewRoutes from './routes/reviews';
import wishlistRoutes from './routes/wishlist';
import fileRoutes from './routes/files';
import secureFileRoutes from './routes/secure-files';
import trackingRoutes from './routes/tracking';
import ratingsRoutes from './routes/ratings';
import statisticsRoutes from './routes/statistics';
import paymentsRoutes from './routes/payments';
import otpRoutes from './routes/otp';
import chatbotRoutes from './routes/chatbot';
import chatRoutes from './routes/chat';
import adminRoutes from './routes/admin';
import agentRoutes from './routes/agent';
import supportRoutes from './routes/support';

const app = express();
const httpServer = createServer(app);

// Initialize chat server
let chatServer: ChatServer;

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
  origin: process.env.NODE_ENV === 'production' ? [
    'https://trek-tribe-web.vercel.app',
    'https://trek-tribe-web-saksham-s-projects-76ba6bcc.vercel.app',
    'https://trek-tribe-6pb4ones7-saksham-s-projects-76ba6bcc.vercel.app',
    'https://trek-tribe-web.onrender.com',
    process.env.FRONTEND_URL || '*',
    process.env.CORS_ORIGIN || '*'
  ] : '*',
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
// Render uses port 10000 by default, but process.env.PORT should be available
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
    
    // Initialize chat server after database connection
    console.log('🔌 Initializing real-time chat server...');
    chatServer = new ChatServer(httpServer);
    console.log('✅ Chat server initialized successfully');
    
    // Routes
    // Root route handler
    app.get('/', (req: Request, res: Response) => {
      res.json({
        message: 'Trek Tribe API',
        version: '1.0.2',
        status: 'active',
        deployed: '2025-09-23T17:35:00Z',
        timestamp: new Date().toISOString(),
        endpoints: {
          health: '/health',
          auth: '/auth/*',
          trips: '/trips',
          reviews: '/reviews',
          wishlist: '/wishlist',
          files: '/files/*',
          tracking: '/tracking/*',
          uploads: '/uploads/*',
          chat: '/chat/*',
          admin: '/admin/*',
          agent: '/agent/*',
          support: '/support/*'
        }
      });
    });

// Serve uploaded files statically
app.use('/uploads', express.static('uploads'));

app.use('/auth', authRoutes);
app.use('/trips', tripRoutes);
app.use('/reviews', reviewRoutes);
app.use('/wishlist', wishlistRoutes);
app.use('/files', fileRoutes);
app.use('/secure-files', secureFileRoutes);
app.use('/tracking', trackingRoutes);
app.use('/ratings', ratingsRoutes);
app.use('/statistics', statisticsRoutes);
app.use('/payments', paymentsRoutes);
app.use('/otp', otpRoutes);
app.use('/chatbot', chatbotRoutes);
app.use('/chat', chatRoutes);
app.use('/admin', adminRoutes);
app.use('/agent', agentRoutes);
app.use('/support', supportRoutes);
    
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
      
      // Check service availability
      const { firebaseService } = require('./utils/firebaseService');
      const { emailService } = require('./utils/emailService');
      const { smsService } = require('./utils/smsService');
      
      const health = {
        status: mongoStatus === 1 && dbTest ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
        version: '1.0.3',
        services: {
          api: 'running',
          database: {
            status: statusMap[mongoStatus as keyof typeof statusMap],
            ping: dbTest ? 'successful' : 'failed',
            connected: mongoStatus === 1
          },
          firebase: {
            available: firebaseService?.isAvailable() || false,
            status: firebaseService?.isAvailable() ? 'configured' : 'disabled'
          },
          email: {
            available: emailService?.isConfigured || false,
            status: emailService?.isConfigured ? 'configured' : 'disabled'
          },
          sms: {
            available: smsService?.client !== null || false,
            status: smsService?.client ? 'configured' : 'disabled'
          },
          chat: {
            available: chatServer !== null,
            status: 'socket.io initialized'
          }
        },
        system: {
          uptime: Math.floor(process.uptime()),
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
          },
          nodeVersion: process.version,
          platform: process.platform
        }
      };
      
      // Return appropriate HTTP status
      const httpStatus = health.status === 'healthy' ? 200 : 503;
      res.status(httpStatus).json(health);
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
    httpServer.listen(port, () => {
      console.log(`🚀 API server listening on http://localhost:${port}`);
      console.log(`🔌 Socket.io server ready for real-time chat`);
      console.log(`📊 Health check: http://localhost:${port}/health`);
      logMessage('INFO', `Server started on port ${port}`);
    });
    
    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n📴 Received ${signal}. Starting graceful shutdown...`);
      logMessage('INFO', `Received ${signal}. Starting graceful shutdown`);
      
      httpServer.close(async (err) => {
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


