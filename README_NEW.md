# 🏔️ Trek Tribe - Professional Adventure Platform

> **Latest Update**: Now featuring professional admin/agent profiles, advanced cookie management, and complete GDPR compliance!

## 🌟 **What's New in v2.0**

### 👑 **Professional Admin Dashboard**
- System-wide metrics and analytics
- User management with role controls
- Real-time system health monitoring
- Enterprise-level administrative tools
- Professional dark theme with crown branding

### 🛡️ **Support Agent Hub**  
- Live chat management dashboard
- Performance metrics and satisfaction ratings
- Status management (Online/Busy/Away/Offline)
- Priority-based ticket handling
- Professional blue theme with shield branding

### 🏔️ **Enhanced User Profiles**
- Beautiful nature-themed interfaces
- Role-specific features and workflows
- Improved trip management
- Professional avatar system
- Enhanced user experience

### 🍪 **Advanced Cookie Management**
- Granular cookie categorization (Essential, Analytics, Marketing, Functional)
- User-controlled preferences with detailed information
- GDPR/CCPA compliant consent management
- Professional cookie settings page
- Automatic cookie cleanup

### 🔐 **Complete GDPR Compliance**
- Data export (human-readable and machine-readable)
- Account deletion with confirmation
- Data portability rights
- Privacy settings management
- Comprehensive legal pages

---

## 🚀 **Quick Start**

### Prerequisites
- Node.js 16+ and npm
- MongoDB (local or cloud)
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/trek-tribe.git
cd trek-tribe

# Install backend dependencies
cd services/api
npm install

# Install frontend dependencies  
cd ../../web
npm install
```

### Environment Setup

**Backend Configuration** (`services/api/.env`):
```bash
# Server
PORT=4000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://127.0.0.1:27017/trekktribe

# Security
JWT_SECRET=your_secure_jwt_secret

# External Services (Optional for basic functionality)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
EMAIL_USER=your-gmail@gmail.com
EMAIL_PASSWORD=your-app-password
```

**Frontend Configuration** (`web/.env`):
```bash
REACT_APP_API_URL=http://localhost:4000
```

### Running the Application

**Terminal 1 - Backend:**
```bash
cd services/api
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd web  
npm start
```

**Access the application:**
- **Main Website**: http://localhost:3000
- **API Health**: http://localhost:4000/health

---

## 🎭 **User Roles & Access**

### 👑 **Administrator** 
- **Access**: System-wide control and monitoring
- **Features**: User management, system health, analytics, alerts
- **Profile**: Professional dashboard with enterprise metrics

### 🛡️ **Support Agent**
- **Access**: Customer support tools and chat management  
- **Features**: Live chat, performance tracking, knowledge base
- **Profile**: Support-focused interface with chat tools

### 🏔️ **Trip Organizer**
- **Access**: Trip creation and management
- **Features**: Create trips, manage bookings, track participants
- **Profile**: Nature-themed with trip management tools

### 🎒 **Traveler** 
- **Access**: Trip discovery and booking
- **Features**: Browse trips, make bookings, track adventures
- **Profile**: Adventure-focused with booking history

---

## 🧪 **Testing with Sample Users**

Create test accounts using the CLI:

```bash
cd services/api

# Create admin user
npm run cli user create admin@trektribe.com "System Administrator" admin admin123

# Create agent user  
npm run cli user create agent@trektribe.com "Support Agent" agent agent123

# Create organizer user
npm run cli user create organizer@trektribe.com "Trip Organizer" organizer organizer123

