# Trek Tribe: Complete Node.js & Express.js Learning Guide

This document serves as both a comprehensive guide to the implemented features and a learning resource for Node.js and Express.js concepts demonstrated in the Trek Tribe travel platform.

## 🏗️ Architecture Overview

Trek Tribe is a full-stack travel platform that demonstrates advanced Node.js and Express.js concepts through real-world implementation:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Web     │────│   Express API   │────│    MongoDB      │
│   (Port 3000)   │    │   (Port 4000)   │    │   (Port 27017)  │
│                 │    │                 │    │                 │
│ • Reviews       │    │ • Authentication│    │ • Users         │
│ • Wishlist      │    │ • File Upload   │    │ • Trips         │
│ • Trip Browse   │    │ • Error Handler │    │ • Reviews       │
│ • File Upload   │    │ • CLI Tools     │    │ • Wishlists     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📚 Node.js Concepts Covered

### 1. Introduction to Node.js

**Node.js vs Browser JavaScript Differences**
```javascript
// Node.js specific globals (not available in browser)
console.log(__dirname);  // Current directory path
console.log(__filename); // Current file path
console.log(process.env); // Environment variables
console.log(process.argv); // Command line arguments

// Example in services/api/src/cli/trek-admin.ts
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/trekktribe';
```

**Installing & Running Node.js Code**
```bash
# Package management
npm install                    # Install dependencies
npm run dev                   # Development mode
npm run build                 # Build for production
npm start                     # Run production

# CLI tools we created
npm run cli:help              # Show CLI help
npm run cli:stats             # Database statistics
npm run cli:user:list         # List users
```

### 2. Modules & Module Systems

**CommonJS vs ES Modules**
```typescript
// ES6 Modules (used throughout the project)
import express from 'express';
import { User } from '../models/User';
export default router;
export { AuthenticationError, ValidationError };

// CommonJS equivalent (legacy)
const express = require('express');
const { User } = require('../models/User');
module.exports = router;
```

**Creating Custom Modules**
- `services/api/src/utils/errors.ts` - Custom error handling
- `services/api/src/utils/logger.ts` - Logging utilities
- `services/api/src/utils/fileHandler.ts` - File operations

### 3. npm Package Management

**Package.json Management**
```json
{
  "name": "trekk-tribe-api",
  "scripts": {
    "dev": "nodemon --watch src --exec ts-node src/index.ts",
    "cli": "ts-node src/cli/trek-admin.ts"
  },
  "dependencies": {
    "express": "^4.19.2",
    "mongoose": "^8.5.1",
    "commander": "^11.1.0"
  }
}
```

**Semantic Versioning**
- `^4.19.2` - Compatible with 4.x.x, allows updates to 4.20.0 but not 5.0.0
- `~4.19.2` - Compatible with 4.19.x, allows 4.19.3 but not 4.20.0
- `4.19.2` - Exact version only

### 4. Error Handling in Node.js

**Synchronous vs Asynchronous Errors**
```typescript
// services/api/src/utils/errors.ts
export class AppError extends Error {
  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = this.constructor.name;
    
    // Maintain stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});
```

**Call Stack & Stack Trace Analysis**
```typescript
// Custom error with detailed stack information
const error = new AppError('Database connection failed', 500);
console.log(error.stack); // Shows full call stack
```

**Debugging Tools**
- Chrome DevTools integration with `--inspect` flag
- VS Code debugging configuration
- Console logging with structured data

### 5. Asynchronous Programming

**Event Loop, Callbacks, Promises, Async/Await**
```typescript
// Promise.all for parallel operations (services/api/src/routes/reviews.ts)
const [reviews, totalCount] = await Promise.all([
  Review.find(filter).populate('reviewerId').sort(sort),
  Review.countDocuments(filter)
]);

// Promise.race for timeout handling
const result = await Promise.race([
  databaseOperation(),
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Timeout')), 10000)
  )
]);

// Error handling in async functions
try {
  await someAsyncOperation();
} catch (error) {
  throw new DatabaseError('Operation failed', error);
}
```

### 6. File Handling

