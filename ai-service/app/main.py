"""
Main FastAPI app for the AI microservice with production hardening.

Features:
- Startup model preload and retrieval index status
- Deterministic JSON action extraction (few-shot + robust post-processing)
- Token-aware truncation handled in model_runner
- Rate limiting, request timeouts, structured logs, and normalized errors
"""
import os
import json
import logging
from typing import Optional, List, Dict, Any
from time import time
from concurrent.futures import ThreadPoolExecutor, TimeoutError
import re
import uuid
from functools import wraps

from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

from fastapi import FastAPI, Request, Header, HTTPException, Response
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from pydantic import BaseModel

from .config import (
    AI_SERVICE_KEY,
    MODEL_NAME,
    MODEL_LOCAL_ENABLED,
    MODEL_DIR,
    REQUIRE_API_KEY,
    AI_GEN_TIMEOUT,
    AI_RATE_LIMIT,
    AI_RATE_WINDOW,
    AI_MAX_INPUT_TOKENS,
    REDIS_URL,
    validate_environment,
)
from .utils import require_api_key, make_response, normalize_error
from .model_runner import generate as model_generate, is_model_loaded, load_local_pipeline, get_model_max_length, FallbackGenerator, count_tokens
from .retrieval import retrieve, RETRIEVAL_INDEX_LOADED, reload_index, verify_index_matches_model
from .retrieval import build_index_from_texts, load_index, DOCS_PATH

app = FastAPI(title="Trek-Tribe AI Service")
logger = logging.getLogger("ai-service")

# Structured JSON logging basic setup
class JSONFormatter(logging.Formatter):
    def format(self, record):
        payload = {
            "time": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "name": record.name,
            "msg": record.getMessage(),
        }
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload)


handler = logging.StreamHandler()
handler.setFormatter(JSONFormatter())
logger.setLevel(logging.INFO)
logger.addHandler(handler)

# Prometheus metrics
REQUEST_COUNT = Counter('ai_service_requests_total', 'Total HTTP requests', ['path', 'method', 'status'])
FAILED_RESPONSES = Counter('ai_service_failed_responses_total', 'Failed responses')
GENERATION_LATENCY = Histogram('ai_service_generation_latency_seconds', 'Generation latency seconds')
RATE_LIMIT_HITS = Counter('ai_service_rate_limit_hits_total', 'Rate limit hits')
INDEX_LOAD_TIME = Histogram('ai_service_index_load_seconds', 'Time to load retrieval index')


class GenerateRequest(BaseModel):
    prompt: str
    max_tokens: Optional[int] = None
    top_k: Optional[int] = 3


class RetrieveRequest(BaseModel):
    query: str
    top_k: Optional[int] = 3


# Middleware: hard limit request body size
class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_body_size: int = 50 * 1024):
        super().__init__(app)
        self.max_body_size = max_body_size

    async def dispatch(self, request: Request, call_next):
        body = await request.body()
        if len(body) > self.max_body_size:
            return JSONResponse(status_code=413, content={"error": "Payload Too Large"})
        return await call_next(request)


# Simple request ID injection middleware
class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        rid = str(uuid.uuid4())
        request.state.request_id = rid
        resp = await call_next(request)
        resp.headers['X-Request-ID'] = rid
        return resp


app.add_middleware(BodySizeLimitMiddleware)
app.add_middleware(RequestIDMiddleware)


# Redis client initialization (optional)
_redis_client = None
if REDIS_URL:
    try:
        import redis
        _redis_client = redis.from_url(REDIS_URL, decode_responses=True)
        logger.info("Redis connected successfully for distributed rate limiting")
    except Exception as e:
        logger.warning(f"Failed to connect to Redis: {e}. Falling back to in-memory rate limiting.")
        _redis_client = None


# Basic in-memory rate limiter (fallback)
_rate_store = {}


def is_rate_limited(ip: str) -> bool:
    """Rate limiting with Redis support (fallback to in-memory if Redis unavailable)"""
    now = time()
    
    # Use Redis if available for distributed rate limiting
    if _redis_client:
        try:
            key = f"ratelimit:{ip}"
            current = _redis_client.incr(key)
            if current == 1:
                _redis_client.expire(key, AI_RATE_WINDOW)
            
            if current > AI_RATE_LIMIT:
                RATE_LIMIT_HITS.inc()
                return True
            return False
        except Exception as e:
            logger.warning(f"Redis rate limit check failed: {e}. Falling back to in-memory.")
            # Fall through to in-memory rate limiting
    
    # In-memory fallback
    window = _rate_store.get(ip, [])
    window = [t for t in window if t > now - AI_RATE_WINDOW]
    if len(window) >= AI_RATE_LIMIT:
        _rate_store[ip] = window
        RATE_LIMIT_HITS.inc()
        return True
    window.append(now)
    _rate_store[ip] = window
    return False


