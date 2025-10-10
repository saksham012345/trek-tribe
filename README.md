# Trek Tribe

A comprehensive travel platform that connects travelers for group trips and adventures with advanced features including WhatsApp integration, AI support, and professional-grade booking management.

## 🌟 Core Features

### Authentication & User Management
- **Multi-role Authentication**: Register as traveler, organizer, or admin
- **Secure JWT Authentication**: Password reset, email verification
- **Enhanced User Profiles**: Profile pictures, verification documents, bio, interests
- **Public Profile Pages**: Sharable user profiles with trip history

### Trip Management
- **Trip Creation & Management**: Create detailed trips with images, itineraries
- **Advanced Trip Discovery**: Search by destination, price, category, dates
- **Smart Trip Joining**: Automatic spot management and waiting lists
- **Trip Reviews & Ratings**: User feedback system with moderation

### Group Booking System
- **Group Booking Creation**: Organizers can create group bookings with participant management
- **Participant Management**: Add/remove participants, track booking status
- **Booking Updates**: Modify dates, participants, and booking details
- **Booking Cancellation**: Full cancellation support with status tracking

### File Upload & Media Management
- **Profile Pictures**: User avatar uploads with Firebase storage
- **Trip Images**: Multiple image uploads for trip galleries
- **Document Verification**: Upload verification documents for enhanced trust
- **QR Code Generation**: Generate QR codes for trips and bookings

### Communication & Support
- **WhatsApp Integration**: Automated trip notifications and confirmations
- **Real-time Chat**: Socket.io powered messaging system
- **AI Chat Support**: OpenAI-powered customer support chatbot
- **Telegram Integration**: Alternative messaging platform support

### Admin & Moderation
- **Admin Dashboard**: Comprehensive admin panel for platform management
- **Review Moderation**: Approve, reject, flag, and manage user reviews
- **User Management**: Admin tools for user verification and management
- **Trip Oversight**: Monitor and manage all platform trips
- **Bulk Operations**: Efficient bulk actions for administrative tasks

### Advanced Features
- **Review Verification System**: Multi-stage review approval process
- **Real-time Notifications**: Live updates via WebSocket connections
- **Health Monitoring**: Built-in health check endpoints
- **CLI Administration**: Command-line tools for database management

## 🛠 Tech Stack

### Frontend
- **React 18+**: Modern React with TypeScript
- **Tailwind CSS**: Utility-first CSS framework
- **Socket.io Client**: Real-time communication
- **React Router**: Client-side routing

### Backend
- **Node.js & Express**: TypeScript-based REST API
- **MongoDB & Mongoose**: Document database with ODM
- **Socket.io**: Real-time WebSocket communication
- **JWT Authentication**: Secure token-based auth
- **Firebase Storage**: Cloud file storage
- **OpenAI API**: AI-powered chat support

### Communication
- **WhatsApp Web.js**: WhatsApp integration
- **Telegram Bot API**: Telegram messaging
- **Nodemailer**: Email notifications

### DevOps & Tools
- **Docker & Docker Compose**: Containerization
- **TypeScript**: Type safety across the stack
- **Zod**: Runtime type validation
- **Helmet**: Security middleware
- **CORS**: Cross-origin resource sharing

## ⚙️ Available Scripts

### Docker Operations
- `npm run dev` - Start all services with Docker Compose
- `npm run build` - Build all Docker images
- `npm run stop` - Stop all running services
- `npm run clean` - Stop services and remove volumes

### Development
- `npm run dev:api` - Start API in development mode (with hot reload)
- `npm run dev:web` - Start React web app in development mode
- `npm run install:all` - Install dependencies for all services

### API-Specific Scripts
- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Start production API server
- `npm run cleanup:trips` - Clean up test/demo trips
- `npm run setup:db` - Initialize database with default data

## 🚀 Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 20+ (for local development)

### Running with Docker (Recommended)

1. Clone the repository
2. Run the application:
   ```bash
   npm run dev
   ```

3. Access the application:
   - **Web App**: http://localhost:3000
   - **API**: http://localhost:4000
   - **MongoDB**: localhost:27017

