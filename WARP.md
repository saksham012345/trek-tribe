# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Quick Start Commands
```powershell
# Start all services with Docker (recommended)
npm run dev

# Alternative: Start services individually for development
npm run install:all  # Install all dependencies
npm run dev:api      # Start API server (Terminal 1)
npm run dev:web      # Start web app (Terminal 2)

# Windows-specific development script
./dev.ps1
```

### Service Management
```powershell
# Docker-based commands
npm run build        # Build all Docker images
npm run start        # Start containers (production mode)
npm run stop         # Stop all services
npm run clean        # Stop services and remove volumes

# Individual service commands
cd services/api
npm run dev          # Start API with nodemon (hot reload)
npm run build        # Build TypeScript to JavaScript
npm start            # Run production build

cd web
npm start            # Start React development server
npm run build        # Build for production
npm test             # Run React tests
```

### Database Commands
```powershell
# Start standalone MongoDB
docker run -d -p 27017:27017 --name trekk-mongo mongo:6

# Check database connection
curl http://localhost:4000/health
```

### Testing Commands
```powershell
# Test API functionality
node test-connection.js
node test-file-upload.js
node test-frontend-backend.js

# CLI management tools
cd services/api
npm run cli:list     # List all trips
npm run cli:stats    # Show database statistics
npm run cli -- export trips-backup.json  # Export data
npm run cli -- create sample-trip.json   # Import trip data
```

## Architecture Overview

### High-Level Structure
This is a **microservices travel platform** with separate frontend and backend services:

```
trek-tribe/
├── services/api/     # Node.js/Express API server
├── web/              # React TypeScript frontend
├── docker-compose.yml # Container orchestration
└── package.json      # Root workspace configuration
```

### Technology Stack
- **Backend**: Node.js, Express.js, TypeScript, MongoDB, JWT authentication
- **Frontend**: React 18, TypeScript, Tailwind CSS, React Router
- **Database**: MongoDB with Mongoose ODM
- **Containerization**: Docker & Docker Compose
- **Development**: nodemon (API), Create React App (web)

### Service Architecture

#### API Service (`services/api/`)
- **Entry Point**: `src/index.ts` - Express server with comprehensive error handling
- **Authentication**: JWT-based with role-based access (traveler/organizer/admin)
- **Models**: User and Trip models with MongoDB/Mongoose
- **Routes**:
  - `/auth/*` - Registration, login, user profile
  - `/trips/*` - Trip CRUD, search, join/leave functionality
- **Middleware**: Authentication, CORS, request logging, global error handling
- **Features**: Database retry logic, graceful shutdown, health monitoring

#### Web Service (`web/`)
- **Entry Point**: `src/index.tsx` → `src/App.tsx`
- **Routing**: React Router with protected routes
- **Authentication**: JWT token management with localStorage
- **Key Pages**:
  - Home, Login/Register, Trips (browse/search)
  - CreateTrip/EditTrip (organizers only), Profile
- **State Management**: React hooks (useState, useEffect)
- **Styling**: Tailwind CSS with custom forest theme

### Data Models

#### User Model
- Fields: email, name, role, passwordHash, preferences
- Roles: 'traveler', 'organizer', 'admin'
- Authentication via bcryptjs + JWT

#### Trip Model
- Core: title, description, destination, capacity, price, dates
- Advanced: categories, schedule, participants, status
- Location: GeoJSON Point for geographic queries
- Participant details with emergency contacts

### Database Design
- **Users Collection**: User accounts with role-based permissions
- **Trips Collection**: Trip listings with embedded participant details
- **Indexes**: Text search on trips, geographic indexing, role-based queries

### Authentication Flow
1. User registers/logs in via `/auth/register` or `/auth/login`
2. Server returns JWT token with user role
3. Frontend stores token and sets default axios headers
4. Protected routes verify JWT via `authenticateJwt` middleware
5. Role-based access control for organizer-only features

### Error Handling Strategy
- **Global Error Handler**: Catches all unhandled errors
- **Async Error Wrapper**: Handles Promise rejections in routes
- **Process Handlers**: Uncaught exceptions and unhandled rejections
- **Database Retry Logic**: Exponential backoff for connection failures
- **Request Timeouts**: Both frontend and backend timeout protection

### Development Workflow
1. Use `npm run dev` for full Docker environment
2. Or use individual services with `npm run dev:api` + `npm run dev:web`
3. MongoDB runs in Docker container on port 27017
4. API server on port 4000, web app on port 3000
5. Both services support hot reload during development

### Production Considerations
- Environment variables for MongoDB URI, JWT secret
- Docker builds for both services
- Health check endpoint at `/health` for monitoring
- Graceful shutdown handling for container orchestration
- Separate production/development CORS policies

### Key Features Implemented
- **Authentication System**: JWT-based auth with role-based access control
- **Reviews & Ratings**: Complete review system with organizer responses
- **Wishlist & Favorites**: Trip bookmarking with tags and priorities
- **File Upload System**: Base64/binary upload with streaming and security
- **CLI Administration Tools**: Complete management interface
- **Advanced Error Handling**: Custom error classes and global handling
- **Logging System**: Structured logging with file rotation
- **Trip Management**: Full CRUD with search, filtering, and participants
- **User Profiles**: Role-based dashboards and journey history
- **Media Gallery**: Image/video uploads with metadata

### API Endpoints

#### Core Routes
- `/auth/*` - Authentication (register, login, profile)
- `/trips/*` - Trip management and search
- `/reviews/*` - Review and rating system
- `/wishlist/*` - User bookmarking system
- `/files/*` - File upload and media management

#### Advanced Features
- **File Upload**: `/files/upload/base64`, `/files/upload/binary`
- **Review System**: `/reviews/:id/helpful`, `/reviews/:id/respond`
- **Wishlist Management**: `/wishlist/stats`, `/wishlist/check/:tripId`
- **Admin Endpoints**: `/files/admin/stats`, `/files/admin/duplicates`

### CLI Tools Usage
```powershell
# Database operations
npm run cli:stats                    # System statistics
npm run cli -- user list --role admin
npm run cli -- trip list --status active

# Data management
npm run cli -- backup data-backup.json
npm run cli -- restore backup.json --force
npm run cli -- cleanup               # System maintenance

# Log analysis
npm run cli -- logs --errors         # Recent errors
```

### File Operations
```powershell
# Test file upload
curl -X POST http://localhost:4000/files/demo/upload \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "base64", "filename": "test.txt"}'

# File management
curl http://localhost:4000/files?subdirectory=images
curl http://localhost:4000/files/FILENAME/info
```

### Node.js Concepts Demonstrated
- **Async Programming**: Promise.all, Promise.race, async/await patterns
- **File System**: Streams, buffers, file operations
- **Error Handling**: Custom error classes, global handlers, graceful shutdown
- **CLI Development**: Commander.js, process.argv, colored output
- **Module Systems**: ES6 imports/exports, custom utility modules
- **Process Management**: Environment variables, signal handling

### Express.js Concepts Demonstrated
- **Middleware**: Authentication, validation, error handling, file uploads
- **Router Organization**: Modular route structure with error boundaries
- **Request/Response**: JSON handling, file streaming, proper status codes
- **Security**: CORS, helmet, input validation, file type restrictions

### Testing Strategy
- **API Testing**: Comprehensive test scripts for all endpoints
- **CLI Testing**: Database operations and system maintenance
- **File Operations**: Upload, download, and metadata testing
- **Error Scenarios**: Network failures, invalid data, security tests
- **Performance**: Load testing with concurrent operations
