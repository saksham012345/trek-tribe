# CORS Configuration Fix

## Issue
When using `credentials: true` (required for httpOnly cookies), the `Access-Control-Allow-Origin` header cannot be set to wildcard `*`. It must specify exact origins.

**Error:**
```
Access to XMLHttpRequest at 'https://trekktribe.onrender.com/auth/me' from origin 'https://trektribe.in' 
has been blocked by CORS policy: The value of the 'Access-Control-Allow-Origin' header in the response 
must not be the wildcard '*' when the request's credentials mode is 'include'.
```

## Fix Applied

Updated CORS configuration in all backend entry points to:
1. Use an origin validation function instead of wildcard or array
2. Explicitly include `trektribe.in` and `www.trektribe.in` in allowed origins
3. Properly handle development vs production environments

### Files Updated:
- ✅ `services/api/src/index.ts` - Main Express app
- ✅ `services/api/src/index.js` - Legacy Express app
- ✅ `services/api/src/serverless.ts` - Serverless function

### Changes:
1. **Origin validation function**: Instead of using `*` or a static array, now uses a function that validates each request origin
2. **Explicit domain support**: Includes `https://trektribe.in` and `https://www.trektribe.in` explicitly
3. **Environment variable support**: Still reads from `FRONTEND_URL`, `CORS_ORIGIN`, `WEB_URL`
4. **Development mode**: More permissive in development (allows localhost)

## Required Environment Variables

Ensure these are set in your Render dashboard:

```bash
FRONTEND_URL=https://trektribe.in
CORS_ORIGIN=https://trektribe.in
```

Or if you want to support multiple domains:
```bash
FRONTEND_URL=https://trektribe.in,https://www.trektribe.in
CORS_ORIGIN=https://trektribe.in,https://www.trektribe.in
```

## Testing

After deploying:
1. Clear browser cache and cookies
2. Try logging in from https://trektribe.in
3. Verify no CORS errors in browser console
4. Verify authentication cookies are set properly

## Security Note

The CORS configuration now:
- ✅ Explicitly allows only whitelisted origins
- ✅ Supports credentials (cookies)
- ✅ Blocks unauthorized origins
- ✅ Logs blocked origins for debugging

---

**Status**: ✅ Fixed - CORS configuration updated to support credentials properly

