# RAG System - Deployment and Integration Guide

## Overview

The RAG (Retrieval-Augmented Generation) system is a Python-based service that:
- Uses **sentence-transformers** for semantic document embeddings
- Uses **FAISS** for efficient similarity search and retrieval
- Uses **GPT-2 Large** for text generation
- Exposes a **FastAPI** REST API for integration

This guide covers deployment and integration with your Trek Tribe architecture.

---

## Architecture

### Current Trek Tribe Deployment

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (Vercel)                           │
│              https://trek-tribe-frontend.vercel.app             │
│                                                                  │
│  - React TypeScript application                                 │
│  - Deployed on Vercel                                           │
│  - Makes API calls to backend and AI services                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                    (HTTP/HTTPS)
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
┌─────────────────┐ ┌─────────────────┐ ┌──────────────────┐
│  Backend API    │ │  AI Service     │ │  RAG System      │
│  (Node.js)      │ │  (Python)       │ │  (Python/FastAPI)│
│  Render         │ │  Render         │ │  Render          │
│  :4000          │ │  :8000          │ │  :8001           │
└─────────────────┘ └─────────────────┘ └──────────────────┘
      │                    │                    │
      └────────┬───────────┴────────┬───────────┘
               │                    │
         (MongoDB)          (FAISS Index)
              │                    │
         Database          Documents/Embeddings
```

### RAG System Components

```
RAG System
├── core.py
│   ├── DocumentStore (FAISS + sentence-transformers)
│   ├── TextGenerator (GPT-2)
│   └── RAGSystem (orchestrator)
├── knowledge_loader.py
│   ├── Trek Tribe specific knowledge
│   └── General trekking knowledge
└── app.py
    ├── FastAPI REST API
    └── Endpoints for query, retrieve, ingest
```

---

## Local Development Setup

### 1. Install Dependencies

```bash
cd ai-service/rag_system
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.template .env
# Edit .env with your configuration
```

Example `.env`:
```env
EMBEDDING_MODEL=all-MiniLM-L6-v2
GENERATION_MODEL=gpt2-large
RAG_DATA_DIR=./rag_data
DEVICE=auto
PORT=8001
RAG_API_KEY=dev-secret-key
RAG_ADMIN_KEY=dev-admin-key
```

### 3. Run Locally

```bash
# Using uvicorn directly
python -m uvicorn rag_system.app:app --reload --port 8001

# Or using the main module
python -m rag_system.app
```

The RAG API will be available at: `http://localhost:8001`

Swagger documentation: `http://localhost:8001/docs`

### 4. Test the RAG System

```bash
# Health check
curl http://localhost:8001/health

# Query endpoint
curl -X POST http://localhost:8001/query \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-secret-key" \
  -d '{"query": "How do I create a trip?"}'

# Retrieve documents
curl -X POST "http://localhost:8001/retrieve?query=booking&top_k=3" \
  -H "X-API-Key: dev-secret-key"
```

---

## Deployment to Render

### 1. Deploy RAG Service on Render

#### Option A: Using Docker

1. Create `render.yaml` in `ai-service/` root:

```yaml
services:
  - type: web
    name: trek-tribe-rag
    env: docker
    dockerfilePath: ./rag_system/Dockerfile
    port: 8001
    envVars:
      - key: EMBEDDING_MODEL
        value: all-MiniLM-L6-v2
      - key: GENERATION_MODEL
        value: gpt2-large
      - key: RAG_DATA_DIR
        value: /app/rag_data
      - key: DEVICE
        value: cpu
      - key: PORT
        value: 8001
      - key: RAG_API_KEY
        fromService:
          name: trek-tribe-api
          property: env.RAG_API_KEY
      - key: RAG_ADMIN_KEY
        fromService:
          name: trek-tribe-api
          property: env.RAG_ADMIN_KEY
```

2. Deploy:
```bash
# Push to Render
git push render main

# Or use Render CLI
render deploy --service trek-tribe-rag
```

