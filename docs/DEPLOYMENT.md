# Trek Tribe Deployment Guide

This guide covers deploying Trek Tribe to production using Vercel (frontend) and Render (backend).

## Architecture Overview

- **Frontend (React)**: Deployed on Vercel
- **Backend (Node.js/Express)**: Deployed on Render  
- **Database**: MongoDB Atlas
- **File Storage**: Cloudinary or AWS S3
- **Domain**: Custom domain with SSL

## Prerequisites

1. **GitHub Repository**: Code should be pushed to GitHub
2. **MongoDB Atlas**: Set up a cloud database
3. **Vercel Account**: For frontend deployment
4. **Render Account**: For backend deployment
5. **Cloudinary Account**: For file storage (optional)
6. **Custom Domain**: Optional but recommended

## Step 1: MongoDB Atlas Setup

### 1.1 Create MongoDB Atlas Cluster

1. Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. Sign up or log in
3. Create a new project: "Trek Tribe"
4. Build a new cluster:
   - Choose AWS/GCP/Azure
   - Select free tier (M0) or appropriate tier
   - Choose region closest to your users
   - Name your cluster: "trek-tribe-cluster"

### 1.2 Configure Database Access

1. **Database Users**:
   - Go to Database Access
   - Add new user with username/password
   - Grant "Read and write to any database" role
   - Save username and password for connection string

2. **Network Access**:
   - Go to Network Access
   - Add IP Address: `0.0.0.0/0` (allow from anywhere)
   - Or add specific IPs for better security

3. **Get Connection String**:
   - Go to Clusters > Connect
   - Choose "Connect your application"
   - Copy connection string:
     ```
     mongodb+srv://<username>:<password>@trek-tribe-cluster.xxxxx.mongodb.net/trekktribe?retryWrites=true&w=majority
     ```

## Step 2: Environment Variables Setup

### 2.1 Production Environment Variables

Create production values for all environment variables:

```bash
# Critical Production Variables
NODE_ENV=production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/trekktribe
JWT_SECRET=your-super-secure-64-character-jwt-secret-for-production-use-only
FRONTEND_URL=https://trek-tribe.vercel.app
CORS_ORIGIN=https://trek-tribe.vercel.app

# Google OAuth (if using)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email (Gmail SMTP)
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password

# Optional Services
WHATSAPP_ENABLED=true
EMAIL_ENABLED=true
```

### 2.2 Generate Secure Secrets

```bash
# Generate a secure JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Or use OpenSSL
openssl rand -hex 32
```

## Step 3: Backend Deployment (Render)

### 3.1 Prepare Backend for Deployment

1. **Update package.json** (if needed):
```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "start:render": "node dist/index.js"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

2. **Create render.yaml** (optional):
```yaml
services:
  - type: web
    name: trek-tribe-api
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm run start:render
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        fromService:
          type: web
          name: trek-tribe-api
          property: port
```

### 3.2 Deploy to Render

1. **Connect Repository**:
   - Go to [Render Dashboard](https://dashboard.render.com/)
   - Click "New +" > "Web Service"
   - Connect your GitHub account
   - Select `trek-tribe` repository
   - Choose `services/api` as root directory

2. **Configure Service**:
   - **Name**: `trek-tribe-api`
   - **Environment**: `Node`
   - **Region**: Choose closest to your users
   - **Branch**: `main` or `production`
   - **Root Directory**: `services/api`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm run start:render`

3. **Set Environment Variables**:
   - Add all production environment variables
   - Render automatically sets `PORT` (usually 10000)

4. **Deploy**:
   - Click "Create Web Service"
   - Wait for deployment to complete
   - Note the service URL: `https://trek-tribe-api.onrender.com`

### 3.3 Verify Backend Deployment

Test your API endpoints:
```bash
# Health check
curl https://trek-tribe-api.onrender.com/health

# Test API
curl https://trek-tribe-api.onrender.com/api/trips
```

## Step 4: Frontend Deployment (Vercel)

### 4.1 Prepare Frontend for Deployment

1. **Update environment variables**:
```bash
# In web/.env.production
REACT_APP_API_URL=https://trek-tribe-api.onrender.com
REACT_APP_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GENERATE_SOURCEMAP=false
```

2. **Update API configuration** (if needed):
```typescript
// web/src/config/api.ts
const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://trek-tribe-api.onrender.com';
```

### 4.2 Deploy to Vercel

1. **Connect Repository**:
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import from GitHub: `trek-tribe` repository
   - **Root Directory**: `web`

