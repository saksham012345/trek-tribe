# 🏔️ Trek Tribe - Complete Project Documentation

## 📋 **Project Overview**

**Trek Tribe** is a comprehensive travel management platform that connects travelers with adventure trip organizers. The platform facilitates trip discovery, booking, payment processing, and real-time communication between different user roles.

### **Core Features**
- 🎯 Trip Creation and Management
- 👥 Multi-role User System (Admin, Organizer, Agent, Traveler)
- 💳 Payment Verification System
- 🤖 AI-powered Trip Recommendations
- ⚡ Real-time Notifications and Updates
- 📱 Responsive Web Interface

---

## 🏗️ **Architecture Overview**

```
trek-tribe/
├── 🌐 web/                    # Frontend (React + TypeScript)
├── ⚙️ services/api/           # Backend API (Node.js + TypeScript)
├── 🐳 Docker & Config Files   # Deployment & Configuration
└── 📚 Documentation          # Project Documentation
```

### **Tech Stack**
- **Frontend**: React 18, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express.js, TypeScript
- **Database**: MongoDB with Mongoose ODM
- **Real-time**: Socket.IO
- **Authentication**: JWT (JSON Web Tokens)
- **Deployment**: Docker, Vercel (Frontend), Render (Backend)

---

## 📁 **Directory Structure & File Responsibilities**

### 🌐 **Frontend (`/web/`)**

#### **Main Application Files**
| File | Purpose | Key Features |
|------|---------|-------------|
| `src/App.tsx` | Main application component | Routing, authentication state, global layout |
| `src/index.tsx` | React entry point | App rendering, CSS imports |
| `src/index.css` | Global styles | Custom animations, Trek Tribe theme colors |

#### **Pages (`/web/src/pages/`)**
| Page | Role Access | Functionality |
|------|-------------|---------------|
| `Home.tsx` | All users | Landing page, featured trips, hero section |
| `Login.tsx` | Unauthenticated | User authentication, role-based redirects |
| `Register.tsx` | Unauthenticated | User registration, role selection |
| `Trips.tsx` | All users | Trip browsing, filtering, search |
| `TripDetails.tsx` | All users | Individual trip information, booking |
| `CreateTrip.tsx` | Organizers | Trip creation form |
| `CreateTripNew.tsx` | Organizers | Enhanced trip creation (latest version) |
| `EditTrip.tsx` | Organizers | Trip modification |
| `MyBookings.tsx` | Travelers | Personal booking history |
| `Profile.tsx` | All users | Profile management |
| `AdminDashboard.tsx` | Admin only | Platform statistics, user management |
| `OrganizerDashboard.tsx` | Organizers | Trip management, payment verification |
| `AgentDashboard.tsx` | Agents | Customer support, basic features |
| `EnhancedAgentDashboard.tsx` | Agents | AI recommendations, enhanced features |

#### **Components (`/web/src/components/`)**
| Component | Purpose | Usage |
|-----------|---------|--------|
| `Header.tsx` | Navigation bar | User authentication, role-based menu |
| `JoinTripModal.tsx` | Trip booking interface | Group booking, payment upload, traveler details |
| `AIRecommendations.tsx` | AI-powered suggestions | Trip recommendations based on preferences |
| `AIChatWidget.tsx` | Customer support chat | AI-powered support, agent escalation |
| `PaymentUpload.tsx` | Payment processing | Screenshot upload, verification |
| `PaymentVerification.tsx` | Organizer tool | Payment approval/rejection |
| `QRCodeUpload.tsx` | Payment QR management | Organizer payment QR codes |
| `ReviewModal.tsx` | Trip reviews | Rating and feedback system |
| `GoogleLoginButton.tsx` | Social authentication | Google OAuth integration |

#### **Configuration (`/web/src/`)**
| File | Purpose | Content |
|------|---------|---------|
| `config/api.ts` | API configuration | Base URL, request interceptors, JWT handling |
| `contexts/AuthContext.tsx` | Authentication state | User session, role management, login/logout |
| `types/index.ts` | TypeScript definitions | User, Trip, Booking interfaces |
| `utils/config.ts` | App configuration | Environment variables, constants |

---

### ⚙️ **Backend (`/services/api/`)**

#### **Main Server Files**
| File | Purpose | Key Features |
|------|---------|-------------|
| `src/index.js` | Main server entry | Express setup, middleware, routes, Socket.IO |
| `src/serverless.ts` | Serverless deployment | Vercel/serverless function wrapper |