**Reading & Writing Files (Sync & Async)**
```typescript
// services/api/src/utils/fileHandler.ts
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';

// Async file operations
await fs.writeFile(fullPath, buffer);
const content = await fs.readFile(filePath, 'utf-8');

// Stream operations for large files
const readStream = createReadStream(filePath);
const writeStream = createWriteStream(outputPath);
await pipeline(readStream, writeStream);
```

**Streams & Buffers**
```typescript
// File upload with streaming
async saveStreamToFile(
  stream: NodeJS.ReadableStream,
  originalName: string,
  mimeType: string
) {
  const writeStream = createWriteStream(fullPath);
  const hash = crypto.createHash('sha256');
  
  stream.on('data', (chunk: Buffer) => {
    hash.update(chunk);
  });
  
  await pipeline(stream, writeStream);
  return hash.digest('hex');
}
```

### 7. Command-Line Apps

**Using process.argv**
```typescript
// services/api/src/cli/trek-admin.ts
console.log(process.argv); // ['node', 'script.js', ...args]

// Environment variables
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/db';
```

**CLI Utilities with Commander**
```typescript
import { Command } from 'commander';

const program = new Command();
program
  .name('trek-admin')
  .description('Trek Tribe administration CLI tool')
  .version('1.0.0');

program
  .command('stats')
  .description('Show system statistics')
  .action(showStats);

program.parse(process.argv);
```

### 8. Interacting with APIs

**HTTP/HTTPS Modules**
```typescript
// Built-in HTTP client (basic example)
import https from 'https';

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log(data));
});
```

**Fetching Data with Axios**
```typescript
// Used in frontend (web/src/App.tsx)
import axios from 'axios';

axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:4000';
const response = await axios.post('/trips', tripData);
```

### 9. Keeping Applications Running

**Using nodemon for Development**
```json
// package.json
{
  "scripts": {
    "dev": "nodemon --watch src --exec ts-node src/index.ts"
  }
}
```

**PM2 for Production** (example configuration)
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'trek-tribe-api',
    script: 'dist/index.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
```

**Crash Recovery and Logging**
```typescript
// services/api/src/utils/logger.ts
export class Logger {
  async error(message: string, meta?: any): Promise<void> {
    const entry = this.formatLogEntry('error', message, meta);
    console.error(this.formatConsoleOutput(entry));
    await this.writeToFile(entry);
  }
}
```

## 🚀 Express.js Concepts Covered

### 1. Express.js Basics

**Setting up a Server**
```typescript
// services/api/src/index.ts
import express from 'express';

const app = express();
const port = process.env.PORT || 4000;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
```

**Routing & RESTful APIs**
```typescript
// services/api/src/routes/reviews.ts
router.get('/', asyncHandler(async (req, res) => {
  // GET /reviews - List reviews
}));

router.post('/', authenticateJwt, asyncHandler(async (req, res) => {
  // POST /reviews - Create review
}));

router.put('/:id', authenticateJwt, asyncHandler(async (req, res) => {
  // PUT /reviews/:id - Update review
}));

router.delete('/:id', authenticateJwt, asyncHandler(async (req, res) => {
  // DELETE /reviews/:id - Delete review
}));
```

**Response Methods**
```typescript
// Different response types
res.json({ data: 'JSON response' });
res.status(201).json({ created: true });
res.status(404).json({ error: 'Not found' });
res.send('Plain text response');
res.redirect('/other-route');
```

### 2. Middleware in Express

**Application-level Middleware**
```typescript
// services/api/src/index.ts
app.use(helmet());                    // Security headers
app.use(cors({ credentials: true })); // CORS handling
app.use(express.json({ limit: '10mb' })); // JSON parsing
app.use(requestLogger);               // Custom logging
```

**Router-level Middleware**
```typescript
// services/api/src/routes/files.ts
const fileSizeLimit = (maxSize: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = req.headers['content-length'];
    if (contentLength && parseInt(contentLength) > maxSize) {
      return res.status(413).json({ error: 'File too large' });
    }
    next();
  };
};