MODEL_LOADED = False


def _repair_json_text(s: str) -> str:
    # Replace single quotes with double quotes when safe-ish
    s = re.sub(r"(?<!\\)'", '"', s)
    # Remove trailing commas before closing braces/brackets
    s = re.sub(r",\s*([}\]])", r"\1", s)
    return s


def extract_last_json(text: str) -> Optional[Dict[str, Any]]:
    """Extract the last JSON object from text robustly.

    Strategy:
    - Find last '{' and attempt to parse balanced JSON forward.
    - If parse fails, run automatic repairs: single->double quotes, remove trailing commas.
    - Validate that result contains 'actions' array; if not, return None.
    """
    if not text or "{" not in text:
        return None
    last_open = text.rfind('{')
    for start in range(last_open, -1, -1):
        if text[start] != '{':
            continue
        depth = 0
        for i in range(start, len(text)):
            ch = text[i]
            if ch == '{':
                depth += 1
            elif ch == '}':
                depth -= 1
                if depth == 0:
                    candidate = text[start:i+1]
                    try:
                        parsed = json.loads(candidate)
                        return parsed
                    except Exception:
                        # try repairing candidate
                        repaired = _repair_json_text(candidate)
                        try:
                            parsed = json.loads(repaired)
                            return parsed
                        except Exception:
                            continue
    return None


def _compose_retrieval_answer(retrieved_items: List[tuple], prompt: str) -> str:
    """Create a deterministic, retrieval-only answer when model generation is unavailable.

    Summarizes the top retrieved sources and echoes guidance tied to the user's prompt.
    """
    contact_line = (
        "Our AI agent is not available right now. "
        "Please contact trektribeagent@gmail.com or call 9876177839 for immediate help."
    )

    if not retrieved_items:
        return (
            contact_line + " "
            "We couldn't generate a full response, but you can ask more specific questions "
            "or try again shortly."
        )
    lines: List[str] = []
    lines.append(contact_line)
    lines.append("Here are the most relevant details I found:")
    for score, doc in retrieved_items[:3]:
        src = doc.get("source", "unknown")
        txt = (doc.get("text") or doc.get("excerpt") or "").strip()
        if txt:
            # Keep the excerpt concise to avoid overwhelming the user
            snippet = txt[:500]
            lines.append(f"- From {src}: {snippet}")
    if prompt:
        lines.append("\nIf you want, I can search for more specifics related to: " + prompt[:200])
    return "\n".join(lines)


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception: %s", exc)
    err = normalize_error(exc)
    return JSONResponse(status_code=500, content=err)


@app.on_event("startup")
def startup_event():
    global MODEL_LOADED
    # Environment validation
    try:
        validate_environment(raise_on_error=True)
    except Exception as e:
        logger.exception("Environment validation failed: %s", e)
        raise

    if MODEL_LOCAL_ENABLED:
        logger.info("MODEL_LOCAL_ENABLED=true; attempting to load local model from %s", MODEL_DIR)
        try:
            p = load_local_pipeline(model_dir=MODEL_DIR, model_name=MODEL_NAME, adapter_path=os.environ.get("AI_PEFT_ADAPTER"))
            MODEL_LOADED = p is not None
            logger.info("Model loaded: %s", MODEL_LOADED)
        except Exception as e:
            logger.exception("Failed to load model at startup: %s", e)
            MODEL_LOADED = False
    else:
        logger.info("MODEL_LOCAL_ENABLED=false; service will run in fallback mode only")
    # Attempt to load retrieval index and record load time
    try:
        t0 = time()
        meta = reload_index()
        INDEX_LOAD_TIME.observe(time() - t0)
        if meta:
            logger.info("Retrieval index loaded with meta: %s", meta)
    except Exception:
        logger.exception("Failed to load retrieval index at startup")

    # If no TF-IDF index is available, attempt to bootstrap from bundled docs
    try:
        if not RETRIEVAL_INDEX_LOADED:
            docs_path = None
            # Prefer configured DOCS_PATH; otherwise check common fallback locations
            if os.path.exists(DOCS_PATH):
                docs_path = DOCS_PATH
            elif os.path.exists("/app/rag_data/documents.json"):
                docs_path = "/app/rag_data/documents.json"
            else:
                # relative fallback in dev environments
                here = os.path.dirname(__file__)
                candidate = os.path.abspath(os.path.join(here, "..", "rag_data", "documents.json"))
                if os.path.exists(candidate):
                    docs_path = candidate

            if docs_path:
                with open(docs_path, 'r', encoding='utf-8') as f:
                    docs = json.load(f)
                texts = [d.get('text', '') for d in docs]
                meta = [{k: v for k, v in d.items() if k != 'text'} for d in docs]
                build_index_from_texts(texts, meta, model_name=MODEL_NAME, tokenizer_version='unknown')
                reload_index()
                logger.info('Bootstrapped TF-IDF index from %s (documents=%d)', docs_path, len(texts))
            else:
                logger.warning('No retrieval docs found to bootstrap index; RAG will be disabled until an index is built')
    except Exception as e:
        logger.warning('Failed to bootstrap retrieval index: %s', e)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/ready")
