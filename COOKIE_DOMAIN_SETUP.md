# Cookie Domain Configuration Guide

## ⚠️ IMPORTANT: Cookie Domain Setting

### For Render.com Deployment:

**Leave `COOKIE_DOMAIN` empty or undefined** - Do NOT set a random value.

### Why?

Cookies work differently across subdomains:

1. **Same Domain (Recommended)**: 
   - Frontend: `trek-tribe-web.onrender.com`
   - Backend: `trek-tribe-api.onrender.com`
   - **These are DIFFERENT domains**, so cookies CANNOT be shared between them
   - **Solution**: Use `sameSite: 'none'` with `secure: true` (already configured)

2. **If you set `COOKIE_DOMAIN`**:
   - Setting `COOKIE_DOMAIN=.onrender.com` won't work because Render uses different root domains
   - Setting a random value breaks cookie functionality completely
   - **Best practice**: Leave it undefined/empty

### Current Configuration

The code now properly handles cookie domain:
- If `COOKIE_DOMAIN` is set and not empty → use it
- If `COOKIE_DOMAIN` is empty/undefined → use undefined (current domain only)

### For Cross-Origin Cookies (Current Setup)

The current setup uses:
- `sameSite: 'none'` in production (allows cross-origin)
- `secure: true` in production (required for sameSite: 'none')
- `domain: undefined` (works with current domain)

This configuration allows cookies to work when:
- Frontend and backend are on different domains
- Both are using HTTPS
- CORS is properly configured

### Action Required

**In Render environment variables:**
1. Remove `COOKIE_DOMAIN` if you set a random value
2. OR set it to empty string `""`
3. OR leave it unset (undefined)

The code will automatically use the correct setting.

