# Trek Tribe RAG System

## Overview

Production-ready Retrieval-Augmented Generation (RAG) system for Trek Tribe's AI-powered customer support and knowledge retrieval.

## Architecture

```
┌─────────────────────────────────────────────────┐
│              RAG System Architecture            │
├─────────────────────────────────────────────────┤
│                                                 │
│  Input Query                                    │
│      ↓                                          │
│  ┌──────────────────────┐                       │
│  │ Sentence Transformer │ (all-MiniLM-L6-v2)   │
│  │   Embedding Model    │                       │
│  └──────────────────────┘                       │
│      ↓                                          │
│  ┌──────────────────────┐                       │
│  │   FAISS Index        │ Vector similarity     │
│  │   Document Store     │ search                │
│  └──────────────────────┘                       │
│      ↓                                          │
│  Top K Documents (default: 3)                   │
│      ↓                                          │
│  ┌──────────────────────┐                       │
│  │  GPT-2 Large         │ Text generation       │
│  │  Text Generator      │                       │
│  └──────────────────────┘                       │
│      ↓                                          │
│  Generated Answer + Sources                     │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Quick Start

### Local Development

```bash
# 1. Install dependencies
cd ai-service/rag_system
pip install -r requirements.txt

# 2. Set up environment
cp .env.production .env
# Edit .env with your settings

# 3. Start the service
cd ../
python -m uvicorn rag_system.app:app --reload --port 8001