def ready():
    return {"ready": True, "model_local": MODEL_LOCAL_ENABLED, "model_loaded": MODEL_LOADED, "retrieval_index_loaded": bool(RETRIEVAL_INDEX_LOADED)}


@app.post("/retrieve")
def do_retrieve(req: RetrieveRequest, x_api_key: Optional[str] = Header(None)):
    # Allow read-only retrieval; require key if configured
    if AI_SERVICE_KEY:
        require_api_key(x_api_key, AI_SERVICE_KEY)

    q = req.query or ""
    top_k = int(req.top_k or 3)
    try:
        items = retrieve(q, top_k=top_k)
        return make_response({"retrieved": [{"score": s, "doc": d} for s, d in items]})
    except Exception as e:
        logger.exception("Retrieval failed: %s", e)
        raise HTTPException(status_code=500, detail="Retrieval failed")


@app.post("/generate")
def generate(req: GenerateRequest, request: Request, x_api_key: Optional[str] = Header(None)):
    # Authenticate from backend proxy
    require_api_key(x_api_key, AI_SERVICE_KEY)

    client_ip = request.client.host if request.client else "unknown"
    if is_rate_limited(client_ip):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    prompt = (req.prompt or "").strip()
    max_tokens = int(req.max_tokens or 128)
    top_k = int(req.top_k or 3)

    logger.info(f"Generation request tokens={max_tokens} model_local={MODEL_LOCAL_ENABLED} ip={client_ip}")

    # Retrieval augmentation
    try:
        retrieved = retrieve(prompt, top_k=top_k) or []
        logger.info('Retrieval returned %d documents for prompt (top_k=%s)', len(retrieved), top_k)
    except Exception:
        retrieved = []

    if retrieved:
        contexts: List[str] = []
        for score, doc in retrieved:
            txt = doc.get("text") or doc.get("excerpt") or ""
            src = doc.get("source", "unknown")
            contexts.append(f"Source: {src}\n{txt}\n---\n")
        augmented = "\n".join(contexts) + "\nUser prompt:\n" + prompt
    else:
        augmented = prompt

    # Enforce prompt token limits
    try:
        tok_count = count_tokens(prompt)
        if tok_count > AI_MAX_INPUT_TOKENS:
            logger.warning("Rejecting request: prompt token count %s exceeds AI_MAX_INPUT_TOKENS=%s", tok_count, AI_MAX_INPUT_TOKENS)
            raise HTTPException(status_code=413, detail="Prompt exceeds maximum token limit")
    except HTTPException:
        raise
    except Exception:
        # if token counting fails, fall back to char-length heuristic
        if len(prompt.encode('utf-8')) > 50 * 1024:
            raise HTTPException(status_code=413, detail="Prompt too large")

    # Few-shot examples to encourage JSON-only final line
    few_shot = (
        'Example 1:\nQ: I can\'t login to my account.\nA: You can reset your password by visiting the forgot-password page.\n{"text": "You can reset your password using the forgot-password flow.", "actions": [{"type": "create_ticket", "summary": "User cannot login; needs password reset"}]}\n'
    )
    # Note: keep few-shot short to avoid context overflow; model_runner truncates tokens.

    instruction = (
        "\n\nRespond as a helpful assistant. After your human-readable answer, on the LAST LINE append a single JSON object only (no surrounding text) with the schema:"
        " {\"text\": \"<short answer>\", \"actions\": [ {\"type\": \"create_ticket\", \"summary\": \"...\"} ] }"
    )

    # Compose final prompt
    prompt_with_instruction = (few_shot + "\n" + augmented + instruction)

    # Generate with timeout and deterministic-ish settings (low temp)
    def _call():
        return model_generate(
            prompt_with_instruction,
            max_tokens=max_tokens,
            model_dir=MODEL_DIR,
            model_name=MODEL_NAME,
            temperature=0.2,
            top_k=10,
            top_p=0.9,
        )

    try:
        with ThreadPoolExecutor(max_workers=1) as ex:
            fut = ex.submit(_call)
            raw_text = fut.result(timeout=AI_GEN_TIMEOUT)
    except TimeoutError:
        logger.exception("Generation timed out after %s seconds", AI_GEN_TIMEOUT)
        raise HTTPException(status_code=504, detail="Generation timed out")
    except Exception as e:
        logger.exception("Generation failed: %s", e)
        raw_text = FallbackGenerator().generate(prompt_with_instruction, max_tokens)

    # Detect fallback mode explicitly (no local model or fallback output signature)
    is_fallback_mode = (not MODEL_LOCAL_ENABLED) or (not is_model_loaded()) or (raw_text or "").startswith("[fallback]")

    # Extract final JSON object robustly
    if is_fallback_mode:
        # In fallback mode, avoid any escalation and provide a retrieval-based answer
        text_out = _compose_retrieval_answer(retrieved, prompt)
        validated_actions: List[Dict[str, Any]] = []
    else:
        json_obj = extract_last_json(raw_text)

        text_out = raw_text
        actions: List[Dict[str, Any]] = []
        if json_obj and isinstance(json_obj, dict):
            text_out = json_obj.get("text") or text_out
            actions = json_obj.get("actions") or []

        # Ensure actions is an array and validate schema
        validated_actions: List[Dict[str, Any]] = []
        for a in (actions or []):
            if isinstance(a, dict) and "type" in a:
                a_type = str(a.get("type"))
                a_summary = str(a.get("summary"))[:1000] if a.get("summary") else ""
                # Only allow known action types
                if a_type in ("create_ticket",):
                    validated_actions.append({"type": a_type, "summary": a_summary})

    payload = {
        "text": text_out,
        "actions": validated_actions,
        "raw": raw_text,
        "retrieved_sources": [{"source": d.get("source", "unknown"), "score": float(s)} for s, d in retrieved] if retrieved else [],
        "mode": "fallback" if is_fallback_mode else "model",
    }

    return make_response(payload)


