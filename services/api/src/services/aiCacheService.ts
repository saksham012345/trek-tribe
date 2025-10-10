import { aiConfig } from '../config/ai';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  createdAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
}

class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder = new Map<string, number>();
  private maxSize: number;
  private accessCounter = 0;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  set(key: string, value: T, ttlMinutes?: number): void {
    const now = Date.now();
    const expiresAt = ttlMinutes 
      ? now + (ttlMinutes * 60 * 1000)
      : now + (aiConfig.cacheExpiryMinutes * 60 * 1000);

    // Remove expired entries first
    this.cleanup();

    // If cache is at max capacity, remove least recently used item
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data: value,
      expiresAt,
      createdAt: now
    });

    this.accessOrder.set(key, ++this.accessCounter);
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      return null;
    }

    // Update access order
    this.accessOrder.set(key, ++this.accessCounter);
    
    return entry.data;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      return false;
    }
    
    return true;
  }

  delete(key: string): void {
    this.cache.delete(key);
    this.accessOrder.delete(key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder.clear();
    this.accessCounter = 0;
  }

  size(): number {
    this.cleanup();
    return this.cache.size;
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, access] of this.accessOrder) {
      if (access < oldestAccess) {
        oldestAccess = access;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.accessOrder.delete(oldestKey);
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.accessOrder.delete(key);
    });
  }
}

class AICacheService {
  private searchCache: LRUCache<any>;
  private recommendationCache: LRUCache<any>;
  private analyticsCache: LRUCache<any>;
  private chatCache: LRUCache<any>;
  
  private stats = {
    search: { hits: 0, misses: 0, size: 0, maxSize: 0 },
    recommendation: { hits: 0, misses: 0, size: 0, maxSize: 0 },
    analytics: { hits: 0, misses: 0, size: 0, maxSize: 0 },
    chat: { hits: 0, misses: 0, size: 0, maxSize: 0 }
  };

  constructor() {
    this.searchCache = new LRUCache(aiConfig.searchCacheSize);
    this.recommendationCache = new LRUCache(aiConfig.recommendationCacheSize);
    this.analyticsCache = new LRUCache(100); // Smaller cache for analytics
    this.chatCache = new LRUCache(200); // Cache for frequent chat responses
    
    this.stats.search.maxSize = aiConfig.searchCacheSize;
    this.stats.recommendation.maxSize = aiConfig.recommendationCacheSize;
    this.stats.analytics.maxSize = 100;
    this.stats.chat.maxSize = 200;
  }

  // Search cache methods
  getSearchResults(key: string): any | null {
    if (!aiConfig.enableCaching) return null;
    
    const result = this.searchCache.get(key);
    if (result) {
      this.stats.search.hits++;
    } else {
      this.stats.search.misses++;
    }
    this.stats.search.size = this.searchCache.size();
    return result;
  }

  setSearchResults(key: string, results: any, ttlMinutes?: number): void {
    if (!aiConfig.enableCaching) return;
    
    this.searchCache.set(key, results, ttlMinutes);
    this.stats.search.size = this.searchCache.size();
  }

  // Recommendation cache methods
  getRecommendations(userId: string, limit: number): any | null {
    if (!aiConfig.enableCaching) return null;
    
    const key = `${userId}:${limit}`;
    const result = this.recommendationCache.get(key);
    if (result) {
      this.stats.recommendation.hits++;
    } else {
      this.stats.recommendation.misses++;
    }
    this.stats.recommendation.size = this.recommendationCache.size();
    return result;
  }

  setRecommendations(userId: string, limit: number, recommendations: any, ttlMinutes?: number): void {
    if (!aiConfig.enableCaching) return;
    
    const key = `${userId}:${limit}`;
    this.recommendationCache.set(key, recommendations, ttlMinutes);
    this.stats.recommendation.size = this.recommendationCache.size();
  }

  // Analytics cache methods
  getAnalytics(userId: string): any | null {
    if (!aiConfig.enableCaching) return null;
    
    const result = this.analyticsCache.get(userId);
    if (result) {
      this.stats.analytics.hits++;
    } else {
      this.stats.analytics.misses++;
    }
    this.stats.analytics.size = this.analyticsCache.size();
    return result;
  }

  setAnalytics(userId: string, analytics: any, ttlMinutes?: number): void {
    if (!aiConfig.enableCaching) return;
    
    // Analytics cache for longer period since it's expensive to compute
    const defaultTTL = ttlMinutes || aiConfig.analyticsConfig.refreshIntervalHours * 60;
    this.analyticsCache.set(userId, analytics, defaultTTL);
    this.stats.analytics.size = this.analyticsCache.size();
  }

