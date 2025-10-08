# TrekkTribe Deployment Guide

This guide covers deploying TrekkTribe to production using various platforms and configurations.

## Quick Deployment Options

### Option 1: Render + Vercel (Recommended)
- **Backend**: Deploy to Render (supports Docker, auto-scaling)
- **Frontend**: Deploy to Vercel (optimized for React)
- **Database**: MongoDB Atlas (managed)
- **Files**: Cloudinary (image hosting)

### Option 2: Railway (Full-stack)
- **Full App**: Deploy entire stack to Railway
- **Database**: Railway Postgres/MongoDB
- **Files**: Railway volumes or Cloudinary

### Option 3: Self-hosted (VPS/AWS/DigitalOcean)
- **Infrastructure**: Docker + Docker Compose
- **Reverse Proxy**: Nginx
- **Database**: Self-hosted MongoDB
- **SSL**: Let's Encrypt

## Pre-deployment Checklist

### 1. Environment Variables Setup
Ensure all required environment variables are configured (see ENVIRONMENT_VARIABLES.md):

**Critical Variables:**
```bash
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret-key
FRONTEND_URL=https://your-domain.com
```

**Service Integration:**
- Email service (SendGrid/SMTP)
- File storage (Cloudinary/AWS S3)
- Payment gateway (Stripe/PayPal)
- WhatsApp service (optional)

### 2. Database Setup
- Create production MongoDB database
- Set up database users and permissions
- Configure network access (IP whitelist)
- Run database migrations if needed

