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

### Required Environment Variables

Create a `.env` file in the root directory with:

```bash
# Database
MONGO_URI=mongodb://localhost:27017/trek-tribe

# JWT
JWT_SECRET=your-super-secret-jwt-key

# Email (Nodemailer)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Firebase (File Storage)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_STORAGE_BUCKET=your-storage-bucket

# OpenAI (AI Chat Support)
OPENAI_API_KEY=your-openai-api-key

# Telegram (Optional)
TELEGRAM_BOT_TOKEN=your-telegram-bot-token

# Production
NODE_ENV=development
PORT=4000
FRONTEND_URL=http://localhost:3000
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