# 4. Test it
cd rag_system
python smoke_test.py
```

### Production Deployment

See [docs/COMPLETE_REPORT.md](../../docs/COMPLETE_REPORT.md) for detailed deployment instructions.

## API Endpoints

### POST /query

Main RAG endpoint for question answering.

**Request:**
```json
{
  "query": "How do I create a new trip?",
  "top_k": 3
}
```

**Response:**
```json
{
  "answer": "To create a new trip on Trek Tribe, follow these 7 steps...",
  "sources": [
    {
      "id": "trip-creation-01",
      "title": "Creating Your First Trip",
      "score": 0.92
    }
  ],
  "query": "How do I create a new trip?",
  "processing_time": 1.23
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "models_loaded": true,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

### POST /ingest

Add documents to the knowledge base (admin only).

**Request:**
```json
{
  "documents": [
    {
      "id": "doc-001",
      "title": "Document Title",
      "text": "Document content...",
      "category": "general"
    }
  ]
}
```

### GET /stats

System statistics.

**Response:**
```json
{
  "total_documents": 150,
  "index_size": "245MB",
  "queries_processed": 1523,
  "avg_response_time": 1.45
}
```

## Configuration

Environment variables (see `.env.production`):

| Variable | Default | Description |
|----------|---------|-------------|
| EMBEDDING_MODEL | all-MiniLM-L6-v2 | Sentence transformer model |
| GENERATION_MODEL | gpt2-large | Text generation model |
| DEVICE | auto | cpu, cuda, or auto |
| RAG_DATA_DIR | ./rag_data | Data storage directory |
| KNOWLEDGE_BASE_PATH | data/knowledge_base.json | JSON knowledge base |
| RAG_API_KEY | - | API authentication key |
| MAX_CONTEXT_LENGTH | 512 | Max tokens for context |
| MAX_GENERATION_LENGTH | 150 | Max tokens for answer |
| TOP_K_RESULTS | 3 | Documents to retrieve |
| TEMPERATURE | 0.7 | Generation randomness |

## Knowledge Base

### Format

JSON file with structured documents:

```json
{
  "documents": [
    {
      "id": "unique-id",
      "title": "Document Title",
      "category": "trip-creation",
      "content": "Document text...",
      "tags": ["trip", "create", "guide"],
      "url": "https://..."
    }
  ]
}
```

### Loading Knowledge

The system loads knowledge from multiple sources:

1. **Hard-coded knowledge** in `knowledge_loader.py`
   - Trip creation process
   - Booking workflows
   - Platform features
   - Equipment guides

2. **JSON knowledge base** in `data/knowledge_base.json`
   - Easily updatable documentation
   - Organizer guides
   - CRM dashboard
   - Support procedures

3. **Dynamic ingestion** via `/ingest` endpoint
   - Runtime document addition
   - API-driven updates

### Updating Knowledge

**Option 1: Edit JSON file**
```bash
# Edit data/knowledge_base.json
# Restart service
```

**Option 2: Use /ingest endpoint**
```bash
curl -X POST http://localhost:8001/ingest \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d @new_documents.json
```

## Files Structure

```
ai-service/
├── rag_system/
│   ├── __init__.py           # Package exports
│   ├── app.py               # FastAPI application (381 lines)
│   ├── core.py              # RAG implementation (370 lines)
│   ├── knowledge_loader.py  # Knowledge loading (1155 lines)
│   ├── requirements.txt     # Python dependencies
│   ├── smoke_test.py        # Automated testing
│   ├── .env                 # Local configuration
│   ├── .env.production      # Production template
│   └── data/
│       └── knowledge_base.json  # Structured knowledge
└── data/
    ├── trip_creation_guide.md  # User documentation
    └── platform_guide.md       # Platform Q&A
```

## Testing

### Automated Testing

```bash
cd rag_system
python smoke_test.py
```

Tests:
- ✓ Health check
- ✓ Trip creation query
- ✓ Requirements query
- ✓ Booking process query
- ✓ CRM dashboard query

### Manual Testing

```bash
# Test health
curl http://localhost:8001/health

# Test query
curl -X POST http://localhost:8001/query \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-key" \
  -d '{"query": "How do I create a trip?", "top_k": 3}'
```

## Performance

### Benchmarks

| Metric | Value | Notes |
|--------|-------|-------|
| First Query | 2-5s | Model loading |
| Subsequent Queries | 1-2s | Models cached |
| Memory (distilgpt2) | ~1GB | Smaller model |
| Memory (gpt2-large) | ~2GB | Better quality |
| Cold Start | 30-60s | Free tier only |

### Optimization

**For faster responses:**
1. Use `distilgpt2` instead of `gpt2-large`
2. Reduce `MAX_GENERATION_LENGTH` to 100
3. Keep service warm with health check pings

**For better quality:**
1. Use `gpt2-large` or `gpt2-xl`
2. Increase `TOP_K_RESULTS` to 5
3. Increase `MAX_CONTEXT_LENGTH` to 768

## Troubleshooting

### Service Won't Start

**Error:** `No module named 'torch'`
```bash
pip install torch transformers sentence-transformers faiss-cpu
```

**Error:** Out of memory
```bash
# Use smaller model
export GENERATION_MODEL=distilgpt2
```

### Slow Responses

**Solution 1:** Use smaller model
```bash
export GENERATION_MODEL=distilgpt2
```

**Solution 2:** Reduce generation length
```bash
export MAX_GENERATION_LENGTH=100
```

### Poor Answer Quality

**Solution 1:** Increase context
```bash
export TOP_K_RESULTS=5
export MAX_CONTEXT_LENGTH=768
```

**Solution 2:** Use larger model
```bash
export GENERATION_MODEL=gpt2-large
```

## Development

### Adding New Features

1. **Add new endpoint** in `app.py`
2. **Update core logic** in `core.py`
3. **Add tests** in `smoke_test.py`
4. **Update documentation**

### Code Quality

```bash
# Format code
black rag_system/

# Type checking
mypy rag_system/

# Linting
pylint rag_system/
```

## Security

- API key authentication required
- CORS configured for backend domain
- Rate limiting recommended
- HTTPS required in production
- Secrets in environment variables

## Monitoring

### Health Checks

```bash
# Local
curl http://localhost:8001/health

# Production
curl https://trek-tribe-ai-service.onrender.com/health
```

### Logs

```bash
# View logs (Render)
render logs -s trek-tribe-ai-service

# View logs (local)
tail -f rag_system.log
```

## Support

- **Documentation:** [docs/COMPLETE_REPORT.md](../../docs/COMPLETE_REPORT.md)
- **Deployment:** [docs/RAG_DEPLOYMENT.md](../../docs/RAG_DEPLOYMENT.md)
- **Issues:** GitHub Issues
- **Questions:** Team Slack channel

## License

Proprietary - Trek Tribe Platform

---

**Version:** 1.0.0  
**Last Updated:** 2024  
**Maintained by:** Trek Tribe Dev Team
