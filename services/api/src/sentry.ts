/**
 * Centralized optional Sentry initialization
 * Keeps Sentry setup in one place so index.ts can remain tidy.
 */
export function initSentry() {
  if (!process.env.SENTRY_DSN) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const Sentry = require('@sentry/node');
    const Tracing = require('@sentry/tracing');
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.RELEASE || process.env.npm_package_version,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.2),
    });
    console.log('✅ Sentry initialized (central)');
    return Sentry;
  } catch (e) {
    console.warn('⚠️ Sentry init skipped (module missing)');
    return null;
  }
}
