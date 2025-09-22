# Trek Tribe - Render Deployment Guide

This guide covers deploying both the API and Web application to Render.

## 🚀 Quick Deployment Overview

Trek Tribe can be deployed to Render in two ways:
1. **Separate Services**: API and Web as individual Render services (recommended)
2. **Monorepo**: Both services from a single repository using root `render.yaml`

## 📋 Prerequisites

1. **Render Account**: Sign up at [render.com](https://render.com)
2. **MongoDB Atlas**: Set up a cloud MongoDB database (recommended)
3. **GitHub Repository**: Push your code to GitHub
4. **Environment Variables**: Prepare your production secrets

## 🔧 Step-by-Step Deployment

### 1. Prepare MongoDB Database

#### Option A: MongoDB Atlas (Recommended)
1. Create account at [mongodb.com/cloud/atlas](https://mongodb.com/cloud/atlas)
2. Create new cluster (free tier available)
3. Create database user with read/write permissions
4. Whitelist your IP (or 0.0.0.0/0 for Render)
5. Get connection string:
   ```
   mongodb+srv://<username>:<password>@cluster.mongodb.net/trekktribe?retryWrites=true&w=majority
   ```

#### Option B: Render PostgreSQL (Requires Code Changes)
If you prefer PostgreSQL, you'll need to:
- Modify models to use a PostgreSQL ORM like Prisma
- Update database connection logic
- This guide assumes MongoDB Atlas

### 2. Deploy API to Render

#### Method 1: Using Render Dashboard

1. **Create New Web Service**:
   - Go to [render.com/dashboard](https://render.com/dashboard)
   - Click "New" → "Web Service"
   - Connect your GitHub repository
   - Set **Root Directory**: `services/api`
   - Set **Environment**: `Node`
   - Set **Build Command**: `npm install && npm run build`
   - Set **Start Command**: `npm start`

2. **Configure Environment Variables**:
   ```
   NODE_ENV=production
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/trekktribe
   JWT_SECRET=your_super_secure_jwt_secret_here
   FRONTEND_URL=https://trek-tribe-web.onrender.com
   CORS_ORIGIN=https://trek-tribe-web.onrender.com
   ```

3. **Advanced Settings**:
   - **Health Check Path**: `/health`
   - **Plan**: Free (or paid as needed)
   - **Region**: Oregon (or nearest to your users)

#### Method 2: Using render.yaml (Recommended)

1. Use the provided `services/api/render.yaml` file
2. Push to GitHub
3. Import repository to Render
4. Render will automatically detect the configuration

### 3. Deploy Web Application to Render

#### Method 1: Using Render Dashboard

1. **Create New Static Site**:
   - Go to [render.com/dashboard](https://render.com/dashboard)
   - Click "New" → "Static Site"
   - Connect your GitHub repository
   - Set **Root Directory**: `web`
   - Set **Build Command**: `npm install && npm run build`
   - Set **Publish Directory**: `build`

2. **Configure Environment Variables**:
   ```
   REACT_APP_API_URL=https://trek-tribe-api.onrender.com
   REACT_APP_APP_NAME=Trek Tribe
   REACT_APP_VERSION=1.0.0
   NODE_ENV=production
   ```

#### Method 2: Using render.yaml

1. Use the provided `web/render.yaml` file
2. Configuration is automatically applied

### 4. Monorepo Deployment (Alternative)

Deploy both services from root directory:

1. **Use Root Configuration**:
   - Import repository to Render
   - Use the root `render.yaml` file
   - Render will create both services automatically

2. **Benefits**:
   - Single repository management
   - Coordinated deployments
   - Shared environment variables

## 🛠️ Post-Deployment Configuration

### 1. Update Service URLs

After deployment, update environment variables with actual service URLs:

**API Service**:
```
FRONTEND_URL=https://your-actual-web-url.onrender.com
CORS_ORIGIN=https://your-actual-web-url.onrender.com
```

**Web Service**:
```
REACT_APP_API_URL=https://your-actual-api-url.onrender.com
```

### 2. Database Setup

Run database setup script (optional):
```bash
# From API directory locally
npm run setup:db
```

### 3. Test Deployment

- API Health: `https://your-api-url.onrender.com/health`
- Web Application: `https://your-web-url.onrender.com`

## 🌟 Production Checklist

### Security
- ✅ Generate secure JWT secret: `openssl rand -hex 32`
- ✅ Use MongoDB Atlas with authentication
- ✅ Configure CORS for production domains
- ✅ Enable HTTPS (automatic with Render)
- ✅ Set up proper environment variables

### Performance
- ✅ Enable caching headers (configured in render.yaml)
- ✅ Configure health checks
- ✅ Set up database indexes
- ✅ Monitor resource usage

### Monitoring
- ✅ Enable Render logs monitoring
- ✅ Set up uptime monitoring
- ✅ Configure error alerting

## 🚨 Common Issues and Solutions

### Issue: Build Fails
**Solutions**:
- Ensure `package.json` has correct build scripts
- Check Node.js version compatibility
- Verify all dependencies are listed in package.json

### Issue: API Returns 500 Error
**Solutions**:
- Check MongoDB connection string
- Verify environment variables are set
- Check Render logs for detailed error messages

### Issue: CORS Errors
**Solutions**:
- Ensure `FRONTEND_URL` is set correctly in API
- Verify web app is using correct API URL
- Check CORS configuration in API code

### Issue: Database Connection Failed
**Solutions**:
- Verify MongoDB Atlas connection string
- Ensure IP whitelist includes Render's IPs (or use 0.0.0.0/0)
- Check database user permissions

### Issue: Static Site Not Loading
**Solutions**:
- Verify build directory is `build`
- Check if build command completed successfully
- Ensure all routes redirect to `index.html`

## 📱 Development vs Production URLs

### Local Development
- API: `http://localhost:4000`
- Web: `http://localhost:3000`

### Render Production (update with your actual URLs)
- API: `https://trek-tribe-api.onrender.com`
- Web: `https://trek-tribe-web.onrender.com`

## 🔄 Continuous Deployment

Render automatically redeploys when you push to your main branch:

1. **Auto-deploy**: Enabled by default
2. **Branch Selection**: Choose which branch triggers deployment
3. **Build Notifications**: Configure via Render dashboard
4. **Preview Deployments**: Available for pull requests

## 💰 Render Pricing

### Free Tier Limitations
- **Web Services**: Sleep after 15 minutes of inactivity
- **Static Sites**: Always available
- **Build Minutes**: Limited per month
- **Bandwidth**: Limited per month

### Paid Plans
- **No sleep**: Services stay active 24/7
- **More resources**: Better performance
- **Custom domains**: Free SSL certificates
- **Priority support**: Faster response times

## 🎯 Advanced Configuration

### Custom Domains
1. Go to Service Settings in Render Dashboard
2. Add custom domain
3. Configure DNS settings
4. SSL certificate is automatic

### Environment-Based Deployments
```yaml
# In render.yaml
envVars:
  - key: ENVIRONMENT
    value: staging
  - key: MONGODB_URI
    value: mongodb+srv://...staging-db...
```

### Health Checks
```yaml
# In render.yaml
healthCheckPath: /health
```

### Resource Scaling
```yaml
# In render.yaml
plan: standard  # or pro
```

## 🔧 Maintenance Commands

```bash
# Local development
npm run dev:api    # Start API on localhost:4000
npm run dev:web    # Start web on localhost:3000

# Database management
npm run setup:db   # Setup database indexes

# Build testing
npm run build:api  # Test API build
npm run build:web  # Test web build
```

## 📊 Monitoring and Logs

### Render Dashboard
- View deployment logs
- Monitor resource usage
- Set up alerts
- Check service health

### API Endpoints for Monitoring
- Health: `/health` or `/api/health`
- Status: Check HTTP response codes
- Database: Monitor MongoDB Atlas dashboard

## 🎉 Success!

Your Trek Tribe application is now running on Render! 

### Quick Verification
1. ✅ API Health: Check `/health` endpoint
2. ✅ Web App: Load homepage and test navigation
3. ✅ Authentication: Test login/registration
4. ✅ API Calls: Create a test trip or review

---

Need help? Check [Render's documentation](https://render.com/docs) or the troubleshooting section above.