2. **Configure Project**:
   - **Framework Preset**: `Create React App`
   - **Root Directory**: `web`
   - **Build Command**: `npm run build`
   - **Output Directory**: `build`
   - **Install Command**: `npm install`

3. **Environment Variables**:
   - Add all `REACT_APP_*` variables
   - Set `GENERATE_SOURCEMAP=false`
   - Set `TSC_COMPILE_ON_ERROR=true`

4. **Deploy**:
   - Click "Deploy"
   - Wait for deployment
   - Note the URL: `https://trek-tribe.vercel.app`

### 4.3 Update Backend CORS

Update your backend environment variables:
```bash
FRONTEND_URL=https://trek-tribe.vercel.app
CORS_ORIGIN=https://trek-tribe.vercel.app
ALLOWED_ORIGINS=https://trek-tribe.vercel.app
```

Redeploy the backend service.

## Step 5: Custom Domain Setup (Optional)

### 5.1 Frontend Domain (Vercel)

1. **Add Domain**:
   - Go to Project Settings > Domains
   - Add your domain: `trek-tribe.com`
   - Add www subdomain: `www.trek-tribe.com`

2. **Configure DNS**:
   - Add CNAME record: `www.trek-tribe.com` → `cname.vercel-dns.com`
   - Add A record: `trek-tribe.com` → `76.76.19.61`

### 5.2 Backend Domain (Render)

1. **Add Custom Domain**:
   - Go to Service > Settings > Custom Domains
   - Add domain: `api.trek-tribe.com`

2. **Configure DNS**:
   - Add CNAME record: `api.trek-tribe.com` → `trek-tribe-api.onrender.com`

### 5.3 Update Environment Variables

```bash
# Backend
FRONTEND_URL=https://trek-tribe.com
CORS_ORIGIN=https://trek-tribe.com
ALLOWED_ORIGINS=https://trek-tribe.com,https://www.trek-tribe.com

# Frontend
REACT_APP_API_URL=https://api.trek-tribe.com
```

## Step 6: SSL and Security

### 6.1 SSL Certificates

Both Vercel and Render provide automatic SSL certificates:
- **Vercel**: Automatic SSL for all domains
- **Render**: Free SSL certificates for custom domains

### 6.2 Security Headers

Update your backend to include security headers:

```typescript
// Add to your Express app
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});
```

## Step 7: Monitoring and Analytics

### 7.1 Application Monitoring

1. **Render Monitoring**:
   - Built-in metrics and logs
   - Set up log retention
   - Monitor CPU and memory usage

2. **Vercel Analytics**:
   - Enable Vercel Analytics
   - Monitor Core Web Vitals
   - Track page performance

### 7.2 Error Tracking

Consider adding error tracking:
- **Sentry**: For error monitoring
- **LogRocket**: For session replay
- **Datadog**: For comprehensive monitoring

### 7.3 Uptime Monitoring

Set up uptime monitoring:
- **UptimeRobot**: Free uptime monitoring
- **Pingdom**: Professional monitoring
- **StatusPage**: Status page for users

## Step 8: Continuous Deployment

### 8.1 Auto-Deploy Setup

Both platforms support auto-deploy:

1. **Vercel**:
   - Automatically deploys on push to main branch
   - Preview deployments for pull requests

2. **Render**:
   - Auto-deploy on push to specified branch
   - Manual deploy option available

### 8.2 Environment Management

Create separate environments:
- **Development**: Local development
- **Staging**: For testing before production
- **Production**: Live application

## Step 9: Database Migrations

### 9.1 Initial Data Setup

Run any necessary database setup scripts:

```bash
# If you have setup scripts
npm run setup:db:prod
npm run setup:users:prod
```

### 9.2 Data Migration

If migrating from existing data:
1. Export data from old system
2. Transform data to match new schema
3. Import using migration scripts
4. Verify data integrity

## Step 10: Testing Production Deployment

### 10.1 Functionality Testing

Test all major features:
- [ ] User registration and login
- [ ] Google OAuth login
- [ ] Trip browsing and search
- [ ] Trip booking and payments
- [ ] Profile management
- [ ] Email notifications
- [ ] File uploads
- [ ] Real-time features

### 10.2 Performance Testing

1. **Load Testing**:
   - Use tools like Artillery or k6
   - Test API endpoints under load
   - Monitor response times

2. **Frontend Performance**:
   - Check Lighthouse scores
   - Optimize bundle size
   - Monitor Core Web Vitals

### 10.3 Security Testing

