# 🏔️ Trek Tribe API

A robust RESTful API for managing travel experiences, trips, reviews, and user interactions. Built with Node.js, Express, TypeScript, and MongoDB.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- MongoDB Atlas account
- Git

### Local Development
```bash
# Clone the repository
git clone https://github.com/your-username/trek-tribe.git
cd trek-tribe

# Install dependencies
npm run install:all

# Set up environment
cd services/api
cp .env.example .env
# Edit .env with your configuration

# Start the API server
npm run dev:api
```

## 🌐 Production Deployment

### 🔴 Backend API (Render)

#### Prerequisites
- GitHub repository
- MongoDB Atlas cluster
- Render account

#### Setup Steps
1. **MongoDB Atlas Setup**
   ```bash
   # Create cluster at https://cloud.mongodb.com/
   # Create database: trekktribe
   # Get connection string:
   # mongodb+srv://<username>:<password>@<cluster>.mongodb.net/trekktribe
   ```

2. **Deploy to Render**
   - Connect your GitHub repository to Render
   - Use the included `render.yaml` configuration
   - Set environment variable: `MONGODB_URI`
   - ✅ **Currently deployed at**: `https://trekktribe.onrender.com`

### 🔵 Frontend (Vercel)

#### Prerequisites
- Vercel account
- Live backend API URL

#### Setup Steps
1. **Navigate to web folder**
   ```bash
   cd web
   ```

2. **Deploy to Vercel**
   ```bash
   npx vercel --prod
   ```
   - Uses `vercel.json` configuration
   - Automatically connects to backend API
   - ✅ **Currently deployed at**: `https://trek-tribe-web.vercel.app` (🌐 **Public Access**)

## 📋 API Documentation

### Base URL
- **Local**: `http://localhost:4000`
- **Production**: `https://trekktribe.onrender.com`

## 🌐 Live Application

### 🚀 **Backend API (Live on Render)**
- **API URL**: `https://trekktribe.onrender.com`
- **Health Check**: `https://trekktribe.onrender.com/health`
- **Status**: ✅ **LIVE & CONNECTED**

### 🌎 **Frontend (Live on Vercel)**
- **Web App**: `https://trek-tribe-web.vercel.app` 🌐 **PUBLIC ACCESS**
- **Alternative URLs**: 
  - `https://trek-tribe-web-saksham-s-projects-76ba6bcc.vercel.app`
  - `https://trek-tribe-6pb4ones7-saksham-s-projects-76ba6bcc.vercel.app`
- **Status**: ✅ **LIVE & PUBLICLY ACCESSIBLE**

### Authentication
All protected endpoints require JWT token in header:
```
Authorization: Bearer <your_jwt_token>
```

### Core Endpoints

#### 🔐 Authentication
```
POST /auth/register       # Register new user
POST /auth/login          # User login
POST /auth/logout         # User logout
GET  /auth/me             # Get current user profile
PUT  /auth/profile        # Update user profile
```

#### 🗺️ Trips
```
GET    /trips             # Get all trips (with filters)
POST   /trips             # Create new trip
GET    /trips/:id         # Get specific trip
PUT    /trips/:id         # Update trip
DELETE /trips/:id         # Delete trip
```

#### ⭐ Reviews
```
GET    /reviews           # Get reviews for a trip
POST   /reviews           # Create review
PUT    /reviews/:id       # Update review
DELETE /reviews/:id       # Delete review
```

#### ❤️ Wishlist
```
GET    /wishlist          # Get user's wishlist
POST   /wishlist          # Add trip to wishlist
DELETE /wishlist/:tripId  # Remove from wishlist
```

#### 📁 File Uploads
```
POST /files/upload/base64   # Upload file as base64
POST /files/upload/binary   # Upload binary file
GET  /uploads/*             # Access uploaded files
```

#### 🏥 Health Check
```
GET /health               # API health status
```

## 🏗️ Project Structure

```
trek-tribe/
├── services/
│   ├── api/                 # Main API service
│   │   ├── src/
│   │   │   ├── routes/      # API routes
│   │   │   ├── models/      # MongoDB models
│   │   │   ├── middleware/  # Custom middleware
│   │   │   ├── utils/       # Utility functions
│   │   │   ├── cli/         # CLI tools
│   │   │   └── scripts/     # Database scripts
│   │   ├── uploads/         # File uploads (gitignored)
│   │   ├── dist/            # Compiled JavaScript
│   │   └── package.json
│   └── cli/                 # CLI utilities
├── web/                     # Frontend (React) - Optional
├── render.yaml              # Render deployment config
├── docker-compose.yml       # Local Docker setup
└── package.json             # Root package.json
```

## 🛠️ Development

### Available Scripts
```bash
# Root level
npm run dev:api              # Start API in development mode
npm run build:api            # Build API for production
npm run install:all          # Install all dependencies

# API level (services/api)
npm run dev                  # Start with hot reload
npm run build                # Compile TypeScript
npm run start                # Start production server
npm run cli                  # Run CLI tools
```

## 🔧 Configuration

### Environment Variables (Production)
The following are automatically configured by `render.yaml`:
- `NODE_ENV=production`
- `PORT=10000`
- `JWT_SECRET` (auto-generated)
- `MAX_FILE_SIZE=10485760`
- `UPLOAD_DIR=uploads`
- `LOG_LEVEL=info`
- `ALLOWED_ORIGINS=*`
- `CORS_ORIGIN=*`

**You only need to set:**
- `MONGODB_URI` - Your MongoDB Atlas connection string

## 🔐 Security Features

- JWT-based authentication
- Helmet.js security headers
- CORS protection
- Input validation with Zod
- File upload restrictions
- Secure password hashing with bcrypt

## 📊 Monitoring

- Health check endpoint: `/health`
- Request logging with timestamps
- Error tracking and logging
- Database connection monitoring
- Memory usage reporting

## 🚦 API Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## 📝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

- **Issues**: Create GitHub issue
- **Documentation**: Check API endpoints above
- **API Status**: Check `/health` endpoint

---

**Happy Trekking! 🥾⛰️**
