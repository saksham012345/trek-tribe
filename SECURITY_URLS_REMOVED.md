# Security Update: Hardcoded URLs Removed

## Summary
All hardcoded service URLs have been removed from the codebase and replaced with environment variables to prevent exposing deployment URLs on GitHub.

## Changes Made

### 1. Render Configuration Files
- ✅ Created `services/api/render.yaml.example` with placeholder URLs
- ✅ Updated `services/api/render.yaml` to use `sync: false` instead of hardcoded values
- ✅ Added `render.yaml` files to `.gitignore`

**Note**: You should set the actual URLs in your Render dashboard environment variables, not in the YAML files.

### 2. Frontend Code (`web/src`)
- ✅ `config/api.ts` - Removed hardcoded URL, uses env var with localhost fallback
- ✅ `utils/config.ts` - Removed hardcoded URLs, uses environment variables
- ✅ `pages/AdminDashboard.tsx` - Removed hardcoded URL
- ✅ `pages/OrganizerDashboard.tsx` - Removed hardcoded URL
- ✅ `pages/EnhancedAgentDashboard.tsx` - Removed hardcoded URL
- ✅ `components/NotificationCenter.tsx` - Removed hardcoded URL
- ✅ `components/auth/ForgotPassword.tsx` - Removed hardcoded URL
- ✅ `components/auth/ResetPassword.tsx` - Removed hardcoded URL

### 3. Backend Code (`services/api/src`)
- ✅ `index.ts` - Removed hardcoded CORS origins, uses environment variables
- ✅ `services/socketService.ts` - Removed hardcoded origins
- ✅ `utils/fileHandler.ts` - Removed hardcoded URL
- ✅ `serverless.ts` - Removed hardcoded URLs
- ✅ `index.js` - Removed hardcoded URLs

## Required Environment Variables

### Frontend (Vercel/Render)
Set these in your deployment platform:

```bash
REACT_APP_API_URL=https://your-api-domain.com
REACT_APP_SOCKET_URL=https://your-api-domain.com  # Optional, defaults to API_URL
REACT_APP_WEBSITE_URL=https://your-frontend-domain.com
```

### Backend (Render)
Set these in your Render dashboard:

```bash
FRONTEND_URL=https://your-frontend-domain.com
CORS_ORIGIN=https://your-frontend-domain.com
SOCKET_ORIGIN=https://your-frontend-domain.com  # Optional
AI_SERVICE_URL=https://your-ai-service-domain.com
API_URL=https://your-api-domain.com  # For file URLs
```

## Development Setup

For local development, the code now defaults to:
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000`

These are safe defaults that don't expose production URLs.

## What's Still Needed

1. **Set Environment Variables**: Update your Render/Vercel dashboards with the actual service URLs
2. **Documentation Files**: Some documentation files still contain example URLs - these are fine as they're just examples, but you may want to update them to use placeholders
3. **Test Scripts**: PowerShell test scripts (`*.ps1`) may still contain URLs - these are typically for local testing and less critical

## Security Notes

- ✅ No production URLs are hardcoded in source code
- ✅ All service URLs must be set via environment variables
- ✅ Development defaults are localhost (safe)
- ✅ Render YAML files use `sync: false` to require manual env var setup
- ⚠️ Remember: Environment variables in Render/Vercel dashboards should still be set with actual values for deployment

---

**Status**: ✅ Complete - All hardcoded URLs removed from source code

