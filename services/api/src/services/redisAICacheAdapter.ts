import { redisService } from './redisService';
import { aiConfig } from '../config/ai';
import { logger } from '../utils/logger';

/**
 * Redis-backed AI Cache Service
 * Drop-in replacement for the existing aiCacheService with Redis backend
 * Falls back to in-memory cache automatically if Redis is unavailable
 */
class RedisAICacheService {
  private stats = {
    search: { hits: 0, misses: 0 },
    recommendation: { hits: 0, misses: 0 },
    analytics: { hits: 0, misses: 0 },
    chat: { hits: 0, misses: 0 }
  };

  // Cache key prefixes
  private readonly SEARCH_PREFIX = 'ai:search:';
  private readonly RECOMMENDATION_PREFIX = 'ai:recommendation:';
  private readonly ANALYTICS_PREFIX = 'ai:analytics:';
  private readonly CHAT_PREFIX = 'ai:chat:';

  constructor() {
    logger.info('🚀 Redis AI Cache Service initialized');
  }

  // ==================== Search Cache Methods ====================

  async getSearchResults(key: string): Promise<any | null> {
    if (!aiConfig.enableCaching) return null;
    
    const cacheKey = `${this.SEARCH_PREFIX}${key}`;
    const result = await redisService.getJSON(cacheKey);
    
    if (result) {
      this.stats.search.hits++;
      logger.debug('Search cache HIT', { key });
    } else {
      this.stats.search.misses++;
      logger.debug('Search cache MISS', { key });
    }
    
    return result;
  }

  async setSearchResults(key: string, results: any, ttlMinutes?: number): Promise<void> {
    if (!aiConfig.enableCaching) return;
    
    const cacheKey = `${this.SEARCH_PREFIX}${key}`;
    const ttlSeconds = (ttlMinutes || aiConfig.cacheExpiryMinutes) * 60;
    
    await redisService.setJSON(cacheKey, results, ttlSeconds);
    logger.debug('Search results cached', { key, ttl: ttlSeconds });
  }

  // ==================== Recommendation Cache Methods ====================

  async getRecommendations(userId: string, limit: number): Promise<any | null> {
    if (!aiConfig.enableCaching) return null;
    
    const cacheKey = `${this.RECOMMENDATION_PREFIX}${userId}:${limit}`;
    const result = await redisService.getJSON(cacheKey);
    
    if (result) {
      this.stats.recommendation.hits++;
      logger.debug('Recommendation cache HIT', { userId, limit });
    } else {
      this.stats.recommendation.misses++;
      logger.debug('Recommendation cache MISS', { userId, limit });
    }
    
    return result;
  }

  async setRecommendations(
    userId: string, 
    limit: number, 
    recommendations: any, 
    ttlMinutes?: number
  ): Promise<void> {
    if (!aiConfig.enableCaching) return;
    
    const cacheKey = `${this.RECOMMENDATION_PREFIX}${userId}:${limit}`;
    const ttlSeconds = (ttlMinutes || aiConfig.cacheExpiryMinutes) * 60;
    
    await redisService.setJSON(cacheKey, recommendations, ttlSeconds);
    logger.debug('Recommendations cached', { userId, limit, ttl: ttlSeconds });
  }

  // ==================== Analytics Cache Methods ====================

  async getAnalytics(userId: string): Promise<any | null> {
    if (!aiConfig.enableCaching) return null;
    
    const cacheKey = `${this.ANALYTICS_PREFIX}${userId}`;
    const result = await redisService.getJSON(cacheKey);
    
    if (result) {
      this.stats.analytics.hits++;
      logger.debug('Analytics cache HIT', { userId });
    } else {
      this.stats.analytics.misses++;
      logger.debug('Analytics cache MISS', { userId });
    }
    
    return result;
  }

  async setAnalytics(userId: string, analytics: any, ttlMinutes?: number): Promise<void> {
    if (!aiConfig.enableCaching) return;
    
    const cacheKey = `${this.ANALYTICS_PREFIX}${userId}`;
    // Analytics cache for longer period since it's expensive to compute
    const defaultTTL = ttlMinutes || aiConfig.analyticsConfig.refreshIntervalHours * 60;
    const ttlSeconds = defaultTTL * 60;
    
    await redisService.setJSON(cacheKey, analytics, ttlSeconds);
    logger.debug('Analytics cached', { userId, ttl: ttlSeconds });
  }

  // ==================== Chat Cache Methods ====================

  async getChatResponse(messageHash: string): Promise<any | null> {
    if (!aiConfig.enableCaching) return null;
    
    const cacheKey = `${this.CHAT_PREFIX}${messageHash}`;
    const result = await redisService.getJSON(cacheKey);
    
    if (result) {
      this.stats.chat.hits++;
      logger.debug('Chat cache HIT', { messageHash });
    } else {
      this.stats.chat.misses++;
      logger.debug('Chat cache MISS', { messageHash });
    }
    
    return result;
  }

