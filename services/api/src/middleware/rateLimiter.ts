import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisService } from '../services/redisService';

/**
 * Shared Redis Store configuration
 */
const getRedisStore = (prefix: string) => {
  const client = redisService.getClient();
  if (!client || !redisService.isRedisConnected()) {
    return undefined; // Fallback to MemoryStore
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
  skip: (req) => {
    // Skip rate limiting in test environment
    return process.env.NODE_ENV === 'test';
  }
});

/**
 * Stricter rate limiter for authentication routes
 * Limits: 5 login attempts per 15 minutes
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  skipSuccessfulRequests: true, // Don't count successful requests
  message: 'Too many login attempts, please try again after 15 minutes.',
  standardHeaders: true,
  legacyHeaders: false,
  store: getRedisStore('auth'),
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
