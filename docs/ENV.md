# Environment Variables Documentation

This document explains all environment variables used in the Trek Tribe application.

## Setup Instructions

1. **Root Directory**: Copy `.env.example` to `.env` in the root directory
2. **API Directory**: Copy `services/api/.env.example` to `services/api/.env` (if it exists)
3. **Web Directory**: Copy `web/.env.example` to `web/.env`

```bash
# In the trek-tribe root directory
cp .env.example .env
cp web/.env.example web/.env
```

## Root Environment Variables

### Core Application Settings

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `NODE_ENV` | string | No | `development` | Application environment (development, production, test) |
| `API_PORT` | number | No | `4000` | Port for the API server |
| `PORT` | number | No | `4000` | Alternative port specification (used by some hosting services) |
| `WEB_PORT` | number | No | `3000` | Port for the web development server |

### Database Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `MONGODB_URI` | string | Yes | - | MongoDB connection string for Docker setup |
| `MONGODB_URI_LOCAL` | string | No | - | MongoDB connection string for local development |

**Example MongoDB URIs:**
- Local: `mongodb://127.0.0.1:27017/trekktribe`
- Docker: `mongodb://mongo:27017/trekktribe`
- Atlas: `mongodb+srv://username:password@cluster.mongodb.net/trekktribe`

### Authentication & Security

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `JWT_SECRET` | string | Yes | - | Secret key for JWT token signing. **Must be at least 32 characters** |
| `JWT_EXPIRES_IN` | string | No | `7d` | JWT token expiration time (e.g., '1h', '7d', '30d') |
| `RESET_TOKEN_EXPIRES` | number | No | `3600000` | Password reset token expiration in milliseconds (1 hour) |

**Generating JWT Secret:**
```bash
# Using OpenSSL
openssl rand -hex 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Online generator
# https://generate-secret.vercel.app/32
```

### Google OAuth Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `GOOGLE_CLIENT_ID` | string | No | - | Google OAuth 2.0 Client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | string | No | - | Google OAuth 2.0 Client Secret from Google Cloud Console |

**Setting up Google OAuth:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 Client ID credentials
5. Add authorized origins:
   - Development: `http://localhost:3000`
   - Production: `https://yourdomain.com`

### CORS & Security Settings

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `ALLOWED_ORIGINS` | string | No | `http://localhost:3000,...` | Comma-separated list of allowed CORS origins |
| `FRONTEND_URL` | string | No | `http://localhost:3000` | Frontend URL for CORS and email links |
| `CORS_ORIGIN` | string | No | - | Single CORS origin for production |

### Email Service Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `GMAIL_USER` | string | No | - | Gmail email address for SMTP |
| `GMAIL_APP_PASSWORD` | string | No | - | Gmail App Password (16 characters) |
| `EMAIL_ENABLED` | boolean | No | `true` | Enable/disable email service |

