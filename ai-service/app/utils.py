from typing import Dict, Any
from fastapi import HTTPException
import logging
from . import config

logger = logging.getLogger("ai-service.utils")


def _mask_secret(s: str) -> str:
    try:
        secret = config.AI_SERVICE_KEY
        if secret and secret in s:
            return s.replace(secret, '***REDACTED***')
        return s
    except Exception:
        return s


def require_api_key(provided: str, expected: str):
    """Validate the provided API key against expected value.

    If no expected key is configured, allow (insecure mode) but log a warning.
    Enforce minimum length of 32 characters for provided keys when expected is set.
    """
    if not expected:
        # No key configured; treat as insecure mode (not recommended)
        logger.warning("AI service running without an API key configured; this is insecure.")
        return
    if not provided:
        logger.warning("Missing x-api-key header")
        raise HTTPException(status_code=401, detail="Missing x-api-key header")
    if len(provided) < 32:
        logger.warning("x-api-key header too short or malformed: %s", _mask_secret(str(provided)))
        raise HTTPException(status_code=403, detail="Invalid API key")
    if provided != expected:
        logger.warning("Invalid x-api-key header provided: %s", _mask_secret(str(provided)))
        raise HTTPException(status_code=403, detail="Invalid API key")


def make_response(obj: Any) -> Dict:
    """Normalize response payloads: accept string or dict and return dict.

    This helps keep the HTTP responses consistent between fallback and full outputs.
    """
    if isinstance(obj, str):
        return {"text": obj}
    if isinstance(obj, dict):
        return obj
    try:
        return {"text": str(obj)}
    except Exception:
        return {"text": ""}


def normalize_error(exc: Exception) -> Dict:
    try:
        msg = str(exc)
        msg = _mask_secret(msg)
        return {"ok": False, "error": msg}
    except Exception:
        return {"ok": False, "error": "unknown_error"}
