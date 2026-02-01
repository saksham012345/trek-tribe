import 'dotenv/config';
// Force Render redeploy with MongoDB Atlas connection (December 20, 2025)
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
// Optional in-memory MongoDB for local dev/testing
import { createServer } from 'http';
import authRoutes from './routes/auth';
import tripRoutes from './routes/trips';
import reviewRoutes from './routes/reviews';
import wishlistRoutes from './routes/wishlist';
// import fileRoutes from './routes/files';
import bookingRoutes from './routes/bookings';
import adminRoutes from './routes/admin';
import profileRoutes from './routes/profile';
import agentRoutes from './routes/agent';
import organizerRoutes from './routes/organizer';
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
// import fileUploadRoutes from './routes/fileUploadProd';
import groupBookingRoutes from './routes/groupBookings';
import reviewVerificationRoutes from './routes/reviewVerification';
import { whatsappService } from './services/whatsappService';
import { socketService } from './services/socketService';
// CRM System Routes
import crmRoutes from './routes/crm';
import chatService from './services/chatService';
import emailVerificationRoutes from './routes/emailVerification';
import verificationRoutes from './routes/verification';
import recommendationsRoutes from './routes/recommendations';
import notificationRoutes from './routes/notifications';
import subscriptionRoutes from './routes/subscriptions';
import analyticsRoutes from './routes/analytics';
import receiptRoutes from './routes/receipts';
import webhookRoutes from './routes/webhooks';
import autoPayRoutes from './routes/autoPay';
import usersRoutes from './routes/users';
import dashboardRoutes from './routes/dashboard';
import paymentVerificationRoutes from './routes/paymentVerification';
import paymentRoutes from './routes/payments';
import marketplaceRoutes from './routes/marketplace';
import customTripRoutes from './routes/customTrips';
import seedRoutes from './routes/seed';
import groupsRoutes from './routes/groups';
import eventsRoutes from './routes/events';
import bankDetailsRoutes from './routes/bankDetails';
import financeRoutes from './routes/finance';
import { apiLimiter, authLimiter, otpLimiter } from './middleware/rateLimiter';
import { cronScheduler } from './services/cronScheduler';
import { chargeRetryWorker } from './services/chargeRetryWorker';
import { Trip } from './models/Trip';
import fs from 'fs';
import path from 'path';
import { logger } from './utils/logger';
import errorHandler from './middleware/errorHandler';
import metrics from './middleware/metrics';

const app = express();
const server = createServer(app);

// Trust proxy for Render deployment (required for express-rate-limit)
app.set('trust proxy', 1);

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
app.use(helmet({
  // Enable CSP in all environments for better security (can be more lenient in development)
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "default-src": ["'self'"],
      // Only allow Razorpay checkout script; disallow inline scripts
      "script-src": ["'self'", 'https://checkout.razorpay.com', ...(process.env.NODE_ENV === 'development' ? ["'unsafe-eval'", "'unsafe-inline'"] : [])],
      // Allow Razorpay checkout to be framed
      "frame-src": ['https://checkout.razorpay.com'],
      // Images from self and data URLs; https generally
      "img-src": ["'self'", 'data:', 'https:'],
      // Restrict connections to self, frontend/backend domains, AI service, and Razorpay API
      "connect-src": [
        "'self'",
        'https:',
        process.env.NODE_ENV === 'development' ? 'http:' : '',
        process.env.FRONTEND_URL || '',
        process.env.BACKEND_URL || '',
        process.env.AI_SERVICE_URL || '',
        'https://api.razorpay.com'
      ].filter(Boolean),
      // Block embedding of objects completely
      "object-src": ["'none'"],
      // Allow styles from self and inline styles in development (for React development tools)
      "style-src": ["'self'", "'unsafe-inline'"]
    },
    // Only report violations in production, allow in development for easier debugging
    reportOnly: process.env.NODE_ENV === 'development'
  },
  crossOriginEmbedderPolicy: true,
  // Relax COOP to allow OAuth popups and cross-origin postMessage (Google Sign-In)
  crossOriginOpenerPolicy: { policy: 'unsafe-none' }
}));