**Setting up Gmail SMTP:**
1. Enable 2-factor authentication on Gmail
2. Generate App Password: [Account Settings > Security > App passwords](https://support.google.com/accounts/answer/185833)
3. Use Gmail address as `GMAIL_USER`
4. Use 16-character App Password as `GMAIL_APP_PASSWORD`

### WhatsApp Integration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `WHATSAPP_ENABLED` | boolean | No | `true` | Enable/disable WhatsApp integration |
| `DEFAULT_COUNTRY_CODE` | string | No | `91` | Default country code for phone formatting (without +) |
| `WHATSAPP_SESSION_NAME` | string | No | `trek-tribe-bot` | WhatsApp session identifier |

### File Upload & Storage

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `MAX_FILE_SIZE` | number | No | `10485760` | Maximum file size in bytes (10MB) |
| `UPLOAD_DIR` | string | No | `uploads` | Directory for file uploads (relative to API root) |
| `ALLOWED_FILE_TYPES` | string | No | `image/jpeg,image/png,...` | Comma-separated list of allowed MIME types |

### Logging Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `LOG_LEVEL` | number | No | `2` | Log level: 0=ERROR, 1=WARN, 2=INFO, 3=DEBUG |
| `LOG_DIR` | string | No | `logs` | Directory for log files |
| `LOG_RETENTION_DAYS` | number | No | `30` | Number of days to keep log files |

### Rate Limiting & Performance

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `RATE_LIMIT_MAX` | number | No | `100` | Maximum requests per IP per window |
| `RATE_LIMIT_WINDOW_MS` | number | No | `60000` | Rate limiting window in milliseconds (1 minute) |
| `REQUEST_TIMEOUT` | number | No | `30000` | Request timeout in milliseconds |

### Development & Debugging

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `DEBUG_MODE` | boolean | No | `true` | Enable detailed error messages in development |
| `GENERATE_SOURCEMAP` | boolean | No | `true` | Generate source maps for debugging |
| `MOCK_EXTERNAL_SERVICES` | boolean | No | `false` | Mock external services for testing |

## Web Environment Variables (React)

### API Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `REACT_APP_API_URL` | string | Yes | - | Backend API URL (with protocol) |
| `REACT_APP_SOCKET_URL` | string | No | Same as API_URL | Socket.IO server URL |

### Google OAuth (Frontend)

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `REACT_APP_GOOGLE_CLIENT_ID` | string | No | - | Google OAuth 2.0 Client ID (same as backend) |

### App Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `REACT_APP_APP_NAME` | string | No | `Trek Tribe` | Application name displayed in UI |
| `REACT_APP_VERSION` | string | No | `1.0.0` | Application version |

### Build Configuration

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `GENERATE_SOURCEMAP` | boolean | No | `false` | Generate source maps for production |
| `TSC_COMPILE_ON_ERROR` | boolean | No | `true` | Continue build on TypeScript errors |
| `ESLINT_NO_DEV_ERRORS` | boolean | No | `true` | Don't treat ESLint warnings as errors |

### Feature Flags

| Variable | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `REACT_APP_ENABLE_REAL_TIME_CHAT` | boolean | No | `true` | Enable real-time chat features |
| `REACT_APP_ENABLE_AI_SUPPORT` | boolean | No | `true` | Enable AI assistant features |
| `REACT_APP_ENABLE_QR_PAYMENTS` | boolean | No | `true` | Enable QR code payment features |

## Deployment-Specific Settings

### Vercel Deployment

```bash
# In Vercel dashboard or vercel.json
REACT_APP_API_URL=https://your-api-domain.vercel.app
GENERATE_SOURCEMAP=false
```

### Render Deployment

```bash
# Backend (Render.com)
PORT=10000  # Automatically set by Render
MONGODB_URI=mongodb+srv://...  # Use MongoDB Atlas
FRONTEND_URL=https://your-frontend.onrender.com

# Frontend
REACT_APP_API_URL=https://your-backend.onrender.com
```

### Railway Deployment

```bash
# Railway automatically provides PORT
FRONTEND_URL=https://your-app.railway.app
CORS_ORIGIN=https://your-app.railway.app
```

## Security Best Practices

1. **Never commit `.env` files** to version control
2. **Use strong, unique JWT secrets** (minimum 32 characters)
3. **Rotate secrets regularly** in production
4. **Use environment-specific configurations**
5. **Validate all environment variables** on application startup
6. **Use HTTPS** in production for all URLs
7. **Restrict CORS origins** to known domains
8. **Enable rate limiting** in production

## Validation

The application validates environment variables on startup. Check the console output for any missing or invalid variables.

```javascript
// Example validation in code
const { MONGODB_URI, JWT_SECRET, GOOGLE_CLIENT_ID } = process.env;

if (!MONGODB_URI) {
  throw new Error('MONGODB_URI environment variable is required');
}

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters long');
}
```

## Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Check `MONGODB_URI` format
   - Verify network connectivity
   - Check MongoDB service status

2. **JWT Token Issues**
   - Ensure `JWT_SECRET` is set and consistent across services
   - Check token expiration settings

3. **CORS Errors**
   - Verify `FRONTEND_URL` and `CORS_ORIGIN` settings
   - Check `ALLOWED_ORIGINS` includes your domain

4. **Google OAuth Not Working**
   - Verify `GOOGLE_CLIENT_ID` is set in both backend and frontend
   - Check Google Cloud Console settings
   - Ensure authorized origins are configured

5. **Email Service Issues**
   - Check Gmail SMTP credentials
   - Verify App Password (not regular password)
   - Ensure 2FA is enabled on Gmail account

### Environment Variable Priority

1. Process environment variables
2. `.env` file in service directory
3. `.env` file in root directory
4. Default values in code

### Docker Considerations

When using Docker, environment variables can be set in:
- `docker-compose.yml`
- Dockerfile `ENV` commands
- Runtime with `-e` flag
- External `.env` files with `env_file`

```yaml
# docker-compose.yml example
environment:
  - NODE_ENV=production
  - MONGODB_URI=mongodb://mongo:27017/trekktribe
env_file:
  - .env
```