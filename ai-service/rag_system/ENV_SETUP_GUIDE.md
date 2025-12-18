# Environment Configuration Guide

Complete guide for setting up environment variables for RAG system across all deployment scenarios.

## 1. Local Development Setup

### Step 1: Create `.env` file
```bash
cd ai-service/rag_system
cp .env.template .env
```

### Step 2: Configure for local development
```env
# AI Models
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
GENERATION_MODEL=gpt2-large

# Storage
RAG_DATA_DIR=./data

# Hardware
DEVICE=cpu  # Use 'cpu' for development, 'cuda' for GPU

# Server
PORT=8001
WORKERS=1

# Security (optional for local dev)
RAG_API_KEY=dev-key-local
RAG_ADMIN_KEY=admin-key-local

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:4000

# Query Defaults
DEFAULT_TOP_K=3
MAX_GENERATION_LENGTH=200
MAX_CONTEXT_LENGTH=2000

# Performance
BATCH_SIZE=32
NUM_THREADS=4
```

### Step 3: Verify configuration
```bash
# Start the service
python -m uvicorn rag_system.app:app --reload --port 8001

# In another terminal, test
curl http://localhost:8001/health
```

---

## 2. Render Deployment Setup

### Step 1: Create service on Render

1. Go to [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect GitHub repository
4. Configure:
   - **Name**: `trek-tribe-rag`
   - **Runtime**: `Python 3.10`
   - **Build Command**: `pip install -r ai-service/rag_system/requirements.txt`
   - **Start Command**: `gunicorn -w 4 -k uvicorn.workers.UvicornWorker rag_system.app:app --bind 0.0.0.0:$PORT`

### Step 2: Set environment variables on Render

```env
# AI Models
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
GENERATION_MODEL=gpt2-large

# Storage
RAG_DATA_DIR=./data

# Hardware (Important for Render)
DEVICE=cpu  # Render free tier doesn't support CUDA; upgrade plan for GPU

# Server
PORT=10000  # Render assigns dynamic port
WORKERS=4

# Security (REQUIRED for production)
RAG_API_KEY=<YOUR_STRONG_SECRET_KEY_HERE>
RAG_ADMIN_KEY=<YOUR_ADMIN_SECRET_KEY_HERE>

# CORS (Update with your domains)
ALLOWED_ORIGINS=https://trek-tribe.vercel.app,https://your-backend.onrender.com,http://localhost:3000

# Query Defaults
DEFAULT_TOP_K=3
MAX_GENERATION_LENGTH=200
MAX_CONTEXT_LENGTH=2000

# Performance
BATCH_SIZE=16  # Reduced for Render free tier
NUM_THREADS=2  # Reduced for Render free tier

# Logging
LOG_LEVEL=INFO
```

### Step 3: Generate strong secrets

```bash
# On local machine, generate API keys
python -c "import secrets; print(secrets.token_urlsafe(32))"
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Copy these values to Render environment variables.

### Step 4: Deploy

1. Render will automatically deploy when you push to GitHub
2. First deploy takes 5-10 minutes (downloads models)
3. Service will be available at: `https://trek-tribe-rag.onrender.com`

---

## 3. Backend (Node.js on Render) Configuration

### File: `services/api/.env`

```env
# RAG Service Configuration
RAG_SERVICE_URL=https://trek-tribe-rag.onrender.com
RAG_API_KEY=<SAME_VALUE_AS_RAG_SERVICE>

# Other existing backend config...
DATABASE_URL=mongodb+srv://...
REDIS_URL=redis://...
JWT_SECRET=...
```

### Step: Set on Render dashboard

1. Go to your backend service on Render
2. Environment tab
3. Add/update:
   - `RAG_SERVICE_URL`: https://trek-tribe-rag.onrender.com
   - `RAG_API_KEY`: (same as RAG service RAG_API_KEY)

---

## 4. Frontend (React on Vercel) Configuration

### File: `web/.env.local` (for local development)

```env
REACT_APP_API_URL=http://localhost:4000
REACT_APP_RAG_ENABLED=true
```

### File: `web/.env.production` (for production)

```env
REACT_APP_API_URL=https://your-backend.onrender.com
REACT_APP_RAG_ENABLED=true
```

### Step: Set on Vercel dashboard

1. Go to Vercel project settings
2. Environment Variables
3. Add variables for each environment (Production, Preview, Development):
   - `REACT_APP_API_URL`: your backend URL
   - `REACT_APP_RAG_ENABLED`: true

---

## 5. Local Development with Docker

### Create `docker-compose.yml` for local testing:

```yaml
version: '3.8'

services:
  rag:
    build:
      context: .
      dockerfile: ai-service/rag_system/Dockerfile
    ports:
      - "8001:8001"
    environment:
      - EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
      - GENERATION_MODEL=gpt2-large
      - RAG_DATA_DIR=/app/data
      - DEVICE=cpu
      - PORT=8001
      - WORKERS=2
      - RAG_API_KEY=dev-key
      - RAG_ADMIN_KEY=admin-key
      - LOG_LEVEL=DEBUG
    volumes:
      - ./ai-service/rag_system:/app
      - rag-data:/app/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

volumes:
  rag-data:
```

### Run locally with Docker:

```bash
docker-compose up
# Service available at http://localhost:8001
```

---

## 6. Advanced Configuration Options

### GPU Support (Render GPU plan)

```env
DEVICE=cuda
# Requires CUDA-capable Render plan
# Cost: ~$20-50/month vs $7/month for CPU
```

### Custom Model Selection

```env
# Smaller model (faster, less accurate)
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2  # 22M params
GENERATION_MODEL=gpt2  # 124M params

# Larger model (slower, more accurate)
EMBEDDING_MODEL=sentence-transformers/all-mpnet-base-v2  # 109M params
GENERATION_MODEL=distilgpt2  # 82M params

# Note: User specified GPT-2 Large (774M params)
# Render free tier CPU: 5-10 sec per query
# Render GPU tier: 1-2 sec per query
```

### Performance Tuning

```env
# For low traffic (default)
BATCH_SIZE=16
NUM_THREADS=2
WORKERS=2

# For high traffic
BATCH_SIZE=32
NUM_THREADS=4
WORKERS=4

# For limited resources
BATCH_SIZE=8
NUM_THREADS=1
WORKERS=1
```

### Logging Configuration

```env
# Development
LOG_LEVEL=DEBUG

# Production
LOG_LEVEL=INFO

# Minimal logging
LOG_LEVEL=WARNING
```

---

## 7. Security Best Practices

### 1. API Key Rotation

Generate new keys monthly:
```bash
# Generate new key
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Update on Render → Environment Variables
# Restart service (automatic with env change)
```

### 2. CORS Configuration

```env
# Development
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:4000

# Production
ALLOWED_ORIGINS=https://trek-tribe.vercel.app,https://trek-tribe-backend.onrender.com

# Do NOT use ALLOWED_ORIGINS=* in production
```

### 3. Admin Key Protection

- Store `RAG_ADMIN_KEY` only in Render environment (not in code)
- Never commit `.env` files to git
- Rotate admin key every 3 months

---

## 8. Troubleshooting Configuration Issues

### Issue: "Cannot connect to RAG service"
**Solution**: Verify URLs match
- Backend: `RAG_SERVICE_URL` should be https://trek-tribe-rag.onrender.com
- Check RAG service is deployed and healthy

### Issue: "401 Unauthorized"
**Solution**: Verify API keys match
- Check `RAG_API_KEY` in backend matches `RAG_API_KEY` in RAG service
- Keys must be exactly identical

### Issue: "CORS blocked from frontend"
**Solution**: Update ALLOWED_ORIGINS
- Add your Vercel URL to RAG service `ALLOWED_ORIGINS`
- Format: https://your-domain.vercel.app
- Restart RAG service

### Issue: "Out of memory" error
**Solution**: Reduce model size or add resources
- Use smaller `EMBEDDING_MODEL` and `GENERATION_MODEL`
- Or upgrade Render plan to higher tier
- Or use GPU plan instead of CPU

### Issue: "Slow queries (>30 seconds)"
**Solution**: Optimize configuration
- Upgrade to GPU plan (`DEVICE=cuda`)
- Reduce `MAX_GENERATION_LENGTH` to 100
- Increase `BATCH_SIZE` for parallel processing
- Use smaller models if accuracy allows

---

## 9. Quick Reference: All Environments

### Local Development
```bash
DEVICE=cpu
WORKERS=1
PORT=8001
LOG_LEVEL=DEBUG
```

### Render Production
```bash
DEVICE=cpu (or cuda for GPU plan)
WORKERS=4
PORT=10000 (dynamic)
LOG_LEVEL=INFO
```

### Docker Local
```bash
DEVICE=cpu
WORKERS=2
PORT=8001
LOG_LEVEL=DEBUG
```

---

## 10. Environment Variables Checklist

- [ ] EMBEDDING_MODEL set to sentence-transformers/all-MiniLM-L6-v2
- [ ] GENERATION_MODEL set to gpt2-large
- [ ] RAG_DATA_DIR points to writable directory
- [ ] DEVICE set appropriately (cpu/cuda)
- [ ] PORT matches service port
- [ ] WORKERS set for concurrency needs
- [ ] RAG_API_KEY is strong and secret
- [ ] RAG_ADMIN_KEY is strong and secret
- [ ] ALLOWED_ORIGINS includes all valid domains
- [ ] CORS properly configured for frontend
- [ ] Backend RAG_SERVICE_URL matches RAG deployment URL
- [ ] Backend RAG_API_KEY matches RAG service key
- [ ] LOG_LEVEL appropriate for environment
- [ ] All sensitive keys NOT committed to git
- [ ] .env files in .gitignore

---

## Quick Deploy Command Reference

```bash
# Local development
python -m uvicorn rag_system.app:app --reload --port 8001

# Local Docker
docker-compose up

# Render deployment
# (Automatic on git push with correct start command)
gunicorn -w 4 -k uvicorn.workers.UvicornWorker rag_system.app:app --bind 0.0.0.0:$PORT

# Test deployment
curl -H "X-API-Key: <YOUR_RAG_API_KEY>" \
  https://trek-tribe-rag.onrender.com/health
```
