# RAG System Deployment Guide

## ✅ Completed Tasks

1. **Route Fixes**
   - Fixed `/profile/enhanced` 500 error by adding `/profile` route mount
   - Fixed `/api/support/human-agent/request` 404 error by adding `/api/support` route mount

2. **Knowledge Base Enhancement**
   - Created comprehensive trip creation documentation
   - Added 8 structured documents to knowledge_base.json
   - Enhanced backend knowledge base with organizer-specific content

3. **RAG System Integration**
   - Integrated pre-existing RAG system (app.py + core.py)
   - Updated knowledge_loader.py to load from JSON
   - Cleaned up duplicate files
   - Fixed dependency versions (faiss-cpu==1.13.1)

## 📋 Next Steps

### 1. Test RAG Service Locally

```powershell
# Install dependencies
cd ai-service/rag_system
python -m pip install -r requirements.txt

# Start the service
cd ../
python -m uvicorn rag_system.app:app --reload --port 8001
```

**Test endpoints:**
```bash
# Health check
curl http://localhost:8001/health

# Query test
curl -X POST http://localhost:8001/query \
  -H "Content-Type: application/json" \
  -H "X-API-Key: trek-tribe-rag-secret-key-2024" \
  -d '{"query": "How do I create a new trip?", "top_k": 3}'
```

### 2. Deploy AI Service on Render

**Service Name:** trek-tribe-ai-service  
**Type:** Web Service  
**Runtime:** Python 3  
**Build Command:** `pip install -r ai-service/rag_system/requirements.txt`  
**Start Command:** `cd ai-service && uvicorn rag_system.app:app --host 0.0.0.0 --port $PORT`

**Environment Variables:**
```
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
GENERATION_MODEL=gpt2-large
DEVICE=cpu
RAG_DATA_DIR=./rag_data
KNOWLEDGE_BASE_PATH=data/knowledge_base.json
RAG_API_KEY=<GENERATE_SECURE_KEY>
HOST=0.0.0.0
PORT=8001
LOG_LEVEL=INFO
MAX_CONTEXT_LENGTH=512
MAX_GENERATION_LENGTH=150
TOP_K_RESULTS=3
TEMPERATURE=0.7
```

### 3. Update Backend (Render)

Add these environment variables to your existing backend service:

```
RAG_SERVICE_URL=https://trek-tribe-ai-service.onrender.com
RAG_API_KEY=<SAME_KEY_AS_AI_SERVICE>
RAG_ENABLED=true
```

### 4. Update Frontend (Vercel)

Add to Vercel environment variables:

```
REACT_APP_RAG_ENABLED=true
REACT_APP_AI_SERVICE_URL=https://trek-tribe-ai-service.onrender.com
```

### 5. Connect AIChatWidget to RAG

Update `web/src/components/AIChatWidgetClean.tsx`:

```typescript
// Add RAG endpoint call
const queryRAG = async (message: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/ai/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        query: message,
        top_k: 3 
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      return {
        answer: data.answer,
        sources: data.sources
      };
    }
  } catch (error) {
    console.error('RAG query failed:', error);
  }
  return null;
};

// Use in message handler
const handleSendMessage = async () => {
  // ... existing code ...
  
  // Try RAG first
  const ragResponse = await queryRAG(message);
  if (ragResponse) {
    addMessage(ragResponse.answer, false);
    // Show sources if needed
    return;
  }
  
  // Fall back to existing AI endpoint
  // ... existing code ...
};
```

### 6. Add Backend Proxy Route

Create `services/api/src/routes/ai.ts`:

```typescript
import { Router } from 'express';
import axios from 'axios';

const router = Router();

router.post('/query', async (req, res) => {
  try {
    const ragServiceUrl = process.env.RAG_SERVICE_URL;
    const ragApiKey = process.env.RAG_API_KEY;
    
    if (!ragServiceUrl || !ragApiKey) {
      return res.status(503).json({ 
        error: 'RAG service not configured' 
      });
    }
    
    const response = await axios.post(
      `${ragServiceUrl}/query`,
      req.body,
      {
        headers: {
          'X-API-Key': ragApiKey,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );
    
    res.json(response.data);
  } catch (error) {
    console.error('RAG proxy error:', error);
    res.status(500).json({ 
      error: 'Failed to query RAG service' 
    });
  }
});

export default router;
```

