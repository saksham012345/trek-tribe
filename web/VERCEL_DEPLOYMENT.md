# Trek Tribe Frontend - Vercel Deployment Guide

## 🚀 Quick Deploy to Vercel

### Prerequisites
- GitHub repository with your Trek Tribe code
- Vercel account (free tier available)
- Backend API deployed (e.g., on Render)

### Step 1: Connect to Vercel
1. Go to [vercel.com](https://vercel.com)
2. Sign up/Sign in with GitHub
3. Click "New Project"
4. Import your `trek-tribe` repository
5. Select the `web` directory as the root

### Step 2: Configure Build Settings
Vercel will auto-detect the React app, but ensure these settings:
- **Framework Preset**: Create React App
- **Root Directory**: `web` (if your frontend is in web folder)
- **Build Command**: `npm run build`
- **Output Directory**: `build`

### Step 3: Set Environment Variables
In Vercel dashboard, add these environment variables:

#### Required Variables:
```
REACT_APP_API_URL=https://your-backend-api-url.onrender.com
```

#### Optional Variables for Production:
```
GENERATE_SOURCEMAP=false
TSC_COMPILE_ON_ERROR=true
ESLINT_NO_DEV_ERRORS=true
```

#### Additional App Configuration:
```
REACT_APP_APP_NAME=Trek Tribe
REACT_APP_VERSION=1.0.0
```

### Step 4: Deploy
1. Click "Deploy"
2. Wait for build to complete (usually 1-3 minutes)
3. Your app will be available at `https://your-app-name.vercel.app`

## 📋 Environment Variables Details

### REACT_APP_API_URL
**Required**: This is the most critical variable. Set it to your backend API URL.

Examples:
- Render: `https://trek-tribe-api.onrender.com`
- Railway: `https://trek-tribe-api.railway.app`
- Heroku: `https://trek-tribe-api.herokuapp.com`
- Custom domain: `https://api.trekkingapp.com`

### Build Optimization Variables
These help with faster builds and fewer warnings:
- `GENERATE_SOURCEMAP=false` - Reduces build size
- `TSC_COMPILE_ON_ERROR=true` - Allows build with TypeScript warnings
- `ESLINT_NO_DEV_ERRORS=true` - Treats ESLint issues as warnings, not errors

## 🔧 Vercel Configuration

The project includes a `vercel.json` file with:
- SPA routing support (all routes redirect to index.html)
- Static asset caching
- Security headers
- Performance optimizations

## 🌐 Custom Domain (Optional)
1. In Vercel dashboard, go to your project
2. Click "Domains" tab
3. Add your custom domain
4. Follow DNS configuration instructions

## 🔄 Automatic Deployments
Once connected, Vercel will automatically deploy when you push to:
- `main` branch (production)
- Other branches (preview deployments)

## 🐛 Troubleshooting

### Build Fails with TypeScript Errors
- Set `TSC_COMPILE_ON_ERROR=true` in environment variables
- Check build logs for specific errors

### App Loads but API Calls Fail
- Verify `REACT_APP_API_URL` is correctly set
- Check browser console for CORS errors
- Ensure backend API is deployed and accessible

### 404 Errors on Page Refresh
- Verify `vercel.json` includes the rewrite rules
- This is already configured in your project

### Environment Variables Not Working
- Ensure they start with `REACT_APP_`
- Restart deployment after adding variables
- Check browser console for undefined variables

## 📊 Performance Tips
1. Enable Vercel Analytics in dashboard
2. Use Vercel's Edge Network for global distribution
3. Monitor Core Web Vitals
4. Enable Speed Insights

## 🔐 Security Notes
- Never commit real environment variables
- Use Vercel's secure environment variable storage
- The app includes security headers in `vercel.json`

## 📱 Preview Deployments
Every pull request gets a unique preview URL for testing before merging.

---

## 🎯 Final Deployment Checklist
- [ ] Backend API deployed and accessible
- [ ] `REACT_APP_API_URL` set correctly
- [ ] Build completes without errors
- [ ] App loads in browser
- [ ] API calls work correctly
- [ ] Authentication flows work
- [ ] All major features functional

Your Trek Tribe app should now be live! 🌲🏔️