#### **Routes (`/services/api/src/routes/`)**
| Route File | Endpoint Base | Functionality |
|------------|---------------|---------------|
| `auth.ts` | `/api/auth/` | Login, register, JWT management, role verification |
| `trips.ts` | `/api/trips/` | CRUD operations for trips, search, filtering |
| `bookings.ts` | `/api/bookings/` | Trip bookings, group bookings, payment tracking |
| `organizer.ts` | `/api/organizer/` | Organizer-specific features, payment verification |
| `agent.ts` | `/api/agent/` | Agent dashboard, customer queries, AI recommendations |
| `admin.ts` | `/api/admin/` | Admin dashboard, user management, platform stats |
| `reviews.ts` | `/api/reviews/` | Trip reviews and ratings |
| `files.ts` | `/api/files/` | File upload, image handling |
| `views.ts` | `/` | Basic server endpoints, health checks |

#### **Database Models (`/services/api/src/models/`)**
| Model | Collection | Purpose |
|-------|------------|---------|
| `User.ts` | users | User accounts, authentication, roles |
| `Trip.ts` | trips | Trip information, pricing, availability |
| `GroupBooking.ts` | groupbookings | Booking details, payment status, travelers |
| `Review.ts` | reviews | Trip ratings and feedback |
| `SupportTicket.ts` | supporttickets | Customer support requests |
| `ChatSession.ts` | chatsessions | AI chat conversations |
| `Wishlist.ts` | wishlists | User saved trips |

#### **Services (`/services/api/src/services/`)**
| Service | Purpose | Features |
|---------|---------|----------|
| `socketService.ts` | Real-time communication | Trip updates, payment notifications, chat |
| `aiSupportService.ts` | AI-powered support | Automated responses, query handling |
| `emailService.ts` | Email notifications | Booking confirmations, updates |
| `whatsappService.ts` | WhatsApp integration | Notifications, support |
| `firebaseService.ts` | Firebase integration | Push notifications, file storage |

#### **Middleware (`/services/api/src/middleware/`)**
| Middleware | Purpose | Usage |
|------------|---------|--------|
| `auth.ts` | Authentication | JWT verification, user session |
| `isAdmin.ts` | Authorization | Admin-only route protection |

#### **Utilities (`/services/api/src/utils/`)**
| Utility | Purpose | Features |
|---------|---------|----------|
| `logger.ts` | Logging system | Structured logging, error tracking |
| `errors.ts` | Error handling | Custom error types, standardized responses |
| `fileHandler.ts` | File management | Upload processing, validation |

---

## 🔐 **Authentication & User Roles**

### **User Roles & Permissions**

| Role | Access Level | Key Permissions |
|------|--------------|-----------------|
| **👤 Traveler** | Basic | Browse trips, book trips, manage bookings, write reviews |
| **🏕️ Organizer** | Trip Management | Create/edit trips, verify payments, manage participants |
| **🎯 Agent** | Customer Support | AI recommendations, customer queries, trip assistance |
| **👑 Admin** | Full Platform | User management, platform statistics, system oversight |

### **Authentication Flow**
1. **Registration** → User selects role → Account created
2. **Login** → JWT token issued → Role-based redirect
3. **Authorization** → Middleware verifies JWT → Route access granted

---

## 💾 **Database Schema**

### **Key Collections**