router.use(fileSizeLimit(10 * 1024 * 1024)); // 10MB limit
```

**Error-handling Middleware**
```typescript
// services/api/src/utils/errors.ts
export const globalErrorHandler = (
  error: any, 
  req: any, 
  res: any, 
  next: any
) => {
  const processedError = ErrorHandler.processError(error);
  res.status(processedError.statusCode).json({
    error: processedError.message,
    ...(process.env.NODE_ENV !== 'production' && {
      stack: processedError.stack
    })
  });
};
```

**Third-party Middleware**
- `helmet` - Security headers
- `cors` - Cross-origin resource sharing
- `morgan` - HTTP request logger (alternative logging)

### 3. Error Handling in Express

**Centralized Error Handling**
```typescript
// services/api/src/routes/reviews.ts
router.use((error: any, req: Request, res: Response, next: NextFunction) => {
  if (error.name === 'ValidationError') {
    return res.status(400).json({ 
      error: 'Validation failed',
      details: error.message
    });
  }
  next(error); // Pass to global handler
});
```

**Custom Error Classes**
```typescript
export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND');
  }
}
```

**Handling Async Errors**
```typescript
export const asyncErrorHandler = (fn: Function) => {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Usage
router.get('/', asyncErrorHandler(async (req, res) => {
  const data = await someAsyncOperation();
  res.json(data);
}));
```

## 🎯 Advanced Features Implemented

### 1. Reviews & Ratings System
**File**: `services/api/src/models/Review.ts`, `services/api/src/routes/reviews.ts`

**Key Concepts Demonstrated**:
- MongoDB schema design with validation
- Aggregation pipelines for statistics
- Mongoose middleware (pre/post hooks)
- Static and instance methods
- Complex querying with population

```typescript
// Calculate average rating using aggregation
reviewSchema.statics.calculateAverageRating = async function(targetId, reviewType) {
  const result = await this.aggregate([
    { $match: { targetId, reviewType, isVerified: true } },
    { $group: { _id: null, averageRating: { $avg: '$rating' } }}
  ]);
  return result;
};
```

### 2. Wishlist & Favorites
**File**: `services/api/src/models/Wishlist.ts`, `services/api/src/routes/wishlist.ts`

**Key Concepts Demonstrated**:
- Complex aggregation with $lookup joins
- Compound indexes for performance
- Instance methods for document operations
- Advanced MongoDB queries

```typescript
// Join wishlist with trip and organizer data
const pipeline = [
  { $match: matchStage },
  { $lookup: { from: 'trips', localField: 'tripId', foreignField: '_id', as: 'trip' }},
  { $lookup: { from: 'users', localField: 'trip.organizerId', foreignField: '_id', as: 'organizer' }}
];
```

### 3. Enhanced Error Handling
**File**: `services/api/src/utils/errors.ts`

**Key Concepts Demonstrated**:
- Custom error class inheritance
- Stack trace preservation
- Global error handling
- Process signal handling
- Graceful shutdown

```typescript
export class GracefulShutdown {
  private setupSignalHandlers() {
    process.on('SIGTERM', () => this.shutdown('SIGTERM'));
    process.on('SIGINT', () => this.shutdown('SIGINT'));
  }
}
```

### 4. File Handling & Media Gallery
**File**: `services/api/src/utils/fileHandler.ts`, `services/api/src/routes/files.ts`

**Key Concepts Demonstrated**:
- Stream-based file operations
- Buffer manipulation
- Crypto operations (checksums)
- File validation and security
- Base64 encoding/decoding

```typescript
// Stream file upload with checksum calculation
async saveStreamToFile(stream, originalName, mimeType) {
  const hash = crypto.createHash('sha256');
  stream.on('data', (chunk) => hash.update(chunk));
  await pipeline(stream, writeStream);
  return hash.digest('hex');
}
```

### 5. CLI Tools & Command-Line Apps
**File**: `services/api/src/cli/trek-admin.ts`

**Key Concepts Demonstrated**:
- Commander.js for CLI interfaces
- Process argument parsing
- Database operations from CLI
- Colored console output
- Data backup/restore functionality

```bash
# CLI Usage Examples
npm run cli:stats                    # System statistics
npm run cli -- user list --role admin
npm run cli -- backup data-backup.json
npm run cli -- cleanup
```

### 6. Logging System
**File**: `services/api/src/utils/logger.ts`

**Key Concepts Demonstrated**:
- Structured logging
- File stream management
- Log rotation and cleanup
- Request tracking with IDs
- Performance monitoring

```typescript
// Request logging middleware
requestLogger() {
  return (req, res, next) => {
    const requestId = req.headers['x-request-id'] || Math.random().toString(36);
    const start = Date.now();
    // Log request completion with timing
  };
}
```

## 🔧 Development Workflow

### 1. Running the Application

**Full Docker Environment**:
```bash
npm run dev  # Starts all services with docker-compose
```

**Individual Services**:
```bash
npm run install:all    # Install dependencies
npm run dev:api       # Start API server (Terminal 1)
npm run dev:web       # Start web app (Terminal 2)
```

### 2. Using CLI Tools

```bash
# Database management
npm run cli:stats                           # Show statistics
npm run cli -- user list --limit 5         # List 5 users
npm run cli -- user create admin@test.com "Admin User" admin password123
npm run cli -- trip list --status active   # List active trips

# Data operations
npm run cli -- backup my-backup.json       # Backup data
npm run cli -- restore my-backup.json --force
npm run cli -- cleanup                     # System cleanup

# Log analysis
npm run cli -- logs --errors              # Show recent errors
```

### 3. File Operations

```bash
# Test file upload via API
curl -X POST http://localhost:4000/files/demo/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "base64", "filename": "test.txt", "content": "Hello World"}'

# List files
curl http://localhost:4000/files?limit=10

# Get file info
curl http://localhost:4000/files/FILENAME/info
```

## 📊 Testing the Implementation

### 1. API Testing Scripts

The project includes several testing scripts:
- `test-connection.js` - Database connectivity
- `test-file-upload.js` - File operations
- `test-frontend-backend.js` - Integration testing

### 2. Manual Testing Checklist

**Authentication**:
- [ ] User registration with different roles
- [ ] JWT token validation
- [ ] Protected route access

**Reviews & Ratings**:
- [ ] Create review for completed trip
- [ ] Calculate average ratings
- [ ] Organizer responses to reviews

**File Upload**:
- [ ] Base64 file upload
- [ ] Binary file upload  
- [ ] File serving with caching headers
- [ ] File metadata retrieval

**CLI Tools**:
- [ ] Database statistics
- [ ] User management
- [ ] Data backup/restore
- [ ] System cleanup

## 🎓 Learning Outcomes

After working through this implementation, you should understand:

### Node.js Fundamentals
- ✅ Event loop and asynchronous programming
- ✅ Module system (CommonJS vs ES6)
- ✅ File system operations
- ✅ Process management and environment variables
- ✅ Command-line application development
- ✅ Error handling patterns

### Express.js Concepts
- ✅ RESTful API design
- ✅ Middleware patterns and custom middleware
- ✅ Error handling middleware
- ✅ Request/response lifecycle
- ✅ Router organization

### Database Integration
- ✅ MongoDB with Mongoose ODM
- ✅ Schema design and validation
- ✅ Aggregation pipelines
- ✅ Indexing strategies
- ✅ Population and references

### Advanced Topics
- ✅ File handling with streams and buffers
- ✅ Authentication with JWT
- ✅ Logging and monitoring
- ✅ CLI tool development
- ✅ Data backup and restoration

### Best Practices
- ✅ Error handling and recovery
- ✅ Security considerations
- ✅ Performance optimization
- ✅ Code organization and modularity
- ✅ Documentation and testing

## 🚀 Next Steps for Learning

1. **Add Testing**: Implement unit and integration tests with Jest
2. **Security Enhancements**: Add rate limiting, input sanitization
3. **Performance**: Implement caching with Redis
4. **Deployment**: Set up CI/CD pipelines
5. **Monitoring**: Add APM tools like New Relic or DataDog
6. **Microservices**: Break into smaller services
7. **Real-time Features**: Add WebSocket support
8. **Payment Integration**: Add Stripe or PayPal integration

This implementation serves as a comprehensive foundation for understanding Node.js and Express.js development in a real-world application context.
