# Trek Tribe — Interview Overview

Executive summary
- Trek Tribe is a full‑stack travel platform with multi‑role access (traveler, organizer, agent, admin), trip management, reviews, wishlist, real‑time chat, WhatsApp/Telegram/email communication, and AI support (RAG).
- Architecture: React (CRA + TypeScript) frontend; Node/Express (TypeScript) API; MongoDB (Mongoose); Socket.io; external services (Gmail SMTP, WhatsApp Web.js, Telegram, Firebase Storage, OpenAI); Docker/Nginx; optional Vercel/Render.

Feature list (minor → major)
- Minor
  - Health check endpoint: /health
  - Static file hosting for uploads: /uploads
  - CORS + Helmet security headers
  - Nginx rate limiting (auth vs general API), gzip, TLS headers
  - QR code generation for trips/bookings
  - Email templates (EJS) + notifications
  - Public user profiles
- Medium
  - JWT auth: register/login/me, password reset, role‑based auth
  - User profiles (enhanced profiles incl. documents/photos)
  - Reviews (trip/organizer) with moderation hooks
  - Wishlist (add/remove/list)
  - File uploads: profile pictures, trip images, verification docs (Multer + Firebase)
  - Search/discovery with advanced filters (q, category, price range, dates, destination)
  - Basic analytics/stats endpoints
- Major
  - Trip management: create, itinerary (schedule), images, capacity/price, geographic data, participant details (emergency, medical, experience), join/leave
  - Group bookings: organizer participant management and updates (route exists; mounting staged)
  - Admin panel: users/trips management, role changes, cleanup, bulk moderation, system stats
  - Agent/support system: tickets, assignment, status workflow, performance metrics, customer lookup/history
  - Real‑time features: Socket.io messaging/status
  - WhatsApp and Telegram integration
  - AI support: OpenAI‑based chat, RAG (embeddings, ingestion, caching, metrics)
  - CLI admin tools for ops (stats, lists, backup, cleanup)

Tech stack (keywords to mention)
- Frontend: React 18, TypeScript, Create React App, React Router v6, Tailwind CSS, socket.io‑client
- Backend: Node.js, Express, TypeScript, Mongoose (MongoDB), JWT, Multer, Zod, Helmet, CORS, Socket.io, EJS
- Integrations: Nodemailer (Gmail SMTP), WhatsApp Web.js, Telegram Bot API, Firebase Storage, OpenAI API, QRCode
- Tooling/DevOps: Docker, Docker Compose, Nginx reverse proxy, Vercel (static), Render (API/web), Commander CLI, logging utilities
- Config: .env, tsconfig, serverless Express entry, Nginx TLS + rate limits

High‑level architecture
- Web (CRA) → Nginx (TLS, security headers, rate limiting, static, routing) → API (Express/TS) → MongoDB
- Real‑time: Socket.io initialized on API HTTP server
- External services: Gmail SMTP, WhatsApp, Telegram, Firebase, OpenAI
- Serverless‑compatible Express entry for alternative hosting

File and responsibility map
- Root
  - `package.json`: workspace scripts to orchestrate API/Web and Docker
  - `docker-compose.yml`: services (mongo, api:4000, web:80)
  - `nginx.conf`: TLS, security headers (HSTS, XFO, etc.), gzip, `limit_req` zones, API/frontend upstreams, Socket.io, static caching
  - `vercel.json`: static build (web/build), API proxy to external API
  - Documentation: `README.md`, `API_DOCUMENTATION.md`, `FUNCTIONALITY_DOCUMENTATION.md` (product and API overviews)
- Backend API (`services/api`)
  - `Dockerfile`: build TS, prune devDeps, start `dist/index.js`
  - `tsconfig.json`: CommonJS, `outDir=dist`
  - `healthcheck.js`: container probe hitting `/health`
  - `package.json`: scripts (dev, build, start, CLI, setup scripts)
  - Entrypoints
    - `src/index.ts`: main server; middleware (helmet, cors, JSON limits), request logging/timeouts; DB connect with retry/backoff; initializes `whatsappService` and `socketService`; serves `/uploads`; mounts routes; `/health`; graceful shutdown
    - `src/serverless.ts`: Express app variant for serverless with cached DB connection; `/api/*` prefixes + legacy routes
  - Routes (`src/routes`)
    - `auth.ts`: register/login/me, password reset (JWT)
    - `trips.ts`: list/details, create/update (role‑gated), join/leave, schedule/images/geodata
    - `bookings.ts`: booking flows; QR codes; participants
    - `reviews.ts`: create/list; moderation hooks
    - `wishlist.ts`: add/remove/list
    - `files.ts`, `fileUploadProd.ts`: uploads (Multer); production‑ready upload handler; Firebase integration
    - `admin.ts`: users/trips admin ops, role changes, cleanup, stats
    - `agent.ts`: tickets, assign, status update, messages, customers search/detail, services status
    - `chatSupportRoutes.ts`: AI chat support endpoint(s)
    - `ai.ts`: OpenAI/RAG‑related endpoints
    - `follow.ts`, `posts.ts`, `search.ts`, `support.ts`, `stats.ts`, `views.ts`, `publicProfile.ts`, `profile.ts`, `enhancedProfile.ts`
    - Present but staged: `groupBookings.ts`, `reviewVerification.ts` (mount when FE ready)
  - Services (`src/services`)
    - Integrations: `whatsappService.ts`, `telegramService.ts`, `emailService.ts`, `firebaseService.ts`, `socketService.ts`
    - AI/RAG: `aiSupportService.ts`, `ragService.ts`, `embeddingService.ts`, `knowledgeIngestionService.ts`, `aiCacheService.ts`, `aiMetricsService.ts`
  - Models (`src/models`)
    - `User.ts`, `Trip.ts`, `Review.ts`, `Wishlist.ts`, `GroupBooking.ts`, `SupportTicket.ts`, `ChatSession.ts`, `Post.ts`, `Comment.ts`, `Follow.ts`, `KnowledgeBase.ts`
  - Middleware (`src/middleware`): `auth.ts` (JWT), `isAdmin.ts`
  - Utils (`src/utils`): `fileHandler.ts` (limits/validation/storage), `errors.ts`, `logger.ts`, `routeWrapper.ts`
  - Config (`src/config/ai.ts`): AI configuration (keys/models/thresholds)
  - CLI (`src/cli`): Commander‑based admin tools; Scripts in `src/scripts` for setup/cleanup
