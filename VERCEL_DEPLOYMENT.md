# Trek Tribe - Vercel Deployment Guide

This guide covers deploying both the API and Web application to Vercel.

## 🚀 Quick Deployment Overview

Trek Tribe can be deployed as two separate Vercel projects:
1. **API**: Serverless functions for the backend
2. **Web**: Static React application for the frontend

## 📋 Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **MongoDB Atlas**: Set up a cloud MongoDB database
3. **GitHub Repository**: Push your code to GitHub
4. **Environment Variables**: Prepare your production secrets

## 🔧 Step-by-Step Deployment

### 1. Prepare MongoDB Database

1. Create a MongoDB Atlas account at [mongodb.com/cloud/atlas](https://mongodb.com/cloud/atlas)
2. Create a new cluster (free tier is fine for development)
3. Create a database user with read/write permissions
4. Get your connection string (replace `<password>` with actual password)
   ```
   mongodb+srv://<username>:<password>@cluster.mongodb.net/trekktribe?retryWrites=true&w=majority
   ```

### 2. Deploy API to Vercel

1. **Import API to Vercel**:
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository
   - Set **Root Directory** to `services/api`
   - Click "Deploy"

2. **Configure Environment Variables**:
   In Vercel Dashboard → Project → Settings → Environment Variables:
   ```
   NODE_ENV=production
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/trekktribe
   JWT_SECRET=your_super_secure_jwt_secret_here
   FRONTEND_URL=https://your-web-app.vercel.app
   ```

3. **Generate Secure JWT Secret**:
   ```bash
   # Run this command to generate a secure secret
   openssl rand -hex 32
   ```

4. **Note your API URL**: After deployment, note your API URL (e.g., `https://your-api.vercel.app`)

### 3. Deploy Web Application to Vercel

1. **Import Web App to Vercel**:
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository again (or use same project)
   - Set **Root Directory** to `web`
   - Click "Deploy"

2. **Configure Environment Variables**:
   In Vercel Dashboard → Project → Settings → Environment Variables:
   ```
   REACT_APP_API_URL=https://your-api.vercel.app
   REACT_APP_APP_NAME=Trek Tribe
   REACT_APP_VERSION=1.0.0
   ```

### 4. Update CORS Configuration

After both deployments:

1. **Update API Environment Variables**:
   - Go to API project in Vercel Dashboard
   - Update `FRONTEND_URL` with your actual web app URL
   - Redeploy the API project

2. **Update Web Environment Variables**:
   - Go to Web project in Vercel Dashboard  
   - Update `REACT_APP_API_URL` with your actual API URL
   - Redeploy the web project

## 🔄 Alternative: Monorepo Deployment

You can also deploy both as a single Vercel project using the root `vercel.json`:

1. **Deploy from Root**:
   - Import GitHub repository 
   - Keep **Root Directory** as `/` (root)
   - The root `vercel.json` will handle routing

2. **Environment Variables** (set at project level):
   ```
   NODE_ENV=production
   MONGODB_URI=mongodb+srv://...
   JWT_SECRET=your_secret_here
   REACT_APP_API_URL=https://your-domain.vercel.app/api
   ```

## 🛠️ Build and Test Locally

Before deploying, test the build process locally:

```bash
# Test API build
cd services/api
npm run build
npm start

# Test Web build
cd ../../web
npm run build
npm run preview
```

## 🌟 Production Checklist

### Security
- ✅ Generate secure JWT secret
- ✅ Use MongoDB Atlas with authentication
- ✅ Configure CORS for production domains
- ✅ Enable HTTPS (automatic with Vercel)

### Environment Variables
- ✅ Set `NODE_ENV=production` for API
- ✅ Configure `MONGODB_URI` with Atlas connection
- ✅ Set `JWT_SECRET` with secure random string
- ✅ Set `REACT_APP_API_URL` with production API URL
- ✅ Set `FRONTEND_URL` for API CORS configuration

### Testing
- ✅ Test API health endpoint: `https://your-api.vercel.app/health`
- ✅ Test web application loads correctly
- ✅ Test authentication flow
- ✅ Test API calls from web app

## 🚨 Common Issues and Solutions

### Issue: API Returns 500 Error
**Solution**: Check MongoDB connection string and ensure database is accessible.

### Issue: CORS Errors
**Solution**: Ensure `FRONTEND_URL` is set correctly in API environment variables.

### Issue: Web App Can't Connect to API
**Solution**: Verify `REACT_APP_API_URL` points to correct API domain.

### Issue: Build Fails
**Solution**: Ensure all dependencies are installed and TypeScript compiles locally.

## 📱 Development vs Production URLs

### Development
- API: `http://localhost:4000`
- Web: `http://localhost:3000`

### Production (replace with your actual domains)
- API: `https://trek-tribe-api.vercel.app`
- Web: `https://trek-tribe-web.vercel.app`

## 🔄 Continuous Deployment

Vercel automatically redeploys when you push to your main branch. For custom deployment:

1. **Enable Auto-deployment**: In Project Settings → Git Integration
2. **Manual Deployment**: Use Vercel CLI or dashboard redeploy button
3. **Preview Deployments**: Automatic for all branches and pull requests

## 📊 Monitoring

Monitor your deployments:
1. **Vercel Dashboard**: View deployment logs and analytics
2. **Function Logs**: Check serverless function execution logs
3. **Performance**: Monitor Core Web Vitals in Vercel Dashboard

## 🎯 Next Steps

1. Set up custom domain names
2. Configure database backups
3. Set up monitoring and alerting
4. Enable analytics tracking
5. Set up staging environments

---

Your Trek Tribe application is now ready for production deployment on Vercel! 🎉