import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import mongoose from 'mongoose';
import { createServer } from 'http';
import authRoutes from './routes/auth';
import tripRoutes from './routes/trips';
import reviewRoutes from './routes/reviews';
import wishlistRoutes from './routes/wishlist';
import fileRoutes from './routes/files';
import bookingRoutes from './routes/bookings';
import adminRoutes from './routes/admin';
import profileRoutes from './routes/profile';
import agentRoutes from './routes/agent';
import chatSupportRoutes from './routes/chatSupportRoutes';
import enhancedProfileRoutes from './routes/enhancedProfile';
import publicProfileRoutes from './routes/publicProfile';
import aiRoutes from './routes/ai';
import aiProxyRoutes from './routes/aiProxy';
import followRoutes from './routes/follow';
import viewsRoutes from './routes/views';
import postsRoutes from './routes/posts';
import searchRoutes from './routes/search';
import supportRoutes from './routes/support';
import statsRoutes from './routes/stats';
// Production-ready file upload routes
import fileUploadRoutes from './routes/fileUploadProd';
import groupBookingRoutes from './routes/groupBookings';
import reviewVerificationRoutes from './routes/reviewVerification';
import { whatsappService } from './services/whatsappService';
import { socketService } from './services/socketService';
// CRM System Routes
import crmRoutes from './routes/crm';
import chatService from './services/chatService';
import emailVerificationRoutes from './routes/emailVerification';
import recommendationsRoutes from './routes/recommendations';
import notificationRoutes from './routes/notifications';
import subscriptionRoutes from './routes/subscriptions';
import analyticsRoutes from './routes/analytics';
import receiptRoutes from './routes/receipts';
import webhookRoutes from './routes/webhooks';
import autoPayRoutes from './routes/autoPay';
import dashboardRoutes from './routes/dashboard';
import { apiLimiter, authLimiter, otpLimiter } from './middleware/rateLimiter';
import { cronScheduler } from './services/cronScheduler';
import { chargeRetryWorker } from './services/chargeRetryWorker';
import { logger } from './utils/logger';
import errorHandler from './middleware/errorHandler';
import metrics from './middleware/metrics';

const app = express();
const server = createServer(app);
// Export the express app for testing and programmatic use
export default app;

// Optional Sentry integration (centralized)
import { initSentry } from './sentry';
const Sentry = initSentry();
if (Sentry) {
  // Attach Sentry request handler
  app.use(Sentry.Handlers.requestHandler());
}

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

// Apply middleware (structured logger)
app.use(logger.requestLogger());
// Metrics middleware collects request metrics for Prometheus
app.use(metrics.metricsMiddleware());
app.use(timeoutMiddleware);
app.use(helmet());

// Rate limiting commented out - uncomment when express-rate-limit types are compatible
// if (process.env.NODE_ENV === 'production') {
//   app.use(apiLimiter);
//   console.log('✅ Rate limiting enabled for production');
// }
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [
      'https://www.trektribe.in',
      'https://trektribe.in',
      'https://trek-tribe-38in.onrender.com',
      'https://trek-tribe-web.onrender.com',
      'https://trek-tribe.vercel.app',
      process.env.FRONTEND_URL,
      process.env.CORS_ORIGIN,
      process.env.WEB_URL,
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined
    ].filter(Boolean) as string[]
  : '*';
