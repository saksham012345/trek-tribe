import NodeCache from 'node-cache';
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';
import { redisService } from '../services/redisService';

// Initialize local cache with 5-minute TTL by default
const localCache = new NodeCache({
  stdTTL: 300, // 5 minutes
  checkperiod: 60, // Check for expired keys every 60 seconds
  useClones: false // Don't clone data for better performance
});

/**
 * Enhanced Cache middleware for GET requests (Distributed support)
 * @param ttl Time to live in seconds (default: 300)
 */
export const cacheMiddleware = (ttl: number = 300) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip caching for authenticated endpoints (has Authorization header)
    if (req.headers.authorization) {
      return next();
    }

    // Generate cache key from URL and query params
    const cacheKey = `web:${req.originalUrl || req.url}`;

    // 1. Check Local Cache (Level 1 - Fast)
    const localResult = localCache.get(cacheKey);
    if (localResult) {
      logger.debug('L1 Cache hit', { key: cacheKey });
      return res.json(localResult);
    }

    // 2. Check Redis Cache (Level 2 - Shared)
    if (redisService.isRedisConnected()) {
      try {
        const redisResult = await redisService.getJSON(cacheKey);
        if (redisResult) {
          logger.debug('L2 Cache hit', { key: cacheKey });
          // Populate back to L1 for faster subsequent hits on this worker
          localCache.set(cacheKey, redisResult, ttl);
          return res.json(redisResult);
        }
      } catch (err) {
        logger.warn('L2 Cache read failed', { key: cacheKey, err });
      }
    }

    // Store original res.json function
    const originalJson = res.json.bind(res);

    // Override res.json to cache the response
    res.json = function (body: any) {
      // Only cache successful status codes if possible
      // (Note: res.statusCode might not be final here, but usually is for json responses)

      // Cache the response in both layers
      localCache.set(cacheKey, body, ttl);

      if (redisService.isRedisConnected()) {
        redisService.setJSON(cacheKey, body, ttl).catch(err =>
          logger.warn('L2 Cache write failed', { key: cacheKey, err })
        );
      }

      logger.debug('Cache set (L1+L2)', { key: cacheKey, ttl });

      // Call original json function
      return originalJson(body);
    };

    next();
  };
};

/**
 * Invalidate cache for specific patterns (Distributed support)
 * @param pattern String pattern to match keys (e.g., 'trips')
 */
export const invalidateCache = async (pattern: string): Promise<number> => {
  // Clear local keys
  const keys = localCache.keys();
  const matchingKeys = keys.filter(key => key.includes(pattern));
  matchingKeys.forEach(key => localCache.del(key));

  // Clear Redis keys
  let redisCount = 0;
  if (redisService.isRedisConnected()) {
    try {
      redisCount = await redisService.deletePattern(`*${pattern}*`);
    } catch (err) {
      logger.warn('Redis cache invalidation failed', { pattern, err });
    }
  }

  const totalCount = matchingKeys.length + redisCount;
  logger.info('Cache invalidated', { pattern, local: matchingKeys.length, redis: redisCount });
  return totalCount;
};

/**
 * Clear all cache (Distributed support)
 */
export const clearCache = async (): Promise<void> => {
  localCache.flushAll();
  if (redisService.isRedisConnected()) {
    try {
      await redisService.deletePattern('web:*');
    } catch (err) {
      logger.warn('Redis cache clear failed', { err });
    }
  }
  logger.info('All caches cleared');
};

export default {
  cacheMiddleware,
  invalidateCache,
  clearCache
};
