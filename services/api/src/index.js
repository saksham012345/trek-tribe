require('dotenv').config();
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const session = require('express-session');
const mongoose = require('mongoose');
const { createServer } = require('http');
const { socketService } = require('./services/socketService');
const authRoutes = require('./routes/auth');
const tripRoutes = require('./routes/trips');
const reviewRoutes = require('./routes/reviews');
const wishlistRoutes = require('./routes/wishlist');
const fileRoutes = require('./routes/files');
const viewRoutes = require('./routes/views');
const organizerRoutes = require('./routes/organizer');
const bookingRoutes = require('./routes/bookings');
const adminRoutes = require('./routes/admin');
const agentRoutes = require('./routes/agent');
const supportRoutes = require('./routes/support');

const app = express();

// Set EJS as view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Enhanced error handling middleware
const asyncErrorHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Request timeout middleware
const timeoutMiddleware = (req, res, next) => {
  req.setTimeout(30000); // 30 seconds timeout
  res.setTimeout(30000);
  next();
};

// Request logging middleware
const requestLogger = (req, res, next) => {
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
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for EJS templates
}));
app.use(cors({ 
  origin: process.env.NODE_ENV === 'production' ? [
    'https://www.trektribe.in',
    'https://trektribe.in',
    'https://trek-tribe.vercel.app',
    process.env.FRONTEND_URL || 'https://trek-tribe-web.onrender.com',
    process.env.CORS_ORIGIN || 'https://trek-tribe-web.onrender.com',
    'https://trek-tribe-38in.onrender.com'
  ] : '*',
  credentials: true 
}));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files
app.use('/static', express.static(path.join(__dirname, 'public')));

// Simple logging function
const logMessage = (level, message) => {
  console.log(`${new Date().toISOString()} [${level}] ${message}`);
};

// Global error handler
const globalErrorHandler = (error, req, res, next) => {
  console.error('🚨 Unhandled error:', error);
  
  // Log error
  logMessage('ERROR', `${req.method} ${req.path} - ${error.message}`);
  
  if (res.headersSent) {
    return next(error);
  }
  
  const statusCode = error.statusCode || 500;
  
  // If it's an API request, return JSON
  if (req.path.startsWith('/api/') || req.xhr || req.get('Content-Type') === 'application/json') {
    return res.status(statusCode).json({
      error: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : error.message,
      ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
    });
  }
  
  // Otherwise render error page
  res.status(statusCode).render('error', {
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message,
    statusCode,
    user: req.session.user || null
  });
};

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000;
const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/trekktribe';

// Enhanced database connection with retry logic
const connectToDatabase = async (retries = 5) => {
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
    } catch (error) {
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
    
    // View routes (main application pages)
    app.use('/', viewRoutes);
    
    // API Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/trips', tripRoutes);
    app.use('/api/reviews', reviewRoutes);
    app.use('/api/wishlist', wishlistRoutes);
    app.use('/api/files', fileRoutes);
    app.use('/api/organizer', organizerRoutes);
    app.use('/api/bookings', bookingRoutes);
    app.use('/api/admin', adminRoutes);
    app.use('/api/agent', agentRoutes);
    app.use('/api/support', supportRoutes);
    
    // Health check endpoint with detailed info
    app.get('/health', asyncErrorHandler(async (req, res) => {
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
          status: statusMap[mongoStatus],
          ping: dbTest ? 'successful' : 'failed'
        },
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version
      };
      
      res.json(health);
    }));
    
    // 404 handler
    app.use('*', (req, res) => {
      if (req.path.startsWith('/api/')) {
        res.status(404).json({ 
          error: 'Route not found',
          path: req.originalUrl,
          method: req.method
        });
      } else {
        res.status(404).render('404', { 
          user: req.session.user || null,
          path: req.originalUrl
        });
      }
    });
    
    // Apply global error handler
    app.use(globalErrorHandler);
    
    // Create HTTP server
    const server = createServer(app);
    
    // Initialize Socket.IO
    socketService.initialize(server);
    
    // Start server with error handling
    server.listen(port, () => {
      console.log(`🚀 API listening on http://localhost:${port}`);
      console.log(`📊 Health check: http://localhost:${port}/health`);
      console.log(`🔌 Socket.IO initialized at http://localhost:${port}/socket.io/`);
      logMessage('INFO', `Server started on port ${port}`);
    });
    
    // Graceful shutdown handling
    const gracefulShutdown = async (signal) => {
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
        } catch (dbError) {
          console.error('❌ Error closing database:', dbError);
          logMessage('ERROR', `Error closing database: ${dbError.message}`);
          process.exit(1);
        }
      });
    };
    
    // Handle process signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    logMessage('ERROR', `Failed to start server: ${err.message}`);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  logMessage('CRITICAL', `Uncaught Exception: ${error.message}`);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  logMessage('CRITICAL', `Unhandled Rejection: ${reason}`);
  process.exit(1);
});

// Start the application
start();
