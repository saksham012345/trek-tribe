import { MongoMemoryServer } from 'mongodb-memory-server';
import { join as pathJoin } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import mongoose from 'mongoose';
// Import Jest globals to satisfy TypeScript typings for lifecycle hooks
import { beforeAll, afterAll, jest } from '@jest/globals';
import { prisma } from '../lib/prisma';

let mongoServer: MongoMemoryServer;
let instanceDbPath: string | undefined;
/**
 * Start an in-memory MongoDB on a port Windows will let us bind, retrying if
 * the one we picked is taken.
 *
 * Windows reserves whole blocks of high ports for Hyper-V and WSL - see
 * `netsh interface ipv4 show excludedportrange protocol=tcp`. Landing inside
 * one gives EACCES. 27100+ is below every reserved block on this machine and
 * above the default mongod port, so a real local mongod does not collide.
 */
async function startMongo(attempts = 5): Promise<MongoMemoryServer> {
  let lastError: unknown;

  // Keep the data files off the system drive.
  //
  // mongodb-memory-server writes them under os.tmpdir(), which is on C:. When C:
  // ran down to 240 MB, every suite failed with "spawn UNKNOWN" or "Instance
  // failed to start within 10000ms" - nine suites and 93 tests in one run, none
  // of it anything to do with the code. The repo lives on D:, which has room, so
  // the data files go beside it.
  //
  // MONGOMS_DOWNLOAD_DIR moves the cached mongod binary for the same reason.
  const dataRoot = pathJoin(__dirname, '..', '..', '.mongo-test-data');
  if (!existsSync(dataRoot)) {
    mkdirSync(dataRoot, { recursive: true });
  }
  process.env.MONGOMS_DOWNLOAD_DIR =
    process.env.MONGOMS_DOWNLOAD_DIR || pathJoin(dataRoot, 'binaries');

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const port = 27100 + Math.floor(Math.random() * 400);
    const dbPath = pathJoin(dataRoot, `instance-${process.pid}-${port}`);
    instanceDbPath = dbPath;
    try {
      mkdirSync(dbPath, { recursive: true });
      const server = await MongoMemoryServer.create({
        instance: { port, dbPath, storageEngine: 'wiredTiger' }
      });
      if (attempt > 1) {
        console.log(`mongodb-memory-server started on port ${port} after ${attempt} attempts`);
      }
      return server;
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Could not start mongodb-memory-server after ${attempts} attempts. ` +
    `Last error: ${(lastError as Error)?.message}`
  );
}


// Set a generous timeout before any hooks run (Windows/CI friendly)
jest.setTimeout(60000);

// Setup before all tests
beforeAll(async () => {
  // Create in-memory MongoDB instance (downloads binaries if needed).
  //
  // A single random port with no retry was not enough. Twenty-nine suites each
  // start their own instance one after another, and a port the previous suite
  // just released can still be in TIME_WAIT - the new mongod then dies with
  // "Instance closed unexpectedly with code 14" and takes the whole suite with
  // it. That is a flake that looks exactly like a real failure, and it cost a
  // full verification run to identify.
  //
  // So: try a few ports before giving up, and say which one worked if it took
  // more than one attempt.
  mongoServer = await startMongo();
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

  // And Prisma. This was missing from the moment the first model moved to
  // Postgres: every suite that touches Prisma opened a connection pool that
  // nothing closed, so jest finished its tests and then sat there with an open
  // handle until something killed it. The tests were passing in thirty seconds
  // and the command was taking ten minutes.
  await prisma.$disconnect();

  // Remove this suite's data directory. mongoServer.stop() deletes the one it
  // created under tmpdir, but it does not own the one we pointed it at, so
  // without this they pile up on the repo drive - a few hundred MB per full run.
  if (instanceDbPath && existsSync(instanceDbPath)) {
    rmSync(instanceDbPath, { recursive: true, force: true });
  }
});

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-should-be-very-long-1234567890';
process.env.RAZORPAY_KEY_ID = 'test_razorpay_key';
process.env.RAZORPAY_KEY_SECRET = 'test_razorpay_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'test_webhook_secret';
