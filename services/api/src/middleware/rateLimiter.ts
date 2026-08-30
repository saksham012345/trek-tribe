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
  // What is checked here is configuration, not connectivity.
  //
  // The comment above described the bug and the first fix still walked into it:
  // this runs at import time, before redisService has finished connecting, so
  // asking "is Redis connected right now" is answered "no" almost every time.
  // As a silent fallback that meant MemoryStore for the life of the process. As
  // a production throw it meant the process could not start at all — the server
  // refused to boot on a box where Redis was up and answering PONG.
  //
  // So the boot-time question is the one that has a stable answer: is Redis
  // configured? The connection itself is resolved per command below, by which
  // time it exists.
  if (!process.env.REDIS_URL) {
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
        '⚠️  Rate limiting is using in-memory storage — REDIS_URL is not set.\n' +
        '    Limits are per-process and reset on restart. Fine locally; not in production.'
      );
    }
    return undefined;
  }

  return new RedisStore({
    // Looked up per command rather than captured at import: the client does not
    // exist yet when this module loads, and a captured null would silently
    // never recover.
    sendCommand: (...args: string[]) => {
      const client = redisService.getClient();
      if (!client) {
        // Fail the request rather than quietly counting in a store that is not
        // shared. A rate limiter that stops limiting is the failure this whole
        // module exists to prevent.
        throw new Error('Rate limiting is unavailable: no Redis client.');
      }
      return client.sendCommand(args);
    },
    prefix: `rl:${prefix}:`,
  });
};

/**
 * General API rate limiter.
 *
 * The 100 here was written against a limiter that never worked. It stored
 * counts in a per-process MemoryStore that reset constantly, so the number was
 * never reached and never tested. Backing it with Redis made it real, and a
 * measurement on the live site showed what real means: the homepage issues ten
 * requests on load, four of them socket.io long-polling, which continues for as
 * long as the tab is open. A visitor sitting on the front page would have been
 * refused within a couple of minutes.
 *
 * So two changes, both from that measurement rather than from taste. Polling is
 * a transport and is not counted. The ceiling is high enough for a person and
 * still low enough to stop a scraper — and it is shared, so an office or a
 * mobile carrier behind one NAT address counts as one caller.
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // per IP per 15 minutes; see the note above for where this came from
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
  skip: (req) =>
    process.env.NODE_ENV === 'test' ||
    process.env.NODE_ENV === 'development' ||
    // socket.io's polling transport reopens a request every few seconds for the
    // life of the page. Counting it measures how long someone left a tab open,
    // not how hard they are hitting the API.
    req.path.startsWith('/socket.io/')
});

/**
 * Stricter limiter for authentication.
 *
 * This guards the whole /auth router, and skipSuccessfulRequests means only
 * failures count. /auth/me is in that router, it is called on every page load,
 * and for a signed-out visitor it answers 401 — a failure. At a limit of three
 * that is three page views before an anonymous visitor is locked out of the
 * login form for fifteen minutes, on an address shared by everyone behind the
 * same NAT.
 *
 * It never showed up because the store was per-process memory that reset before
 * anyone reached three. Giving the limiter a real shared store is what made it
 * reachable, so the shape of the rule has to be right rather than merely strict.
 *
 * The rule it should express is: slow down credential guessing. A GET is not a
 * credential attempt, so GETs are not counted. Ten remaining attempts still
 * ends a brute force well before it starts, and leaves room for a person who
 * mistypes a password more than twice.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true, // only failures count
  message: 'Too many login attempts, please try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  store: getRedisStore('auth'),
  skip: (req) =>
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV === 'test' ||
    // Reading who you are is not an attempt to become someone.
    req.method === 'GET'
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
