# Hybrid AI Service Implementation Plan

## Overview
Integrating Python microservice as an optional enhancement layer in the existing AI chat flow, with graceful fallback to current local service.

## Work Breakdown

### Phase 1: Core Integration (2-3 hours)

#### 1.1 Add Python Service Helper Method
**File**: `services/api/src/routes/ai.ts`  
**Time**: 30-45 minutes

**What to do:**
- Add a private method `callPythonService(prompt: string, context?: any)` in `TrekTribeAI` class
- Use existing `aiProxy.ts` logic (already has `AI_SERVICE_URL` and `AI_SERVICE_KEY`)
- Build enriched prompt with conversation context
- Handle timeout (120s) and errors gracefully
- Normalize response format to match local service structure

**Code changes needed:**
```typescript
private async callPythonService(prompt: string, context?: any): Promise<any> {
  const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || '').replace(/\/$/, '');
  const AI_SERVICE_KEY = process.env.AI_SERVICE_KEY || '';
  
  // Skip if not configured
  if (!AI_SERVICE_URL || !AI_SERVICE_KEY) {
    return null;
  }
  
  // Build enriched prompt with context
  const enrichedPrompt = this.buildEnrichedPrompt(prompt, context);
  
  try {
    const resp = await axios.post(
      `${AI_SERVICE_URL}/generate`,
      { 
        prompt: enrichedPrompt, 
        max_tokens: 600,
        top_k: 50 
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': AI_SERVICE_KEY,
        },
        timeout: 120000, // 120s timeout
      }
    );
    
    // Normalize response
    const data = resp.data || {};
    const text = typeof data.text === 'string' ? data.text : JSON.stringify(data);
    
    return {
      response: text.trim(),
      source: 'python_microservice',
      confidence: 'medium'
    };
  } catch (error: any) {
    console.warn('⚠️ Python service unavailable, using fallback:', error?.message);
    return null; // Return null to trigger fallback
  }
}

private buildEnrichedPrompt(message: string, context?: any): string {
  // Build context-aware prompt
  let prompt = message;
  
  if (context?.conversationHistory && context.conversationHistory.length > 0) {
    const recentHistory = context.conversationHistory.slice(-3).map((msg: any) => 
      `${msg.role}: ${msg.content}`
    ).join('\n');
    prompt = `Previous conversation:\n${recentHistory}\n\nCurrent question: ${message}`;
  }
  
  if (context?.currentTrip) {
    prompt += `\n\nContext: User is asking about "${context.currentTrip}" trip.`;
  }
  
  return prompt;
}
```

#### 1.2 Integrate into General Query Flow
**File**: `services/api/src/routes/ai.ts`  
**Method**: `generateGeneralChatResponse()`  
**Time**: 30-45 minutes

**What to do:**
- Insert Python service call between OpenAI attempt and knowledge base fallback
- Only call Python service for general queries (not trek-specific)
- Maintain existing fallback chain

**Code changes needed:**
```typescript
private async generateGeneralChatResponse(message: string, context?: any) {
  const apiKey = process.env.OPENAI_API_KEY;
  
  // Try OpenAI first (if available)
  if (apiKey) {
    try {
      const client = new OpenAI({ apiKey });
      const resp = await client.chat.completions.create({
        model: process.env.GENERAL_AI_MODEL || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: message }
        ],
        max_tokens: 600
      });
      
      const text = resp.choices?.[0]?.message?.content || '';
      return {
        response: text.trim(),
        suggestions: ['Tell me more', 'Ask another question'],
        requiresHumanAgent: false,
        source: 'openai'
      };
    } catch (error: any) {
      console.warn('⚠️ OpenAI error:', error?.message);
      // Fall through to Python service or fallback
    }
  }
  
  // NEW: Try Python microservice (hybrid enhancement)
  const pythonResponse = await this.callPythonService(message, context);
  if (pythonResponse) {
    return {
      ...pythonResponse,
      suggestions: ['Tell me more', 'Ask another question', 'Find trips'],
      requiresHumanAgent: false
    };
  }
  
  // Existing fallback chain (knowledge base + general knowledge)
  // ... rest of existing code remains unchanged
}
```

#### 1.3 Optional: Enhance RAG Responses with Python
**File**: `services/api/src/routes/ai.ts`  
**Method**: `generateRagResponse()`  
**Time**: 45-60 minutes (optional)

**What to do:**
- After building context from knowledge base, optionally enhance with Python service
- Use Python service to generate more natural responses from retrieved context
- This is more complex and may not be necessary

**Decision needed**: Do we want Python to enhance trek-specific RAG responses too?

### Phase 2: Testing & Error Handling (1-2 hours)

#### 2.1 Add Error Handling & Logging
**Time**: 30-45 minutes

**What to do:**
- Add structured logging for Python service calls
- Track success/failure rates
- Add metrics (response time, availability)
- Ensure errors don't break existing flow

#### 2.2 Test Scenarios
**Time**: 45-60 minutes

