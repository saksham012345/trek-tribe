import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
// Import Jest globals to satisfy TypeScript typings for lifecycle hooks
import { beforeAll, afterAll, jest } from '@jest/globals';

let mongoServer: MongoMemoryServer;

// Set a generous timeout before any hooks run (Windows/CI friendly)
jest.setTimeout(60000);

// Setup before all tests
beforeAll(async () => {
  // Create in-memory MongoDB instance (downloads binaries if needed)
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();

  // Share URI with application code (including serverless handlers) to avoid
  // mixed connection strings that trigger openUri collisions.
  process.env.MONGODB_URI = mongoUri;

  // Connect to in-memory database
  await mongoose.connect(mongoUri);

  // Ensure a clean slate before the test suite runs
  if (mongoose.connection.db) {
    await mongoose.connection.db.dropDatabase();
  }
});

// Note: We intentionally do NOT clear collections after each test.
// Many suites (e.g., comprehensive) rely on state across multiple tests.
// Individual test files mount isolated Express apps; we perform a full
// cleanup only once after all tests finish.

// Cleanup after all tests
afterAll(async () => {
  // Disconnect and stop MongoDB server
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-should-be-very-long-1234567890';
process.env.RAZORPAY_KEY_ID = 'test_razorpay_key';
process.env.RAZORPAY_KEY_SECRET = 'test_razorpay_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret';
