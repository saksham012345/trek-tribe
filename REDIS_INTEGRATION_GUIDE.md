# Redis Integration Guide for Trek Tribe

## Overview

This guide explains how Docker is currently used in Trek Tribe and how Redis has been integrated without affecting existing functionality.

---

## Current Docker Architecture

### Services in `docker-compose.yml`

```yaml
1. MongoDB (mongo:6)
   - Port: 27017
   - Volume: mongo_data
   - Purpose: Primary database

2. API (Node.js/Express/TypeScript)
   - Port: 4000
   - Built from: ./services/api
   - Depends on: MongoDB

3. Web (React)
   - Port: 3000
   - Built from: ./web
   - Depends on: API
```

### Key Features
- **Container Orchestration**: All services run in isolated containers
- **Service Discovery**: Services communicate via Docker network (mongo, api, web)
- **Data Persistence**: MongoDB data persists across restarts via volume
- **Development Ready**: Configured with restart policies and hot-reload support

---

## How Redis is Integrated

### New Redis Service

Redis has been added to the architecture with **automatic fallback** to in-memory cache if Redis is unavailable.

#### File: `docker-compose.redis.yml`

```yaml
redis:
  image: redis:7-alpine
  restart: unless-stopped
  ports:
    - '6379:6379'
  volumes:
    - redis_data:/data
  command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD:-trek-tribe-redis-pass}
  healthcheck:
    test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
    interval: 10s
    timeout: 3s
    retries: 5
```

#### Key Features:
- **Persistent Storage**: AOF (Append Only File) enabled for data durability
- **Health Checks**: Ensures Redis is ready before API starts
- **Password Protected**: Secure access with configurable password
- **Data Volume**: redis_data volume for persistence

---

## Redis Service Components

### 1. Core Redis Service (`redisService.ts`)

**Purpose**: Low-level Redis wrapper with automatic fallback to in-memory cache

**Key Features**:
- ✅ Automatic fallback if Redis is unavailable
- ✅ Supports all common Redis operations (strings, hashes, sets, lists)
- ✅ JSON serialization helpers
- ✅ Pattern-based deletion
- ✅ Pub/Sub support
- ✅ Connection health monitoring

**API Examples**:
```typescript
import { redisService } from './services/redisService';

// Basic operations
await redisService.set('key', 'value', 3600); // TTL in seconds
const value = await redisService.get('key');

// JSON operations
await redisService.setJSON('user:123', { name: 'John' }, 3600);
const user = await redisService.getJSON('user:123');

// Check connection
console.log(redisService.getConnectionStatus());
// Returns: 'connected' | 'disconnected' | 'memory-fallback'
```

### 2. Redis AI Cache Adapter (`redisAICacheAdapter.ts`)

**Purpose**: Drop-in replacement for existing `aiCacheService.ts` using Redis backend

**Use Cases**:
- AI search results caching
- User recommendations
- Analytics data
- Chat responses

**Integration Example**:
```typescript
// Old (in-memory):
import { aiCacheService } from './services/aiCacheService';

// New (Redis-backed):
import { redisAICacheService } from './services/redisAICacheAdapter';

// API is identical - no code changes needed!
const cached = await redisAICacheService.getSearchResults(searchKey);
```

### 3. Redis Session Store (`redisSessionStore.ts`)

**Purpose**: Persistent session management for Socket.IO

**Use Cases**:
- Chat sessions persistence
- User-socket mappings
- Agent availability tracking
- Message history

**Benefits**:
- Sessions survive server restarts
- Supports multiple API instances (horizontal scaling)
- Automatic cleanup of expired sessions

---

## Integration Steps

### Step 1: Update Docker Compose

**Option A: Replace existing docker-compose.yml**
```bash
# Backup current file
cp docker-compose.yml docker-compose.old.yml

# Use new Redis-enabled version
cp docker-compose.redis.yml docker-compose.yml
```

**Option B: Use as separate file**
```bash
# Keep existing setup, use Redis version explicitly
docker-compose -f docker-compose.redis.yml up
```

### Step 2: Install Redis Client Package

```bash
cd services/api
npm install redis@^4.6.0
```

### Step 3: Update Environment Variables

