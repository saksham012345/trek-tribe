# RAG System - Quick Start Guide

## What is This RAG System?

A **Retrieval-Augmented Generation (RAG)** system that:
- **Retrieves** relevant documents from your knowledge base (using FAISS + sentence-transformers)
- **Augments** the prompt with retrieved context
- **Generates** accurate answers using GPT-2 Large

Perfect for your Trek Tribe application to provide:
- **Trip creation guidance** for organizers
- **Booking information** for travelers
- **Safety tips** for adventures
- **General trekking knowledge**

---

## System Architecture

```
┌─────────────────────────────────────────┐
│     Frontend (Vercel)                   │
│  User asks: "How do I create a trip?"   │
└──────────────────┬──────────────────────┘
                   │ HTTP Request
                   ▼
┌──────────────────────────────────────────┐
│     Backend API (Render)                 │
│  Forwards query to RAG service           │
└──────────────────┬───────────────────────┘
                   │ HTTP Request
                   ▼
┌──────────────────────────────────────────┐
│     RAG Service (Render)                 │
│  1. Query FAISS index for relevant docs  │
│  2. Create augmented prompt              │
│  3. Generate answer with GPT-2           │
│  4. Return answer + sources              │
└──────────────────┬───────────────────────┘
                   │ HTTP Response
                   ▼
┌──────────────────────────────────────────┐
│     Frontend Display                     │
│  "To create a trip: Step 1... Step 2..."  │
└──────────────────────────────────────────┘
```

---

## Components

### 1. `core.py` - RAG Engine
- **DocumentStore**: Manages FAISS index + sentence embeddings
- **TextGenerator**: Generates answers using GPT-2
- **RAGSystem**: Orchestrates retrieval + generation

### 2. `knowledge_loader.py` - Knowledge Base
- Trek Tribe specific knowledge (trip creation, CRM, bookings, payments)
- General trekking knowledge (safety, packing, seasons, altitude sickness)
- ~20 comprehensive documents covering all topics

### 3. `app.py` - REST API
- **POST /query** - Query the RAG system
- **POST /retrieve** - Just retrieve documents (no generation)
- **POST /admin/ingest** - Add new documents
- **GET /stats** - System statistics
- **GET /health** - Health check

---

## Quick Start (Local Development)

### 1. Install

```bash
cd ai-service/rag_system
pip install -r requirements.txt
```

**Time**: ~5 minutes (includes model downloads)

### 2. Configure

```bash
cp .env.template .env
```

Default settings work fine for local development.

### 3. Run

```bash
# Terminal 1: Run RAG Service
python -m uvicorn rag_system.app:app --reload --port 8001

# Terminal 2: Test the API
curl -X POST http://localhost:8001/query \
  -H "Content-Type: application/json" \
  -d '{"query": "How do I create a trip?"}'
```

Visit: `http://localhost:8001/docs` for interactive API documentation.

### 4. Test Response

The RAG system should return something like:

```json
{
  "answer": "To create a trip on Trek Tribe, follow these 7 steps...",
  "context": "[Retrieved context from knowledge base]",
  "sources": [
    {
      "source": "Trek Tribe Documentation",
      "title": "How to Create a Trip",
      "score": 0.95
    }
  ],
  "query": "How do I create a trip?"
}
```

---

## Deployment (Production)

### Option 1: Render (Recommended - Same as your other services)

1. **Create new service on Render**:
   - New Web Service
   - Connect GitHub repo
   - Branch: `main`

2. **Build Command**:
   ```bash
   cd ai-service && pip install -r rag_system/requirements.txt
   ```

3. **Start Command**:
   ```bash
   cd ai-service && python -m uvicorn rag_system.app:app --host 0.0.0.0 --port $PORT
   ```

4. **Environment Variables**:
   ```env
   EMBEDDING_MODEL=all-MiniLM-L6-v2
   GENERATION_MODEL=gpt2-large
   DEVICE=cpu
   RAG_API_KEY=your-secret-key
   ```

5. **Plan**: Standard (2GB RAM) or better

6. **Deploy** - Takes ~10 minutes on first deploy

Your RAG service will be available at: `https://trek-tribe-rag.onrender.com`

### Option 2: Docker (Any Server)

```bash
# Build
docker build -f rag_system/Dockerfile -t trek-tribe-rag .

# Run
docker run -p 8001:8001 \
  -e DEVICE=cpu \
  -e RAG_API_KEY=your-key \
  trek-tribe-rag
```

---

## Integration with Your Backend

### Backend Setup (Node.js/Express)

1. **Create `services/api/src/services/ragService.ts`**:

```typescript
import axios from 'axios';

export const ragService = {
  async query(query: string) {
    const response = await axios.post(
      `${process.env.RAG_SERVICE_URL}/query`,
      { query, top_k: 3 },
      { headers: { 'X-API-Key': process.env.RAG_API_KEY } }
    );
    return response.data;
  }
};
```

2. **Add environment variables** to `.env`:

```env
RAG_SERVICE_URL=https://trek-tribe-rag.onrender.com
RAG_API_KEY=your-secret-key
```

3. **Create endpoint** `services/api/src/routes/rag.ts`:

```typescript
router.post('/query', async (req, res) => {
  const result = await ragService.query(req.body.query);
  res.json({ success: true, data: result });
});
```

4. **Register in** `services/api/src/index.ts`:

```typescript
app.use('/api/rag', ragRoutes);
```

---

## Integration with Frontend

### Frontend Setup (React)

1. **Create service** `web/src/services/ragService.ts`:

```typescript
import api from '../config/api';

export const ragService = {
  async query(query: string) {
    const response = await api.post('/api/rag/query', { query });
    return response.data.data;
  }
};
```