**Test cases:**
1. ✅ Python service available → uses Python, falls back on error
2. ✅ Python service unavailable → uses existing fallback chain
3. ✅ Python service timeout → gracefully falls back
4. ✅ Conversation context properly passed to Python
5. ✅ Response format matches expected structure
6. ✅ No regression in existing functionality

### Phase 3: Configuration & Documentation (30-60 minutes)

#### 3.1 Environment Variables
**Already configured:**
- `AI_SERVICE_URL` - Python service URL
- `AI_SERVICE_KEY` - API key for authentication

**No additional config needed** ✅

#### 3.2 Documentation
**Time**: 30 minutes

**What to document:**
- How hybrid approach works
- When Python service is called vs local
- How to enable/disable Python service
- Fallback behavior

## Total Estimated Time: **4-6 hours**

### Breakdown:
- **Core Integration**: 2-3 hours
- **Testing & Error Handling**: 1-2 hours
- **Documentation**: 30-60 minutes

## Complexity Assessment

### Low Complexity ✅
- Python service proxy already exists (`aiProxy.ts`)
- Environment variables already configured
- Clear insertion point in existing flow
- Existing fallback chain makes it safe

### Medium Complexity ⚠️
- Need to normalize response formats
- Context enrichment for prompts
- Error handling and timeouts

### High Complexity ❌
- None - this is a straightforward enhancement

## Risk Assessment

### Low Risk ✅
- **Graceful degradation**: If Python service fails, existing fallback works
- **No breaking changes**: All existing functionality preserved
- **Optional feature**: Can be disabled via environment variables
- **Backward compatible**: Works even if `AI_SERVICE_URL` not set

### Medium Risk ⚠️
- **Response format differences**: Python service response format may need normalization
- **Latency**: Additional HTTP call adds ~200-500ms (with timeout protection)

### High Risk ❌
- None identified

## Implementation Strategy

### Option A: Minimal Integration (Recommended)
**Time**: 2-3 hours

**Scope:**
- Add Python service call only in `generateGeneralChatResponse()` (general queries)
- Simple prompt building (just message + minimal context)
- Quick fallback to existing chain

**Best for**: Quick implementation with minimal risk

### Option B: Enhanced Integration
**Time**: 4-6 hours

**Scope:**
- Python service in general queries
- Optionally in RAG responses too
- Rich context building with conversation history
- Enhanced prompt engineering

**Best for**: Maximum benefit from Python service (if fine-tuned models are available)

### Option C: Full Integration
**Time**: 6-8 hours

**Scope:**
- All of Option B
- Custom prompt templates
- Response quality scoring
- A/B testing infrastructure

**Best for**: Production-grade deployment with monitoring

## Recommended Approach

### **Start with Option A (Minimal Integration)**

**Why:**
1. ✅ Lowest risk
2. ✅ Fastest to implement
3. ✅ Easy to test
4. ✅ Can enhance later if needed

**Implementation Steps:**
1. Add `callPythonService()` method (30 min)
2. Add `buildEnrichedPrompt()` method (15 min)
3. Integrate into `generateGeneralChatResponse()` (30 min)
4. Test with/without Python service (45 min)
5. Document and deploy (30 min)

**Total**: ~2.5 hours

## Dependencies

### Already Satisfied ✅
- ✅ Python service proxy exists
- ✅ Environment variables configured
- ✅ Axios available for HTTP calls
- ✅ Error handling patterns established

### Needs Verification ⚠️
- ⚠️ Python service is running and accessible
- ⚠️ `AI_SERVICE_URL` points to correct endpoint
- ⚠️ `AI_SERVICE_KEY` is valid

## Success Criteria

### Must Have ✅
- Python service called for general queries (when available)
- Graceful fallback if Python service unavailable
- No regression in existing functionality
- Response format matches expected structure

### Nice to Have ⚠️
- Enhanced RAG responses with Python
- Response quality improvements
- Metrics and monitoring

### Future Enhancements 🔮
- Fine-tune Python models on TrekTribe data
- A/B testing between services
- Quality scoring and routing

## Next Steps

1. **Verify Python service is running**
   ```bash
   curl -X POST http://localhost:8000/health \
     -H "x-api-key: YOUR_KEY"
   ```

2. **Test Python service response format**
   ```bash
   curl -X POST http://localhost:8000/generate \
     -H "Content-Type: application/json" \
     -H "x-api-key: YOUR_KEY" \
     -d '{"prompt": "Hello", "max_tokens": 50}'
   ```

3. **Implement Option A (Minimal Integration)**
   - Follow steps above
   - Test thoroughly
   - Deploy to staging

4. **Monitor and iterate**
   - Check response quality
   - Measure latency
   - Adjust as needed

## Conclusion

**Effort Level**: ⭐⭐☆☆☆ (Low-Medium)
- **Quick win**: Can be done in 2-3 hours
- **Low risk**: Graceful fallback protects existing functionality
- **High value**: Adds optional enhancement without breaking anything

**Recommendation**: Start with **Option A (Minimal Integration)** - it's quick, safe, and provides immediate value. Can enhance later if Python service proves valuable.

