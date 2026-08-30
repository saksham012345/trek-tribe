/**
 * Boot the compiled server exactly as production runs it.
 *
 * Every other suite runs with NODE_ENV=test or development. Two bugs shipped
 * into a release directory because of that, and both were at module *import*
 * time, so nothing that imports a route in a test would have found them either:
 *
 *   1. express-rate-limit 8 refuses a keyGenerator that reads req.ip without
 *      ipKeyGenerator, and throws when the route module loads.
 *   2. getRedisStore asked whether Redis was connected at import time, which it
 *      never is, and in production that was a throw rather than a warning. The
 *      server could not start on a box where Redis was up and answering.
 *
 * Neither reproduces below NODE_ENV=production. This does, by starting the real
 * dist against the real environment and waiting for it to answer.
 *
 * Needs: a build (npm run build) and the production env, REDIS_URL included.
 */

import { spawn } from 'child_process';
import path from 'path';
import http from 'http';

const PORT = Number(process.env.BOOT_CHECK_PORT ?? 4199);
const DIST = path.join(__dirname, '..', 'dist', 'index.js');
const DEADLINE_MS = 90_000;

function get(pathname: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port: PORT, path: pathname, timeout: 8000 }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

async function main() {
  console.log(`Booting ${DIST} with NODE_ENV=production on port ${PORT}\n`);

  const child = spawn(process.execPath, [DIST], {
    env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT) },
    // No cwd override: dotenv resolves .env from the working directory, and
    // production runs from the release root rather than from services/api. Run
    // this from wherever the process manager runs the app, or it loads a
    // different .env than the one being verified.
  });

  let output = '';
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (output += d));

  let exited: number | null = null;
  child.on('exit', (code) => (exited = code ?? -1));

  const started = Date.now();
  let health: { status: number; body: string } | null = null;

  while (Date.now() - started < DEADLINE_MS) {
    if (exited !== null) break;
    try {
      health = await get('/health');
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  const finish = (ok: boolean, why: string) => {
    child.kill('SIGTERM');
    setTimeout(() => child.kill('SIGKILL'), 3000).unref();
    console.log(ok ? `\nPASS — ${why}` : `\nFAIL — ${why}`);
    if (!ok) {
      console.log('\n--- server output ---');
      console.log(output.split('\n').slice(-40).join('\n'));
    }
    process.exit(ok ? 0 : 1);
  };

  if (exited !== null) {
    return finish(false, `the server exited with code ${exited} instead of listening`);
  }
  if (!health || health.status !== 200) {
    return finish(false, `/health did not answer 200 within ${DEADLINE_MS / 1000}s`);
  }

  const ready = await get('/ready').catch(() => null);
  if (!ready) return finish(false, '/health answered but /ready did not');

  let parsed: any = {};
  try { parsed = JSON.parse(ready.body); } catch { /* reported below */ }

  console.log(`  /health  ${health.status}`);
  console.log(`  /ready   ${ready.status}  ${ready.body.slice(0, 120)}`);

  if (!parsed.postgres) return finish(false, '/ready says Postgres is not connected');

  // Not asserted: redis and razorpay. Both are environment, not code, and this
  // check exists to catch code that cannot start — not to gate on a service
  // being reachable from wherever it happens to run.
  finish(true, 'the production build boots and serves');
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
