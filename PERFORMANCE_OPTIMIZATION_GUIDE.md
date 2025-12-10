# Performance Optimization & Profiling Guide

## 1. Overview

This guide covers optimization strategies for Trek Tribe's payment system and CRM module to ensure production readiness.

**Target Metrics:**
- ✅ First Contentful Paint (FCP): < 1.5 seconds
- ✅ Largest Contentful Paint (LCP): < 2.5 seconds  
- ✅ Time to Interactive (TTI): < 3.5 seconds
- ✅ Cumulative Layout Shift (CLS): < 0.1
- ✅ API Response Time: < 500ms (95th percentile)
- ✅ Database Query Time: < 200ms

---

## 2. Frontend Performance Analysis

### 2.1 Lighthouse Audit

**Steps:**
1. Open CRM Dashboard in Chrome
2. Press F12 → Lighthouse tab
3. Select "Mobile" mode
4. Click "Analyze page load"
5. Review results

**Key Metrics to Monitor:**
```
Performance Score: > 85
FCP: < 1.5s
LCP: < 2.5s
TTI: < 3.5s
TBT: < 200ms (Total Blocking Time)
```

**Optimization Areas (if score < 85):**
- JavaScript bundle size too large
- Unoptimized images
- Unused CSS
- Slow third-party scripts

### 2.2 React DevTools Profiler

**Steps:**
1. Install React DevTools extension
2. Open CRM Dashboard
3. Click "Profiler" tab
4. Record 3-5 seconds of interaction
5. Analyze component render times

**Check for:**
- ✅ Components rendering < 16ms (60 FPS target)
- ✅ No unnecessary re-renders
- ✅ Memoization working correctly

**Sample Output:**
```
StatsCard: 2ms
LeadsTable: 45ms (too slow if > 100ms)
SearchBar: 1ms
FilterDropdown: 3ms
```

### 2.3 Bundle Size Analysis

**Steps:**
```bash
# Install bundle analyzer
npm install --save-dev webpack-bundle-analyzer

# Check build size
npm run build

# Analyze bundle
npm run build -- --analyze
```

**Expected Results:**
- Frontend bundle: < 300KB (gzipped)
- CSS: < 50KB (gzipped)
- JavaScript: < 250KB (gzipped)

**Optimization Techniques:**

1. **Code Splitting** - Split components into chunks
```tsx
const CRMDashboard = React.lazy(() => import('./pages/CRMDashboard'));
const AutoPaySetup = React.lazy(() => import('./pages/AutoPaySetup'));

// Load with fallback
<Suspense fallback={<Loading />}>
  <CRMDashboard />
</Suspense>
```

2. **Tree Shaking** - Remove unused imports
```bash
# Check for unused imports
npm run analyze:unused
```

3. **Image Optimization** - Compress images
```bash
# Install image optimizer
npm install --save-dev imagemin

# Optimize images
npx imagemin web/public/images/* --out-dir=web/public/images-optimized
```

---

## 3. API Response Time Optimization

### 3.1 Baseline Measurement

**API Endpoint Performance Test:**

```bash
# Test CRM leads endpoint
curl -X GET http://localhost:3000/api/crm/leads \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -w "\nTime: %{time_total}s\n"

# Expected: < 500ms
```

**Bulk Test with Apache Bench:**
```bash
# Install apache2-utils
sudo apt-get install apache2-utils

# Test with 100 requests
ab -n 100 -c 10 \
  -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/crm/leads
```

**Expected Results:**
```
Requests per second:  20 (#/sec)
Time per request:     50ms [mean]
95% within:           200ms
```

### 3.2 Database Query Optimization

**Analyze Slow Queries:**

```javascript
// Enable MongoDB profiling
db.setProfilingLevel(1, { slowms: 100 });

// Find slow queries
db.system.profile.find({ millis: { $gt: 100 } }).pretty();

// Typical slow query on leads:
{
  op: "query",
  ns: "trek-tribe.leads",
  millis: 250,  // TOO SLOW - should be < 100ms
  execStats: { totalDocsExamined: 5000 }
}
```

**Optimization #1 - Add Indexes:**

```javascript
// Create compound index for common queries
db.leads.createIndex({ organizerId: 1, createdAt: -1 });
db.leads.createIndex({ organizerId: 1, status: 1 });
db.leads.createIndex({ email: 1 });

// Verify indexes
db.leads.getIndexes();
```