// Enable rate limiting in non-test environments for brute-force protection
if (process.env.NODE_ENV !== 'test') {
  app.use(apiLimiter);
  console.log('✅ Rate limiting enabled');
}
// CORS configuration - must specify exact origins when credentials are enabled
const getAllowedOrigins = (): string[] => {
  const origins: string[] = [];

  // Helper to split comma-separated values from env vars
  const addOrigins = (val: string | undefined) => {
    if (!val) return;
    val.split(',').forEach(o => {
      const clean = o.trim().replace(/\/$/, ''); // Remove trailing slash
      if (clean) origins.push(clean);
    });
  };

  // Add environment variable origins
  addOrigins(process.env.FRONTEND_URL);
  addOrigins(process.env.CORS_ORIGIN);
  addOrigins(process.env.WEB_URL);
  if (process.env.VERCEL_URL) origins.push(`https://${process.env.VERCEL_URL}`);

  // In production, always include common production domains
  if (process.env.NODE_ENV === 'production') {
    origins.push('https://trektribe.in');
    origins.push('https://www.trektribe.in');
    origins.push('https://trek-tribe-web.onrender.com');
    // Backend domain itself
    origins.push('https://trek-tribe-1-56gm.onrender.com');
    origins.push('https://trek-tribe-api.onrender.com');
  }

  // In development, allow localhost origins
  if (process.env.NODE_ENV === 'development') {
    origins.push('http://localhost:3000');
    origins.push('http://localhost:3001');
    origins.push('http://127.0.0.1:3000');
    origins.push('http://localhost:5000');
  }

  return [...new Set(origins)]; // Remove duplicates
};

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) {
      return callback(null, true);
    }

    const allowedOrigins = getAllowedOrigins();

    // In development, be more permissive
    if (process.env.NODE_ENV === 'development') {
      return callback(null, true);
    }

    // Check if the origin is in the allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}. Allowed origins: ${allowedOrigins.join(', ')}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-api-key'],
}));
// Capture raw body for webhook signature verification (Razorpay requires exact bytes)
// Cookie parser for httpOnly cookies (security: JWT storage)
app.use(cookieParser());

app.use(express.json({
  limit: '10mb',
  verify: (req: any, _res, buf: Buffer, encoding: string) => {
    if (buf && buf.length) {
      req.rawBody = buf.toString((encoding as BufferEncoding) || 'utf8');
    }
  }
}));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply input sanitization middleware to prevent XSS/injection attacks
import { sanitizeInputs } from './middleware/sanitization';
app.use(sanitizeInputs);

// Serve static files for uploads
app.use('/uploads', express.static('uploads'));

// Simple logging function
const logMessage = (level: string, message: string): void => {
  console.log(`${new Date().toISOString()} [${level}] ${message}`);
};

// Centralized error handling is provided by middleware/errorHandler

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
// Render uses port 10000 by default, but process.env.PORT should be available
let mongoUri = process.env.MONGODB_URI;
const useMemDb = (process.env.USE_MEM_DB || 'false').toLowerCase() === 'true';

