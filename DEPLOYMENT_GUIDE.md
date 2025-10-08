# Trek Tribe - Production Deployment Guide

## 🚀 Overview

This guide provides step-by-step instructions for deploying Trek Tribe to various production environments including Docker, cloud platforms (Render, Vercel, Railway), and VPS servers.

## 📋 Pre-Deployment Checklist

### ✅ Required Services
- [ ] MongoDB database (Atlas recommended for production)
- [ ] Gmail account with 2FA and App Password for email service
- [ ] WhatsApp account for messaging integration
- [ ] Domain name (optional but recommended)
- [ ] SSL certificate (Let's Encrypt recommended)

### ✅ Environment Variables
Ensure all environment variables are properly configured (see `.env.example`):

**Critical Variables:**
- `JWT_SECRET`: Minimum 32-character random string
- `MONGODB_URI`: Production MongoDB connection string
- `GMAIL_USER` & `GMAIL_APP_PASSWORD`: Email service credentials
- `FRONTEND_URL`: Your frontend domain URL
- `NODE_ENV`: Set to `production`

---

## 🐳 Docker Deployment (Recommended)

### Prerequisites
- Docker & Docker Compose installed
- Domain name configured (optional)

### Step 1: Prepare Environment
```bash
# Clone repository
git clone <your-repo-url>
cd trek-tribe

# Copy environment files
cp .env.example .env
cp services/api/.env.example services/api/.env
cp web/.env.example web/.env

# Configure environment variables
# Edit each .env file with your production values
```

### Step 2: Production Environment Setup
```bash
# Set production environment variables
export NODE_ENV=production
export JWT_SECRET=your_super_secure_jwt_secret_key_min_32_characters
export MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/trekktribe
export GMAIL_USER=your-email@gmail.com
export GMAIL_APP_PASSWORD=your-16-char-app-password
export FRONTEND_URL=https://your-domain.com
```

### Step 3: Build and Deploy
```bash
# Build all services
docker-compose build

# Start production services
docker-compose up -d

# Verify deployment
docker-compose ps
docker-compose logs -f
```

### Step 4: SSL Configuration (with Nginx)
Create `nginx.conf`:
```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API
    location /api/ {
        proxy_pass http://localhost:4000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Step 5: Database Setup
```bash
# Connect to API container
docker-compose exec api npm run setup:db

# Verify database setup
docker-compose exec api npm run cli:stats
```

---

## ☁️ Render.com Deployment

### API Deployment

1. **Create New Web Service**
   - Repository: Connect your GitHub repository
   - Branch: `main`
   - Root Directory: `services/api`
   - Environment: `Node`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start:render`

2. **Environment Variables**
```bash
NODE_ENV=production
PORT=10000
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/trekktribe
JWT_SECRET=your_super_secure_jwt_secret_key_min_32_characters
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password
FRONTEND_URL=https://trek-tribe-web.onrender.com
CORS_ORIGIN=https://trek-tribe-web.onrender.com
WHATSAPP_ENABLED=true
```

3. **Auto-Deploy**: Enable auto-deploy from `main` branch

### Frontend Deployment

1. **Create Static Site**
   - Repository: Same repository
   - Branch: `main`
   - Root Directory: `web`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `build`

2. **Environment Variables**
```bash
REACT_APP_API_URL=https://trek-tribe-api.onrender.com
REACT_APP_APP_NAME=Trek Tribe
GENERATE_SOURCEMAP=false
```

---

## 🔵 Vercel Deployment

### Frontend Deployment

1. **Install Vercel CLI**
```bash
npm i -g vercel
```

2. **Deploy Frontend**
```bash
cd web
vercel

# Follow prompts:
# Set up and deploy? Yes
# Scope: Your account/team
# Project name: trek-tribe-web
# Directory: ./
# Override settings? Yes
# Build Command: npm run build
# Output Directory: build
```

3. **Configure Environment Variables**
   - Go to Vercel Dashboard → Project Settings → Environment Variables
   - Add:
```bash
REACT_APP_API_URL=https://trek-tribe-api.vercel.app
REACT_APP_APP_NAME=Trek Tribe
GENERATE_SOURCEMAP=false
```

### API Deployment

1. **Create `vercel.json` in `/services/api/`**
```json
{
  "version": 2,
  "builds": [
    {
      "src": "dist/index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "dist/index.js"
    }
  ],
  "env": {
    "NODE_ENV": "production"
  }
}
```

2. **Deploy API**
```bash
cd services/api
npm run build
vercel

# Configure environment variables in Vercel dashboard
```

---

## 🚄 Railway Deployment

### 1. Install Railway CLI
```bash
npm install -g @railway/cli
railway login
```

### 2. Create Railway Project
```bash
railway init
railway add --database mongodb
```

### 3. Deploy API
```bash
cd services/api
railway deploy

# Set environment variables
railway variables set NODE_ENV=production
railway variables set JWT_SECRET=your_jwt_secret
railway variables set MONGODB_URI=${{MONGODB_URL}}
railway variables set GMAIL_USER=your-email@gmail.com
railway variables set GMAIL_APP_PASSWORD=your-app-password
```

### 4. Deploy Frontend
```bash
cd ../web
railway init
railway deploy

# Set environment variables
railway variables set REACT_APP_API_URL=https://your-api-domain.railway.app
```

---

## 🖥️ VPS/Dedicated Server Deployment

### Prerequisites
- Ubuntu 20.04+ or CentOS 8+
- Root or sudo access
- Domain name (optional)

### Step 1: Server Setup
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin

# Install Nginx
sudo apt install nginx

# Install Certbot for SSL
sudo apt install certbot python3-certbot-nginx
```

### Step 2: Application Setup
```bash
# Create application directory
sudo mkdir -p /opt/trek-tribe
sudo chown $USER:$USER /opt/trek-tribe
cd /opt/trek-tribe

# Clone repository
git clone <your-repo-url> .

# Set up environment files
cp .env.example .env
cp services/api/.env.example services/api/.env
cp web/.env.example web/.env

# Configure environment variables
nano .env
nano services/api/.env
nano web/.env
```

### Step 3: SSL Certificate Setup
```bash
# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

### Step 4: Production Deployment
```bash
# Build and start services
docker-compose -f docker-compose.prod.yml up -d --build

# Setup database
docker-compose exec api npm run setup:db

# Configure log rotation
sudo nano /etc/logrotate.d/trek-tribe
```

### Step 5: Process Management (PM2)
```bash
# Install PM2 globally
sudo npm install -g pm2

# Create ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'trek-tribe-api',
      cwd: '/opt/trek-tribe/services/api',
      script: 'dist/index.js',
      env: {
        NODE_ENV: 'production',
        PORT: 4000
      },
      error_file: '/var/log/trek-tribe/api-error.log',
      out_file: '/var/log/trek-tribe/api-out.log',
      log_file: '/var/log/trek-tribe/api-combined.log'
    }
  ]
};
EOF

# Start with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

## 🗄️ Database Setup

### MongoDB Atlas (Recommended)
1. Create MongoDB Atlas account
2. Create cluster
3. Configure network access (allow your deployment IPs)
4. Create database user
5. Get connection string

### Self-Hosted MongoDB
```bash
# Install MongoDB
sudo apt install mongodb

# Configure MongoDB
sudo nano /etc/mongod.conf

# Start MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod

# Create database and user
mongo
use trekktribe
db.createUser({
  user: "trekkuser",
  pwd: "secure_password",
  roles: [{ role: "readWrite", db: "trekktribe" }]
})
```

---

## 📧 Email Service Configuration

### Gmail SMTP Setup
1. **Enable 2-Factor Authentication**
   - Go to Google Account settings
   - Security → 2-Step Verification → Turn On

2. **Generate App Password**
   - Security → App passwords
   - Select app: Mail
   - Select device: Other
   - Generate and copy 16-character password

3. **Update Environment Variables**
```bash
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-character-app-password
EMAIL_ENABLED=true
```

### Alternative: SendGrid/Mailgun
For higher volume, consider:
- SendGrid API integration
- Mailgun SMTP service
- Amazon SES

---

## 📱 WhatsApp Integration Setup

### WhatsApp Web.js Configuration
1. **First Time Setup**
```bash
# Start application
npm run dev:api

# Scan QR code when prompted
# WhatsApp will display QR code in terminal
# Scan with your phone's WhatsApp
```

2. **Production Considerations**
- Use dedicated WhatsApp Business account
- Keep session alive with proper server uptime
- Monitor for QR code re-authentication needs

---

## 🔧 Performance Optimization

### Database Optimization
```bash
# MongoDB indexes (run once)
db.trips.createIndex({ title: "text", description: "text", destination: "text" })
db.trips.createIndex({ location: "2dsphere" })
db.trips.createIndex({ startDate: 1, endDate: 1 })
db.users.createIndex({ email: 1 }, { unique: true })
db.supporttickets.createIndex({ status: 1, priority: 1, createdAt: -1 })
```

### Nginx Configuration
```nginx
# Performance optimizations
gzip on;
gzip_types text/css text/javascript application/javascript application/json;
client_max_body_size 10M;

# Cache static files
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, no-transform";
}
```

### Docker Production Optimizations
```yaml
# docker-compose.prod.yml
version: '3.9'
services:
  api:
    build: ./services/api
    restart: unless-stopped
    environment:
      - NODE_ENV=production
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
    
  web:
    build: ./web
    restart: unless-stopped
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
```

---

## 📊 Monitoring & Logging

### Application Monitoring
```bash
# Install monitoring tools
npm install -g pm2
pm2 install pm2-logrotate

