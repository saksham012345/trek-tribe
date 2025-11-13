import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

interface CacheEntry {
  data: any;
  expiresAt: number;
}

/**
 * Redis Service with fallback to in-memory cache
 * This ensures the application works with or without Redis
 */
class RedisService {
  private client: RedisClientType | null = null;
  private isConnected = false;
  private useMemoryFallback = false;
  
  // In-memory fallback cache
  private memoryCache = new Map<string, CacheEntry>();
  
  constructor() {
    this.initialize();
  }

  private async initialize() {
    const redisUrl = process.env.REDIS_URL;
    
    if (!redisUrl) {
      logger.warn('⚠️ REDIS_URL not configured - using in-memory cache fallback');
      this.useMemoryFallback = true;
      return;
    }

    try {
      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error('❌ Redis connection failed after 10 retries, switching to memory fallback');
              this.useMemoryFallback = true;
              return new Error('Redis connection failed');
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });

      this.client.on('error', (err) => {
        logger.error('Redis Client Error', { error: err.message });
        if (!this.isConnected) {
          this.useMemoryFallback = true;
        }
      });

      this.client.on('connect', () => {
        logger.info('🔌 Redis connecting...');
      });

      this.client.on('ready', () => {
        logger.info('✅ Redis connected and ready');
        this.isConnected = true;
        this.useMemoryFallback = false;
      });

      this.client.on('reconnecting', () => {
        logger.warn('🔄 Redis reconnecting...');
      });