# Create traveler user
npm run cli user create traveler@trektribe.com "Adventure Traveler" traveler traveler123
```

## 📱 **Key Features**

### 🏔️ **Adventure Platform**
- Trip discovery and booking system
- Real-time chat with support agents
- Interactive trip tracking
- Emergency contact management
- Multi-role user system

### 💬 **Real-time Communication** 
- Live chat widget for instant support
- Agent dashboard for chat management
- Socket.IO powered real-time messaging
- Priority-based ticket handling

### 🔐 **Privacy & Compliance**
- GDPR-compliant data management
- Advanced cookie consent system
- Privacy policy and terms of service
- User data export and deletion
- Cookie preference management

### 📊 **Analytics & Management**
- Admin dashboard with system metrics
- Agent performance tracking
- User engagement analytics
- System health monitoring

---

## 🛠️ **Technology Stack**

### **Backend**
- **Node.js** with Express.js
- **TypeScript** for type safety
- **MongoDB** with Mongoose ODM
- **Socket.IO** for real-time features
- **JWT** authentication
- **Helmet** security middleware

### **Frontend** 
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Axios** for API communication
- **React Router** for navigation
- **Socket.IO Client** for real-time features

### **External Integrations**
- **Google OAuth** for social login
- **Gmail SMTP** for email notifications
- **Twilio** for SMS notifications (optional)

---

## 🎨 **Professional UI/UX**

### **Design System**
- **Nature Theme**: Forest greens and earth tones for regular users
- **Professional Theme**: Dark gradients for admin interfaces  
- **Support Theme**: Blue gradients for agent interfaces
- **Responsive Design**: Mobile-first approach
- **Accessibility**: WCAG 2.1 compliant

### **Role-based Interfaces**
- **Admin**: Enterprise dashboard with system controls
- **Agent**: Support-focused with chat management
- **Organizer**: Nature-themed with trip tools
- **Traveler**: Adventure-focused with booking features

---

## 🚀 **Deployment**

### **Development**
```bash
# Backend
cd services/api && npm run dev

# Frontend  
cd web && npm start
```

### **Production**

**Vercel (Frontend):**
```bash
cd web
npm run build
vercel --prod
```

**Render/Railway (Backend):**
- Connect GitHub repository
- Set environment variables
- Deploy automatically

---

## 🔧 **Configuration**

### **External Service Setup**

#### **Google OAuth (Optional)**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Add redirect URI: `http://localhost:4000/auth/google/callback`
4. Update `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

#### **Email Service (Optional)**
1. Enable Gmail 2-factor authentication
2. Generate app-specific password
3. Update `EMAIL_USER` and `EMAIL_PASSWORD`

#### **SMS Service (Optional)**  
1. Sign up at [Twilio](https://twilio.com)
2. Get Account SID and Auth Token
3. Update `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`

---

## 📚 **API Documentation**

### **Authentication Endpoints**
- `POST /auth/register` - User registration
- `POST /auth/login` - User login  
- `GET /auth/me` - Get current user
- `GET /auth/google` - Google OAuth login

### **User Management (Admin Only)**
- `GET /admin/users` - List all users
- `PUT /admin/users/:id` - Update user role
- `DELETE /admin/users/:id` - Delete user

### **Trip Management**
- `GET /trips` - List trips
- `POST /trips` - Create trip (organizer)
- `PUT /trips/:id` - Update trip (organizer)
- `DELETE /trips/:id` - Delete trip (organizer)

### **Agent Features**
- `GET /agent/chats` - Get active chats
- `POST /agent/status` - Update agent status
- `GET /agent/statistics` - Get performance metrics

---

## 🤝 **Contributing**

### **Development Workflow**
1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`  
5. Open Pull Request

### **Code Standards**
- TypeScript for type safety
- ESLint + Prettier for code formatting
- Conventional commits for clear history
- Component-based architecture

---

## 📄 **Legal & Compliance**

### **Privacy Features**
- ✅ GDPR Article 20 (Data Portability)
- ✅ GDPR Article 17 (Right to Erasure)  
- ✅ Cookie Consent (ePrivacy Directive)
- ✅ Privacy Policy (GDPR Article 13)
- ✅ Terms of Service

### **Cookie Management**
- Essential cookies (always active)
- Analytics cookies (user choice)
- Marketing cookies (user choice)
- Functional cookies (user choice)

---

## 🔧 **Troubleshooting**

### **Common Issues**

**Backend won't start:**
```bash
# Check MongoDB connection
# Verify .env file exists
# Check port 4000 availability
```

**Frontend compilation errors:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

**Authentication issues:**
```bash
# Verify JWT_SECRET is set
# Check CORS configuration
# Confirm API URL in frontend
```

---

## 📞 **Support**

- **Documentation**: [GitHub Wiki](https://github.com/yourusername/trek-tribe/wiki)
- **Issues**: [GitHub Issues](https://github.com/yourusername/trek-tribe/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/trek-tribe/discussions)

---

## 📋 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 **Acknowledgments**

- React Team for the amazing framework
- Tailwind CSS for the utility-first styling
- MongoDB for the flexible database
- All contributors and users of Trek Tribe

---

**Ready to start your adventure? 🏔️**

[Get Started](#quick-start) | [View Demo](http://localhost:3000) | [Documentation](https://github.com/yourusername/trek-tribe/wiki)