Add to `.env` file:
```bash
# Redis Configuration (Optional - works without it)
REDIS_URL=redis://:trek-tribe-redis-pass@redis:6379
REDIS_PASSWORD=trek-tribe-redis-pass

# For local development (outside Docker)
# REDIS_URL=redis://:trek-tribe-redis-pass@localhost:6379
```

### Step 4: Update package.json Dependencies

Add to `services/api/package.json`:
```json
{
  "dependencies": {
    "redis": "^4.6.0"
  }
}
```

### Step 5: Use Redis Services (Optional)

The services work automatically with fallback, but you can explicitly integrate them:

#### Option A: Replace AI Cache Service

```typescript
// In files using aiCacheService, change:
// OLD:
import { aiCacheService } from './services/aiCacheService';

// NEW:
import { redisAICacheService as aiCacheService } from './services/redisAICacheAdapter';

// No other code changes needed!
```

#### Option B: Use Redis for Socket Sessions

```typescript
// In socketService.ts
import { redisSessionStore } from './services/redisSessionStore';

// Store sessions in Redis instead of Map
await redisSessionStore.createSession({
  sessionId,
  userId,
  userName,
  userEmail,
  isConnectedToAgent: false,
  messages: [],
  createdAt: new Date().toISOString(),
  lastActivity: new Date().toISOString()
});
```

---

## Running the Application

### With Redis (Recommended for Production)

```bash
# Start all services including Redis
npm run dev

# Or explicitly:
docker-compose -f docker-compose.redis.yml up --build
```

### Without Redis (Fallback Mode)

```bash
# Use original docker-compose
docker-compose up --build

# Redis services will automatically use in-memory fallback
```

---

## Testing Redis Integration

### 1. Verify Redis is Running

```bash
# Check containers
docker ps

# Should show redis container running on port 6379
```

### 2. Connect to Redis CLI

```bash
# Access Redis shell
docker exec -it <redis-container-id> redis-cli

# Authenticate
AUTH trek-tribe-redis-pass

# Test commands
PING
# Should return: PONG

# Check cached data
KEYS ai:*
KEYS session:*
```

### 3. Check Application Logs

```bash
# API logs should show:
✅ Redis connected and ready
🚀 Redis AI Cache Service initialized

# If Redis unavailable:
⚠️ REDIS_URL not configured - using in-memory cache fallback
```

---

## Benefits of Redis Integration

### 1. **Improved Performance**
- Faster cache lookups (memory-based)
- Reduced database queries
- Lower AI API costs (cached responses)

### 2. **Scalability**
- Support for multiple API instances
- Distributed caching across servers
- Horizontal scaling capability

### 3. **Persistence**
- Sessions survive server restarts
- Cache data persists across deployments
- Message history retained

### 4. **Better User Experience**
- Faster response times
- Consistent sessions
- No data loss on restarts

### 5. **Monitoring & Analytics**
- Cache hit/miss ratios
- Session statistics
- Performance insights

---

## Use Cases in Trek Tribe

### 1. **AI Search Caching**
```typescript
// Cache expensive AI search results
const searchKey = generateSearchKey(query, filters);
const cached = await redisService.getJSON(`ai:search:${searchKey}`);

if (!cached) {
  const results = await performAISearch(query);
  await redisService.setJSON(`ai:search:${searchKey}`, results, 1800);
}
```

### 2. **User Recommendations**
```typescript
// Cache personalized recommendations
const recommendations = await redisService.getJSON(`ai:recommendation:${userId}`);

if (!recommendations) {
  const fresh = await generateRecommendations(userId);
  await redisService.setJSON(`ai:recommendation:${userId}`, fresh, 3600);
}
```

### 3. **Socket.IO Sessions**
```typescript
// Persistent chat sessions
await redisSessionStore.createSession({
  sessionId: 'session_123',
  userId: 'user_456',
  messages: [],
  createdAt: new Date().toISOString()
});

// Map users to sockets for direct messaging
await redisSessionStore.mapUserToSocket(userId, socketId);
```

### 4. **Rate Limiting**
```typescript
// Distributed rate limiting
const key = `ratelimit:${userId}:${endpoint}`;
const count = await redisService.get(key);

if (parseInt(count || '0') >= limit) {
  throw new Error('Rate limit exceeded');
}

await redisService.set(key, String(parseInt(count || '0') + 1), 60);
```