2. **Use in component**:

```typescript
import { ragService } from '../services/ragService';

function AIChatWidget() {
  async function handleQuery(userMessage: string) {
    const result = await ragService.query(userMessage);
    setAnswer(result.answer);
    setSources(result.sources);
  }

  return (
    <div>
      <div>{answer}</div>
      {sources.map(src => (
        <small key={src.title}>{src.source}: {src.title}</small>
      ))}
    </div>
  );
}
```

---

## Query Examples

### Example 1: Trip Creation
```bash
curl -X POST http://localhost:8001/query \
  -H "Content-Type: application/json" \
  -d '{"query": "How do I create a trip as an organizer?"}'
```

### Example 2: Booking Process
```bash
curl -X POST http://localhost:8001/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the complete booking process?"}'
```

### Example 3: Altitude Sickness
```bash
curl -X POST http://localhost:8001/query \
  -H "Content-Type: application/json" \
  -d '{"query": "How do I prevent altitude sickness?"}'
```

### Example 4: Packing List
```bash
curl -X POST http://localhost:8001/query \
  -H "Content-Type: application/json" \
  -d '{"query": "What should I pack for a monsoon trek?"}'
```

---

## Adding Your Own Knowledge

### Method 1: Update Knowledge Loader

Edit `knowledge_loader.py` and add documents to `load_trek_tribe_knowledge()`:

```python
{
    "id": "custom-doc-1",
    "title": "Your Document Title",
    "source": "Trek Tribe",
    "category": "category-name",
    "text": "Your document content here..."
}
```

Then restart the service.

### Method 2: API Ingestion (Admin)

```bash
curl -X POST http://localhost:8001/admin/ingest \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-admin-key" \
  -d '{
    "documents": [
      {
        "id": "new-doc-1",
        "title": "New Information",
        "source": "Trek Tribe",
        "text": "New information content..."
      }
    ]
  }'
```

---

## Performance & Optimization

### Current Setup
- **Embedding Model**: all-MiniLM-L6-v2 (22M params, fast)
- **Generation Model**: gpt2-large (774M params, quality)
- **Index Type**: FAISS Flat L2 (exact, slow but accurate)
- **Deployment**: CPU on Render

### Optimization Options

**For Speed** (Render Standard plan):
```env
EMBEDDING_MODEL=sentence-transformers/paraphrase-TinyBERT-L6-v2
GENERATION_MODEL=gpt2
FAISS_INDEX_TYPE=hnsw  # Approximate search
```

**For Quality** (Render Premium plan):
```env
EMBEDDING_MODEL=all-mpnet-base-v2
GENERATION_MODEL=gpt2-xl
DEVICE=cuda  # GPU
```

**Caching** - Add Redis for query caching (optional):
```python
from redis import Redis
cache = Redis()
result = cache.get(query_hash)
```

---

## Monitoring

### Health Check
```bash
curl https://trek-tribe-rag.onrender.com/health
```

Response:
```json
{
  "status": "healthy",
  "rag_system_ready": true,
  "documents_loaded": 28
}
```

### Check Stats
```bash
curl https://trek-tribe-rag.onrender.com/stats \
  -H "X-API-Key: your-api-key"
```

### View Logs (Render)
```bash
# Via Render dashboard or
render logs trek-tribe-rag
```

---

## Troubleshooting

### Issue: Models take too long to download

**Solution**: Models download on first run. This is normal. For production, pre-download by running locally:
```python
from sentence_transformers import SentenceTransformer
SentenceTransformer("all-MiniLM-L6-v2")
from transformers import GPT2LMHeadModel
GPT2LMHeadModel.from_pretrained("gpt2-large")
```

### Issue: Out of memory

**Solution**: Use smaller models or upgrade Render plan to Standard (2GB) or higher.

### Issue: Slow responses

**Solution**: 
- Reduce `max_generation_length`
- Use faster embedding model
- Cache results
- Upgrade to GPU

### Issue: Low quality answers

**Solution**:
- Add more documents to knowledge base
- Check if question matches available topics
- Use larger embedding model
- Check top_k parameter

---

## Architecture Summary

```
Your Trek Tribe App
├── Frontend (Vercel)
│   ├── React/TypeScript
│   └── Calls /api/rag/query
├── Backend API (Render)
│   ├── Node.js/Express
│   ├── Routes queries to RAG
│   └── Processes responses
└── RAG Service (Render) ← NEW
    ├── Python/FastAPI
    ├── FAISS Index
    ├── Sentence Embeddings
    ├── GPT-2 Generation
    └── Trek Tribe Knowledge Base
```

---

## Next Steps

1. **Deploy RAG service** to Render
2. **Configure backend** to call RAG API
3. **Update frontend** to display RAG responses
4. **Test end-to-end** with sample queries
5. **Monitor** performance and user feedback
6. **Add more documents** as needed

---

## Support

For issues or questions:
1. Check Render logs: `render logs trek-tribe-rag`
2. Test RAG API directly: `https://trek-tribe-rag.onrender.com/docs`
3. Review environment variables in Render dashboard
4. Check API key is correct in all services

---

## Files Overview

```
ai-service/rag_system/
├── core.py                          # RAG engine (retrieval + generation)
├── knowledge_loader.py              # Trek Tribe & general knowledge
├── app.py                           # FastAPI service
├── requirements.txt                 # Python dependencies
├── Dockerfile                       # Docker configuration
├── .env.template                    # Environment variables template
├── DEPLOYMENT_INTEGRATION.md        # Detailed deployment guide
└── __init__.py                      # Package initialization
```

Happy RAG-ing! 🚀

