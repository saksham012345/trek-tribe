import NodeCache from 'node-cache';
import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

// Initialize cache with 5-minute TTL by default
const cache = new NodeCache({
  stdTTL: 300, // 5 minutes
  checkperiod: 60, // Check for expired keys every 60 seconds
  useClones: false // Don't clone data for better performance
});

/**
 * Cache middleware for GET requests
 * @param ttl Time to live in seconds (default: 300)
 */
export const cacheMiddleware = (ttl: number = 300) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip caching for authenticated endpoints (has Authorization header)
    if (req.headers.authorization) {
      return next();
    }

    // Generate cache key from URL and query params
    const cacheKey = `${req.originalUrl || req.url}`;

    // Try to get cached response
    const cachedResponse = cache.get(cacheKey);
    
    if (cachedResponse) {
      logger.debug('Cache hit', { key: cacheKey });
      return res.json(cachedResponse);
    }

    // Store original res.json function
    const originalJson = res.json.bind(res);

    // Override res.json to cache the response
    res.json = function (body: any) {
      // Cache the response
      cache.set(cacheKey, body, ttl);
      logger.debug('Cache set', { key: cacheKey, ttl });
      
      // Call original json function
      return originalJson(body);
    };

    next();
  };
};

/**
 * Invalidate cache for specific patterns
 * @param pattern String pattern to match keys (e.g., '/trips')
 */
export const invalidateCache = (pattern: string): number => {
  const keys = cache.keys();
  const matchingKeys = keys.filter(key => key.includes(pattern));
  
  matchingKeys.forEach(key => cache.del(key));
  
  logger.info('Cache invalidated', { pattern, count: matchingKeys.length });
  return matchingKeys.length;
};

/**
 * Clear all cache
 */
export const clearCache = (): void => {
  cache.flushAll();
  logger.info('Cache cleared');
};

/**
 * Get cache statistics
 */
export const getCacheStats = () => {
  return cache.getStats();
};

export default {
  cacheMiddleware,
  invalidateCache,
  clearCache,
  getCacheStats
};