  // Chat cache methods
  getChatResponse(messageHash: string): any | null {
    if (!aiConfig.enableCaching) return null;
    
    const result = this.chatCache.get(messageHash);
    if (result) {
      this.stats.chat.hits++;
    } else {
      this.stats.chat.misses++;
    }
    this.stats.chat.size = this.chatCache.size();
    return result;
  }

  setChatResponse(messageHash: string, response: any, ttlMinutes?: number): void {
    if (!aiConfig.enableCaching) return;
    
    this.chatCache.set(messageHash, response, ttlMinutes || 60); // Cache chat responses for 1 hour
    this.stats.chat.size = this.chatCache.size();
  }

  // Utility methods
  generateSearchKey(query: string, filters: any): string {
    return `search:${query}:${JSON.stringify(filters)}`;
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
    return `chat:${Math.abs(hash).toString(36)}`;
  }

  // Invalidation methods
  invalidateUserCache(userId: string): void {
    // Clear all user-specific cached data
    this.recommendationCache.delete(`${userId}:6`);
    this.recommendationCache.delete(`${userId}:10`);
    this.recommendationCache.delete(`${userId}:20`);
    this.analyticsCache.delete(userId);
  }

  invalidateSearchCache(pattern?: string): void {
    if (pattern) {
      // In a real implementation, you might want pattern matching
      // For now, we'll just clear the entire cache
      this.searchCache.clear();
    } else {
      this.searchCache.clear();
    }
  }

  // Statistics and monitoring
  getStats(): typeof this.stats {
    return {
      search: { ...this.stats.search, size: this.searchCache.size() },
      recommendation: { ...this.stats.recommendation, size: this.recommendationCache.size() },
      analytics: { ...this.stats.analytics, size: this.analyticsCache.size() },
      chat: { ...this.stats.chat, size: this.chatCache.size() }
    };
  }

  getCacheHitRatio(cacheType: keyof typeof this.stats): number {
    const cache = this.stats[cacheType];
    const total = cache.hits + cache.misses;
    return total > 0 ? cache.hits / total : 0;
  }

  // Cache warming - preload popular data
  async warmCache(): Promise<void> {
    console.log('🔥 Warming AI caches...');
    
    // You could implement cache warming logic here
    // For example, preload popular searches, top recommendations, etc.
    
    console.log('✅ AI cache warming completed');
  }

  // Cleanup and maintenance
  performMaintenance(): void {
    // Clean up expired entries
    [this.searchCache, this.recommendationCache, this.analyticsCache, this.chatCache].forEach(cache => {
      (cache as any).cleanup?.();
    });

    // Log cache statistics
    const stats = this.getStats();
    console.log('📊 AI Cache Statistics:', {
      search: `${stats.search.hits}/${stats.search.hits + stats.search.misses} hits (${(this.getCacheHitRatio('search') * 100).toFixed(1)}%)`,
      recommendation: `${stats.recommendation.hits}/${stats.recommendation.hits + stats.recommendation.misses} hits (${(this.getCacheHitRatio('recommendation') * 100).toFixed(1)}%)`,
      analytics: `${stats.analytics.hits}/${stats.analytics.hits + stats.analytics.misses} hits (${(this.getCacheHitRatio('analytics') * 100).toFixed(1)}%)`,
      chat: `${stats.chat.hits}/${stats.chat.hits + stats.chat.misses} hits (${(this.getCacheHitRatio('chat') * 100).toFixed(1)}%)`
    });
  }

  // Clear all caches
  clearAll(): void {
    this.searchCache.clear();
    this.recommendationCache.clear();
    this.analyticsCache.clear();
    this.chatCache.clear();
    
    // Reset stats
    Object.keys(this.stats).forEach(key => {
      this.stats[key as keyof typeof this.stats].hits = 0;
      this.stats[key as keyof typeof this.stats].misses = 0;
      this.stats[key as keyof typeof this.stats].size = 0;
    });
    
    console.log('🧹 All AI caches cleared');
  }
}

// Export singleton instance
export const aiCacheService = new AICacheService();

// Initialize cache maintenance interval
if (aiConfig.enableCaching) {
  setInterval(() => {
    aiCacheService.performMaintenance();
  }, 300000); // Every 5 minutes
  
  // Warm cache on startup if in production
  if (process.env.NODE_ENV === 'production') {
    setTimeout(() => {
      aiCacheService.warmCache();
    }, 5000); // Wait 5 seconds after startup
  }
}

export default aiCacheService;