- Frontend (`web/`)
  - CRA + TypeScript + Tailwind; React Router; socket.io‑client
  - `package.json`: scripts (start/build/test, bundle analyzer, preview)
  - `tsconfig.json`: strict, `jsx=react-jsx`
  - `tailwind.config.js`: theme extensions, colors, animations
  - `Dockerfile`: multi‑stage build → Nginx serve build
  - `nginx.conf`: frontend static server config
  - `.env.example`: `REACT_APP_API_URL`, `REACT_APP_SOCKET_URL`, feature flags (chat, AI support, QR payments)

API highlights (by domain)
- Auth: `/auth/register`, `/auth/login`, `/auth/me`, `/auth/forgot-password`, `/auth/reset-password`
- Trips: `/trips` (list/search/filter); `/trips/:id`; join/leave
- Profiles: `/profile` (get/update), `/api/public` (public profile)
- Reviews: `/reviews` (create/list); moderation via admin routes
- Wishlist: `/wishlist` (CRUD)
- Files: `/files/upload` and production uploads via `/api/uploads`
- Admin: `/admin/stats`, users/trips management, role changes, cleanup
- Agent/support: `/agent/*` (tickets/messages/assign/customers), `/support`
- AI: `/api/ai/*` and `/chat` for AI support
- Real‑time: Socket.io endpoint `/socket.io` (proxied via Nginx)

Data model notes (high‑level)
- User: role enum [traveler, organizer, agent, admin], profile fields, optional organizer profile
- Trip: organizerId, categories, destination, GeoJSON location, schedule[], images, capacity/price, participants[], participantDetails[], status
- SupportTicket: ticketId, user/agent refs, category/priority/status, messages[], SLA metrics
- Review, Wishlist, GroupBooking, Posts/Comments/Follow, KnowledgeBase for AI retrieval

Security and reliability
- JWT authentication; `isAdmin` guard for admin routes
- Helmet/CORS in API; Nginx TLS, HSTS, security headers
- Nginx rate limits: stricter for auth than general API
- File size limits (10MB), MIME checks; static `/uploads` served with cache controls
- DB connection retries with exponential backoff; health endpoint includes Mongo ping/state
- Graceful shutdown: closes Socket.io and Mongo connections

Performance and scalability
- Socket.io for real‑time interactions
- MongoDB indexing strategy implied by queries (optimize text/category/date/geo fields)
- Serverless‑friendly Express entry with connection caching
- CRA static build served by Nginx; immutable caching for assets

Deployment
- Docker Compose: mongo, api (4000), web (80)
- Render: API `node dist/index.js`; Web static (see `web/render.yaml`)
- Vercel: Web static; API proxied to external API host (see root `vercel.json`)
- Environment essentials
  - Backend: `MONGODB_URI`, `JWT_SECRET` (32+ chars), `FRONTEND_URL`, email/WhatsApp/Firebase/OpenAI settings as needed
  - Frontend: `REACT_APP_API_URL`, `REACT_APP_SOCKET_URL`, feature flags

CLI and scripts (API)
- CLI (Commander): `npm run cli:help | stats | user:list | trip:list | backup | cleanup | logs`
- Setup scripts: `npm run setup:db`, `setup:users`; maintenance: `cleanup:trips`

Interview talking points
- Unified HTTP + WebSocket server (Express + Socket.io) with lifecycle management and graceful shutdown
- Mongo/Mongoose chosen for flexible itineraries and GeoJSON‑based discovery
- Edge rate limiting and TLS/security via Nginx before requests reach Node
- File handling with Multer and Firebase; production‑ready upload route; static `/uploads` serving with strict size/type controls
- AI/RAG modular services (ingestion, embeddings, cache, metrics) decoupled from routing; serverless entry available
- Role‑based access via middleware; clear separation of admin/agent/organizer pathways
- Resilience: DB retry + health checks + signal handling for safe shutdowns
- Deployment flexibility: Docker‑first; Vercel/Render; serverless variant

Potential gotchas
- `groupBookings.ts` and `reviewVerification.ts` exist but are not mounted in `src/index.ts` (enable when frontend is ready)
- Keep CORS origins in `src/index.ts` aligned with deployed frontend domains
- Ensure strong `JWT_SECRET` per environment
- WhatsApp service initialization is best‑effort; features degrade gracefully if not connected
- CRA build/API URL must be set correctly at build time

Elevator pitch
- “Trek Tribe is a React + Node/Express + Mongo platform for group adventures with multi‑role access, real‑time chat, and AI‑powered support. It integrates WhatsApp/Telegram and email notifications, uses Nginx for TLS and rate limiting, and ships with CLI tools for ops. The backend is TypeScript with Socket.io and a modular RAG stack, deployable via Docker, Render, or a serverless entry.”