# Set up log rotation
pm2 set pm2-logrotate:retain 30
pm2 set pm2-logrotate:compress true
```

### Health Checks
```bash
# API health check endpoint
curl https://your-domain.com/api/health

# Expected response:
{
  "status": "ok",
  "mongodb": { "status": "connected" },
  "uptime": 3600,
  "memory": {...}
}
```

### Error Tracking
Consider integrating:
- Sentry for error tracking
- DataDog for performance monitoring
- New Relic for application monitoring

---

## 🔒 Security Hardening

### Server Security
```bash
# Configure firewall
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Disable root login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no
sudo systemctl restart ssh

# Keep system updated
sudo apt update && sudo apt upgrade -y
```

### Application Security
```bash
# Environment variables security
chmod 600 .env*

# Database security
# Use strong passwords
# Enable authentication
# Restrict network access

# SSL/TLS configuration
# Use strong cipher suites
# Enable HSTS headers
# Regular certificate renewal
```

---

## 🚨 Troubleshooting

### Common Issues

**Database Connection Failed**
```bash
# Check MongoDB status
sudo systemctl status mongod

# Check connection string format
# mongodb://username:password@host:port/database
# mongodb+srv://username:password@cluster.mongodb.net/database

# Test connection
mongo "mongodb+srv://cluster.mongodb.net/test" --username username
```

**Email Service Not Working**
```bash
# Verify Gmail credentials
# Check 2FA is enabled
# Confirm app password is correct
# Test SMTP connection

