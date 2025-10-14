# Render Environment Variables Setup Guide

## Required Environment Variables for Trek Tribe Backend

To fix the image loading issue and enable email notifications, you need to set these environment variables in your Render dashboard:

### 1. Basic Application Configuration
```
NODE_ENV=production
PORT=10000
API_URL=https://trek-tribe-38in.onrender.com
```

### 2. Database Configuration
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/trekktribe
```

### 3. Authentication & Security
```
JWT_SECRET=your_super_secure_jwt_secret_min_32_characters_long
SESSION_SECRET=your_session_secret_here
```

### 4. Email Service Configuration (Gmail SMTP)
```
GMAIL_USER=your_email@gmail.com
GMAIL_APP_PASSWORD=your_16_character_app_password
```

**Important:** For Gmail App Password:
1. Enable 2-factor authentication on your Gmail account
2. Go to Google Account settings → Security → App passwords
3. Generate a new app password for "Mail"
4. Use the 16-character password (not your regular Gmail password)

### 5. Frontend Configuration
```
FRONTEND_URL=https://www.trektribe.in
CORS_ORIGIN=https://www.trektribe.in
SOCKET_ORIGIN=https://www.trektribe.in
```

### 6. File Upload Configuration
```
MAX_FILE_SIZE=10485760
```

## How to Set Environment Variables in Render

1. **Go to your Render dashboard**
2. **Navigate to your backend service**
3. **Click on "Environment" tab**
4. **Add each environment variable:**
   - Click "Add Environment Variable"
   - Enter the variable name (e.g., `NODE_ENV`)
   - Enter the value (e.g., `production`)
   - Click "Save Changes"
5. **Repeat for all variables above**
6. **Redeploy your service** after adding all variables

## Verification Steps

After setting up the environment variables:

1. **Check image URLs**: Images should now load from `https://trek-tribe-38in.onrender.com/files/...`
2. **Test email notifications**: Create a booking and verify emails are sent
3. **Check logs**: Look for "Email service initialized successfully" in your Render logs

## Common Issues and Solutions

### Issue: Images still not loading
**Solution:** Ensure `API_URL=https://trek-tribe-38in.onrender.com` is set correctly

### Issue: Email service not working
**Solution:** 
- Verify `GMAIL_USER` and `GMAIL_APP_PASSWORD` are correct
- Check that 2FA is enabled and app password is generated
- Look for "Email service initialized successfully" in logs

### Issue: CORS errors
**Solution:** Ensure `CORS_ORIGIN` matches your frontend domain exactly

## Testing Email Service

You can test the email service by:
1. Making a booking
2. Uploading a payment screenshot
3. Checking if confirmation emails are sent

The email service will automatically send:
- Booking confirmation emails to travelers
- Payment screenshot notifications to organizers
- Payment verification emails to travelers

## Security Notes

- Never commit `.env` files to version control
- Use strong, unique passwords for all secrets
- Regularly rotate JWT secrets and app passwords
- Monitor your Render logs for any authentication errors
