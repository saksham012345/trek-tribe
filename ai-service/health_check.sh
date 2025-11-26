#!/usr/bin/env bash
# Simple health check for the AI service
URL=${1:-http://localhost:8000}
API_KEY=${AI_SERVICE_KEY:-dev-ai-key-123}

echo "Checking health..."
curl -sS "$URL/health" || exit 1
echo
echo "Checking ready..."
curl -sS "$URL/ready" || exit 1
echo
echo "Testing simple generate (no model required)..."
curl -sS -X POST "$URL/generate" \
  -H "Content-Type: application/json" \
  -H "x-api-key: $API_KEY" \
  -d '{"prompt":"Hello, what is Trek-Tribe?","max_tokens":40}' || exit 1
echo
echo "Health check done."