### Local Development

1. Install dependencies:
   ```bash
   npm run install:all
   ```

2. Start MongoDB (via Docker):
   ```bash
   docker run -d -p 27017:27017 --name trekk-mongo mongo:6
   ```

3. Start the API:
   ```bash
   npm run dev:api
   ```

4. Start the web app (in another terminal):
   ```bash
   npm run dev:web
   ```

## 📡 API Endpoints

### Authentication
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Login user
- `GET /auth/me` - Get current user info
- `POST /auth/forgot-password` - Request password reset
- `POST /auth/reset-password` - Reset password with token

### Trips
- `GET /trips` - Get all trips (with search/filter)
- `POST /trips` - Create a new trip (organizers only)
- `GET /trips/:id` - Get trip by ID
- `POST /trips/:id/join` - Join a trip
- `DELETE /trips/:id/leave` - Leave a trip
- `POST /trips/:id/reviews` - Add trip review

### User Profiles
- `GET /users/profile` - Get user profile
- `PUT /users/profile` - Update user profile
- `GET /users/:id/public` - Get public user profile
- `POST /upload/profile-picture` - Upload profile picture

### Group Bookings
- `POST /group-bookings` - Create group booking
- `GET /group-bookings` - Get user's group bookings
- `GET /group-bookings/:id` - Get specific group booking
- `PUT /group-bookings/:id` - Update group booking
- `DELETE /group-bookings/:id` - Cancel group booking
- `POST /group-bookings/:id/participants` - Add participant
- `DELETE /group-bookings/:id/participants/:participantId` - Remove participant

### File Upload
- `POST /upload/profile-picture` - Upload profile picture
- `POST /upload/trip-images` - Upload trip images
- `POST /upload/verification-document` - Upload verification document
- `POST /upload/generate-qr` - Generate QR code

### Admin (Protected)
- `GET /admin/stats` - Get platform statistics
- `GET /admin/reviews/pending` - Get pending reviews
- `POST /admin/reviews/:id/approve` - Approve review
- `POST /admin/reviews/:id/reject` - Reject review
- `POST /admin/reviews/:id/flag` - Flag review
- `POST /admin/reviews/bulk-action` - Bulk review actions

### Communication
- `POST /chat-support` - AI chat support
- `WebSocket /socket.io` - Real-time messaging

### Health & Monitoring
- `GET /health` - Health check endpoint

## 📁 Project Structure

```
├── services/
│   └── api/                    # Node.js TypeScript API
│       ├── src/
│       │   ├── middleware/     # Auth, admin, validation middleware
│       │   ├── models/         # MongoDB/Mongoose models
│       │   ├── routes/         # API route handlers
│       │   ├── services/       # WhatsApp, AI, Firebase, Socket services
│       │   ├── utils/          # Utility functions
│       │   ├── cli/            # Command-line administration tools
│       │   └── scripts/        # Database and maintenance scripts
│       ├── healthcheck.js      # Container health monitoring
│       └── package.json        # API dependencies
├── web/                        # React TypeScript frontend
│   ├── src/
│   │   ├── components/         # Reusable React components
│   │   ├── pages/              # Page components
│   │   └── services/           # Frontend API services
│   └── package.json            # Frontend dependencies
├── frontend/                   # Additional frontend variant
├── docker-compose.yml          # Multi-service orchestration
├── nginx.conf                  # Reverse proxy configuration
├── .env.example                # Environment variables template
└── package.json                # Root package.json with scripts
```

## 🚀 Environment Setup

### Quick Setup

1. **Copy environment templates**:
   ```bash
   # Root environment (for Docker)
   cp .env.example .env
   
   # Frontend environment
   cp web/.env.example web/.env
   ```

2. **Configure essential variables** in `.env`:
   ```bash
   # Generate a secure JWT secret (32+ characters)
   JWT_SECRET=$(openssl rand -hex 32)
   
   # MongoDB connection (Docker default)
   MONGODB_URI=mongodb://mongo:27017/trekktribe
   
   # Frontend URL
   FRONTEND_URL=http://localhost:3000
   ```

