# Redis Quick Start Guide

## 🚀 5-Minute Setup

### 1. Install Redis Package
```bash
cd services/api
npm install redis@^4.6.0
```

### 2. Copy Files
```bash
# Use the new docker-compose with Redis
cp docker-compose.redis.yml docker-compose.yml

# Or keep both and specify which to use:
# docker-compose -f docker-compose.redis.yml up
```

### 3. Add Environment Variable (Optional)
```bash
# Add to .env
REDIS_URL=redis://:trek-tribe-redis-pass@redis:6379
```

### 4. Start Everything
```bash
npm run dev
```

**That's it!** Redis is now running with automatic fallback.

---

## 📋 What You Get

✅ **Redis running on port 6379**
✅ **Automatic fallback to in-memory if Redis fails**
✅ **No code changes required**
✅ **All existing features work identically**

---

## 🔍 Verify It's Working

### Check Containers
```bash
docker ps
# Look for redis container
```

### Test Redis
```bash
# Connect to Redis CLI
docker exec -it trek-tribe-redis-1 redis-cli

# Authenticate and test
AUTH trek-tribe-redis-pass
PING
# Should return: PONG
```

### Check Logs
```bash
docker-compose logs api | grep -i redis

# Should see:
# ✅ Redis connected and ready
```

---

## 💡 Using Redis in Your Code

### Basic Caching
```typescript
import { redisService } from './services/redisService';

// Set with 1 hour TTL
await redisService.setJSON('my-key', { data: 'value' }, 3600);

// Get
const data = await redisService.getJSON('my-key');
```

### Replace AI Cache (Drop-in)
```typescript
// Change this line:
import { aiCacheService } from './services/aiCacheService';

// To this:
import { redisAICacheService as aiCacheService } from './services/redisAICacheAdapter';

// Everything else stays the same!
```

### Session Storage
```typescript
import { redisSessionStore } from './services/redisSessionStore';

await redisSessionStore.createSession({
  sessionId: 'abc123',
  userId: 'user456',
  messages: [],
  createdAt: new Date().toISOString(),
  lastActivity: new Date().toISOString()
});
```

---

## 🎯 Common Use Cases

### 1. Cache API Responses
```typescript
const cacheKey = `api:trips:${userId}`;
let trips = await redisService.getJSON(cacheKey);

if (!trips) {
  trips = await Trip.find({ userId });
  await redisService.setJSON(cacheKey, trips, 300); // 5 minutes
}
```

### 2. Rate Limiting
```typescript
const key = `ratelimit:${userId}`;
const requests = parseInt(await redisService.get(key) || '0');

if (requests >= 100) {
  throw new Error('Rate limit exceeded');
}

await redisService.set(key, String(requests + 1), 3600);
```

### 3. User Sessions
```typescript
await redisSessionStore.mapUserToSocket(userId, socketId);
const socketId = await redisSessionStore.getUserSocket(userId);
```

---

## 🛠️ Commands Cheat Sheet

### Development
```bash
# Start with Redis
docker-compose up --build

# Start without rebuilding
docker-compose up

# Stop everything
docker-compose down

# Stop and remove volumes (clean slate)
docker-compose down -v
```

### Redis Commands
```bash
# Access Redis CLI
docker exec -it trek-tribe-redis-1 redis-cli -a trek-tribe-redis-pass

# View all keys
KEYS *

# View AI cache keys
KEYS ai:*

# View session keys
KEYS session:*

# Get a value
GET key-name

# Delete a key
DEL key-name

# Check key TTL
TTL key-name

# Flush all data (careful!)
FLUSHALL
```

---

## ⚠️ Troubleshooting

### Redis Not Connecting
**Don't worry!** App automatically uses in-memory cache.

### Port Already in Use
```bash
# Find and stop conflicting process
docker ps -a | grep 6379
docker stop <container-id>
```

### Can't Authenticate
Check your `.env` file has correct password:
```bash
REDIS_PASSWORD=trek-tribe-redis-pass
REDIS_URL=redis://:trek-tribe-redis-pass@redis:6379
```

---

## 📊 Monitor Performance

### Check Connection Status
```typescript
console.log(redisService.getConnectionStatus());
// 'connected' | 'disconnected' | 'memory-fallback'
```

### Get Cache Stats
```typescript
const stats = redisAICacheService.getStats();
console.log(stats);
// { search: { hits: 45, misses: 12 }, ... }
```

---

## 🎉 Next Steps

1. ✅ Verify Redis is running
2. ✅ Test basic caching
3. ✅ Migrate AI cache (optional)
4. ✅ Add session persistence (optional)
5. ✅ Monitor cache performance

---

## 📚 Full Documentation

See `REDIS_INTEGRATION_GUIDE.md` for complete details on:
- Architecture overview
- Advanced configurations
- Production deployment
- Monitoring and alerts
- Backup strategies

---

**Need Help?**
- Check logs: `docker-compose logs redis`
- Test connection: `docker exec -it trek-tribe-redis-1 redis-cli PING`
- Read full guide: `REDIS_INTEGRATION_GUIDE.md`
