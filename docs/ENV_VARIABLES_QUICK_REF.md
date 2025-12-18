# Environment Variables - Quick Reference

## 🎯 AI Service (Render)

**Service Name:** `trek-tribe-ai-service`

Copy-paste these into Render environment variables:

```
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
GENERATION_MODEL=gpt2-large
DEVICE=cpu
RAG_DATA_DIR=./rag_data
KNOWLEDGE_BASE_PATH=data/knowledge_base.json
HOST=0.0.0.0
LOG_LEVEL=INFO
MAX_CONTEXT_LENGTH=512
MAX_GENERATION_LENGTH=150
TOP_K_RESULTS=3
TEMPERATURE=0.7
```

**Generate secure API key:**
```bash
# On Linux/Mac:
openssl rand -hex 32

# On Windows PowerShell:
-join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Maximum 16) })
```

Then add:
```
RAG_API_KEY=<paste-generated-key-here>
```

## 🔧 Backend (Render)

**Service Name:** `trek-tribe-38in` (existing service)

Add these 3 variables:

```
RAG_SERVICE_URL=https://trek-tribe-ai-service.onrender.com
RAG_API_KEY=<same-key-as-ai-service>
RAG_ENABLED=true
```

## 🌐 Frontend (Vercel)

**Project Name:** `trek-tribe` (existing project)

Add these 2 variables:

```
REACT_APP_RAG_ENABLED=true
REACT_APP_AI_SERVICE_URL=https://trek-tribe-ai-service.onrender.com
```

## ✅ Verification

After setting environment variables:

1. **AI Service Health:**
   ```bash
   curl https://trek-tribe-ai-service.onrender.com/health
   ```
   Expected: `{"status": "healthy", "models_loaded": true}`

2. **Backend Proxy Health:**
   ```bash
   curl https://trek-tribe-38in.onrender.com/api/ai/rag/health
   ```
   Expected: `{"status": "healthy", "ragService": {...}}`

3. **Frontend Test:**
   - Open https://trek-tribe.vercel.app
   - Open chat widget
   - Ask: "How do I create a trip?"
   - Should get comprehensive answer

## 🔒 Security Checklist

- [ ] Generated secure RAG_API_KEY
- [ ] Same key used in AI service and backend
- [ ] Frontend doesn't call AI service directly
- [ ] HTTPS enabled on all services
- [ ] CORS configured on AI service

## 📝 Notes

- **First deployment:** Takes 5-10 minutes (downloads ML models)
- **Memory requirements:** 2GB+ for gpt2-large, 1GB for distilgpt2
- **Cold starts:** Free tier ~30-60 seconds, paid tier ~5-10 seconds
- **Response time:** First query 2-5s, subsequent 1-2s