**Expected Impact:**
- Before: 250ms query
- After: 10-15ms query
- **Improvement: 95% faster** ✅

**Optimization #2 - Pagination:**

Instead of fetching all leads, paginate:

```typescript
// Backend (subscriptions.ts)
async getLeads(req: AuthRequest, res: Response) {
  const page = req.query.page || 1;
  const limit = 20;
  const skip = (page - 1) * limit;

  const leads = await Lead.find({ organizerId: req.user.id })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  const total = await Lead.countDocuments({ organizerId: req.user.id });

  res.json({
    leads,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
}
```

**Expected Impact:**
- Fetching 1000 leads: 5000ms → 50ms (100x faster)

**Optimization #3 - Field Projection:**

```javascript
// Only fetch needed fields, not entire document
db.leads.find(
  { organizerId: "user_123" },
  { name: 1, email: 1, status: 1, _id: 1 }  // exclude notes, metadata
)
```

**Expected Impact:**
- 20% network time reduction

### 3.3 API Response Caching

**Implement Redis Caching:**

```typescript
// Install Redis
npm install redis

// In CRM controller
import { createClient } from 'redis';
const redisClient = createClient();

async getLeads(req: AuthRequest, res: Response) {
  const organizerId = req.user.id;
  const cacheKey = `leads:${organizerId}`;

  // Check cache first
  const cached = await redisClient.get(cacheKey);
  if (cached) {
    return res.json(JSON.parse(cached));
  }

  // Fetch from DB
  const leads = await Lead.find({ organizerId }).limit(100);
  
  // Cache for 5 minutes
  await redisClient.setEx(cacheKey, 300, JSON.stringify(leads));

  res.json(leads);
}
```

**Cache Invalidation:**
```typescript
// When lead is updated, clear cache
async updateLead(req: AuthRequest, res: Response) {
  const lead = await Lead.findByIdAndUpdate(req.params.id, req.body);
  
  // Invalidate cache
  await redisClient.del(`leads:${lead.organizerId}`);
  
  res.json(lead);
}
```

**Expected Improvement:**
- Repeated requests: 500ms → 5ms (100x faster)
- Cache hit rate: ~70% for typical usage

---

## 4. Frontend Rendering Optimization

### 4.1 React Component Optimization

**Problem: Unnecessary Re-renders in CRMDashboard**

```typescript
// BEFORE - Inefficient
const CRMDashboard = () => {
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);

  // Every render triggers fetches
  useEffect(() => {
    fetchLeads();
    fetchStats();
  }, []); // But deps are missing!

  // LeadsTable re-renders even if leads haven't changed
  return <LeadsTable leads={leads} />;
};
```

**AFTER - Optimized**

```typescript
// Use React.memo to prevent unnecessary renders
const LeadsTable = React.memo(({ leads, onStatusChange }) => {
  return (
    <table>
      {leads.map(lead => (
        <LeadsRow key={lead._id} lead={lead} onStatusChange={onStatusChange} />
      ))}
    </table>
  );
}, (prevProps, nextProps) => {
  // Custom comparison - only re-render if leads actually changed
  return prevProps.leads === nextProps.leads;
});

// Use useMemo for expensive calculations
const StatsCards = ({ leads }) => {
  const stats = useMemo(() => {
    return {
      total: leads.length,
      new: leads.filter(l => l.status === 'new').length,
      // ... other calculations
    };
  }, [leads]); // Only recalculate if leads change

  return (
    <div>
      {/* Render stats */}
    </div>
  );
};
```

**Performance Impact:**
- Before: All components re-render on state change (10+ re-renders)
- After: Only affected components re-render (2-3 re-renders)
- **50% reduction in render time** ✅

### 4.2 List Virtualization

**Problem: Rendering 1000 leads creates 1000 DOM nodes**

```typescript
// BEFORE - All leads rendered
{leads.map(lead => (
  <LeadRow key={lead._id} lead={lead} />
))}

// Performance: 50ms for 100 leads, 500ms+ for 1000 leads
```

**AFTER - Virtual scrolling with react-window**

```typescript
npm install react-window

import { FixedSizeList as List } from 'react-window';

const LeadsTable = ({ leads }) => {
  const Row = ({ index, style }) => (
    <div style={style}>
      <LeadRow lead={leads[index]} />
    </div>
  );

  return (
    <List
      height={600}
      itemCount={leads.length}
      itemSize={50}
      width="100%"
    >
      {Row}
    </List>
  );
};

// Performance: Renders only visible rows (~15), not all 1000
// Before: 500ms, After: 20ms
```