#### Option B: Manual Deployment on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: trek-tribe-rag
   - **Environment**: Python
   - **Build Command**: `cd ai-service && pip install -r rag_system/requirements.txt`
   - **Start Command**: `cd ai-service && python -m uvicorn rag_system.app:app --host 0.0.0.0 --port $PORT`
   - **Plan**: Standard (or higher if needed)

5. Set environment variables:
   - `EMBEDDING_MODEL`: `all-MiniLM-L6-v2`
   - `GENERATION_MODEL`: `gpt2-large`
   - `RAG_DATA_DIR`: `/app/rag_data`
   - `DEVICE`: `cpu` (change to `cuda` if GPU available)
   - `RAG_API_KEY`: Set to secret value
   - `RAG_ADMIN_KEY`: Set to secret value

6. Click "Create Web Service"

### 2. RAG Service URL

After deployment, your RAG service will be available at:
```
https://trek-tribe-rag.onrender.com
```

---

## Integration with Backend API

### 1. Add RAG Service Configuration to Backend

Update `services/api/src/config/rag.ts`:

```typescript
export const ragConfig = {
  // RAG Service URL
  baseURL: process.env.RAG_SERVICE_URL || 'http://localhost:8001',
  
  // API Key for authentication
  apiKey: process.env.RAG_API_KEY || '',
  
  // Default parameters
  defaultTopK: 3,
  maxGenerationLength: 200,
  
  // Endpoints
  endpoints: {
    query: '/query',
    retrieve: '/retrieve',
    ingest: '/admin/ingest',
    stats: '/stats',
    health: '/health'
  },
  
  // Request timeout
  timeout: 30000,
  
  // Enable/disable RAG
  enabled: process.env.RAG_ENABLED === 'true'
};
```

### 2. Create RAG Service Integration

Create `services/api/src/services/ragService.ts`:

```typescript
import axios, { AxiosInstance } from 'axios';
import { ragConfig } from '../config/rag';
import { logger } from '../utils/logger';

interface QueryRequest {
  query: string;
  top_k?: number;
  include_sources?: boolean;
  max_generation_length?: number;
}

interface QueryResponse {
  answer: string;
  context: string;
  sources: Array<{
    source: string;
    title: string;
    score: number;
  }>;
  query: string;
}

export class RAGService {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: ragConfig.baseURL,
      timeout: ragConfig.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': ragConfig.apiKey
      }
    });
  }

  async query(request: QueryRequest): Promise<QueryResponse> {
    try {
      logger.info(`RAG Query: ${request.query}`);
      
      const response = await this.client.post<QueryResponse>('/query', {
        query: request.query,
        top_k: request.top_k || ragConfig.defaultTopK,
        include_sources: request.include_sources !== false,
        max_generation_length: request.max_generation_length || ragConfig.defaultTopK
      });

      logger.info(`RAG Query successful: ${response.data.sources.length} sources`);
      return response.data;
    } catch (error) {
      logger.error('RAG query failed:', error);
      throw error;
    }
  }

  async health(): Promise<boolean> {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      logger.error('RAG health check failed:', error);
      return false;
    }
  }

  async stats() {
    try {
      const response = await this.client.get('/stats');
      return response.data;
    } catch (error) {
      logger.error('Failed to get RAG stats:', error);
      return null;
    }
  }
}

export const ragService = new RAGService();
```

### 3. Create RAG Route in Backend

Create `services/api/src/routes/rag.ts`:

