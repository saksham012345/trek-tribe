# Trekk Tribe - Deployment & Testing Guide

## 🚀 Quick Start (Recommended)

### Option 1: Docker Compose (Production-like)
```bash
# Start all services
npm run dev

# Access the application
# - Web: http://localhost:3000
# - API: http://localhost:4000
# - MongoDB: localhost:27017
```

### Option 2: Development Mode (Local)
```bash
# Install all dependencies
npm run install:all

# Start MongoDB (in Docker)
docker run -d -p 27017:27017 --name trekk-mongo mongo:6

# Start API (Terminal 1)
npm run dev:api

# Start Web App (Terminal 2)  
npm run dev:web
```

### Option 3: Windows PowerShell Script
```powershell
# Run the development script
./dev.ps1
```

## 🧪 Testing the API

Run the comprehensive API test suite:
```bash
node test-api.js
```

This will test:
- Health check endpoint
- User registration and login
- JWT authentication
- Trip creation and management  
- Trip joining functionality

## 📱 Using the Application

### For Travelers:
1. **Register** at `/register` with role "traveler"
2. **Browse trips** at `/trips`
3. **Search/filter** by destination, category, price
4. **Join trips** with available spots
5. **View your trips** in your profile

### For Organizers:
1. **Register** at `/register` with role "organizer"  
2. **Create trips** at `/create-trip`
3. **Manage your trips** in your profile
4. **View participants** and trip statistics

## 🔧 Development

### API Development
```bash
cd services/api
npm run dev    # Start with nodemon
npm run build  # Build TypeScript
npm start      # Run production build
```

### Web Development  
```bash
cd web
npm start      # Start dev server
npm run build  # Build for production
npm test       # Run tests
```

## 🛠 Troubleshooting

### Common Issues:

**MongoDB Connection Error:**
- Ensure MongoDB is running on port 27017
- Check Docker container: `docker ps`
- Restart: `docker restart trekk-mongo`

**Build Errors:**
- Clear node_modules: `rm -rf node_modules && npm install`
- Check Node.js version: `node --version` (requires 20+)

**Port Already in Use:**
- API (4000): `lsof -ti:4000 | xargs kill`
- Web (3000): `lsof -ti:3000 | xargs kill`

**Docker Issues:**
- Ensure Docker Desktop is running
- Try: `docker system prune` to clean up

## 📦 Production Deployment

### Environment Variables
Create `.env` files:

**API (.env):**
```
NODE_ENV=production
MONGODB_URI=mongodb://localhost:27017/trekktribe
JWT_SECRET=your-secure-secret-here
PORT=4000
```

**Web (.env):**
```
REACT_APP_API_URL=https://your-api-domain.com
```

### Build for Production
```bash
# Build all services
npm run build

# Or individually
cd services/api && npm run build
cd web && npm run build
```

## 🧩 Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Web     │────│   Express API   │────│    MongoDB      │
│   (Port 3000)   │    │   (Port 4000)   │    │   (Port 27017)  │
│                 │    │                 │    │                 │
│ • Authentication│    │ • JWT Auth      │    │ • User Data     │
│ • Trip Discovery│    │ • Trip CRUD     │    │ • Trip Data     │
│ • User Profile  │    │ • User Management│    │ • Sessions      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## ✅ Features Implemented

### Backend API ✅
- [x] User authentication (register/login/me)
- [x] JWT token management
- [x] Trip CRUD operations
- [x] Trip search and filtering
- [x] Trip joining/leaving
- [x] Role-based authorization
- [x] MongoDB integration
- [x] TypeScript support
- [x] Docker containerization

### Frontend Web App ✅
- [x] React with TypeScript
- [x] User authentication flow
- [x] Trip browsing and search
- [x] Trip creation (organizers)
- [x] User profiles
- [x] Responsive design (Tailwind CSS)
- [x] Error handling
- [x] Form validation

### DevOps & Tooling ✅
- [x] Docker configuration
- [x] Development scripts
- [x] Build processes
- [x] TypeScript compilation
- [x] Environment configuration
- [x] Testing utilities

The application is now **fully functional** and ready for development and testing!