**Expected Improvement:**
- 1000 leads: 500ms → 20ms (25x faster)

---

## 5. Image & Asset Optimization

### 5.1 Image Optimization

**Current State Check:**
```bash
# Check unoptimized sizes
ls -lh web/public/images/*.png
ls -lh web/public/images/*.jpg
```

**Optimization Strategy:**

```bash
# Install image optimizer
npm install --save-dev imagemin imagemin-mozjpeg imagemin-pngquant

# Create optimization script
npx imagemin web/public/images/*.{png,jpg} \
  --out-dir=web/public/images-optimized \
  --plugin=mozjpeg \
  --plugin=pngquant

# Results:
# Before: 500KB
# After: 120KB (75% reduction!)
```

**Use Next-Gen Formats:**

```html
<!-- BEFORE -->
<img src="logo.png" />

<!-- AFTER - with fallback -->
<picture>
  <source srcSet="logo.webp" type="image/webp" />
  <source srcSet="logo.png" type="image/png" />
  <img src="logo.png" alt="Logo" />
</picture>
```

### 5.2 CSS Optimization

**Remove Unused CSS:**

```bash
# Install PurgeCSS
npm install --save-dev purgecss

# Scan for unused classes
npx purgecss --css web/src/index.css --content "web/src/**/*.tsx"
```

**Expected Savings:**
- Tailwind CSS typically: 100-150KB
- After PurgeCSS: 20-30KB (80% reduction)

---

## 6. Database Query Optimization

### 6.1 Query Analysis

**Enable Slow Query Log:**

```javascript
// MongoDB slow query logging
db.setProfilingLevel(1, { slowms: 50 });

// Check slow queries
db.system.profile.find().sort({ ts: -1 }).limit(5).pretty();
```

**Analyze Execution Plan:**

```javascript
// Explain query execution
db.leads.find({ organizerId: "user_123" }).explain("executionStats");

// Look for:
// - executionStages.stage: "COLLSCAN" (BAD - table scan)
// - executionStages.stage: "IXSCAN" (GOOD - uses index)
// - executionStats.totalDocsExamined >> executionStats.nReturned (BAD)
```

### 6.2 Index Strategy

**Create Essential Indexes:**

```javascript
// Subscription lookups
db.organizersubscriptions.createIndex({ userId: 1, status: 1 });
db.organizersubscriptions.createIndex({ userId: 1, planType: 1 });

// Lead queries
db.leads.createIndex({ organizerId: 1, createdAt: -1 });
db.leads.createIndex({ organizerId: 1, status: 1 });
db.leads.createIndex({ email: 1 }, { unique: true, sparse: true });

// Payment lookups
db.payments.createIndex({ userId: 1, createdAt: -1 });
db.payments.createIndex({ paymentId: 1 }, { unique: true });

// Activity tracking
db.useractivity.createIndex({ userId: 1, createdAt: -1 });

// Verify all indexes
db.leads.getIndexes();
```

**Expected Impact:**
- Table scans: Eliminated
- Query time: 300-500ms → 10-50ms (10-50x faster)
- Index size cost: ~20MB for optimal indexing (acceptable trade-off)

---

## 7. Real-World Performance Tests

### 7.1 Load Test Scenario

**Setup: Simulate 100 concurrent users**

```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Test CRM endpoint with 100 concurrent users
ab -n 1000 -c 100 \
  -H "Authorization: Bearer VALID_TOKEN" \
  http://localhost:3000/api/crm/leads

# Expected Results (Good):
# Requests per second: 50+
# Failed requests: 0
# Time per request: 2000ms (100 concurrent)
```

### 7.2 Payment Processing Load Test

```bash
# Test payment webhook endpoint
ab -n 500 -c 50 \
  -H "Content-Type: application/json" \
  -p webhook-payload.json \
  http://localhost:3000/api/subscriptions/webhook

# Expected Results:
# 0 errors
# < 100ms response time per request
```

### 7.3 Database Stress Test

```bash
# Insert 10,000 test leads
for i in {1..10000}; do
  db.leads.insertOne({
    organizerId: "stress_test",
    name: "Lead $i",
    email: "lead$i@test.com",
    phone: "9999999999",
    status: "new",
    createdAt: new Date()
  })
done

# Query all leads (with index)
time db.leads.find({ organizerId: "stress_test" }).count()
# Expected: < 50ms
```