app.use(cors({
  origin: allowedOrigins as any,
  credentials: true 
}));
// Capture raw body for webhook signature verification (Razorpay requires exact bytes)
app.use(express.json({ 
  limit: '10mb',
  verify: (req: any, _res, buf: Buffer, encoding: string) => {
    if (buf && buf.length) {
      req.rawBody = buf.toString((encoding as BufferEncoding) || 'utf8');
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files for uploads
app.use('/uploads', express.static('uploads'));

// Simple logging function
const logMessage = (level: string, message: string): void => {
  console.log(`${new Date().toISOString()} [${level}] ${message}`);
};

// Centralized error handling is provided by middleware/errorHandler

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
// Render uses port 10000 by default, but process.env.PORT should be available
const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) {
  throw new Error('MONGODB_URI environment variable is required');
}

// Ensure a JWT secret exists. In test environments provide a safe fallback so
// tests and worker processes don't fail when env vars are not propagated.
if ((!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) && process.env.NODE_ENV === 'test') {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-that-is-long-enough-12345';
  console.log('ℹ️  Using fallback JWT_SECRET for test environment');
}

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be set and at least 32 characters long');
}

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
    
    // Initialize WhatsApp service (non-blocking; gated by env)
    const whatsappEnabled = (process.env.WHATSAPP_ENABLED || 'false').toLowerCase() === 'true';
    if (whatsappEnabled) {
      whatsappService.initialize().catch((error) => {
        console.error('❌ Failed to initialize WhatsApp service:', error.message);
        console.log('ℹ️  WhatsApp notifications will be disabled');
      });
    } else {
      console.log('ℹ️  WhatsApp service disabled (WHATSAPP_ENABLED is not true)');
    }
    
    // Initialize Socket.IO service
    socketService.initialize(server);
    console.log('✅ Socket.IO service initialized');
    logMessage('INFO', 'Socket.IO service initialized');
    
    // Initialize CRM Chat Service (integrates with existing Socket.IO)
    if (socketService.getIO()) {
      chatService.initializeSocketIO(socketService.getIO());
      console.log('✅ CRM Chat service initialized');
      logMessage('INFO', 'CRM Chat service initialized');
    }
    
    // Initialize Cron Scheduler for auto-pay and other scheduled tasks
    cronScheduler.init();
    console.log('✅ Cron scheduler initialized');
    logMessage('INFO', 'Cron scheduler initialized');

    // Start charge retry worker
    try {
      chargeRetryWorker.start();
      console.log('✅ Charge retry worker started');
      logMessage('INFO', 'Charge retry worker started');
    } catch (err: any) {
      console.warn('⚠️ Failed to start charge retry worker', err.message);
    }
    
    // Routes
    app.use('/auth', authRoutes);
    app.use('/trips', tripRoutes);
    app.use('/reviews', reviewRoutes);
    app.use('/wishlist', wishlistRoutes);
    app.use('/files', fileRoutes);
    app.use('/bookings', bookingRoutes);
    app.use('/admin', adminRoutes);
    app.use('/profile', profileRoutes);
    app.use('/profile', enhancedProfileRoutes);
    app.use('/api/public', publicProfileRoutes);
    // File upload system (production ready)
    app.use('/api/uploads', fileUploadRoutes);
    
    // Group Bookings and Review Verification
    app.use('/api/group-bookings', groupBookingRoutes);
    app.use('/group-bookings', groupBookingRoutes);
    app.use('/api/review-verification', reviewVerificationRoutes);
    app.use('/review-verification', reviewVerificationRoutes);
    app.use('/agent', agentRoutes);
    app.use('/chat', chatSupportRoutes);
    app.use('/api/ai', aiRoutes);
    // Server-side proxy that forwards client AI requests to the internal Python AI microservice
    // Mounted at the same prefix so `/api/ai/generate` will forward to the Python service.
    app.use('/api/ai', aiProxyRoutes);
    app.use('/', viewsRoutes);
    app.use('/api/follow', followRoutes);
    app.use('/api/posts', postsRoutes);
    app.use('/api/search', searchRoutes);
    app.use('/support', supportRoutes);
    app.use('/stats', statsRoutes);
    
    // CRM System Routes
    app.use('/api/crm', crmRoutes);
    console.log('✅ CRM routes mounted at /api/crm');
    logMessage('INFO', 'CRM routes registered');
    
    // Email Verification Routes
    app.use('/api/verify-email', emailVerificationRoutes);
    console.log('✅ Email verification routes mounted at /api/verify-email');
    logMessage('INFO', 'Email verification routes registered');
    
    // Recommendations Routes
    app.use('/api/recommendations', recommendationsRoutes);
    console.log('✅ Recommendations routes mounted at /api/recommendations');
    logMessage('INFO', 'Recommendations routes registered');
    
    // Notification Routes
    app.use('/api/notifications', notificationRoutes);
    console.log('✅ Notification routes mounted at /api/notifications');
    logMessage('INFO', 'Notification routes registered');
    
    // Subscription Routes
    app.use('/api/subscriptions', subscriptionRoutes);
    console.log('✅ Subscription routes mounted at /api/subscriptions');
    logMessage('INFO', 'Subscription routes registered');
    
    // Analytics Routes
    app.use('/api/analytics', analyticsRoutes);
    console.log('✅ Analytics routes mounted at /api/analytics');
    logMessage('INFO', 'Analytics routes registered');
    
    // Receipt Generation Routes
    app.use('/api/receipts', receiptRoutes);
    console.log('✅ Receipt routes mounted at /api/receipts');
    logMessage('INFO', 'Receipt routes registered');
    
    // Razorpay Webhook Routes
    app.use('/api/webhooks', webhookRoutes);
    console.log('✅ Webhook routes mounted at /api/webhooks');
    logMessage('INFO', 'Webhook routes registered');
    
    // Auto-Pay Routes
    app.use('/api/auto-pay', autoPayRoutes);
    console.log('✅ Auto-pay routes mounted at /api/auto-pay');
    logMessage('INFO', 'Auto-pay routes registered');
    
    // Dashboard Routes (role-specific)
    app.use('/api/dashboard', dashboardRoutes);
    console.log('✅ Dashboard routes mounted at /api/dashboard');
    logMessage('INFO', 'Dashboard routes registered');
    
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
        socketIO: socketService.getServiceStatus(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version
      };
      
      res.json(health);
    }));

    // Readiness probe: checks critical dependencies (DB + optional Redis + Razorpay)
    app.get('/ready', asyncErrorHandler(async (_req: Request, res: Response) => {
      const mongoStatus = mongoose.connection.readyState === 1;
      // Optional Redis check
      let redisOk = true;
      try {
        const { redisService } = require('./services/redisService');
        if (redisService && redisService.ping) {
          redisOk = await redisService.ping();
        }
      } catch (e) {
        // redis might not be configured; treat as optional
        redisOk = true;
      }

      // Razorpay credential check (lightweight): ensure env vars exist
      const razorpayOk = !!(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

      const ready = mongoStatus && redisOk && razorpayOk;
      if (!ready) {
        return res.status(503).json({ ready: false, mongo: mongoStatus, redis: redisOk, razorpay: razorpayOk });
      }
      return res.json({ ready: true });
    }));

    // Prometheus metrics endpoint
    app.get('/metrics', metrics.metricsEndpoint);

    // Request metrics middleware (collect metrics for each request)
    app.use(metrics.metricsMiddleware());
    
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
    
    // Start server with error handling
    const httpServer = server.listen(port, () => {
      console.log(`🚀 API listening on http://localhost:${port}`);
      console.log(`📊 Health check: http://localhost:${port}/health`);
      console.log(`💬 Socket.IO chat support: http://localhost:${port}/socket.io/`);
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
          // Stop cron jobs
          cronScheduler.stopAll();
          console.log('✅ Cron jobs stopped');
          
          // Shutdown Socket.IO service
          socketService.shutdown();
          console.log('✅ Socket.IO service shut down');
          
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