- [ ] HTTPS enabled everywhere
- [ ] CORS properly configured
- [ ] Input validation working
- [ ] File upload restrictions
- [ ] Rate limiting active

## Troubleshooting

### Common Deployment Issues

1. **Build Failures**:
   ```bash
   # Check build logs
   # Verify all dependencies installed
   # Check TypeScript compilation
   npm run build
   ```

2. **Environment Variable Issues**:
   - Verify all required variables set
   - Check variable names (case-sensitive)
   - Ensure no spaces in values

3. **Database Connection Issues**:
   ```bash
   # Test MongoDB connection
   # Check IP whitelist
   # Verify connection string format
   ```

4. **CORS Errors**:
   - Check `CORS_ORIGIN` matches frontend URL
   - Verify protocol (http vs https)
   - Check for trailing slashes

5. **API Not Responding**:
   - Check service logs in Render
   - Verify build completed successfully
   - Test endpoints directly

### Recovery Procedures

1. **Rollback Deployment**:
   - Render: Use previous deployment
   - Vercel: Revert to previous commit

2. **Database Issues**:
   - Keep regular backups
   - Use MongoDB Atlas automated backups
   - Test backup restoration

3. **Service Downtime**:
   - Check service status pages
   - Monitor service logs
   - Have maintenance page ready

## Cost Optimization

### Free Tier Limits

1. **Vercel**:
   - 100GB bandwidth/month
   - 100 deployments/day
   - 1000 serverless function invocations/day

2. **Render**:
   - Free services spin down after 15 minutes
   - 750 hours/month (enough for 1 service)
   - Slower startup times

3. **MongoDB Atlas**:
   - M0: 512MB storage
   - Shared cluster
   - Basic monitoring

### Scaling Considerations

When you outgrow free tiers:
- **Render**: Upgrade to paid plans for always-on services
- **Vercel**: Pro plan for team features and higher limits
- **MongoDB Atlas**: M10+ for dedicated clusters
- **CDN**: Add CloudFlare for better performance

## Backup and Disaster Recovery

### Regular Backups

1. **Database Backups**:
   - MongoDB Atlas automatic backups
   - Manual exports for critical data

2. **Code Backups**:
   - GitHub repository
   - Backup environment variables separately

3. **File Storage Backups**:
   - If using file uploads, backup storage

### Disaster Recovery Plan

1. **Service Outage**:
   - Switch DNS to maintenance page
   - Restore from backups
   - Communicate with users

2. **Data Loss**:
   - Restore from latest backup
   - Check data integrity
   - Update users on any data loss

3. **Security Breach**:
   - Rotate all secrets immediately
   - Review access logs
   - Update security measures

## Support and Maintenance

### Regular Maintenance Tasks

1. **Weekly**:
   - Check service logs
   - Monitor performance metrics
   - Review error rates

2. **Monthly**:
   - Update dependencies
   - Review security alerts
   - Backup verification

3. **Quarterly**:
   - Security audit
   - Performance optimization
   - Cost review

### Getting Help

- **Render Support**: [Render Docs](https://render.com/docs)
- **Vercel Support**: [Vercel Docs](https://vercel.com/docs)
- **MongoDB Atlas**: [Atlas Docs](https://docs.atlas.mongodb.com/)

---

## Quick Reference

### Important URLs

- Frontend: `https://trek-tribe.vercel.app`
- Backend API: `https://trek-tribe-api.onrender.com`
- Database: MongoDB Atlas cluster
- Render Dashboard: `https://dashboard.render.com`
- Vercel Dashboard: `https://vercel.com/dashboard`

### Environment Variables Checklist

Backend (Render):
- [ ] `NODE_ENV=production`
- [ ] `MONGODB_URI` (Atlas connection string)
- [ ] `JWT_SECRET` (32+ character secret)
- [ ] `FRONTEND_URL` (Vercel URL)
- [ ] `CORS_ORIGIN` (Vercel URL)
- [ ] `GMAIL_USER` and `GMAIL_APP_PASSWORD`
- [ ] `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

Frontend (Vercel):
- [ ] `REACT_APP_API_URL` (Render URL)
- [ ] `REACT_APP_GOOGLE_CLIENT_ID`
- [ ] `GENERATE_SOURCEMAP=false`
- [ ] `TSC_COMPILE_ON_ERROR=true`

### Deployment Commands

```bash
# Manual deployment (if needed)
# Backend
npm run build
npm run start:render

# Frontend
npm run build
```

This completes the deployment guide for Trek Tribe! 🚀