// If requested, start an in-memory MongoDB for local development/testing
if (!mongoUri && useMemDb) {
  console.log('ℹ️  USE_MEM_DB enabled — starting in-memory MongoDB instance');
} else if (!mongoUri && !useMemDb) {
  throw new Error('MONGODB_URI environment variable is required (or set USE_MEM_DB=true for in-memory DB)');
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
  // If using in-memory DB, start it here and set mongoUri
  if ((!mongoUri || mongoUri.length === 0) && useMemDb) {
    console.log('ℹ️  USE_MEM_DB enabled — starting in-memory MongoDB instance');
    // Dynamically import mongodb-memory-server only when requested so that production
    // / production-built images that don't include devDependencies don't crash.
    // @ts-ignore
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const mongod = await MongoMemoryServer.create();
    mongoUri = mongod.getUri();
    console.log(`✅ In-memory MongoDB started at ${mongoUri}`);
  }
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

export async function start() {
  try {
    console.log('🚀 Starting TrekkTribe API server...');
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`📡 Port: ${port}`);

    // Connect to database with retry logic
    await connectToDatabase();

    // Initialize WhatsApp service DISABLED
    // Reason: WhatsApp credentials were exposed in git history
    // Alternative: Use WhatsApp Business API instead
    console.log('ℹ️  WhatsApp service disabled (credentials compromised - use WhatsApp Business API instead)');

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
    if (process.env.NODE_ENV !== 'test') {
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
    }

    // Routes
    app.use('/auth', authLimiter, authRoutes);
    app.use('/trips', tripRoutes);
    app.use('/reviews', reviewRoutes);
    app.use('/wishlist', wishlistRoutes);
    // app.use('/files', fileRoutes);
    app.use('/bookings', bookingRoutes);
    app.use('/admin', adminRoutes);
    app.use('/api/profile', profileRoutes);
    app.use('/api/profile', enhancedProfileRoutes);
    // Also mount enhanced profile without /api prefix to match other routes
    app.use('/profile', enhancedProfileRoutes);
    app.use('/api/public', publicProfileRoutes);
    // File upload system (production ready)
    // app.use('/api/uploads', fileUploadRoutes);

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
    app.use('/api/groups', groupsRoutes);
    app.use('/api/events', eventsRoutes);
    app.use('/api/search', searchRoutes);
    app.use('/support', supportRoutes);
    app.use('/api/support', supportRoutes); // Also mount at /api/support for consistency
    app.use('/stats', statsRoutes);

    // CRM System Routes
    app.use('/api/crm', crmRoutes);
    console.log('✅ CRM routes mounted at /api/crm');
    logMessage('INFO', 'CRM routes registered');

    // Email Verification Routes
    app.use('/api/verify-email', emailVerificationRoutes);
    console.log('✅ Email verification routes mounted at /api/verify-email');
    logMessage('INFO', 'Email verification routes registered');

    // KYC and ID Verification Routes
    app.use('/api/verification', verificationRoutes);
    console.log('✅ Verification routes mounted at /api/verification');
    logMessage('INFO', 'KYC and ID verification routes registered');

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

    // Marketplace Routes (Razorpay Route)
    app.use('/api/marketplace', marketplaceRoutes);
    console.log('✅ Marketplace routes mounted at /api/marketplace');
    logMessage('INFO', 'Marketplace routes registered');

    // Custom Trip Routes
    app.use('/api/custom-trips', customTripRoutes);
    console.log('✅ Custom Trip routes mounted at /api/custom-trips');
    logMessage('INFO', 'Custom Trip routes registered');

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

    // Users Routes (Username & Profile helpers)
    app.use('/api/users', usersRoutes);
    console.log('✅ Users routes mounted at /api/users');
    logMessage('INFO', 'Users routes registered');

    // Dashboard Routes (role-specific)
    app.use('/api/dashboard', dashboardRoutes);
    console.log('✅ Dashboard routes mounted at /api/dashboard');
    logMessage('INFO', 'Dashboard routes registered');

    // Organizer Routes
    app.use('/api/organizer', organizerRoutes);
    console.log('✅ Organizer routes mounted at /api/organizer');
    logMessage('INFO', 'Organizer routes registered');

    // Payment Verification Routes (Organizer QR code payment verification)
    app.use('/api/payment-verification', paymentVerificationRoutes);
    console.log('✅ Payment verification routes mounted at /api/payment-verification');
    logMessage('INFO', 'Payment verification routes registered');

    // Centralized Payment Routes
    app.use('/api/payments', paymentRoutes);
    console.log('✅ Payment routes mounted at /api/payments');
    logMessage('INFO', 'Payment routes registered');

    // Bank Details Routes (Simplified, no route onboarding)
    app.use('/api/bank-details', bankDetailsRoutes);
    console.log('✅ Bank details routes mounted at /api/bank-details');
    logMessage('INFO', 'Bank details routes registered');

    // Finance & Expense Routes (Organizer Profit/Loss)
    app.use('/api/finance', financeRoutes);
    console.log('✅ Finance routes mounted at /api/finance');
    logMessage('INFO', 'Finance routes registered');

    // Seed Routes under internal namespace
    app.use('/api/internal/seed', seedRoutes);

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

    // ==========================================
    // SEO & OpenGraph Injection Layer
    // ==========================================

    // 1. Robots.txt
    app.get('/robots.txt', (req, res) => {
      res.type('text/plain');
      res.send(`User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /dashboard\nDisallow: /api\nDisallow: /auth\n\nSitemap: https://trektribe.in/sitemap.xml`);
    });

    // 2. Sitemap.xml
    app.get('/sitemap.xml', async (req, res) => {
      try {
        const trips = await Trip.find({ status: { $ne: 'cancelled' }, verificationStatus: 'approved' })
          .select('slug updatedAt')
          .lean();

        const baseUrl = 'https://trektribe.in';

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/trips</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`;

        trips.forEach((trip: any) => {
          if (trip.slug) {
            xml += `
  <url>
    <loc>${baseUrl}/trips/${trip.slug}</loc>
    <lastmod>${new Date(trip.updatedAt).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`;
          }
        });

        xml += `
</urlset>`;

        res.header('Content-Type', 'application/xml');
        res.send(xml);
      } catch (error) {
        console.error('Sitemap generation error:', error);
        res.status(500).send('Error generating sitemap');
      }
    });

    // 3. Trip SEO Injection (Hijack /trips/:slug)
    // Only applies to requests accepting HTML (browsers/crawlers)
    app.get('/trips/:slug', async (req, res, next) => {
      // If it looks like a resource file, skip
      if (req.params.slug.includes('.')) return next();

      try {
        const trip = await Trip.findOne({ slug: req.params.slug }).lean();

        if (!trip) return next(); // Fallback to React app 404 handling

        // Read index.html
        // Assuming web build is in client/build or similar. Adjust path as needed.
        // In local dev, we might not have build folder, so this is primarily for production.
        const buildPath = process.env.CLIENT_BUILD_PATH || path.join(__dirname, '../../web/build');
        const indexPath = path.join(buildPath, 'index.html');

        if (!fs.existsSync(indexPath)) {
          // In dev or if build missing, fall through to normal handling
          return next();
        }

        let html = fs.readFileSync(indexPath, 'utf8');

        // Replace Meta Tags
        const title = `${trip.title} | TrekTribe`;
        const description = trip.description.substring(0, 160).replace(/"/g, '&quot;');
        const image = trip.coverImage || (trip.images && trip.images[0]) || 'https://trektribe.in/logo-192x192.png';
        const url = `https://trektribe.in/trips/${trip.slug}`;

        // Replace primary tags
        html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
        html = html.replace(/content="TrekTribe - Connect with amazing trip organizers.*?"/, `content="${description}"`);

        // Replace OG tags (using regex to be safe against formatting changes)
        html = html.replace(/property="og:title" content=".*?"/, `property="og:title" content="${title}"`);
        html = html.replace(/property="og:description" content=".*?"/, `property="og:description" content="${description}"`);
        html = html.replace(/property="og:image" content=".*?"/, `property="og:image" content="${image}"`); // Add this if missing in template

        // Ensure image tag exists if replacement failed
        if (!html.includes('property="og:image"')) {
          html = html.replace('</head>', `<meta property="og:image" content="${image}" />\n</head>`);
        }

        res.send(html);

      } catch (error) {
        console.error('SEO Injection Error:', error);
        next();
      }
    });

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

// Start the application unless auto-start was disabled (used by dev helpers)
if (process.env.DISABLE_AUTO_START !== 'true') {
  start();
}