# Check logs
docker-compose logs api | grep -i email
```

**WhatsApp Service Issues**
```bash
# Check QR code authentication
# Verify WhatsApp Web compatibility
# Restart service if needed

docker-compose restart api
docker-compose logs api | grep -i whatsapp
```

**Frontend Build Failures**
```bash
# Clear cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install

# Check environment variables
echo $REACT_APP_API_URL

# Build with verbose logging
npm run build -- --verbose
```

### Performance Issues
```bash
# Check resource usage
docker stats

# Monitor API performance
curl -w "@curl-format.txt" -o /dev/null -s https://your-api.com/health

# Database performance
db.trips.find().explain("executionStats")
```

---

## 🔄 Maintenance & Updates

### Regular Maintenance Tasks
```bash
# Update dependencies monthly
npm audit
npm update

# Clean old Docker images
docker system prune -a

# Rotate logs
logrotate /etc/logrotate.d/trek-tribe

# Database maintenance
# Run cleanup operations via API
curl -X POST https://your-api.com/admin/cleanup \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Backup Strategy
```bash
# Database backup (Atlas)
# Use Atlas continuous backup feature

# Application backup
tar -czf trek-tribe-backup-$(date +%Y%m%d).tar.gz \
  --exclude=node_modules \
  --exclude=.git \
  /opt/trek-tribe/

# Upload to cloud storage
aws s3 cp trek-tribe-backup-*.tar.gz s3://your-backup-bucket/
```

---

## 📈 Scaling Considerations

### Horizontal Scaling
- Load balancer configuration (Nginx/HAProxy)
- Multiple API instances
- Database replica sets
- Redis for session storage

### Performance Monitoring
- Set up alerts for high memory/CPU usage
- Monitor API response times
- Track database query performance
- User experience monitoring

### Cost Optimization
- Use CDN for static assets
- Implement database query optimization
- Consider serverless functions for low-traffic endpoints
- Regular resource usage analysis

---

## ✅ Post-Deployment Checklist

- [ ] All services are running and accessible
- [ ] Database is connected and populated
- [ ] Email service is sending notifications
- [ ] WhatsApp integration is active (if enabled)
- [ ] SSL certificate is installed and valid
- [ ] All environment variables are configured
- [ ] Admin account is created and accessible
- [ ] Backup strategy is implemented
- [ ] Monitoring and logging are active
- [ ] Performance testing completed
- [ ] Security scan performed
- [ ] Documentation updated with production URLs

---

## 🆘 Emergency Procedures

### Service Recovery
```bash
# Quick restart all services
docker-compose restart

# Check service health
docker-compose ps
curl https://your-domain.com/api/health

# View recent logs
docker-compose logs --tail=100 -f
```

### Database Recovery
```bash
# Restore from backup (Atlas)
# Use Atlas point-in-time recovery

# Manual restore
mongorestore --uri="mongodb+srv://..." --db=trekktribe /path/to/backup/
```

### Emergency Contacts
- Database provider support
- Hosting platform support
- Domain registrar support
- SSL certificate provider support

---

This comprehensive deployment guide covers all major deployment scenarios and provides troubleshooting steps for common issues. Follow the specific section that matches your deployment target, and ensure all security and performance optimizations are implemented for production use.