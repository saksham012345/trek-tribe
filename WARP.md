# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Trek Tribe is a full-stack travel platform that connects travelers for group trips and adventures. It's built as a monorepo using npm workspaces with a React frontend and Node.js/Express backend.

## Development Commands

### Quick Start
```bash
# Start all services with Docker (recommended for development)
npm run dev

# Install dependencies for all packages
npm run install:all

# Build all services
npm run build
```

### Individual Service Commands
```bash
# API Development
npm run dev:api          # Start API in development mode
npm run build:api        # Build API
cd services/api && npm run cli:help  # View CLI commands

# Web Development  
npm run dev:web          # Start React development server
npm run build:web        # Build React app for production
cd web && npm run lint   # Lint frontend code
cd web && npm run test   # Run frontend tests

# Database Management
cd services/api && npm run setup:db     # Setup database locally
cd services/api && npm run cleanup:trips # Clean test trip data
```

### Docker Commands
```bash
npm start                # Start with Docker (production mode)
npm stop                 # Stop Docker containers
npm run clean           # Stop containers and remove volumes
```

### CLI Tools
The API includes a CLI tool accessible via:
```bash
cd services/api && npm run cli -- [command]
# Available commands: stats, user list, trip list, backup, cleanup, logs
```

## Architecture Overview

### High-Level Structure
- **Monorepo**: Uses npm workspaces with `services/*` and `packages/*`
- **Frontend**: React 18 + TypeScript + Tailwind CSS (port 3000)
- **Backend**: Node.js + Express + TypeScript (port 4000)
- **Database**: MongoDB (port 27017)
- **Authentication**: JWT-based with role-based access control
- **Containerization**: Docker with docker-compose for orchestration

### Role-Based System
The application supports four user roles with different capabilities:
- **Traveler**: Join trips, create reviews, manage profile
- **Organizer**: Create and manage trips + traveler capabilities  
- **Agent**: Manage bookings and customer support + organizer capabilities
- **Admin**: Full system access including user management

### Key Backend Architecture

**Models** (`services/api/src/models/`):
- `User.ts`: Authentication, profiles, preferences, role management
- `Trip.ts`: Trip creation, scheduling, participant management with detailed participant info
- `Review.ts`: Trip and organizer reviews
- Additional: ChatSession, SupportTicket, Wishlist

**Routes** (`services/api/src/routes/`):
- `auth.ts`: Registration, login, password reset
- `trips.ts`: CRUD operations, search/filtering, join/leave functionality
- `admin.ts`: User management, system statistics
- `agent.ts`: Booking management, customer support tools
- `reviews.ts`, `wishlist.ts`, `bookings.ts`, `profile.ts`

**Services**:
- `emailService.ts`: Email notifications and communications
- `whatsappService.ts`: WhatsApp integration for notifications

### Frontend Architecture

**Components** (`web/src/components/`):
- `Header.tsx`: Navigation with role-based menu items
- `JoinTripModal.tsx`: Trip booking with participant details
- `ReviewModal.tsx`, `ReviewsList.tsx`: Review system

**Pages** (`web/src/pages/`):
- Public: `Home.tsx`, `Trips.tsx`, `TripDetails.tsx`
- Auth: `Login.tsx`, `Register.tsx`
- Role-specific: `CreateTrip.tsx` (organizers), `AdminDashboard.tsx` (admins), `AgentDashboard.tsx` (agents)
- Profile management: `Profile.tsx`, `EnhancedProfile.tsx`

**Context**: `AuthContext.tsx` manages authentication state across the app

### Database Design
- MongoDB with Mongoose ODM
- Indexed fields for search performance (title, destination, categories, dates)
- Geographic indexing for location-based features
- Comprehensive participant information storage for trip bookings

### Key Features to Understand
- **Trip Management**: Complex scheduling system with day-by-day itineraries
- **Participant System**: Detailed information collection (emergency contacts, medical conditions, experience levels)
- **Search & Filtering**: Text search, category, price range, date range, destination filtering
- **File Handling**: Support for trip images, itinerary PDFs, profile photos
- **Notification System**: Email and WhatsApp integration for trip updates

### Development Notes
- The API uses comprehensive error handling with detailed logging
- Frontend uses React Router for navigation with route protection based on user roles
- Environment configuration supports multiple deployment platforms (Vercel, Render, Railway)
- Database operations include timeout handling and retry logic for reliability
- CLI tools available for administrative tasks and data management