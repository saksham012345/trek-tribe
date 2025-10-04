# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Quick Start
```bash
# Install all dependencies (root, API, and web)
npm run install:all

# Start full stack with Docker (recommended for first run)
npm run dev

# Start API only (development mode with hot reload)
npm run dev:api

# Start web frontend only  
npm run dev:web
```

### Building and Testing
```bash
# Build API for production
npm run build:api

# Build web frontend
npm run build:web

# Build both API and web
npm run build

# Run web frontend tests
cd web && npm test

# Run web frontend linter
cd web && npm run lint
```

### Database and CLI Operations
```bash
# Set up database (development)
cd services/api && npm run setup:db

# Set up database (production)
cd services/api && npm run setup:db:prod

# Run CLI tool with help
cd services/api && npm run cli:help

# View database statistics
cd services/api && npm run cli:stats

# List users and trips
cd services/api && npm run cli:user:list
cd services/api && npm run cli:trip:list

# Clean up test data
cd services/api && npm run cleanup:trips
```

### Docker Operations
```bash
# Start all services with Docker
npm run dev

# Build Docker images
npm run build

# Stop all Docker services
npm run stop

# Clean up Docker containers and volumes
npm run clean
```

### Single Test Execution
```bash
# Run specific test file (web)
cd web && npm test -- --testPathPattern=specific-test.test.ts

# Run tests in watch mode
cd web && npm test -- --watch
```

## Architecture Overview

### Project Structure
This is a monorepo with a Node.js/Express API backend and React frontend:

- **Root**: Workspace configuration and Docker orchestration
- **services/api/**: Express.js API server with MongoDB
- **web/**: React frontend with TypeScript and Tailwind CSS
- **services/cli/**: Command-line utilities

### API Architecture (services/api/)

**Core Technology Stack:**
- Express.js with TypeScript
- MongoDB with Mongoose ODM
- JWT authentication with role-based access
- Zod for request validation
- Helmet for security headers

**Key Components:**
- `src/index.ts`: Main Express server with middleware setup, database connection with retry logic, and graceful shutdown
- `src/models/`: Mongoose schemas (User, Trip, Review, Wishlist, TripTracking)
- `src/routes/`: RESTful API endpoints organized by resource
- `src/middleware/auth.ts`: JWT authentication and role-based authorization
- `src/cli/trek-admin.ts`: CLI tool for database management and statistics

**Authentication Flow:**
- JWT-based stateless authentication
- Role-based access control (traveler, organizer, admin)
- Protected routes require valid JWT token in Authorization header

**Database Design:**
- **Trip**: Core entity with participants, schedules, pricing, and geolocation support
- **User**: Authentication and profile management with role-based permissions  
- **Review**: Trip reviews with ratings linked to users and trips
- **Wishlist**: User's saved trips for later reference
- **TripTracking**: Real-time location tracking for active trips

### Frontend Architecture (web/)

**Technology Stack:**
- React 18 with TypeScript
- React Router for navigation
- Tailwind CSS for styling
- Axios for API communication

**Key Components:**
- `src/App.tsx`: Main app component with route configuration and authentication state
- `src/pages/`: Route components for different application screens
- `src/components/`: Reusable UI components
- `src/config/api.ts`: API configuration and base URL setup

**State Management:**
- React hooks for local component state
- Context for authentication state across components
- localStorage for JWT token persistence

### Development Environment

**Local Development:**
- API runs on port 4000
- Web frontend runs on port 3000  
- MongoDB via Docker on port 27017
- Hot reload enabled for both API and frontend

**Environment Configuration:**
- `.env.example` files in both API and web directories
- Environment variables for database URI, JWT secrets, and API URLs
- Different configurations for development, staging, and production

### Deployment Architecture

**Production Setup:**
- API deployed on Render.com with auto-scaling
- Frontend deployed on Vercel with CDN
- MongoDB Atlas for managed database
- Automatic deployments via GitHub integration

**Key Environment Variables:**
- `MONGODB_URI`: MongoDB Atlas connection string
- `JWT_SECRET`: JWT signing secret (auto-generated in production)
- `REACT_APP_API_URL`: Frontend API endpoint URL

### File Upload System

**Implementation:**
- Base64 and binary file upload support via `/files/upload/` endpoints
- Local file storage in `services/api/uploads/` directory
- Static file serving via Express for uploaded content
- File size limits and type validation for security

### CLI Administration Tool

**Usage Patterns:**
```bash
# View system statistics
npm run cli:stats

# User management
npm run cli:user:list --role=organizer --limit=20
npm run cli -- user create admin@example.com "Admin User" admin password123

# Trip management  
npm run cli:trip:list --status=active --destination=mountain

# Database maintenance
npm run cli:backup
npm run cli:cleanup
```

The CLI tool (`trek-admin.ts`) provides comprehensive database management capabilities with colored output, error handling, and confirmation prompts for destructive operations.