#### **Users Collection**
```javascript
{
  _id: ObjectId,
  name: String,
  email: String (unique),
  passwordHash: String,
  role: String, // 'traveler', 'organizer', 'agent', 'admin'
  phone: String,
  profilePhoto: String,
  isVerified: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

#### **Trips Collection**
```javascript
{
  _id: ObjectId,
  organizerId: ObjectId, // Reference to User
  title: String,
  description: String,
  destination: String,
  price: Number,
  capacity: Number,
  participants: [ObjectId], // Array of User references
  categories: [String],
  startDate: Date,
  endDate: Date,
  status: String, // 'active', 'cancelled', 'completed'
  images: [String],
  paymentConfig: {
    paymentType: String, // 'full', 'advance'
    advanceAmount: Number,
    paymentMethods: [String]
  },
  createdAt: Date,
  updatedAt: Date
}
```

#### **GroupBookings Collection**
```javascript
{
  _id: ObjectId,
  tripId: ObjectId, // Reference to Trip
  mainBookerId: ObjectId, // Reference to User
  participants: [{
    name: String,
    email: String,
    phone: String,
    age: Number,
    emergencyContact: String,
    medicalConditions: String,
    dietaryRestrictions: String
  }],
  numberOfGuests: Number,
  totalAmount: Number,
  finalAmount: Number,
  paymentStatus: String, // 'pending', 'completed', 'failed'
  paymentVerificationStatus: String, // 'pending', 'verified', 'rejected'
  paymentScreenshot: {
    filename: String,
    url: String,
    uploadedAt: Date
  },
  bookingStatus: String, // 'pending', 'confirmed', 'cancelled'
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🌍 **Environment Configuration**

### **Backend Environment Variables (`/services/api/.env`)**
```bash
# Database
MONGODB_URI=mongodb://127.0.0.1:27017/trekktribe

# Authentication
JWT_SECRET=your-jwt-secret-key-here
SESSION_SECRET=your-session-secret-key

# Server Configuration
PORT=4000
NODE_ENV=development

# External Services
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-secret

# File Upload
CLOUDINARY_CLOUD_NAME=your-cloudinary-name
CLOUDINARY_API_KEY=your-cloudinary-key
CLOUDINARY_API_SECRET=your-cloudinary-secret

# Communication Services
WHATSAPP_API_TOKEN=your-whatsapp-token
EMAIL_SERVICE_KEY=your-email-service-key

# AI Services
OPENAI_API_KEY=your-openai-key
```

### **Frontend Environment Variables (`/web/.env`)**
```bash
# API Configuration
REACT_APP_API_URL=http://localhost:4000

# Authentication
REACT_APP_GOOGLE_CLIENT_ID=your-google-client-id

# Features
REACT_APP_ENABLE_AI_FEATURES=true
REACT_APP_ENABLE_REAL_TIME=true
```

---

## 🔧 **Preset Credentials & Test Data**

### **Default Admin Account**
```javascript
// Located in: services/api/src/scripts/create-root-user.ts
{
  email: "admin@trektribe.com",
  password: "admin123",
  role: "admin",
  name: "Trek Tribe Admin"
}
```

### **Sample Organizer Account**
```javascript
{
  email: "organizer@trektribe.com",
  password: "organizer123",
  role: "organizer",
  name: "Sample Organizer"
}
```

### **Demo Agent Account**
```javascript
{
  email: "agent@trektribe.com",
  password: "agent123",
  role: "agent",
  name: "Support Agent"
}
```

### **Test Traveler Account**
```javascript
{
  email: "traveler@trektribe.com",
  password: "traveler123",
  role: "traveler",
  name: "Demo Traveler"
}
```

---

## 🚀 **Development & Deployment**

### **Package Files**
| File | Purpose | Key Scripts |
|------|---------|-------------|
| `package.json` (root) | Workspace management | `dev`, `build`, `install:all` |
| `web/package.json` | Frontend dependencies | React, TypeScript, Tailwind CSS |
| `services/api/package.json` | Backend dependencies | Express, MongoDB, Socket.IO |

### **Key NPM Scripts**
```bash
# Root Level
npm run dev              # Start both frontend and backend
npm run build            # Build both applications
npm run install:all      # Install all dependencies

# Frontend (/web)
npm start               # Development server (localhost:3000)
npm run build           # Production build
npm run preview         # Preview production build

# Backend (/services/api)
npm run dev             # Development server (localhost:4000)
npm run build           # TypeScript compilation
npm start               # Production server
```

### **Docker Configuration**
| File | Purpose | Usage |
|------|---------|-------|
| `docker-compose.yml` | Local development | `docker-compose up --build` |
| `web/Dockerfile` | Frontend container | React app with nginx |
| `services/api/Dockerfile` | Backend container | Node.js API server |

### **Deployment Files**
| File | Purpose | Platform |
|------|---------|----------|
| `render.yaml` | Backend deployment | Render.com |
| `vercel.json` | Frontend deployment | Vercel.com |
| `web/vercel.json` | Frontend config | Vercel-specific settings |

---

## 🔄 **Real-Time Features**

### **Socket.IO Events**
| Event | Purpose | Data |
|-------|---------|------|
| `trip_update` | Trip changes | Trip data, update type |
| `booking_update` | Booking status | Booking info, status change |
| `organizer_notification` | Organizer alerts | New bookings, payments |
| `agent_dashboard_update` | Agent updates | New queries, assignments |
| `admin_update` | Admin notifications | System events, user actions |

### **Real-Time Functionality**
- 📊 Dashboard auto-refresh
- 💳 Payment verification notifications  
- 🎯 Trip booking updates
- 💬 Live chat support
- 🔔 Status change alerts

---

## 📱 **API Endpoints Overview**

### **Public Endpoints**
```bash
GET  /api/trips                 # Browse all trips
GET  /api/trips/:id             # Trip details
POST /api/auth/login            # User login
POST /api/auth/register         # User registration
```

### **Protected Endpoints**
```bash
# Traveler
POST /api/bookings              # Create booking
GET  /api/bookings/my-bookings  # User's bookings

# Organizer  
GET  /api/organizer/trips       # Organizer's trips
POST /api/organizer/verify-payment/:id  # Verify payment

# Agent
GET  /api/agent/queries         # Customer queries
GET  /api/agent/ai-recommendations  # AI suggestions

# Admin
GET  /api/admin/stats           # Platform statistics
GET  /api/admin/users           # User management
```

---

## 🎨 **UI/UX Design System**

### **Color Palette**
```css
/* Trek Tribe Brand Colors */
--color-forest-50: #f0f9f5;     /* Light backgrounds */
--color-forest-600: #16a34a;    /* Primary green */
--color-forest-800: #166534;    /* Dark text */
--color-nature-600: #059669;    /* Accent green */
--color-nature-500: #10b981;    /* Hover states */
```

### **Component Design**
- 🎯 Consistent rounded corners (`rounded-xl`)
- 🌊 Gradient backgrounds for CTAs
- 🎨 Forest/Nature color scheme
- ✨ Smooth animations and transitions
- 📱 Mobile-first responsive design

---

## 🐛 **Common Issues & Solutions**

### **Development Issues**
| Issue | Solution |
|-------|----------|
| MongoDB connection failed | Check MONGODB_URI in .env |
| JWT authentication error | Verify JWT_SECRET is set |
| CORS errors | Update CORS origin in index.js |
| File upload failing | Check Cloudinary credentials |
| Socket.IO not connecting | Verify REACT_APP_API_URL |

### **Build Issues**
| Issue | Solution |
|-------|----------|
| TypeScript compilation errors | Check model interfaces |
| Missing dependencies | Run `npm install` |
| Environment variables missing | Copy from .env.example |
| Port already in use | Change PORT in .env |

---

## 📚 **Getting Started Guide**

### **1. Clone & Install**
```bash
git clone <repository-url>
cd trek-tribe
npm run install:all
```

### **2. Environment Setup**
```bash
# Copy environment files
cp services/api/.env.example services/api/.env
cp web/.env.example web/.env

# Update with your values
```

### **3. Database Setup**
```bash
# Start MongoDB
mongod --dbpath /path/to/data

# Create admin user
cd services/api
npm run setup:db
```

### **4. Development**
```bash
# Start both frontend and backend
npm run dev

# Or start individually
cd services/api && npm run dev  # Backend: http://localhost:4000
cd web && npm start             # Frontend: http://localhost:3000
```

### **5. Access the Platform**
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:4000
- **Admin Panel**: Login with admin credentials

---

## 🏆 **Project Features Summary**

### ✅ **Completed Features**
- Multi-role authentication system
- Trip creation and management
- Group booking with payment verification
- Real-time notifications via Socket.IO
- AI-powered trip recommendations
- Admin, Organizer, and Agent dashboards
- Payment screenshot upload and verification
- Responsive design across all devices

### 🔧 **Technical Achievements**
- TypeScript for type safety
- RESTful API architecture
- Real-time WebSocket communication
- JWT-based authentication
- MongoDB with Mongoose ODM
- Docker containerization
- Cloud deployment ready (Vercel + Render)

---

## 📞 **Support & Maintenance**

### **Key Configuration Files**
- Environment variables in `.env` files
- Database models in `/models/` directory
- API routes in `/routes/` directory
- Frontend components in `/components/` directory

### **Logs & Debugging**
- Backend logs: Console output with structured logging
- Frontend errors: Browser developer console
- Database queries: MongoDB logs
- Real-time events: Socket.IO debug logs

This documentation provides a complete overview of the Trek Tribe platform architecture, making it easy for developers to understand, maintain, and extend the application.