3. **Configure frontend** in `web/.env`:
   ```bash
   # API endpoint
   REACT_APP_API_URL=http://localhost:4000
   ```

### Advanced Configuration

#### Authentication & Security
```bash
# JWT Configuration (REQUIRED)
JWT_SECRET=your-secure-32-character-secret-key-here
JWT_EXPIRES_IN=7d

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

#### Database
```bash
# Local MongoDB (Docker)
MONGODB_URI=mongodb://mongo:27017/trekktribe

# Local MongoDB (Direct)
MONGODB_URI_LOCAL=mongodb://127.0.0.1:27017/trekktribe

# MongoDB Atlas (Production)
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/trekktribe
```

#### Email Service (Optional)
```bash
# Gmail SMTP
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-character-app-password
EMAIL_ENABLED=true
```

#### WhatsApp Integration (Optional)
```bash
WHATSAPP_ENABLED=true
DEFAULT_COUNTRY_CODE=91
WHATSAPP_SESSION_NAME=trek-tribe-bot
```

#### Frontend Configuration
```bash
# API Configuration (REQUIRED)
REACT_APP_API_URL=http://localhost:4000
REACT_APP_SOCKET_URL=http://localhost:4000

# Google OAuth (Optional)
REACT_APP_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# Feature Flags
REACT_APP_ENABLE_REAL_TIME_CHAT=true
REACT_APP_ENABLE_AI_SUPPORT=true
REACT_APP_ENABLE_QR_PAYMENTS=true
```

### Environment Variables Guide

📖 **Detailed Documentation**: See [`docs/ENV.md`](docs/ENV.md) for complete environment variable reference

🚀 **Deployment Guide**: See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) for production deployment instructions

### Secure Secret Generation

```bash
# Generate JWT secret (Unix/Mac)
openssl rand -hex 32

# Generate JWT secret (Node.js)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Online generator
# Visit: https://generate-secret.vercel.app/32
```

### Using process.env Safely

```typescript
// ✅ Good: Validate required environment variables
const { MONGODB_URI, JWT_SECRET } = process.env;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is required');
}

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long');
}

// ✅ Good: Provide fallback values for optional variables
const PORT = parseInt(process.env.PORT || '4000', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';

// ✅ Good: Type-safe environment variable access
interface EnvConfig {
  mongoUri: string;
  jwtSecret: string;
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
}

function getConfig(): EnvConfig {
  return {
    mongoUri: process.env.MONGODB_URI!,
    jwtSecret: process.env.JWT_SECRET!,
    port: parseInt(process.env.PORT || '4000', 10),
    nodeEnv: (process.env.NODE_ENV as any) || 'development',
  };
}
```

### Environment Validation

The application validates critical environment variables on startup:

```typescript
// Example validation in services/api/src/index.ts
function validateEnvironment() {
  const required = ['MONGODB_URI', 'JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`   - ${key}`));
    process.exit(1);
  }
  
  console.log('✅ Environment variables validated successfully');
}
```

## 🔧 CLI Administration Tools

The project includes comprehensive CLI tools for administration:

```bash
# Navigate to API directory
cd services/api

# General help
npm run cli:help

# Platform statistics
npm run cli:stats

# User management
npm run cli:user:list

# Trip management
npm run cli:trip:list

# Database backup
npm run cli:backup

# System cleanup
npm run cli:cleanup

# View system logs
npm run cli:logs

# Database setup
npm run setup:db
```

## 📊 Monitoring & Health Checks

- **API Health**: `GET /health`
- **Database Status**: Included in health check
- **WhatsApp Connection**: Real-time status monitoring
- **Socket.io Status**: Connection health tracking

## 🔐 Security Features

- **Helmet.js**: Security headers
- **CORS Configuration**: Controlled cross-origin access
- **JWT Token Validation**: Secure authentication
- **Input Validation**: Zod schema validation
- **File Upload Security**: Type and size restrictions
- **Admin Route Protection**: Role-based access control