### 3. Domain & SSL
- Purchase domain name
- Configure DNS records
- Set up SSL certificates (Let's Encrypt/Cloudflare)

## Deployment Instructions

## Option 1: Render + Vercel Deployment

### Backend Deployment (Render)

1. **Connect Repository**
   - Login to Render.com
   - Connect your GitHub repository
   - Select the backend service directory

2. **Service Configuration**
   ```yaml
   Name: trekktribe-api
   Environment: Docker
   Dockerfile Path: services/api/Dockerfile
   Build Command: docker build -t trekktribe-api .
   Start Command: npm start
   ```

3. **Environment Variables**
   Add all backend environment variables in Render dashboard

4. **Health Check**
   - Health check path: `/health`
   - Health check port: `4000`

### Frontend Deployment (Vercel)

1. **Connect Repository**
   - Login to Vercel
   - Import GitHub repository
   - Set root directory to `services/frontend`

2. **Build Settings**
   ```yaml
   Framework Preset: Create React App
   Build Command: npm run build
   Output Directory: build
   Install Command: npm ci
   ```

3. **Environment Variables**
   ```bash
   REACT_APP_API_URL=https://your-api-domain.onrender.com
   REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_...
   ```

### Custom Domain Setup

1. **Backend Domain**
   - Add custom domain in Render: `api.yourdomain.com`
   - Update DNS records as instructed

2. **Frontend Domain**
   - Add custom domain in Vercel: `yourdomain.com`
   - Configure DNS records

## Option 2: Railway Deployment

### Full-stack Deployment

1. **Repository Setup**
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login and create project
   railway login
   railway init
   ```

2. **Service Configuration**
   Create `railway.toml`:
   ```toml
   [build]
   builder = "DOCKERFILE"
   
   [deploy]
   healthcheckPath = "/health"
   healthcheckTimeout = 300
   restartPolicyType = "ON_FAILURE"
   ```

3. **Environment Variables**
   ```bash
   railway variables set NODE_ENV=production
   railway variables set MONGODB_URI=mongodb://...
   # Add all other variables
   ```

4. **Deploy**
   ```bash
   railway up
   ```

## Option 3: Self-hosted VPS Deployment

### Server Preparation

1. **Server Requirements**
   - Ubuntu 20.04+ or CentOS 8+
   - 4GB+ RAM
   - 40GB+ storage
   - Docker and Docker Compose installed

2. **Install Dependencies**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   
   # Install Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

3. **Clone Repository**
   ```bash
   git clone https://github.com/yourusername/trek-tribe.git
   cd trek-tribe
   ```

4. **Environment Configuration**
   ```bash
   # Copy and edit environment file
   cp .env.example .env
   nano .env
   ```

5. **SSL Setup with Let's Encrypt**
   ```bash
   # Install Certbot
   sudo apt install certbot python3-certbot-nginx -y
   
   # Generate SSL certificates
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```

6. **Deploy with Docker Compose**
   ```bash
   # Production deployment
   docker-compose --profile production up -d
   
   # Check services
   docker-compose ps
   docker-compose logs -f
   ```

### Production Monitoring

1. **Health Monitoring**
   ```bash
   # Check service health
   curl https://yourdomain.com/health
   
   # Monitor logs
   docker-compose logs -f api
   ```

2. **Backup Strategy**
   ```bash
   # MongoDB backup script
   docker exec mongodb mongodump --out /backup/$(date +%Y%m%d_%H%M%S)
   
   # Upload backups to cloud storage
   # Schedule with cron job
   ```

## Post-deployment Configuration

### 1. Domain Configuration
Update all environment variables with production URLs:
```bash
FRONTEND_URL=https://yourdomain.com
CORS_ORIGIN=https://yourdomain.com
```

### 2. Email Templates
Configure email templates in your email service provider

### 3. Payment Gateway
- Set up production payment gateway accounts
- Configure webhooks for payment confirmations
- Test payment flows

### 4. WhatsApp Integration
- Set up WhatsApp Business API account
- Configure webhook URLs
- Test message sending functionality

### 5. File Upload Configuration
- Set up CDN for faster file serving
- Configure image optimization
- Set up file backup strategy

## Security Considerations

### 1. Environment Security
- Never commit environment files to version control
- Use strong, unique passwords and secrets
- Rotate API keys regularly
- Enable 2FA on all service accounts

### 2. Server Security
- Keep server and dependencies updated
- Configure firewall rules
- Use SSH keys instead of passwords
- Regular security audits

### 3. Application Security
- Enable rate limiting
- Configure CORS properly
- Use HTTPS everywhere
- Implement proper input validation

### 4. Database Security
- Use strong database passwords
- Configure network access restrictions
- Enable database encryption
- Regular backup testing

## Monitoring and Maintenance

### 1. Application Monitoring
- Set up health check alerts
- Monitor application logs
- Track performance metrics
- Monitor error rates

### 2. Infrastructure Monitoring
- Server resource usage (CPU, RAM, disk)
- Network performance
- Database performance
- SSL certificate expiration

### 3. Backup Strategy
- Automated daily database backups
- File storage backups
- Configuration backups
- Test restore procedures regularly

### 4. Update Strategy
- Staging environment for testing
- Blue-green deployments
- Database migration strategy
- Rollback procedures

## Troubleshooting

### Common Issues

1. **Service Won't Start**
   ```bash
   # Check logs
   docker-compose logs api
   
   # Check environment variables
   docker-compose exec api printenv
   
   # Restart services
   docker-compose restart api
   ```

2. **Database Connection Issues**
   ```bash
   # Test database connection
   docker-compose exec api npm run test:db
   
   # Check MongoDB logs
   docker-compose logs mongodb
   ```

3. **File Upload Issues**
   ```bash
   # Check upload directory permissions
   ls -la uploads/
   
   # Check storage service configuration
   docker-compose exec api npm run test:storage
   ```

4. **SSL Certificate Issues**
   ```bash
   # Renew certificates
   sudo certbot renew
   
   # Test SSL configuration
   ssl-test yourdomain.com
   ```

### Performance Optimization

1. **Database Optimization**
   - Create proper indexes
   - Optimize queries
   - Enable query profiling
   - Configure connection pooling

2. **Application Optimization**
   - Enable compression
   - Optimize bundle size
   - Implement caching strategy
   - Use CDN for static assets

3. **Server Optimization**
   - Configure reverse proxy caching
   - Enable HTTP/2
   - Optimize Docker containers
   - Monitor resource usage

## Support and Documentation

- **API Documentation**: Available at `/api/docs` after deployment
- **Health Status**: Available at `/health`
- **Monitoring Dashboard**: Configure with your preferred monitoring tool
- **Support Contact**: admin@yourdomain.com

For additional support and customization, please refer to the technical documentation or contact the development team.