---

## 8. Optimization Checklist

### Frontend
- [ ] Code splitting enabled (lazy loading)
- [ ] React.memo applied to list items
- [ ] useMemo used for expensive calculations
- [ ] Lighthouse score > 85
- [ ] Bundle size < 300KB (gzipped)
- [ ] Images optimized and compressed
- [ ] Unused CSS removed (PurgeCSS)
- [ ] Virtual scrolling for large lists

### Backend
- [ ] API response time < 500ms (95th percentile)
- [ ] Database indexes created for common queries
- [ ] Pagination implemented for large datasets
- [ ] Redis caching for frequent queries
- [ ] Database query logging enabled
- [ ] Slow queries identified and fixed
- [ ] Connection pooling configured

### Database
- [ ] Compound indexes created
- [ ] Field projection used (only fetch needed fields)
- [ ] Pagination implemented
- [ ] Sharding considered for > 100M documents

### Deployment
- [ ] Gzip compression enabled
- [ ] HTTP/2 enabled
- [ ] Browser caching configured
- [ ] CDN for static assets
- [ ] Database backups automated
- [ ] Monitoring and alerting setup

---

## 9. Monitoring & Continuous Optimization

### 9.1 Key Metrics to Monitor

```typescript
// Setup APM (Application Performance Monitoring)
// Using tools like New Relic, DataDog, or custom solution

interface PerformanceMetrics {
  // Frontend
  pageLoadTime: number;      // Target: < 3s
  fcp: number;              // Target: < 1.5s
  lcp: number;              // Target: < 2.5s
  cls: number;              // Target: < 0.1
  
  // Backend API
  avgResponseTime: number;   // Target: < 500ms
  p95ResponseTime: number;   // Target: < 1000ms
  p99ResponseTime: number;   // Target: < 2000ms
  errorRate: number;        // Target: < 0.1%
  
  // Database
  avgQueryTime: number;      // Target: < 200ms
  slowQueryCount: number;    // Target: < 5/hour
  
  // Business
  conversionRate: number;
  paymentSuccessRate: number;
}
```

### 9.2 Alerting Rules

```javascript
// Alert if metrics exceed thresholds
if (pageLoadTime > 5000) {
  sendAlert('Page load time critical', { severity: 'high' });
}

if (p95ResponseTime > 1500) {
  sendAlert('API response time degraded', { severity: 'medium' });
}

if (errorRate > 1) {
  sendAlert('Error rate above 1%', { severity: 'critical' });
}
```

---

## 10. Quick Optimization Win Summary

**Top 5 Optimizations (Fastest ROI):**

1. **Database Indexing** (1 hour, 50x faster)
   - Create indexes on organizerId, userId, createdAt
   - Time investment: 30 minutes
   - Performance gain: 300ms → 10ms

2. **API Response Caching** (2 hours, 100x faster for cached requests)
   - Redis cache for lead lists
   - 5 minute TTL
   - Performance gain: 500ms → 5ms (cache hit)

3. **React Component Memoization** (1 hour, 50% faster renders)
   - React.memo on table rows
   - useMemo for stats calculation
   - Performance gain: 100ms → 50ms render time

4. **Image Optimization** (30 minutes, 75% smaller)
   - Compress PNGs and JPGs
   - Use WebP format
   - Performance gain: 500KB → 120KB

5. **Code Splitting** (1 hour, 30% smaller initial bundle)
   - Lazy load CRM dashboard
   - Lazy load payment forms
   - Performance gain: 350KB → 250KB

**Total Time Investment: 5.5 hours**
**Performance Improvement: 10-100x faster in key areas**
**Status: Worth doing before launch** ✅

---

## Deployment Performance Checklist

Before going live:

```bash
# 1. Run Lighthouse audit
npm run audit:lighthouse

# 2. Run load test
npm run test:load

# 3. Check database indexes
db.leads.getIndexes()
db.organizersubscriptions.getIndexes()

# 4. Enable monitoring
export MONITORING_ENABLED=true

# 5. Verify caching
curl http://localhost:3000/api/crm/leads -v | grep cache-control

# 6. Check bundle size
npm run build:analyze

# 7. Test payment flow under load
npm run test:payment:load
```

All optimizations should achieve target metrics before production launch.