### 5. **JWT Token Blacklist**
```typescript
// Implement logout/revoke tokens
await redisService.set(`blacklist:${token}`, '1', tokenExpirySeconds);

// Check before accepting token
const isBlacklisted = await redisService.exists(`blacklist:${token}`);
```

---

## Environment Comparison

| Feature | Without Redis | With Redis |
|---------|---------------|------------|
| Cache | In-memory (lost on restart) | Persistent |
| Scaling | Single instance only | Multi-instance support |
| Sessions | Lost on restart | Persistent |
| Performance | Good | Excellent |
| Setup | Simple | Slightly more complex |
| Fallback | N/A | Automatic to in-memory |

---

## Troubleshooting

### Issue: Redis connection failed

**Solution**: Application automatically falls back to in-memory cache
```
⚠️ REDIS_URL not configured - using in-memory cache fallback
```

### Issue: Redis authentication error

**Solution**: Check password in environment variables
```bash
# .env file
REDIS_PASSWORD=trek-tribe-redis-pass
REDIS_URL=redis://:trek-tribe-redis-pass@redis:6379
```

### Issue: Redis container not starting

**Solution**: Check logs
```bash
docker-compose logs redis

# Common fixes:
# 1. Port 6379 already in use
docker ps -a | grep 6379

# 2. Permission issues with volume
docker volume rm trek-tribe_redis_data
```

---

## Monitoring & Statistics

### Cache Statistics Endpoint

Add to your API:
```typescript
// routes/admin.ts
router.get('/cache-stats', authenticateToken, requireRole(['admin']), async (req, res) => {
  const stats = redisAICacheService.getStats();
  res.json({
    ...stats,
    connection: redisService.getConnectionStatus()
  });
});
```

### Session Statistics
```typescript
router.get('/session-stats', authenticateToken, requireRole(['admin']), async (req, res) => {
  const stats = await redisSessionStore.getStats();
  res.json(stats);
});
```

---

## Production Considerations

### 1. **Redis Password**
```bash
# Use strong password in production
openssl rand -hex 32
```

### 2. **Redis Persistence**
```bash
# Configure AOF settings for durability
redis-server --appendonly yes --appendfsync everysec
```

### 3. **Memory Limits**
```yaml
redis:
  image: redis:7-alpine
  command: redis-server --maxmemory 256mb --maxmemory-policy allkeys-lru
```

### 4. **Monitoring**
- Use Redis INFO command
- Set up alerts for memory usage
- Monitor cache hit ratios

### 5. **Backup Strategy**
```bash
# Backup Redis data
docker exec <redis-container> redis-cli --rdb /data/backup.rdb

# Or use volume backup
docker run --rm -v trek-tribe_redis_data:/data -v $(pwd):/backup alpine tar czf /backup/redis-backup.tar.gz /data
```

---

## Migration Path

### Phase 1: Development (Current)
- Redis runs alongside existing services
- Automatic fallback if unavailable
- No changes to existing code required

### Phase 2: Gradual Adoption
- Replace AI cache with Redis version
- Migrate sessions to Redis store
- Monitor performance improvements

### Phase 3: Full Integration
- Remove in-memory fallbacks
- Optimize cache strategies
- Scale horizontally with multiple API instances

---

## Next Steps

1. ✅ Test Redis with current setup
2. ✅ Monitor cache hit ratios
3. ✅ Gradually migrate caching to Redis
4. ✅ Implement distributed sessions
5. ✅ Set up monitoring dashboards
6. ✅ Configure production-ready settings

---

## Summary

✅ **Zero Downtime**: Automatic fallback ensures app works with or without Redis

✅ **No Breaking Changes**: All existing functionality preserved

✅ **Performance Boost**: Faster caching and persistent sessions

✅ **Scalability**: Ready for horizontal scaling

✅ **Production Ready**: Health checks, persistence, and monitoring built-in

---

## Support

For questions or issues:
1. Check application logs for Redis connection status
2. Verify Redis container is running: `docker ps`
3. Test Redis connection: `docker exec -it <container> redis-cli PING`
4. Review this guide's troubleshooting section

---

**Author**: Trek Tribe Development Team  
**Last Updated**: 2025-01-13  
**Version**: 1.0