```typescript
import express, { Request, Response, NextFunction } from 'express';
import { ragService } from '../services/ragService';
import { body, validationResult } from 'express-validator';
import { logger } from '../utils/logger';

const router = express.Router();

// Middleware for validation
const validateQuery = [
  body('query').isString().trim().notEmpty(),
  body('top_k').optional().isInt({ min: 1, max: 10 }),
  body('include_sources').optional().isBoolean()
];

// Query RAG system
router.post('/query', validateQuery, async (req: Request, res: Response) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await ragService.query({
      query: req.body.query,
      top_k: req.body.top_k || 3,
      include_sources: req.body.include_sources !== false
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error('Error querying RAG:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to query RAG system'
    });
  }
});

// Health check
router.get('/health', async (req: Request, res: Response) => {
  try {
    const healthy = await ragService.health();
    res.json({ healthy });
  } catch (error) {
    res.status(500).json({ healthy: false });
  }
});

// Stats
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await ragService.stats();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false });
  }
});

export default router;
```

### 4. Register RAG Routes in Index

Add to `services/api/src/index.ts`:

```typescript
import ragRoutes from './routes/rag';

// In the routes section:
app.use('/api/rag', ragRoutes);
```

### 5. Update Environment Variables

Add to backend `.env`:

```env
# RAG Service
RAG_ENABLED=true
RAG_SERVICE_URL=https://trek-tribe-rag.onrender.com
RAG_API_KEY=your-rag-api-key-here
```

---

## Integration with Frontend

### 1. Create RAG Service Client

Create `web/src/services/ragService.ts`:

```typescript
import api from '../config/api';

export interface RAGQueryRequest {
  query: string;
  top_k?: number;
  include_sources?: boolean;
}

export interface RAGQueryResponse {
  answer: string;
  context: string;
  sources: Array<{
    source: string;
    title: string;
    score: number;
  }>;
}

export const ragService = {
  async query(request: RAGQueryRequest): Promise<RAGQueryResponse> {
    try {
      const response = await api.post('/api/rag/query', {
        query: request.query,
        top_k: request.top_k || 3,
        include_sources: request.include_sources !== false
      });

      return response.data.data;
    } catch (error) {
      console.error('RAG query failed:', error);
      throw error;
    }
  },

  async health(): Promise<boolean> {
    try {
      const response = await api.get('/api/rag/health');
      return response.data.healthy;
    } catch (error) {
      console.error('RAG health check failed:', error);
      return false;
    }
  }
};
```

### 2. Use RAG in Components

Example integration in AI chat widget:

```typescript
// In AIChatWidgetClean.tsx
import { ragService } from '../services/ragService';

async function handleUserMessage(message: string) {
  try {
    // Query RAG system instead of or in addition to OpenAI
    const ragResponse = await ragService.query({
      query: message,
      top_k: 3
    });

    // Display RAG answer to user
    setMessages(prev => [...prev, {
      id: `rag_${Date.now()}`,
      message: ragResponse.answer,
      sources: ragResponse.sources
    }]);

    // Optionally show sources
    if (ragResponse.sources.length > 0) {
      console.log('Retrieved from:', ragResponse.sources);
    }
  } catch (error) {
    console.error('Failed to get RAG response:', error);
    // Fallback to other response methods
  }
}
```

---

## Query Examples

### Example 1: Trip Creation Query

**Request:**
```bash
curl -X POST https://trek-tribe-rag.onrender.com/query \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "query": "How do I create a trip as an organizer?",
    "top_k": 3,
    "include_sources": true
  }'
```

**Response:**
```json
{
  "answer": "To create a trip on Trek Tribe, you must first be registered as an Organizer. Then follow these steps: ...",
  "context": "To create a trip on Trek Tribe, follow these 7 steps: Step 1: Basic Information ...",
  "sources": [
    {
      "source": "Trek Tribe Documentation",
      "title": "How to Create a Trip",
      "score": 0.95
    }
  ],
  "query": "How do I create a trip as an organizer?"
}
```

### Example 2: Booking Query

**Request:**
```bash
curl -X POST https://trek-tribe-rag.onrender.com/query \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "query": "What is the refund policy?",
    "top_k": 2
  }'
```

---

## Performance Optimization

### 1. Model Size Considerations