      await this.client.connect();
    } catch (error: any) {
      logger.error('Failed to initialize Redis', { error: error.message });
      this.useMemoryFallback = true;
    }
  }

  // ==================== Generic Cache Methods ====================

  async get(key: string): Promise<string | null> {
    if (this.useMemoryFallback) {
      return this.getFromMemory(key);
    }

    try {
      if (!this.client) return null;
      return await this.client.get(key);
    } catch (error: any) {
      logger.error('Redis GET error', { key, error: error.message });
      return this.getFromMemory(key);
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (this.useMemoryFallback) {
      return this.setInMemory(key, value, ttlSeconds);
    }

    try {
      if (!this.client) return false;
      
      if (ttlSeconds) {
        await this.client.setEx(key, ttlSeconds, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error: any) {
      logger.error('Redis SET error', { key, error: error.message });
      return this.setInMemory(key, value, ttlSeconds);
    }
  }

  async del(key: string): Promise<boolean> {
    if (this.useMemoryFallback) {
      this.memoryCache.delete(key);
      return true;
    }

    try {
      if (!this.client) return false;
      await this.client.del(key);
      return true;
    } catch (error: any) {
      logger.error('Redis DEL error', { key, error: error.message });
      this.memoryCache.delete(key);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (this.useMemoryFallback) {
      return this.memoryCache.has(key) && !this.isExpired(key);
    }

    try {
      if (!this.client) return false;
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error: any) {
      logger.error('Redis EXISTS error', { key, error: error.message });
      return this.memoryCache.has(key);
    }
  }

  async expire(key: string, seconds: number): Promise<boolean> {
    if (this.useMemoryFallback) {
      const entry = this.memoryCache.get(key);
      if (entry) {
        entry.expiresAt = Date.now() + (seconds * 1000);
        return true;
      }
      return false;
    }

    try {
      if (!this.client) return false;
      await this.client.expire(key, seconds);
      return true;
    } catch (error: any) {
      logger.error('Redis EXPIRE error', { key, error: error.message });
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    if (this.useMemoryFallback) {
      const entry = this.memoryCache.get(key);
      if (!entry) return -2;
      if (entry.expiresAt === 0) return -1;
      const remaining = Math.floor((entry.expiresAt - Date.now()) / 1000);
      return remaining > 0 ? remaining : -2;
    }

    try {
      if (!this.client) return -2;
      return await this.client.ttl(key);
    } catch (error: any) {
      logger.error('Redis TTL error', { key, error: error.message });
      return -2;
    }
  }

  // ==================== JSON Cache Methods ====================

  async getJSON<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;
    
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Failed to parse JSON from cache', { key });
      return null;
    }
  }

  async setJSON<T>(key: string, value: T, ttlSeconds?: number): Promise<boolean> {
    try {
      const jsonString = JSON.stringify(value);
      return await this.set(key, jsonString, ttlSeconds);
    } catch (error) {
      logger.error('Failed to stringify JSON for cache', { key });
      return false;
    }
  }

  // ==================== Hash Methods ====================

  async hSet(key: string, field: string, value: string): Promise<boolean> {
    if (this.useMemoryFallback) {
      const hashKey = `${key}:${field}`;
      return this.setInMemory(hashKey, value);
    }

    try {
      if (!this.client) return false;
      await this.client.hSet(key, field, value);
      return true;
    } catch (error: any) {
      logger.error('Redis HSET error', { key, field, error: error.message });
      return false;
    }
  }

  async hGet(key: string, field: string): Promise<string | null> {
    if (this.useMemoryFallback) {
      const hashKey = `${key}:${field}`;
      return this.getFromMemory(hashKey);
    }

    try {
      if (!this.client) return null;
      const value = await this.client.hGet(key, field);
      return value || null;
    } catch (error: any) {
      logger.error('Redis HGET error', { key, field, error: error.message });
      return null;
    }
  }

  async hGetAll(key: string): Promise<Record<string, string>> {
    if (this.useMemoryFallback) {
      // In memory fallback for hash operations is limited
      logger.warn('HGETALL not fully supported in memory fallback');
      return {};
    }

    try {
      if (!this.client) return {};
      return await this.client.hGetAll(key);
    } catch (error: any) {
      logger.error('Redis HGETALL error', { key, error: error.message });
      return {};
    }
  }

  async hDel(key: string, field: string): Promise<boolean> {
    if (this.useMemoryFallback) {
      const hashKey = `${key}:${field}`;
      this.memoryCache.delete(hashKey);
      return true;
    }

    try {
      if (!this.client) return false;
      await this.client.hDel(key, field);
      return true;
    } catch (error: any) {
      logger.error('Redis HDEL error', { key, field, error: error.message });
      return false;
    }
  }

  // ==================== Set Methods ====================

  async sAdd(key: string, member: string): Promise<boolean> {
    if (this.useMemoryFallback) {
      const setKey = `set:${key}`;
      const existing = this.memoryCache.get(setKey);
      const members = existing ? JSON.parse(existing.data) : [];
      if (!members.includes(member)) {
        members.push(member);
        return this.setInMemory(setKey, JSON.stringify(members));
      }
      return true;
    }

    try {
      if (!this.client) return false;
      await this.client.sAdd(key, member);
      return true;
    } catch (error: any) {
      logger.error('Redis SADD error', { key, member, error: error.message });
      return false;
    }
  }

  async sRem(key: string, member: string): Promise<boolean> {
    if (this.useMemoryFallback) {
      const setKey = `set:${key}`;
      const existing = this.memoryCache.get(setKey);
      if (existing) {
        const members = JSON.parse(existing.data).filter((m: string) => m !== member);
        return this.setInMemory(setKey, JSON.stringify(members));
      }
      return false;
    }

    try {
      if (!this.client) return false;
      await this.client.sRem(key, member);
      return true;
    } catch (error: any) {
      logger.error('Redis SREM error', { key, member, error: error.message });
      return false;
    }
  }

  async sMembers(key: string): Promise<string[]> {
    if (this.useMemoryFallback) {
      const setKey = `set:${key}`;
      const existing = this.memoryCache.get(setKey);
      return existing ? JSON.parse(existing.data) : [];
    }

    try {
      if (!this.client) return [];
      return await this.client.sMembers(key);
    } catch (error: any) {
      logger.error('Redis SMEMBERS error', { key, error: error.message });
      return [];
    }
  }

  // ==================== List Methods ====================

  async lPush(key: string, value: string): Promise<boolean> {
    if (this.useMemoryFallback) {
      const listKey = `list:${key}`;
      const existing = this.memoryCache.get(listKey);
      const list = existing ? JSON.parse(existing.data) : [];
      list.unshift(value);
      return this.setInMemory(listKey, JSON.stringify(list));
    }

    try {
      if (!this.client) return false;
      await this.client.lPush(key, value);
      return true;
    } catch (error: any) {
      logger.error('Redis LPUSH error', { key, error: error.message });
      return false;
    }
  }

  async lRange(key: string, start: number, stop: number): Promise<string[]> {
    if (this.useMemoryFallback) {
      const listKey = `list:${key}`;
      const existing = this.memoryCache.get(listKey);
      if (!existing) return [];
      const list = JSON.parse(existing.data);
      return list.slice(start, stop === -1 ? undefined : stop + 1);
    }

    try {
      if (!this.client) return [];
      return await this.client.lRange(key, start, stop);
    } catch (error: any) {
      logger.error('Redis LRANGE error', { key, error: error.message });
      return [];
    }
  }

  // ==================== Pub/Sub Methods ====================

  async publish(channel: string, message: string): Promise<boolean> {
    if (this.useMemoryFallback) {
      logger.warn('Pub/Sub not available in memory fallback mode');
      return false;
    }

    try {
      if (!this.client) return false;
      await this.client.publish(channel, message);
      return true;
    } catch (error: any) {
      logger.error('Redis PUBLISH error', { channel, error: error.message });
      return false;
    }
  }

  // ==================== Pattern Deletion ====================

  async deletePattern(pattern: string): Promise<number> {
    if (this.useMemoryFallback) {
      let count = 0;
      const regex = new RegExp(pattern.replace('*', '.*'));
      for (const key of this.memoryCache.keys()) {
        if (regex.test(key)) {
          this.memoryCache.delete(key);
          count++;
        }
      }
      return count;
    }

    try {
      if (!this.client) return 0;
      const keys = await this.client.keys(pattern);
      if (keys.length === 0) return 0;
      await this.client.del(keys);
      return keys.length;
    } catch (error: any) {
      logger.error('Redis pattern deletion error', { pattern, error: error.message });
      return 0;
    }
  }

  // ==================== Memory Cache Fallback Methods ====================

  private getFromMemory(key: string): string | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;
    
    if (this.isExpired(key)) {
      this.memoryCache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  private setInMemory(key: string, value: string, ttlSeconds?: number): boolean {
    const expiresAt = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : 0;
    this.memoryCache.set(key, { data: value, expiresAt });
    return true;
  }

  private isExpired(key: string): boolean {
    const entry = this.memoryCache.get(key);
    if (!entry || entry.expiresAt === 0) return false;
    return Date.now() > entry.expiresAt;
  }

  // ==================== Utility Methods ====================

  isRedisConnected(): boolean {
    return this.isConnected && !this.useMemoryFallback;
  }

  getConnectionStatus(): string {
    if (this.useMemoryFallback) return 'memory-fallback';
    if (this.isConnected) return 'connected';
    return 'disconnected';
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.quit();
        logger.info('✅ Redis disconnected gracefully');
      } catch (error) {
        logger.error('Error disconnecting Redis', { error });
      }
    }
    this.memoryCache.clear();
  }

  // Cleanup expired entries in memory cache
  cleanupMemoryCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiresAt > 0 && now > entry.expiresAt) {
        this.memoryCache.delete(key);
      }
    }
  }
}

// Export singleton instance
export const redisService = new RedisService();

// Periodic cleanup for memory cache
setInterval(() => {
  if (!redisService.isRedisConnected()) {
    redisService.cleanupMemoryCache();
  }
}, 60000); // Every minute

export default redisService;
