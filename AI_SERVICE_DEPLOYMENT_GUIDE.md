# AI Service Deployment Guide for TrekTribe

## Current Situation

Your TrekTribe backend on Render currently calls an **external AI service** that doesn't exist. The AI chat widget will show fallback responses when this service is unavailable.

## Option 1: Deploy Free AI Service on Render (RECOMMENDED for you)

Since you don't want external dependencies, deploy a simple AI service alongside your backend.

### Step 1: Create AI Service in Your Repo

Create `services/ai/main.py`:

```python
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
import os

app = FastAPI()

# Simple API key check (set in Render env)
AI_SERVICE_KEY = os.getenv("AI_SERVICE_KEY", "your-secret-key-12345")

class GenerateRequest(BaseModel):
    prompt: str
    max_tokens: int = 256
    top_k: int = 50

@app.post("/generate")
async def generate(request: GenerateRequest, x_api_key: str = Header(None)):
    # Validate API key
    if x_api_key != AI_SERVICE_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    # Simple rule-based responses (no external AI needed)
    prompt_lower = request.prompt.lower()
    
    if "booking" in prompt_lower or "book" in prompt_lower:
        text = "I can help you with bookings! Please tell me which trip you're interested in, and I'll check availability and guide you through the booking process."
        actions = []
    elif "payment" in prompt_lower or "refund" in prompt_lower:
        text = "For payment issues, please share your booking ID or transaction reference. I'll help verify the payment status and guide you through refunds if needed."
        actions = [{"create_ticket": True, "ticket_summary": "Payment/Refund inquiry"}]
    elif "cancel" in prompt_lower:
        text = "To cancel a booking, I'll need your booking ID. I can then check the cancellation policy and process your request."
        actions = []
    elif "support" in prompt_lower or "help" in prompt_lower or "ticket" in prompt_lower:
        text = "I've created a support ticket for you. An agent will review your query and get back to you within 24 hours."
        actions = [{"create_ticket": True, "ticket_summary": f"Support request: {request.prompt[:100]}"}]
    else:
        text = f"I understand you're asking about: '{request.prompt[:100]}'. How can I assist you with your trek booking or trip planning today?"
        actions = []
    
    return {
        "text": text,
        "actions": actions,
        "retrieved_sources": []
    }

@app.get("/health")
async def health():
    return {"status": "ok", "service": "trek-tribe-ai"}
```

### Step 2: Add Requirements File

Create `services/ai/requirements.txt`:

```
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
```

### Step 3: Deploy on Render (Free Tier)

1. **Go to Render Dashboard** → New → Web Service
2. **Connect your GitHub repo**
3. **Settings:**
   - Name: `trek-tribe-ai`
   - Root Directory: `services/ai`
   - Runtime: `Python 3`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. **Environment Variables:**
   - `AI_SERVICE_KEY` = `your-secret-key-12345` (any random string)
5. **Deploy** (Free tier is fine)

### Step 4: Configure Your Backend

Add to your Render backend environment variables:

```bash
AI_SERVICE_URL=https://trek-tribe-ai.onrender.com
AI_SERVICE_KEY=your-secret-key-12345  # Same as above
```

## Option 2: Use OpenAI API (Costs ~$0.01 per 100 messages)

If you want smarter responses, use OpenAI:

### Update `services/ai/main.py`:

```python
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel
import os
import openai

app = FastAPI()
openai.api_key = os.getenv("OPENAI_API_KEY")
AI_SERVICE_KEY = os.getenv("AI_SERVICE_KEY", "your-secret-key-12345")

class GenerateRequest(BaseModel):
    prompt: str
    max_tokens: int = 256

@app.post("/generate")
async def generate(request: GenerateRequest, x_api_key: str = Header(None)):
    if x_api_key != AI_SERVICE_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    try:
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful assistant for TrekTribe, a trek booking platform. Help users with bookings, payments, cancellations, and general queries."},
                {"role": "user", "content": request.prompt}
            ],
            max_tokens=request.max_tokens,
            temperature=0.7
        )
        
        text = response.choices[0].message.content
        
        # Check if ticket should be created
        actions = []
        if "ticket" in text.lower() or "support" in request.prompt.lower():
            actions.append({"create_ticket": True, "ticket_summary": request.prompt[:100]})
        
        return {
            "text": text,
            "actions": actions,
            "retrieved_sources": []
        }
    except Exception as e:
        return {
            "text": "I'm having trouble processing your request right now. Please try again or contact support.",
            "actions": [],
            "retrieved_sources": []
        }
```

Add to `requirements.txt`:
```
openai==1.3.0
```

Add environment variable:
```bash
OPENAI_API_KEY=sk-...your-key...
```

## Option 3: Disable AI Service (Use Fallback Only)

If you don't want to deploy AI at all, the chat widget already has built-in fallback responses. Just leave `AI_SERVICE_URL` empty or remove it from env variables.

The fallback in `AIChatWidgetClean.tsx` already handles:
- Booking inquiries
- Payment/refund help
- Cancellation guidance
- Generic support

## What is `AI_SERVICE_KEY`?

It's just a **password** between your backend and AI service to prevent unauthorized access. You can set it to any random string like:

```
AI_SERVICE_KEY=trektribe-ai-secret-2025-xyz123
```

Set the **same value** in:
1. Your AI service environment (Render)
2. Your backend environment (Render)

## Summary for Your Setup

**Since you're on Render and don't want external services:**

1. **Create simple AI service** (Option 1 above) - FREE on Render
2. **Deploy it as second web service** on Render
3. **Connect backend to AI service** via environment variables
4. **Total cost: $0** (both on free tier)

Or just **skip AI deployment** and use the built-in fallback responses (already working in your widget).

## Testing Locally

```bash
# Terminal 1 - Run AI service
cd services/ai
pip install -r requirements.txt
uvicorn main:app --port 8000

# Terminal 2 - Run your backend
cd services/api
export AI_SERVICE_URL=http://localhost:8000
export AI_SERVICE_KEY=your-secret-key-12345
npm run dev
```

Then test the chat widget in your frontend!
