# Trek Tribe - Quick Vercel Deployment

## 🚀 Fast Deploy (5 minutes)

### 1. Prerequisites
- ✅ Code pushed to GitHub
- ✅ MongoDB Atlas database ready
- ✅ Vercel account created

### 2. Deploy API (2 minutes)
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo
3. Set **Root Directory**: `services/api`
4. Add Environment Variables:
   ```
   MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/trekktribe
   JWT_SECRET=your_secure_secret_here
   NODE_ENV=production
   ```
5. Deploy!

### 3. Deploy Web (2 minutes)
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo again
3. Set **Root Directory**: `web`  
4. Add Environment Variables:
   ```
   REACT_APP_API_URL=https://your-api-domain.vercel.app
   ```
5. Deploy!

### 4. Update CORS (1 minute)
- Go to API project → Settings → Environment Variables
- Add: `FRONTEND_URL=https://your-web-domain.vercel.app`
- Redeploy API project

## ✅ Verify Deployment
- API Health: `https://your-api.vercel.app/health`
- Web App: `https://your-web.vercel.app`

## 🔧 Local Development Commands
```bash
npm run dev:web    # Start web on localhost:3000
npm run dev:api    # Start API on localhost:4000
npm run build:api  # Build API for production  
npm run build:web  # Build web for production
```

---
For detailed instructions, see [VERCEL_DEPLOYMENT.md](./VERCEL_DEPLOYMENT.md)