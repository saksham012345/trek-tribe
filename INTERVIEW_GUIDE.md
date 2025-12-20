# Trek Tribe - Complete Technical Interview Guide

**Last Updated:** December 20, 2025  
**Platform:** MERN + AI Travel & Trip Management Platform  
**Architecture:** Microservices (Frontend, Backend API, AI Service)

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Frontend (React + TypeScript)](#frontend-react--typescript)
3. [Backend API (Node.js + Express)](#backend-api-nodejs--express)
4. [AI Service (Python + FastAPI)](#ai-service-python--fastapi)
5. [Database & State Management](#database--state-management)
6. [DevOps & Deployment](#devops--deployment)
7. [Key Technical Keywords](#key-technical-keywords)

---

## Architecture Overview

### Tech Stack Summary
```
┌─────────────────────────────────────────────────────┐
│ Frontend (Vercel)                                   │
│ React 18 + TypeScript + TailwindCSS                 │
└──────────────────┬──────────────────────────────────┘
                   │ Axios + Socket.IO Client
                   ↓
┌─────────────────────────────────────────────────────┐
│ Backend API (Render)                                │
│ Node.js + Express + TypeScript + Socket.IO          │
│ Helmet, CORS, Rate Limiting, JWT Auth              │
└──────────────────┬──────────────────────────────────┘
                   │
         ┌─────────┴──────────┬─────────────┐
         ↓                    ↓             ↓
┌─────────────────┐  ┌────────────┐  ┌────────────────┐
│ MongoDB Atlas   │  │ Redis      │  │ AI Service     │
│ Database        │  │ Cache/Jobs │  │ (Python)       │
└─────────────────┘  └────────────┘  └────────────────┘
```

### Microservices Breakdown
- **Frontend (`/web`)**: React SPA with client-side routing
- **Backend API (`/services/api`)**: RESTful API + WebSocket server
- **AI Service (`/ai-service`)**: NLP-powered trip recommendations & RAG chatbot

---

## Frontend (React + TypeScript)

### Key Dependencies (`web/package.json`)

| Package | Purpose | Use Case |
|---------|---------|----------|
| `react` 18.2.0 | UI framework | Component-based SPA |
| `react-router-dom` 6.8.0 | Client-side routing | `/trips`, `/profile`, `/dashboard` |
| `axios` 1.3.0 | HTTP client | API calls with interceptors |
| `socket.io-client` 4.8.1 | WebSocket client | Real-time notifications, chat |
| `react-toastify` 11.0.5 | Toast notifications | User feedback (success/error) |
| `chart.js` + `react-chartjs-2` | Data visualization | Analytics dashboards |
| `lucide-react` | Icon library | Modern SVG icons |
| `tailwindcss` 3.2.0 | Utility-first CSS | Responsive styling |
| `typescript` 4.9.0 | Type safety | Static typing, IntelliSense |

### Core Features & Workflows

#### 1. **Authentication Flow** (JWT-based)
- **File:** `web/src/contexts/AuthContext.tsx`
- **Flow:**
  ```typescript
  login(email, password) 
    → POST /auth/login 
    → Store JWT in localStorage 
    → Decode user role (traveler/organizer/agent/admin)
    → Redirect based on role
  ```
- **Persistence:** `localStorage.getItem('token')` + `localStorage.getItem('user')`
- **Auto-Refresh:** On mount, validate token via `GET /auth/me`

#### 2. **Real-Time Features** (Socket.IO)
- **File:** `web/src/components/NotificationCenter.tsx`
- **Events:**
  - `notification` → New booking, payment, ticket updates
  - `ticket:update` → Support ticket status changes
  - `chat:message` → Live chat messages
- **Connection:**
  ```typescript
  const socket = io(process.env.REACT_APP_API_URL, {
    auth: { token },
    transports: ['websocket', 'polling']
  });
  ```

#### 3. **API Client Configuration**
- **File:** `web/src/config/api.ts`
- **Features:**
  - Axios instance with `baseURL` fallback
  - Request interceptor: Inject `Authorization: Bearer <token>`
  - Response interceptor: Auto-logout on 401, cache GET responses
  - **Caching Strategy:**
    ```typescript
    apiCache.set(url, data, params, ttl)
    - Trips: 10 min TTL
    - AI recommendations: 30 min TTL
    - Default: 5 min TTL
    ```

#### 4. **State Management**
- **Local State:** React Hooks (`useState`, `useEffect`)
- **Global State:** Context API (`AuthContext`, `useAuth()`)
- **Persistent State:** `localStorage` for auth, `sessionStorage` for temp data

#### 5. **Component Structure**
```
src/
├── components/
│   ├── crm/TicketsView.tsx      # Support ticket dashboard
│   ├── NotificationCenter.tsx   # Real-time notification bell
│   ├── GoogleLoginButton.tsx    # OAuth integration
│   ├── AIChatWidgetClean.tsx    # AI chatbot widget
│   └── ReviewModal.tsx          # Trip review form
├── pages/
│   ├── Home.tsx                 # Landing page
│   ├── Trips.tsx                # Trip listing with filters
│   ├── TripDetails.tsx          # Trip detail + booking
│   ├── OrganizerDashboard.tsx   # Organizer analytics
│   ├── AdminDashboard.tsx       # Admin panel
│   └── EnhancedAgentDashboard.tsx # Agent CRM
├── contexts/
│   └── AuthContext.tsx          # Global auth state
└── config/
    └── api.ts                   # Axios configuration
```

---

## Backend API (Node.js + Express)

### Key Dependencies (`services/api/package.json`)

| Package | Purpose | Technical Concept |
|---------|---------|-------------------|
| `express` 4.19.2 | Web framework | Middleware pipeline, RESTful routing |
| `mongoose` 8.5.1 | MongoDB ODM | Schema validation, query builder |
| `jsonwebtoken` 9.0.2 | JWT auth | Stateless authentication |
| `bcryptjs` 2.4.3 | Password hashing | One-way encryption (salt + hash) |
| `socket.io` 4.7.5 | WebSocket server | Bi-directional event-based communication |
| `redis` 4.6.0 | Caching & pub/sub | Session store, rate limiting |
| `helmet` 7.1.0 | Security headers | XSS, CSRF, CSP protection |
| `cors` 2.8.5 | Cross-origin | Allow frontend requests |
| `express-rate-limit` 8.2.1 | Rate limiting | Brute-force protection |
| `pino` 9.3.2 | Structured logging | JSON logs for production |
| `razorpay` 2.9.6 | Payment gateway | Trip bookings, wallet top-ups |
| `nodemailer` 7.0.9 | Email service | Transactional emails (booking confirmations) |
| `multer` 1.4.5 | File uploads | Image uploads (profile, trip photos) |
| `express-validator` 7.2.1 | Input validation | Sanitize and validate request bodies |
| `zod` 3.23.8 | Schema validation | Type-safe validation |
| `prom-client` 14.0.0 | Prometheus metrics | Request latency, error rates |
| `node-cron` 4.2.1 | Scheduled jobs | Payment retries, cleanup tasks |

### Core Architecture Patterns

#### 1. **Middleware Pipeline**
- **File:** `services/api/src/index.ts`
- **Order:**
  ```typescript
  app.use(logger.requestLogger())          // Structured logging
  app.use(metrics.metricsMiddleware())     // Prometheus metrics
  app.use(helmet())                        // Security headers
  app.use(cors({ origin: allowedOrigins }))// CORS policy
  app.use(apiLimiter)                      // Rate limiting
  app.use(express.json({ limit: '10mb' })) // Body parsing
  app.use(sanitizeInputs)                  // XSS prevention
  app.use('/api/auth', authRoutes)         // Route mounting
  app.use(errorHandler)                    // Centralized error handling
  ```

#### 2. **Authentication & Authorization**
- **File:** `services/api/src/middleware/auth.ts`
- **JWT Verification:**
  ```typescript
  verifyToken(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { userId, role, email }
    next();
  }
  ```
- **Role-Based Access Control (RBAC):**
  ```typescript
  requireRole(['admin', 'agent'])(req, res, next) {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  }
  ```

#### 3. **Rate Limiting Strategy**
- **File:** `services/api/src/middleware/rateLimiter.ts`
- **Limits:**
  - General API: 100 req/15 min
  - Auth endpoints: 5 req/15 min (brute-force protection)
  - OTP requests: 3 req/hour
  - Payment endpoints: 10 req/hour
  - Trip creation: 20 trips/day

#### 4. **Structured Logging (Pino)**
- **File:** `services/api/src/utils/logger.ts`
- **Features:**
  - JSON logs for machine parsing
  - Request ID tracing
  - Context binding (userId, role)
  - Express middleware integration
  ```typescript
  logger.info('User login', { userId, email, ip });
  logger.error('Payment failed', { error, orderId, amount });
  ```

#### 5. **WebSocket (Socket.IO)**
- **File:** `services/api/src/services/socketService.ts`
- **Authentication:**
  ```typescript
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.data.userId = decoded.userId;
    socket.data.userRole = decoded.role;
    next();
  });
  ```
- **Event Handlers:**
  ```typescript
  socket.on('join-room', (roomId) => socket.join(roomId));
  socket.on('send-message', async (data) => {
    io.to(roomId).emit('new-message', message);
  });
  ```

#### 6. **Redis Integration**
- **File:** `services/api/src/services/redisService.ts`
- **Use Cases:**
  - Session storage: `redis.set('session:userId', sessionData, 'EX', 3600)`
  - AI response caching: `redis.get('ai:query:hash')`
  - Rate limiting: `redis.incr('ratelimit:ip')`
  - Pub/Sub: `redis.publish('notifications', event)`

#### 7. **Payment Processing (Razorpay)**
- **File:** `services/api/src/routes/payment.ts`
- **Workflow:**
  ```
  1. POST /api/payment/create-order → Razorpay Order
  2. Frontend displays Razorpay checkout
  3. POST /api/payment/verify → Verify signature
  4. POST /api/payment/webhook → Razorpay webhook (async)
  5. Retry failed charges via chargeRetryWorker
  ```
- **Signature Verification:**
  ```typescript
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(orderId + '|' + paymentId)
    .digest('hex');
  ```

#### 8. **Background Jobs (node-cron)**
- **File:** `services/api/src/services/cronScheduler.ts`
- **Jobs:**
  - Payment retries: Every 30 min
  - Cleanup old sessions: Daily at 2 AM
  - Send reminder emails: Hourly check

#### 9. **Error Handling**
- **File:** `services/api/src/middleware/errorHandler.ts`
- **Centralized:**
  ```typescript
  app.use((err, req, res, next) => {
    logger.error('Request failed', { error: err.message, stack: err.stack });
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  });
  ```

### Route Structure

```
/api/auth           → Login, register, JWT refresh
/api/trips          → CRUD operations for trips
/api/bookings       → Trip bookings, cancellations
/api/reviews        → User reviews & ratings
/api/payment        → Razorpay integration
/api/agent          → CRM endpoints (tickets, leads)
/api/support        → Support ticket management
/api/ai             → AI chatbot & recommendations
/api/admin          → Admin panel endpoints
/socket.io/         → WebSocket handshake
/health             → Health check (DB + Redis ping)
/metrics            → Prometheus metrics
```

---

## AI Service (Python + FastAPI)

### Key Dependencies (`ai-service/requirements.txt`)

| Package | Purpose | Use Case |
|---------|---------|----------|
| `fastapi` | Web framework | Async REST API |
| `transformers` | Hugging Face models | NLP model inference |
| `torch` | PyTorch | Deep learning backend |
| `uvicorn` | ASGI server | Production server |
| `redis` | Caching | Distributed rate limiting |
| `prometheus_client` | Metrics | Monitor request latency |
| `sentence-transformers` | Embeddings | Semantic search |
| `faiss-cpu` | Vector search | RAG retrieval |

### Core Features

#### 1. **RAG (Retrieval-Augmented Generation)**
- **File:** `ai-service/app/retrieval.py`
- **Workflow:**
  ```
  1. User query → Embed query using sentence-transformers
  2. FAISS index search → Top 3 relevant docs
  3. Concat docs + query → LLM prompt
  4. Generate response using Flan-T5
  ```

#### 2. **Rate Limiting (Redis + In-Memory Fallback)**
- **File:** `ai-service/app/main.py`
- **Strategy:**
  ```python
  def is_rate_limited(ip: str) -> bool:
      if redis_client:
          current = redis_client.incr(f"ratelimit:{ip}")
          if current == 1:
              redis_client.expire(f"ratelimit:{ip}", AI_RATE_WINDOW)
          return current > AI_RATE_LIMIT
      # Fallback to in-memory dict
  ```

#### 3. **API Endpoints**
- `POST /generate` → Generate trip recommendations
- `POST /retrieve` → Fetch relevant documents (RAG)
- `GET /health` → Service health check
- `GET /metrics` → Prometheus metrics

---

## Database & State Management

### MongoDB Schema Design

#### 1. **User Model**
```javascript
{
  _id: ObjectId,
  email: String (unique, indexed),
  password: String (bcrypt hashed),
  name: String,
  role: Enum['traveler', 'organizer', 'agent', 'admin'],
  profilePhoto: String,
  organizerProfile: {
    uniqueUrl: String,
    bankDetails: Object
  },
  createdAt: Date
}
```

#### 2. **Trip Model**
```javascript
{
  _id: ObjectId,
  title: String (indexed),
  destination: String (indexed),
  organizerId: ObjectId → User,
  price: Number,
  capacity: Number,
  participants: [ObjectId] → User,
  categories: [String] (indexed),
  status: Enum['active', 'cancelled', 'completed'],
  coverImage: String,
  itinerary: [Object],
  createdAt: Date
}
```

#### 3. **Booking Model**
```javascript
{
  _id: ObjectId,
  tripId: ObjectId → Trip,
  userId: ObjectId → User,
  paymentStatus: Enum['pending', 'paid', 'failed', 'refunded'],
  razorpayOrderId: String (unique),
  amount: Number,
  travelers: [Object],
  createdAt: Date
}
```

#### 4. **SupportTicket Model**
```javascript
{
  _id: ObjectId,
  ticketId: String (auto-generated: TT-{timestamp}-{random}),
  subject: String,
  status: Enum['open', 'in-progress', 'resolved', 'closed'],
  priority: Enum['low', 'medium', 'high', 'urgent'],
  messages: [{ sender: String, message: String, timestamp: Date }],
  userId: ObjectId → User,
  assignedAgent: ObjectId → User
}
```

### Indexing Strategy
```javascript
db.trips.createIndex({ destination: 'text', title: 'text' })
db.users.createIndex({ email: 1 }, { unique: true })
db.bookings.createIndex({ userId: 1, tripId: 1 })
```

---

## DevOps & Deployment

### Hosting Platforms
- **Frontend:** Vercel (auto-deploy from GitHub)
- **Backend API:** Render (Node.js service)
- **AI Service:** Render (Docker container)
- **Database:** MongoDB Atlas (M0 Free Tier)
- **Cache:** Redis Cloud

### Environment Variables
- **Frontend:**
  ```bash
  REACT_APP_API_URL=https://trekktribe.onrender.com
  REACT_APP_SOCKET_URL=https://trekktribe.onrender.com
  REACT_APP_RAZORPAY_KEY_ID=rzp_live_xxx
  ```
- **Backend:**
  ```bash
  MONGODB_URI=mongodb+srv://...
  JWT_SECRET=<secret>
  REDIS_URL=redis://...
  RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
  AI_SERVICE_URL=https://trek-tribe-ai-service.onrender.com
  ```

### CI/CD Pipeline
```
GitHub Push → Render Auto-Deploy → Build (npm run build) 
→ Health Check → Live Production
```

---

## Key Technical Keywords

### Security
- **Helmet:** Sets HTTP headers (CSP, XSS protection, HSTS)
- **CORS:** Cross-Origin Resource Sharing policy
- **JWT:** Stateless token-based authentication
- **Bcrypt:** Password hashing with salt rounds
- **Input Sanitization:** XSS prevention via `express-validator`
- **Rate Limiting:** Brute-force attack prevention

### Performance
- **Redis:** In-memory caching, session store
- **API Caching:** Client-side (axios interceptor), server-side (Redis)
- **Database Indexing:** Text search, compound indexes
- **Lazy Loading:** React code splitting
- **CDN:** Static assets via Vercel Edge Network

### Observability
- **Pino:** Structured JSON logging
- **Prometheus:** Metrics collection (request latency, error rates)
- **Sentry:** Error tracking (optional)
- **Health Checks:** `/health` endpoint for uptime monitoring

### Real-Time
- **Socket.IO:** WebSocket with fallback to long-polling
- **Event-Driven:** Pub/Sub via Redis
- **Room-Based:** Namespace isolation (chat rooms, notifications)

### AI/ML
- **Transformers:** Hugging Face library for NLP
- **FAISS:** Vector similarity search
- **RAG:** Retrieval-Augmented Generation
- **Embeddings:** Sentence-BERT for semantic search
- **Prompt Engineering:** Context-aware LLM prompts

### Testing
- **Jest:** Unit testing framework (backend)
- **Supertest:** API endpoint testing
- **React Testing Library:** Component testing
- **K6:** Load testing (WebSocket stress tests)

### Data Validation
- **Zod:** Type-safe schema validation
- **Express-Validator:** Request body sanitization
- **Mongoose Schemas:** Database-level validation

---

## Common Interview Questions & Answers

### Q: How does authentication work?
**A:** JWT-based stateless auth. User logs in → Backend verifies password → Issues JWT (signed with secret) → Client stores in `localStorage` → Every request includes `Authorization: Bearer <token>` → Backend verifies signature and decodes payload.

### Q: How do you prevent brute-force attacks?
**A:** Multi-layered:
1. Rate limiting (5 login attempts/15 min via `express-rate-limit`)
2. Account lockout after failed attempts (stored in MongoDB)
3. CAPTCHA on frontend (optional)
4. IP-based blacklisting (Redis)

### Q: Explain the payment flow.
**A:**
1. User clicks "Book Trip" → Frontend calls `POST /api/payment/create-order` → Backend creates Razorpay order
2. Frontend displays Razorpay checkout modal
3. User pays → Razorpay redirects to success URL with `paymentId` + `signature`
4. Frontend calls `POST /api/payment/verify` → Backend verifies HMAC signature
5. Razorpay webhook (`POST /api/payment/webhook`) confirms payment asynchronously
6. Background worker retries failed charges every 30 min

### Q: How do you handle real-time notifications?
**A:** Socket.IO server listens on `/socket.io/` path. When a booking is created, the API server emits a `notification` event to the organizer's socket room. The frontend `NotificationCenter` component listens for this event and displays a toast.

### Q: What's your caching strategy?
**A:** 
- **Client-side:** Axios interceptor caches GET responses in memory (5-30 min TTL based on endpoint)
- **Server-side:** Redis caches AI responses (key = query hash, TTL = 1 hour)
- **Database:** MongoDB query result caching via Mongoose lean queries

### Q: How do you scale the AI service?
**A:** 
1. Horizontal scaling: Deploy multiple FastAPI instances behind a load balancer
2. Model optimization: Use quantized models (INT8) for faster inference
3. Batch processing: Queue requests via Redis and process in batches
4. CDN caching: Cache common queries at edge locations

### Q: Describe your error handling strategy.
**A:** 
- **Frontend:** Axios interceptors catch errors, display toasts, log to console
- **Backend:** Centralized `errorHandler` middleware catches all Express errors, logs via Pino, returns structured JSON response
- **AI Service:** FastAPI exception handlers convert Python exceptions to HTTP 500/400 responses
- **Monitoring:** Sentry captures uncaught exceptions in production

---

## Code Quality & Best Practices

### TypeScript Strictness
```json
{
  "strict": false,          // Incremental migration
  "noImplicitAny": false,   // Allow any type temporarily
  "lib": ["esnext"],        // Modern JS features
  "types": ["node", "react"]
}
```

### Logging Standards
```typescript
logger.info('message', { userId, action, metadata });
logger.error('error', { error: err.message, stack: err.stack });
```

### API Response Format
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "timestamp": "2025-12-20T10:00:00Z"
}
```

---

**End of Interview Guide**