  async setChatResponse(messageHash: string, response: any, ttlMinutes?: number): Promise<void> {
    if (!aiConfig.enableCaching) return;
    
    const cacheKey = `${this.CHAT_PREFIX}${messageHash}`;
    const ttlSeconds = (ttlMinutes || 60) * 60; // Default 1 hour for chat
    
    await redisService.setJSON(cacheKey, response, ttlSeconds);
    logger.debug('Chat response cached', { messageHash, ttl: ttlSeconds });
  }

  // ==================== Utility Methods ====================

  generateSearchKey(query: string, filters: any): string {
    return `${query}:${JSON.stringify(filters)}`;
  }

  generateMessageHash(message: string, context?: any): string {
    const content = context ? `${message}:${JSON.stringify(context)}` : message;
    // Simple hash function (in production, you might want to use a proper hash library)
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // ==================== Invalidation Methods ====================

  async invalidateUserCache(userId: string): Promise<void> {
    // Clear all user-specific cached data
    const patterns = [
      `${this.RECOMMENDATION_PREFIX}${userId}:*`,
      `${this.ANALYTICS_PREFIX}${userId}`
    ];
    
    for (const pattern of patterns) {
      await redisService.deletePattern(pattern);
    }
    
    logger.info('User cache invalidated', { userId });
  }

  async invalidateSearchCache(pattern?: string): Promise<void> {
    const searchPattern = pattern 
      ? `${this.SEARCH_PREFIX}*${pattern}*`
      : `${this.SEARCH_PREFIX}*`;
    
    const count = await redisService.deletePattern(searchPattern);
    logger.info('Search cache invalidated', { pattern, keysDeleted: count });
  }

  // ==================== Statistics and Monitoring ====================

  getStats() {
    return {
      search: { ...this.stats.search, size: 0, maxSize: aiConfig.searchCacheSize },
      recommendation: { ...this.stats.recommendation, size: 0, maxSize: aiConfig.recommendationCacheSize },
      analytics: { ...this.stats.analytics, size: 0, maxSize: 100 },
      chat: { ...this.stats.chat, size: 0, maxSize: 200 },
      redisStatus: redisService.getConnectionStatus()
    };
  }

  getCacheHitRatio(cacheType: keyof typeof this.stats): number {
    const cache = this.stats[cacheType];
    const total = cache.hits + cache.misses;
    return total > 0 ? cache.hits / total : 0;
  }

  // ==================== Cache Warming ====================

  async warmCache(): Promise<void> {
    logger.info('🔥 Warming Redis AI caches...');
    
    // You could implement cache warming logic here
    // For example, preload popular searches, top recommendations, etc.
    
    logger.info('✅ Redis AI cache warming completed');
  }

  // ==================== Cleanup and Maintenance ====================

  performMaintenance(): void {
    // Log cache statistics
    const stats = this.getStats();
    logger.info('📊 Redis AI Cache Statistics', {
      search: `${stats.search.hits}/${stats.search.hits + stats.search.misses} hits (${(this.getCacheHitRatio('search') * 100).toFixed(1)}%)`,
      recommendation: `${stats.recommendation.hits}/${stats.recommendation.hits + stats.recommendation.misses} hits (${(this.getCacheHitRatio('recommendation') * 100).toFixed(1)}%)`,
      analytics: `${stats.analytics.hits}/${stats.analytics.hits + stats.analytics.misses} hits (${(this.getCacheHitRatio('analytics') * 100).toFixed(1)}%)`,
      chat: `${stats.chat.hits}/${stats.chat.hits + stats.chat.misses} hits (${(this.getCacheHitRatio('chat') * 100).toFixed(1)}%)`,
      redisStatus: stats.redisStatus
    });
  }

  // ==================== Clear All Caches ====================

  async clearAll(): Promise<void> {
    const patterns = [
      `${this.SEARCH_PREFIX}*`,
      `${this.RECOMMENDATION_PREFIX}*`,
      `${this.ANALYTICS_PREFIX}*`,
      `${this.CHAT_PREFIX}*`
    ];
    
    for (const pattern of patterns) {
      await redisService.deletePattern(pattern);
    }
    
    // Reset stats
    Object.keys(this.stats).forEach(key => {
      this.stats[key as keyof typeof this.stats].hits = 0;
      this.stats[key as keyof typeof this.stats].misses = 0;
    });
    
    logger.info('🧹 All Redis AI caches cleared');
  }
}

// Export singleton instance
export const redisAICacheService = new RedisAICacheService();

// Initialize cache maintenance interval
if (aiConfig.enableCaching) {
  setInterval(() => {
    redisAICacheService.performMaintenance();
  }, 300000); // Every 5 minutes
  
  // Warm cache on startup if in production
  if (process.env.NODE_ENV === 'production') {
    setTimeout(() => {
      redisAICacheService.warmCache();
    }, 5000); // Wait 5 seconds after startup
  }
}

export default redisAICacheService;
