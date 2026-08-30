import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisService } from '../services/redisService';

/**
 * Shared Redis store, or a loud refusal to pretend.
 *
 * This is evaluated when the module is imported, which happens before Redis has
 * finished connecting. So the connected check almost always failed, undefined
 * was returned, and express-rate-limit quietly fell back to MemoryStore — for
 * the life of the process, even once Redis came up a second later.
 *
 * MemoryStore is per-process. Two PM2 instances means twice the configured
 * attempts, and every deploy resets the counters. The limits looked like the
 * config said and were not. Redis held 69 keys when this was checked and not
 * one of them was an rl: key.
 *
 * Two changes. The fallback is announced rather than silent, and in production
 * it is fatal: a login limiter that is quietly weaker than configured is worse
 * than a service that refuses to start, because the first one nobody finds out
 * about until an account is taken.
 */
let fallbackAnnounced = false;

const getRedisStore = (prefix: string) => {
  const client = redisService.getClient();

  if (!client || !redisService.isRedisConnected()) {
    if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MEMORY_RATE_LIMIT !== 'yes') {
      throw new Error(
        'Rate limiting requires Redis in production. Without it, limits are ' +
        'per-process rather than per-IP and reset on every deploy, which makes ' +
        'the login limiter weaker than its configuration claims. Set REDIS_URL, ' +
        'or set ALLOW_MEMORY_RATE_LIMIT=yes to accept that trade deliberately.'
      );
    }

    if (!fallbackAnnounced) {
      fallbackAnnounced = true;
      console.warn(
        '⚠️  Rate limiting is using in-memory storage — Redis is not connected.\n' +
        '    Limits are per-process and reset on restart. Fine locally; not in production.'
      );
    }
    return undefined;
  }

  return new RedisStore({
    sendCommand: (...args: string[]) => client.sendCommand(args),
    prefix: `rl:${prefix}:`,
  });
};

/**
 * General API rate limiter
 * Limits: 100 requests per 15 minutes per IP
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  store: getRedisStore('api'),
  // Skipped for test and for local development, matching authLimiter.
  //
  // The end-to-end suite makes about fifty requests in a run, so a 100-per-15
  // minutes limit refuses the second run and every request in it — which reads
  // as forty failing endpoints rather than as one rate limit, and sent this
  // session chasing an outage that was not there.
  //
  // Anything deployed sets NODE_ENV=production and is unaffected.
  skip: () =>
    process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development'
});

/**
 * Stricter rate limiter for authentication routes
 * Limits: 3 login attempts per 15 minutes
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3, // limit each IP to 3 requests per windowMs
  skipSuccessfulRequests: true, // Don't count successful requests
  message: 'Too many login attempts, please try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  store: getRedisStore('auth'),
  // This guards the whole /auth router, not just /login - so a 400 from
  // /auth/complete-profile counts against it exactly as a wrong password does.
  // Three mistyped phone numbers lock the caller out for fifteen minutes, which
  // makes local testing impractical.
  //
  // apiLimiter already skips itself for 'test'; this does the same for local
  // development. Anything deployed sets NODE_ENV=production and is unaffected.
  skip: () => process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test'
});

/**
 * Rate limiter for account registration
 * Limits: 5 registrations per hour per IP
 */
export const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  message: 'Too many account registrations from this IP, please try again in an hour.',
  standardHeaders: true,
  legacyHeaders: false,
  store: getRedisStore('registration'),
});

/**
 * Rate limiter for verification requests (KYC/OTP)
 */
export const verificationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Too many verification attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  store: getRedisStore('verification'),
});

/**
 * Rate limiter for OTP requests
 * Limits: 3 OTP requests per hour
 */
export const otpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 OTP requests per hour
  message: 'Too many OTP requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  store: getRedisStore('otp'),
});

/**
 * Rate limiter for payment endpoints
 * Limits: 10 payment requests per hour
 */
export const paymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: 'Too many payment requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Rate limiter for trip creation
 * Limits: 20 trips per day per IP
 */
export const tripCreationLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 20,
  message: 'Too many trips created, please try again tomorrow.',
  standardHeaders: true,
  legacyHeaders: false,
});