- **Embedding Model**: `all-MiniLM-L6-v2` (22M parameters, fast)
  - Alternative: `all-mpnet-base-v2` (110M, slower but more accurate)
  - For lightweight: `sentence-transformers/paraphrase-TinyBERT-L6-v2` (4.3M)

- **Generation Model**: `gpt2-large` (774M parameters)
  - For speed: `gpt2` (124M)
  - For quality: `gpt2-xl` (1.5B, slower)

### 2. Caching

Add caching layer to avoid repeated queries:

```python
from functools import lru_cache
import hashlib

@lru_cache(maxsize=1000)
def cached_query(query_hash: str):
    # Return cached result
    pass

def query_with_cache(query: str):
    query_hash = hashlib.md5(query.encode()).hexdigest()
    # Check cache, return if found
    # Otherwise compute and cache
```

### 3. Batch Processing

For multiple queries:

```python
def batch_query(queries: List[str]) -> List[Dict]:
    results = []
    for query in queries:
        result = rag_system.query(query)
        results.append(result)
    return results
```

### 4. Index Optimization

- **FAISS Index Types**:
  - `IndexFlatL2`: Exact search (used now)
  - `IndexIVFFlat`: Approximate search, faster
  - `IndexHNSW`: Graph-based, balanced speed/accuracy

---

## Monitoring & Maintenance

### 1. Health Monitoring

```bash
# Check RAG service health
curl https://trek-tribe-rag.onrender.com/health

# Response should include:
# - status: "healthy"
# - rag_system_ready: true
# - documents_loaded: <number>
```

### 2. Update Knowledge Base

```bash
curl -X POST https://trek-tribe-rag.onrender.com/admin/ingest \
  -H "Content-Type: application/json" \
  -H "X-API-Key: admin-key" \
  -d '{
    "documents": [
      {
        "id": "custom-1",
        "title": "New Document",
        "source": "Custom",
        "text": "Document content..."
      }
    ]
  }'
```

### 3. Logs & Debugging

Check Render logs:
```bash
# Via Render dashboard or
render logs trek-tribe-rag
```

---

## Troubleshooting

### Issue: Out of Memory

**Solution:**
- Use smaller embedding model: `sentence-transformers/all-MiniLM-L6-v2`
- Use smaller generation model: `gpt2` instead of `gpt2-large`
- Reduce batch size in config

### Issue: Slow Responses

**Solutions:**
- Use FAISS approximate search (IndexIVFFlat)
- Reduce `max_generation_length`
- Cache frequent queries
- Use GPU deployment (with CUDA)

### Issue: Low Quality Answers

**Solutions:**
- Add more/better documents to knowledge base
- Use larger embedding model (`all-mpnet-base-v2`)
- Fine-tune for your domain (optional)
- Adjust temperature and sampling parameters

### Issue: API Key Not Working

**Check:**
- Environment variable set correctly in Render dashboard
- Header name is exactly `X-API-Key`
- Key hasn't been rotated/changed

---

## Advanced Configuration

### Use GPU for Faster Inference

1. Change Render plan to GPU-enabled
2. Update `.env`:
   ```env
   DEVICE=cuda
   ```
3. Update `requirements.txt`:
   ```
   torch==2.1.0[cu118]
   faiss-gpu==1.7.4
   ```

### Custom Domain

```bash
# In Render dashboard
Settings → Custom Domain → Add Domain
# Point DNS to Render
```

### Auto-scaling (Render Pro)

Configure in `render.yaml`:
```yaml
services:
  - autoDeploy: true
    scaling:
      minInstances: 1
      maxInstances: 3
```

---

## Summary

Your RAG system is now deployed and integrated! Here's the flow:

1. **Frontend** (Vercel) → Sends queries to **Backend API** (Render)
2. **Backend API** → Forwards to **RAG Service** (Render)
3. **RAG Service** → Retrieves documents → Generates answer
4. **Answer** → Returned to Frontend for display

The system uses the Trek Tribe-specific knowledge base plus general trekking knowledge to provide context-aware, accurate answers.

