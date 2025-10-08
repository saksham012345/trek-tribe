# Environment Variables Configuration

This document outlines all the environment variables required for the TrekTribe application to function properly in production.

## Backend API Environment Variables (.env)

### Core Configuration
```bash
# Node.js Environment
NODE_ENV=production

# Server Configuration
PORT=4000

# Frontend URL (for CORS and redirects)
FRONTEND_URL=https://your-frontend-domain.com
CORS_ORIGIN=https://your-frontend-domain.com
```

### Database Configuration
```bash
# MongoDB Connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/trekktribe?retryWrites=true&w=majority
```

### Authentication & Security
```bash
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d

# Password Reset
RESET_PASSWORD_SECRET=your-reset-password-secret-key
```

### File Upload & Storage
```bash
# Cloudinary (recommended for image storage)
CLOUDINARY_CLOUD_NAME=your-cloudinary-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret

# Alternative: AWS S3
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=trekktribe-uploads
```

### Email Services
```bash
# SendGrid (recommended)
SENDGRID_API_KEY=your-sendgrid-api-key
FROM_EMAIL=noreply@yourdomain.com
ADMIN_EMAIL=admin@yourdomain.com

# Alternative: Gmail SMTP
GMAIL_USER=your-email@gmail.com
GMAIL_PASS=your-app-password
```

### WhatsApp Integration
```bash
# WhatsApp Business API
WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
WHATSAPP_ACCESS_TOKEN=your-whatsapp-access-token
WHATSAPP_VERIFY_TOKEN=your-webhook-verify-token
WHATSAPP_BUSINESS_ACCOUNT_ID=your-business-account-id

# Alternative: Twilio WhatsApp
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
```

### Payment Gateways
```bash
# Stripe (recommended)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# PayPal
PAYPAL_CLIENT_ID=your-paypal-client-id
PAYPAL_CLIENT_SECRET=your-paypal-client-secret
PAYPAL_MODE=live  # or 'sandbox' for testing

# Razorpay (for India)
RAZORPAY_KEY_ID=your-razorpay-key-id
RAZORPAY_KEY_SECRET=your-razorpay-key-secret
```

### SMS Services
```bash
# Twilio SMS
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890
```

### Google Services
```bash
# Google Maps API
GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Google Cloud Storage (alternative)
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_CLOUD_KEY_FILE=path/to/service-account-key.json
```

### Social Authentication (Optional)
```bash
# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Facebook OAuth
FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret
```

## Frontend Environment Variables (.env)

```bash
# API Configuration
REACT_APP_API_URL=https://your-api-domain.com

# Google Maps
REACT_APP_GOOGLE_MAPS_API_KEY=your-google-maps-api-key

# Stripe
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_...

# PayPal
REACT_APP_PAYPAL_CLIENT_ID=your-paypal-client-id

# Analytics (Optional)
REACT_APP_GOOGLE_ANALYTICS_ID=GA_TRACKING_ID
REACT_APP_FACEBOOK_PIXEL_ID=your-facebook-pixel-id
```

## Service-Specific Setup Instructions

### 1. MongoDB Atlas
1. Create a MongoDB Atlas cluster
2. Create a database user
3. Whitelist IP addresses (0.0.0.0/0 for production or specific IPs)
4. Get connection string and replace `<password>` with your actual password

### 2. Cloudinary Setup
1. Sign up at cloudinary.com
2. Get your cloud name, API key, and API secret from the dashboard
3. Configure upload presets for different image types

### 3. SendGrid Setup
1. Sign up at sendgrid.com
2. Create an API key with full access
3. Verify your domain for better email deliverability
4. Set up email templates if needed

### 4. WhatsApp Business API Setup
1. Apply for WhatsApp Business API access via Meta
2. Set up a webhook URL for receiving messages
3. Verify your business phone number
4. Get necessary tokens from the Meta Developer Console

### 5. Stripe Setup
1. Create a Stripe account
2. Get API keys from the Stripe Dashboard
3. Set up webhook endpoints for payment events
4. Configure payment methods for your region

### 6. Google Maps API
1. Enable Maps JavaScript API and Places API in Google Cloud Console
2. Create an API key and restrict it to your domain
3. Enable billing on your Google Cloud project

## Deployment Platform Configuration

### Render (Backend)
- Add all backend environment variables in the Render dashboard
- Set build command: `npm run build`
- Set start command: `npm start`

### Vercel (Frontend)
- Add all frontend environment variables in the Vercel dashboard
- Build command: `npm run build`
- Output directory: `build`

### Railway (Alternative)
- Add environment variables in the Railway dashboard
- Railway will auto-detect the build and start commands

## Security Considerations

1. **Never commit environment variables** to version control
2. **Use strong, unique secrets** for JWT and other security tokens
3. **Rotate API keys regularly**, especially after team member changes
4. **Use different API keys** for development and production
5. **Enable CORS restrictions** to only allow your frontend domains
6. **Set up monitoring** for API usage and potential security breaches

## Testing Environment Variables

For development and testing, create a `.env.development` file with:
- Local MongoDB instance or a development cluster
- Test API keys from services (like Stripe test keys)
- Local or development URLs
- Debug mode enabled for better error messages

## Required for Basic Functionality

**Minimum required variables for the app to start:**
```bash
NODE_ENV=production
PORT=4000
MONGODB_URI=your-mongodb-connection-string
JWT_SECRET=your-jwt-secret
FRONTEND_URL=your-frontend-url
```

**Additional variables needed for full functionality:**
- Email service (SendGrid or SMTP)
- File upload service (Cloudinary or AWS S3)
- Payment gateway (Stripe recommended)
- WhatsApp service for notifications

## Environment Variable Validation

The application includes validation for critical environment variables. If required variables are missing, the application will fail to start with clear error messages indicating which variables need to be configured.