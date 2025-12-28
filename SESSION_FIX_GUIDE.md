# Session Retention Fix Guide

## Problem Summary
- Session not retaining after login
- Redirects to login page on any action after logging in
- Need login page as default landing page

## Root Causes Identified

1. **API Interceptor Too Aggressive**: The axios interceptor was redirecting to `/login` on any 401 error, even for expected cases
2. **Route Guards**: Routes weren't properly protected - some allowed access without authentication
3. **Cookie Configuration**: Cookies might not be properly sent/received in cross-origin scenarios

## Fixes Applied

### 1. Fixed API Interceptor (`web/src/config/api.ts`)
- **Before**: Automatically redirected to `/login` on any 401 error
- **After**: Removed automatic redirects - let route guards handle authentication checks
- **Why**: Prevents redirect loops and allows proper auth state management

### 2. Updated Route Guards (`web/src/App.tsx`)
- **Before**: Home route (`/`) and `/home` allowed access without authentication
- **After**: 
  - Default route (`/`) redirects to `/login` if not authenticated, `/home` if authenticated
  - `/home` requires authentication
  - All protected routes explicitly check `user` before rendering

### 3. Enhanced AuthContext (`web/src/contexts/AuthContext.tsx`)
- Improved session verification logic
- Better handling of 401 errors (don't immediately clear user on network issues)
- Added logging for debugging session issues

### 4. Ensured Cookie Configuration
- Backend: Cookie parser, CORS with credentials, secure cookie settings
- Frontend: Axios configured with `withCredentials: true`

## Testing the Fix

### Step 1: Verify Cookie Configuration

**Backend Environment Variables (Render/Vercel):**
```env
NODE_ENV=production
COOKIE_DOMAIN=  # Leave empty or undefined for same-origin
FRONTEND_URL=https://trek-tribe-web.onrender.com
CORS_ORIGIN=https://trek-tribe-web.onrender.com
```

**Frontend Environment Variables:**
```env
REACT_APP_API_URL=https://trek-tribe-api.onrender.com
```

### Step 2: Test Session Flow

1. **Clear Browser Cookies and LocalStorage**
   - Open DevTools → Application → Clear Storage
   - Clear Cookies for your domain
   - Clear LocalStorage

2. **Login Test**
   - Navigate to `/login`
   - Login with valid credentials
   - Should redirect to `/home` (not `/`)
   - Check DevTools → Application → Cookies
   - Should see `token` cookie set with `HttpOnly`, `Secure`, `SameSite=None`

3. **Session Persistence Test**
   - After login, refresh the page (F5)
   - Should stay on `/home` (not redirect to `/login`)
   - Check console - should see "Session verified successfully"

4. **Navigation Test**
   - Click on any protected route (e.g., `/trips`, `/profile`)
   - Should navigate without redirecting to login
   - All protected routes should work

5. **Logout Test**
   - Click logout
   - Should redirect to `/login`
   - Cookie should be cleared
   - LocalStorage should be cleared

### Step 3: Debugging Checklist

If session still doesn't work:

1. **Check Browser Console**
   - Look for errors about cookies/CORS
   - Check if `/auth/me` returns 401 or 200

2. **Check Network Tab**
   - Login request should return Set-Cookie header
   - Subsequent requests should include Cookie header
   - Check if requests to `/auth/me` include cookies

3. **Check Backend Logs**
   - Verify CORS headers are set correctly
   - Verify cookie is being set with correct attributes
   - Check if `authenticateJwt` middleware is working

4. **Cookie Attributes to Verify**
   ```
   Set-Cookie: token=<jwt>; Path=/; Secure; HttpOnly; SameSite=None; Max-Age=604800
   ```

5. **CORS Headers to Verify**
   ```
   Access-Control-Allow-Origin: https://trek-tribe-web.onrender.com
   Access-Control-Allow-Credentials: true
   Access-Control-Allow-Methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
   ```

## Common Issues and Solutions

### Issue 1: Cookies Not Being Sent
**Symptoms**: Every request returns 401
**Solutions**:
- Verify `withCredentials: true` in axios config
- Verify CORS `credentials: true` on backend
- Check if SameSite=None requires Secure=true (it does in production)

### Issue 2: Redirect Loop
**Symptoms**: Page keeps redirecting between `/login` and `/home`
**Solutions**:
- Check if API interceptor is redirecting (shouldn't anymore)
- Verify route guards are working correctly
- Check if `/auth/me` is returning inconsistent responses

### Issue 3: Session Expires Too Quickly
**Symptoms**: User logged out after short time
**Solutions**:
- Verify JWT expiresIn is set to '7d' in auth routes
- Verify cookie maxAge matches JWT expiration
- Check if cookie is being cleared unexpectedly

### Issue 4: Works Locally But Not in Production
**Symptoms**: Session works on localhost but not on Render/Vercel
**Solutions**:
- Verify HTTPS is enabled (required for Secure cookies)
- Check CORS origins include production URLs
- Verify environment variables are set correctly
- Check if proxy is interfering with cookies

## Deployment Checklist

Before deploying, ensure:

- [ ] Backend environment variables set:
  - `NODE_ENV=production`
  - `FRONTEND_URL` (your frontend URL)
  - `CORS_ORIGIN` (same as FRONTEND_URL)
  - `COOKIE_DOMAIN` (leave empty for same-origin)

- [ ] Frontend environment variables set:
  - `REACT_APP_API_URL` (your backend URL)

- [ ] Backend has HTTPS enabled (required for Secure cookies)

- [ ] CORS is configured correctly with credentials support

- [ ] Cookie parser middleware is enabled

- [ ] Test login/logout flow in production

## Monitoring

After deployment, monitor:
- 401 error rates (should be low after successful login)
- Session restoration success rate (check `/auth/me` calls)
- Cookie set/clear operations in logs

## Additional Notes

- Cookies are httpOnly (can't be accessed via JavaScript) - this is for security
- Session state is stored in both cookie (for auth) and localStorage (for UI)
- If localStorage has user but cookie is missing, user will be prompted to login
- The `/auth/me` endpoint is called on every page load to verify session

## Support

If issues persist:
1. Check browser console for errors
2. Check backend logs for authentication errors
3. Verify all environment variables are set
4. Test cookie functionality in browser DevTools
5. Check CORS configuration matches your deployment URLs

