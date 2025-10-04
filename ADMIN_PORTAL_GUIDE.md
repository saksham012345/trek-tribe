# 🔐 Trek Tribe Admin Portal - Complete Guide

## 📋 **Admin Portal Architecture**

### **Frontend Integration**
- **Location**: Integrated into main React app at `/admin` route
- **URL**: http://localhost:3000/admin  
- **Component**: `AdminDashboard.tsx` in `web/src/pages/`
- **Protection**: Role-based access control (admin/agent roles only)

### **Backend API**
- **Base URL**: http://localhost:4000/admin
- **Route File**: `services/api/src/routes/admin-simple.ts`
- **Authentication**: JWT-based with role verification
- **Middleware**: `authenticateJwt` + `isAdminOrAgent` middleware

---

## 🔑 **Admin Login Credentials**

### **Admin User (Full Access)**
- **Email**: `admin@trekktribe.com`
- **Password**: `admin123`
- **Role**: `admin`
- **Permissions**: Full admin access to all features

### **Agent User (Support Access)**
- **Email**: `agent@trekktribe.com`  
- **Password**: `agent123`
- **Role**: `agent`
- **Permissions**: Support and user management features

---

## 🚀 **How to Access Admin Portal**

### **Step 1: Login Process**
1. **Open**: http://localhost:3000/login
2. **Enter Credentials**: Use admin or agent credentials above
3. **Login**: Click login button
4. **Verify**: You should see admin menu in header

### **Step 2: Access Admin Dashboard**
1. **Direct URL**: http://localhost:3000/admin
2. **Or**: Click "⚙️ Admin Panel" in the top navigation
3. **Dashboard**: You'll see the admin dashboard with stats and navigation

### **Step 3: Navigation Tabs**
- **📊 Dashboard**: Overview stats and analytics
- **👥 Users**: User management and roles  
- **🏔️ Trips**: Trip management and moderation
- **💬 Support**: Chat/ticket management system
- **⚙️ System**: System health and monitoring

---

## 🖥️ **Frontend Components**

### **Main Admin Component**
```typescript
// web/src/pages/AdminDashboard.tsx
- Role verification (admin/agent only)
- Tab-based navigation
- Real-time stats display
- User and trip management
- Support ticket system
```

### **Access Control in App.tsx**
```typescript
// Protects /admin route
<Route 
  path="/admin" 
  element={
    user && (user.role === 'admin' || user.role === 'agent') 
      ? <AdminDashboard user={user} /> 
      : <Navigate to="/" />
  } 
/>
```

### **Header Navigation**
```typescript
// Shows admin link only for admin/agent users
{(user?.role === 'admin' || user?.role === 'agent') && (
  <Link to="/admin">⚙️ Admin Panel</Link>
)}
```

---

## 🔧 **Backend API Endpoints**

### **Admin Routes (All require admin/agent role)**

#### **Dashboard Analytics**
```
GET /admin/dashboard
- Overview stats (users, trips, chats)
- Growth metrics and trends
- Recent activity feed
- Role and status distributions
```

#### **User Management**
```
GET /admin/users
- Paginated user list
- Role and status information
- Search and filtering
- User verification status
```

#### **Support System**
```  
GET /admin/chats
- Support ticket queue
- Chat session management
- Priority and status tracking
- Agent assignment
```

#### **System Monitoring**
```
GET /admin/system
- Database statistics
- Active agent count
- System health status
- Server uptime
```

---

## 🛡️ **Security & Role-Based Access**

### **Authentication Flow**
1. **JWT Verification**: All admin routes require valid JWT token
2. **Role Check**: User must have 'admin' or 'agent' role
3. **Route Protection**: Frontend prevents unauthorized access
4. **API Security**: Backend validates roles on every request

### **Role Permissions**
```typescript
// Both admin and agent can access:
- Dashboard overview
- User list (read-only for agents)  
- Support tickets
- System monitoring

// Admin-only features:
- User role modification
- System configuration
- Advanced analytics
```

### **Middleware Protection**
```typescript
// services/api/src/routes/admin-simple.ts
const isAdminOrAgent = (req, res, next) => {
  if (req.auth.role !== 'admin' && req.auth.role !== 'agent') {
    return res.status(403).json({ error: 'Admin or agent access required' });
  }
  next();
};
```

---

## 📊 **Admin Dashboard Features**

### **Overview Stats Card**
- Total users count with growth rate
- Active trips and completion stats  
- Support chat queue status
- System health indicators

### **User Management Panel**
- User list with filtering options
- Role assignments (traveler/organizer/admin/agent)
- Account status management  
- Email/phone verification tracking

### **Trip Moderation**
- Trip approval workflow
- Content moderation tools
- Organizer verification
- Safety and quality checks

### **Support Ticket System**
- Live chat queue management
- Ticket assignment to agents
- Priority level handling
- Response time tracking

---

## 🔍 **Testing the Admin Portal**

### **Quick Test Steps**
1. **Health Check**: Visit http://localhost:4000/admin/dashboard (should get 401 without auth)
2. **Login**: Use admin credentials on frontend
3. **Access Dashboard**: Visit http://localhost:3000/admin
4. **Test Navigation**: Click through different tabs
5. **API Verification**: Check network tab for successful admin API calls

### **Troubleshooting**
- **403 Forbidden**: User doesn't have admin/agent role
- **401 Unauthorized**: Not logged in or invalid token
- **404 Not Found**: Admin routes not properly configured
- **500 Server Error**: Backend database or middleware issue

---

## 🎯 **Current Status**

### **✅ Working Features**
- ✅ Admin user authentication
- ✅ Role-based access control
- ✅ Dashboard with mock analytics
- ✅ User management interface
- ✅ Support ticket queue
- ✅ System monitoring

### **⚠️ Mock Data Areas**
- Dashboard statistics (using sample data)
- User lists (showing demo users)
- Support tickets (demo conversations)
- System stats (placeholder values)

### **🔄 To Implement for Production**
- Real database queries for stats
- Live user management operations  
- Actual support ticket integration
- Real-time notifications
- Advanced filtering and search

---

## 📞 **Quick Access Summary**

**Login with these credentials:**
- **Admin**: admin@trekktribe.com / admin123
- **Agent**: agent@trekktribe.com / agent123

**Then visit:**
- **Admin Dashboard**: http://localhost:3000/admin
- **API Health**: http://localhost:4000/health
- **Admin API**: http://localhost:4000/admin/dashboard

The admin portal is fully integrated and ready to use! 🚀