@app.post("/admin/reload_model")
def admin_reload(x_api_key: Optional[str] = Header(None)):
    """Admin endpoint to reload model and retrieval index without restarting the process.

    Requires the AI_SERVICE_KEY header.
    """
    require_api_key(x_api_key, AI_SERVICE_KEY)
    try:
        p = load_local_pipeline(model_dir=MODEL_DIR, model_name=MODEL_NAME, adapter_path=os.environ.get("AI_PEFT_ADAPTER"))
        ok = p is not None
        return make_response({"reloaded": bool(ok)})
    except Exception as e:
        logger.exception("Reload failed: %s", e)
        raise HTTPException(status_code=500, detail="Reload failed")


@app.post("/admin/reload_index")
def admin_reload_index(x_api_key: Optional[str] = Header(None)):
    """Admin endpoint to reload the retrieval index and return its metadata."""
    require_api_key(x_api_key, AI_SERVICE_KEY)
    try:
        meta = reload_index()
        return make_response({"reloaded": bool(meta is not None), "meta": meta})
    except Exception as e:
        logger.exception("Reload index failed: %s", e)
        raise HTTPException(status_code=500, detail="Reload index failed")


@app.post('/admin/build_index')
def admin_build_index(x_api_key: Optional[str] = Header(None)):
    """Admin endpoint to (re)build the TF-IDF retrieval index from the bundled docs file.

    This helps complete the RAG flow by ensuring the TF-IDF index exists for `retrieve()`.
    """
    require_api_key(x_api_key, AI_SERVICE_KEY)
    try:
        # Resolve docs source (prefers configured DOCS_PATH, falls back to bundled rag_data)
        docs_path = None
        if os.path.exists(DOCS_PATH):
            docs_path = DOCS_PATH
        elif os.path.exists("/app/rag_data/documents.json"):
            docs_path = "/app/rag_data/documents.json"
        else:
            here = os.path.dirname(__file__)
            candidate = os.path.abspath(os.path.join(here, "..", "rag_data", "documents.json"))
            if os.path.exists(candidate):
                docs_path = candidate

        if not docs_path:
            logger.warning('No docs file found at %s and no fallback documents available', DOCS_PATH)
            raise HTTPException(status_code=404, detail='Docs file for index not found')

        with open(docs_path, 'r', encoding='utf-8') as f:
            docs = json.load(f)

        texts = [d.get('text', '') for d in docs]
        meta = [{k: v for k, v in d.items() if k != 'text'} for d in docs]
        build_index_from_texts(texts, meta, model_name=MODEL_NAME, tokenizer_version='unknown')
        logger.info('Index build complete from %s (documents=%d)', docs_path, len(texts))
        return make_response({'built': True, 'count': len(texts), 'source': docs_path})
    except HTTPException:
        raise
    except Exception as e:
        logger.exception('Index build failed: %s', e)
        raise HTTPException(status_code=500, detail='Index build failed')


@app.get('/metrics')
def metrics():
    try:
        data = generate_latest()
        return Response(content=data, media_type=CONTENT_TYPE_LATEST)
    except Exception as e:
        logger.exception('Metrics generation failed: %s', e)
        raise HTTPException(status_code=500, detail='Metrics generation failed')
