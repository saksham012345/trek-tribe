# Trek Tribe - Quick Render Deployment

## 🚀 Fast Deploy (10 minutes)

### 1. Prerequisites (2 minutes)
- ✅ Code pushed to GitHub
- ✅ MongoDB Atlas database ready
- ✅ Render account created

### 2. Deploy API (3 minutes)
1. Go to [render.com/new](https://render.com/new)
2. Choose "Web Service"
3. Connect your GitHub repo
4. **Root Directory**: `services/api`
5. **Build Command**: `npm install && npm run build`
6. **Start Command**: `npm start`
7. Add Environment Variables:
   ```
   NODE_ENV=production
   MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/trekktribe
   JWT_SECRET=your_secure_secret_here
   FRONTEND_URL=https://trek-tribe-web.onrender.com
   CORS_ORIGIN=https://trek-tribe-web.onrender.com
   ```
8. Deploy!

### 3. Deploy Web (3 minutes)
1. Go to [render.com/new](https://render.com/new)
2. Choose "Static Site"
3. Connect your GitHub repo again
4. **Root Directory**: `web`
5. **Build Command**: `npm install && npm run build`
6. **Publish Directory**: `build`
7. Add Environment Variables:
   ```
   REACT_APP_API_URL=https://trek-tribe-api.onrender.com
   REACT_APP_APP_NAME=Trek Tribe
   REACT_APP_VERSION=1.0.0
   ```
8. Deploy!

### 4. Update URLs (2 minutes)
After both deploy:
- Update API `FRONTEND_URL` with actual web URL
- Update Web `REACT_APP_API_URL` with actual API URL
- Redeploy both services

## ✅ Verify Deployment
- API Health: `https://your-api.onrender.com/health`
- Web App: `https://your-web.onrender.com`

## 🔧 Alternative: One-Click Deploy

Use the root `render.yaml` file:
1. Import your GitHub repo to Render
2. Select the root directory
3. Render auto-detects and deploys both services!

## 💡 Pro Tips
- Free tier services sleep after 15 minutes of inactivity
- Web static sites stay awake always (free)
- Use paid plan to prevent API from sleeping
- Health check keeps services warm

---
For detailed instructions, see [RENDER_DEPLOYMENT.md](./RENDER_DEPLOYMENT.md)