Mount in `services/api/src/index.ts`:

```typescript
import aiRoutes from './routes/ai';
app.use('/api/ai', aiRoutes);
```

## 🔐 Security Checklist

- [ ] Generate secure RAG_API_KEY (use `openssl rand -hex 32`)
- [ ] Set same key in both AI service and backend
- [ ] Ensure frontend calls backend proxy, not AI service directly
- [ ] Enable CORS on AI service for backend domain only
- [ ] Use HTTPS for all service-to-service communication

## 🧪 Testing Checklist

- [ ] RAG service health check returns 200
- [ ] Query endpoint returns relevant answers
- [ ] Backend proxy successfully forwards requests
- [ ] Frontend chat displays RAG responses
- [ ] Sources are shown in UI when available
- [ ] Fallback to existing AI works if RAG fails
- [ ] Ticket creation still works
- [ ] Profile routes work correctly

## 📊 Monitoring

Add these health checks:

1. **RAG Service:** `GET https://trek-tribe-ai-service.onrender.com/health`
2. **Backend RAG Proxy:** `POST https://trek-tribe-38in.onrender.com/api/ai/query`
3. **Frontend Integration:** Test chat widget with known questions

## 🚀 Deployment Order

1. Deploy AI service first (Render)
2. Add environment variables to backend (Render)
3. Push backend code changes to GitHub
4. Backend auto-deploys on Render
5. Add environment variables to frontend (Vercel)
6. Push frontend code changes to GitHub
7. Frontend auto-deploys on Vercel
8. Test end-to-end flow

## 📝 Environment Variable Summary

### AI Service (Render)
```env
EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
GENERATION_MODEL=gpt2-large
DEVICE=cpu
RAG_DATA_DIR=./rag_data
KNOWLEDGE_BASE_PATH=data/knowledge_base.json
RAG_API_KEY=<generate-with-openssl-rand-hex-32>
HOST=0.0.0.0
PORT=8001
LOG_LEVEL=INFO
MAX_CONTEXT_LENGTH=512
MAX_GENERATION_LENGTH=150
TOP_K_RESULTS=3
TEMPERATURE=0.7
```

### Backend (Render) - ADD THESE
```env
RAG_SERVICE_URL=https://trek-tribe-ai-service.onrender.com
RAG_API_KEY=<same-as-ai-service>
RAG_ENABLED=true
```

### Frontend (Vercel) - ADD THESE
```env
REACT_APP_RAG_ENABLED=true
REACT_APP_AI_SERVICE_URL=https://trek-tribe-ai-service.onrender.com
```

## 🛠️ Troubleshooting

**RAG service fails to start:**
- Check model downloads completed
- Verify FAISS index creation
- Check memory limits on Render (need 2GB+ for gpt2-large)

**Backend can't reach AI service:**
- Verify RAG_SERVICE_URL is correct
- Check RAG_API_KEY matches
- Ensure AI service is deployed and running

**Frontend not showing RAG responses:**
- Check browser console for errors
- Verify backend proxy is working
- Test backend `/api/ai/query` endpoint directly

**Slow response times:**
- First query downloads models (2-3 minutes)
- Subsequent queries should be fast (1-3 seconds)
- Consider using distilgpt2 instead of gpt2-large for faster responses

## ✅ Success Criteria

- User asks "How do I create a trip?" → Gets accurate 7-step guide
- User asks about booking → Gets booking process explanation
- User asks about CRM → Gets dashboard features list
- Ticket creation still works via "Talk to Human Agent"
- All existing functionality remains intact
- Response time < 5 seconds for RAG queries
