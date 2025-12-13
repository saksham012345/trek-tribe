from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os

app = FastAPI(title="TrekTribe AI Service", version="1.0.0")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("BACKEND_URL", "http://localhost:5000"),
        os.getenv("FRONTEND_URL", "http://localhost:3000")
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API key for authentication between backend and AI service
AI_SERVICE_KEY = os.getenv("AI_SERVICE_KEY", "change-me-in-production-12345")

class GenerateRequest(BaseModel):
    prompt: str
    max_tokens: int = 256
    top_k: int = 50

class GenerateResponse(BaseModel):
    text: str
    actions: list = []
    retrieved_sources: list = []

@app.get("/")
async def root():
    return {
        "service": "TrekTribe AI Service",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "trek-tribe-ai"
    }

@app.post("/generate", response_model=GenerateResponse)
async def generate(request: GenerateRequest, x_api_key: str = Header(None)):
    """
    Generate AI response based on user prompt.
    Uses rule-based logic for common trek/booking queries.
    """
    # Validate API key
    if x_api_key != AI_SERVICE_KEY:
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing API key. Set x-api-key header."
        )
    
    # Convert to lowercase for matching
    prompt_lower = request.prompt.lower()
    
    # Rule-based response logic
    text = ""
    actions = []
    
    # Booking related queries
    if any(word in prompt_lower for word in ["booking", "book", "reserve", "reservation"]):
        text = (
            "I can help you with bookings! Please tell me:\n"
            "• Which trek you're interested in\n"
            "• Your preferred dates\n"
            "• Number of participants\n\n"
            "I'll check availability and guide you through the booking process."
        )
    
    # Payment and refund queries
    elif any(word in prompt_lower for word in ["payment", "refund", "money", "charge", "paid"]):
        text = (
            "For payment-related queries, please provide:\n"
            "• Your booking ID or transaction reference\n"
            "• The issue you're experiencing\n\n"
            "I'll help verify your payment status and guide you through refunds if needed."
        )
        actions.append({
            "create_ticket": True,
            "ticket_summary": f"Payment inquiry: {request.prompt[:80]}"
        })
    
    # Cancellation queries
    elif any(word in prompt_lower for word in ["cancel", "cancellation", "refund policy"]):
        text = (
            "To help with cancellation:\n"
            "• Please share your booking ID\n"
            "• I'll check the cancellation policy for your trip\n"
            "• Guide you through the cancellation process\n\n"
            "Note: Cancellation charges may apply based on timing."
        )
    
    # Trip details and information
    elif any(word in prompt_lower for word in ["trek", "trip", "destination", "itinerary", "details"]):
        text = (
            "I can provide trek details! Which specific information do you need?\n"
            "• Itinerary and schedule\n"
            "• Difficulty level and requirements\n"
            "• Included/excluded items\n"
            "• Weather and best time to visit\n"
            "• Gear and packing list"
        )
    
    # Support and help queries
    elif any(word in prompt_lower for word in ["support", "help", "ticket", "issue", "problem"]):
        text = (
            "I'm creating a support ticket for you. An agent will review your query "
            "and get back to you within 24 hours.\n\n"
            "In the meantime, is there anything else I can help clarify?"
        )
        actions.append({
            "create_ticket": True,
            "ticket_summary": f"Support request: {request.prompt[:100]}"
        })
    
    # Contact and communication
    elif any(word in prompt_lower for word in ["contact", "phone", "email", "reach", "organizer"]):
        text = (
            "You can reach us through:\n"
            "• Support tickets (I can create one for you)\n"
            "• Email: support@trektribe.in\n"
            "• Phone: Available in your booking confirmation\n\n"
            "For specific trek organizer contact, please share your booking ID."
        )
    
    # Preparation and packing
    elif any(word in prompt_lower for word in ["prepare", "pack", "gear", "equipment", "what to bring"]):
        text = (
            "Great question about preparation! For most treks, you'll need:\n"
            "✓ Comfortable trekking shoes\n"
            "✓ Layered clothing (thermal + fleece + jacket)\n"
            "✓ Personal medical kit\n"
            "✓ Water bottle and snacks\n"
            "✓ Valid ID proof\n\n"
            "Each trek has a specific gear list - which trek are you planning?"
        )
    
    # Weather and conditions
    elif any(word in prompt_lower for word in ["weather", "temperature", "climate", "season", "rain"]):
        text = (
            "Weather information varies by destination and season. "
            "Which trek location are you asking about?\n\n"
            "I can provide:\n"
            "• Best time to visit\n"
            "• Expected temperature ranges\n"
            "• Rainfall patterns\n"
            "• What to pack for the conditions"
        )
    
    # Generic fallback
    else:
        text = (
            f"I understand you're asking about: '{request.prompt[:100]}'\n\n"
            "I'm here to help with:\n"
            "• Trip bookings and availability\n"
            "• Payment and refund queries\n"
            "• Cancellation policies\n"
            "• Trek details and preparation\n"
            "• General support\n\n"
            "How can I assist you with your trek planning today?"
        )
    
    return GenerateResponse(
        text=text,
        actions=actions,
        retrieved_sources=[]
    )

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
