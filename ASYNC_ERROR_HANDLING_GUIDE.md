# 🚀 Node.js Async Programming & Error Handling Guide

This project demonstrates comprehensive **asynchronous programming** and **error handling** in Node.js with real-world examples.

## 📋 Table of Contents

1. [Error Handling Features](#-error-handling-features)
2. [Asynchronous Programming Examples](#-asynchronous-programming-examples)
3. [File System Operations](#-file-system-operations)
4. [Command-Line Applications](#-command-line-applications)
5. [Database Operations with Error Handling](#-database-operations)
6. [Testing the Implementation](#-testing-the-implementation)

---

## 🛡️ Error Handling Features

### 1. **Uncaught Exception Handling**
```typescript
// Location: services/api/src/index.ts (lines 233-237)
process.on('uncaughtException', async (error: Error) => {
  console.error('🚨 Uncaught Exception:', error);
  await logToFile('CRITICAL', `Uncaught Exception: ${error.message}`);
  process.exit(1);
});
```

### 2. **Unhandled Promise Rejection Handling**
```typescript
// Location: services/api/src/index.ts (lines 239-244)
process.on('unhandledRejection', async (reason: any, promise: Promise<any>) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
  await logToFile('CRITICAL', `Unhandled Rejection: ${reason}`);
  process.exit(1);
});
```

### 3. **Express.js Error Middleware**
```typescript
// Location: services/api/src/index.ts (lines 81-98)
const globalErrorHandler = (error: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('🚨 Unhandled error:', error);
  
  // Log error to file asynchronously
  logToFile('ERROR', `${req.method} ${req.path} - ${error.message}`);
  
  const statusCode = (error as any).statusCode || 500;
  res.status(statusCode).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : error.message
  });
};
```

### 4. **Frontend Error Handling**
```typescript
// Location: web/src/pages/CreateTrip.tsx (lines 129-156)
catch (error: any) {
  console.error('Error creating trip:', error);
  
  let errorMessage = 'Failed to create trip';
  
  if (error.message) {
    errorMessage = error.message;
  } else if (error.response?.data?.error) {
    // Handle API validation errors
    if (typeof error.response.data.error === 'string') {
      errorMessage = error.response.data.error;
    } else if (error.response.data.error.fieldErrors) {
      const fieldErrors = error.response.data.error.fieldErrors;
      const firstError = Object.values(fieldErrors)[0];
      errorMessage = Array.isArray(firstError) ? firstError[0] : firstError;
    }
  } else if (error.response?.status === 401) {
    errorMessage = 'Authentication required. Please log in again.';
  }
  
  setError(errorMessage);
}
```

---

## ⚡ Asynchronous Programming Examples

### 1. **Database Connection with Retry Logic**
```typescript
// Location: services/api/src/index.ts (lines 104-131)
const connectToDatabase = async (retries = 5): Promise<void> => {
  for (let i = 1; i <= retries; i++) {
    try {
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        maxPoolSize: 10,
        minPoolSize: 2,
      });
      return;
    } catch (error: any) {
      if (i === retries) {
        throw new Error(`Failed to connect after ${retries} attempts`);
      }
      
      // Exponential backoff
      const waitTime = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
};
```

### 2. **Promise.all for Parallel Operations**
```typescript
// Location: services/api/src/cli/trip-manager.ts (lines 205-219)
const [
  totalTrips,
  activeTrips,
  totalUsers,
  organizerCount,
  avgPrice
] = await Promise.all([
  Trip.countDocuments(),
  Trip.countDocuments({ status: 'active' }),
  User.countDocuments(),
  User.countDocuments({ role: 'organizer' }),
  Trip.aggregate([
    { $group: { _id: null, avgPrice: { $avg: '$price' } } }
  ])
]);
```

### 3. **Promise.race for Timeout Handling**
```typescript
// Location: services/api/src/routes/trips.ts (lines 75-79)
const timeoutPromise = new Promise((_, reject) => 
  setTimeout(() => reject(new Error('Database operation timeout')), 10000)
);

const trip = await Promise.race([createPromise, timeoutPromise]);
```

### 4. **Frontend Request with Timeout**
```typescript
// Location: web/src/pages/CreateTrip.tsx (lines 108-117)
const response = await Promise.race([
  axios.post('/trips', tripData, {
    headers: { 'Content-Type': 'application/json' }
  }),
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Request timeout - please try again')), 10000)
  )
]);
```

---

## 📁 File System Operations

### 1. **Async Directory Creation**
```typescript
// Location: services/api/src/utils/fileHandler.ts (lines 17-30)
export const initializeFileStorage = async (): Promise<void> => {
  try {
    await fs.access(FILE_BASE_DIR);
    console.log('📂 File storage directory exists');
  } catch (error) {
    try {
      await fs.mkdir(FILE_BASE_DIR, { recursive: true });
      console.log('📂 Created file storage directory');
    } catch (mkdirError) {
      throw new Error(`Failed to create upload directory: ${mkdirError.message}`);
    }
  }
};
```

### 2. **Async File Reading & Writing**
```typescript
// Location: services/api/src/utils/fileHandler.ts (lines 76-85)
export const readFile = async (fileName: string): Promise<Buffer> => {
  const filePath = path.join(FILE_BASE_DIR, fileName);
  
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    console.error('❌ Failed to read file:', error);
    throw new Error(`Failed to read file: ${error.message}`);
  }
};
```

### 3. **Async Logging**
```typescript
// Location: services/api/src/index.ts (lines 69-78)
const logToFile = async (level: string, message: string): Promise<void> => {
  const logFile = path.join(__dirname, '../logs', `${new Date().toISOString().split('T')[0]}.log`);
  const logEntry = `${new Date().toISOString()} [${level}] ${message}\\n`;
  
  try {
    await fs.appendFile(logFile, logEntry);
  } catch (error) {
    console.error('❌ Failed to write to log file:', error);
  }
};
```

### 4. **Parallel File Operations**
```typescript
// Location: services/api/src/utils/fileHandler.ts (lines 199-219)
export const readMultipleFilesInParallel = async (
  fileNames: string[]
): Promise<{ [key: string]: Buffer }> => {
  const filePromises = fileNames.map(async (fileName) => {
    const content = await readFile(fileName);
    return { fileName, content };
  });
  
  const results = await Promise.all(filePromises);
  
  return results.reduce((acc, { fileName, content }) => {
    acc[fileName] = content;
    return acc;
  }, {} as { [key: string]: Buffer });
};
```

---

## 💻 Command-Line Applications

### 1. **CLI Trip Manager**
```bash
# Location: services/api/src/cli/trip-manager.ts

# List trips
npm run cli:list

# Show statistics  
npm run cli:stats

# Export data
npm run cli -- export trips-backup.json

# Create trip from JSON
npm run cli -- create sample-trip.json

# Delete trip
npm run cli -- delete <trip-id>
```

### 2. **CLI Features Demonstrated**
- ✅ Command parsing with `commander`
- ✅ Colored console output
- ✅ File I/O operations
- ✅ Database operations
- ✅ Error handling with proper exit codes
- ✅ Async/await patterns
- ✅ Progress reporting

---

## 🗄️ Database Operations

### 1. **Enhanced Error Handling in Routes**
```typescript
// Location: services/api/src/routes/trips.ts (lines 100-127)
if (error.code === 11000) {
  return res.status(409).json({ 
    error: 'Trip with this title already exists' 
  });
}

if (error.name === 'ValidationError') {
  const errorMessages = Object.values(error.errors)
    .map((err: any) => err.message)
    .join(', ');
  return res.status(400).json({ 
    error: 'Database validation failed',
    details: errorMessages
  });
}
```

### 2. **Connection Health Monitoring**
```typescript
// Location: services/api/src/index.ts (lines 150-175)
app.get('/health', asyncErrorHandler(async (_req: Request, res: Response) => {
  const mongoStatus = mongoose.connection.readyState;
  const dbTest = await mongoose.connection.db.admin().ping();
  
  const health = {
    status: 'ok',
    mongodb: {
      status: statusMap[mongoStatus],
      ping: dbTest ? 'successful' : 'failed'
    },
    uptime: process.uptime(),
    memory: process.memoryUsage()
  };
  
  res.json(health);
}));
```

---

## 🧪 Testing the Implementation

### 1. **Test Error Handling**
```bash
# Start the backend
cd services/api
npm run dev

# Test the frontend  
cd web
npm start

# Try creating a trip with invalid data to see error handling
# Try creating a trip with past dates
# Try creating without authentication
```

### 2. **Test CLI Commands**
```bash
cd services/api

# Install dependencies first
npm install

# Test CLI commands
npm run cli:help
npm run cli:list
npm run cli:stats
```

### 3. **Test File Operations**
```bash
# The file operations are automatically tested when:
# - Server starts (log directory creation)
# - Errors occur (async logging)
# - CLI export command is used
```

### 4. **Test Async Features**
```bash
# Multiple parallel requests to test Promise.all
curl -X GET http://localhost:4000/trips
curl -X GET http://localhost:4000/health

# Test timeout handling by creating trips with large data
# Test retry logic by temporarily stopping MongoDB
```

---

## 🎯 Key Learning Outcomes

This implementation covers:

✅ **Uncaught Exception Handling** - Global process handlers  
✅ **Unhandled Promise Rejections** - Proper cleanup and logging  
✅ **Async File Operations** - fs.promises API usage  
✅ **Error Stack Traces** - Comprehensive error logging  
✅ **Debugging Tools** - Enhanced logging and monitoring  
✅ **Promise.all** - Parallel async operations  
✅ **Promise.race** - Timeout implementations  
✅ **Command-line Apps** - Full-featured CLI with commander  
✅ **Database Retry Logic** - Resilient connections  
✅ **Request Timeouts** - Both frontend and backend  
✅ **Graceful Shutdown** - Process signal handling  

---

## 🔧 Additional Features

- **Request Logging**: Every API request is logged with timing
- **Memory Monitoring**: Health endpoint shows memory usage
- **Graceful Shutdown**: Proper cleanup on SIGTERM/SIGINT
- **Production Error Handling**: Different error responses for prod vs dev
- **File Upload Simulation**: Base64 file handling examples
- **Data Export/Import**: CLI commands for data management

This implementation provides a comprehensive foundation for understanding Node.js asynchronous programming and error handling patterns in real-world applications.
