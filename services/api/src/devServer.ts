import 'dotenv/config';
import path from 'path';

async function startMemoryAndApi() {
  console.log('🧪 Starting in-memory MongoDB for dev...');

  // Dynamically import mongodb-memory-server to avoid bundling/dev-only deps
  // into production builds where devDependencies are pruned.
  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const mongod = await MongoMemoryServer.create({ instance: { dbName: 'trektribe_dev' } });
  const uri = mongod.getUri();
  console.log(`🧪 MongoDB memory server running at ${uri}`);

  // Set env vars for the API process
  process.env.MONGODB_URI = uri;
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
  process.env.DISABLE_AUTO_START = 'true';
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    process.env.JWT_SECRET = 'dev-jwt-secret-0123456789abcdefghijklmnop';
    console.log('ℹ️  Using dev JWT secret');
  }

  // Spawn the API process with the in-memory MongoDB URI set in env
  console.log('ℹ️  Spawning API process (node dist/index.js) with in-memory MongoDB');
  const { spawn } = await import('child_process');
  const apiEnv = { ...process.env, MONGODB_URI: uri } as any;
  const child = spawn('node', ['dist/index.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: apiEnv,
    stdio: 'inherit'
  });

  child.on('exit', (code) => {
    console.log(`API process exited with code ${code}`);
    process.exit(code === null ? 1 : code);
  });

  // On process exit, stop mongod
  const shutdown = async () => {
    console.log('🛑 Shutting down in-memory MongoDB');
    try { await mongod.stop(); } catch (e) { /* ignore */ }
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

startMemoryAndApi().catch(err => {
  console.error('❌ Dev server failed:', err);
  process.exit(1);
});
