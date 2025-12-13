# TrekTribe AI Service

Simple FastAPI service for handling chat queries in TrekTribe platform.

## Features

- Rule-based response generation
- Support ticket creation triggers
- Booking, payment, and trek information handling
- API key authentication

## Local Development

```bash
# Install dependencies
pip install -r requirements.txt

# Run service
uvicorn main:app --reload --port 8000

# Or use Python directly
python main.py
```

## Testing

```bash
# Health check
curl http://localhost:8000/health

# Generate response
curl -X POST http://localhost:8000/generate \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-secret-key" \
  -d '{"prompt": "I want to book a trek", "max_tokens": 256}'
```

## Environment Variables

- `AI_SERVICE_KEY` - API key for authentication (required in production)
- `PORT` - Port to run service on (default: 8000)

## Deployment on Render

1. Create new Web Service
2. Connect GitHub repo
3. Set root directory: `services/ai`
4. Build command: `pip install -r requirements.txt`
5. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Add environment variable: `AI_SERVICE_KEY=your-secret-key`

## Integration with Backend

Your backend should call this service at `/generate` endpoint with:
- Header: `x-api-key: your-secret-key`
- Body: `{"prompt": "user message", "max_tokens": 256}`

Backend environment variables:
```
AI_SERVICE_URL=https://trek-tribe-ai.onrender.com
AI_SERVICE_KEY=your-secret-key
```
