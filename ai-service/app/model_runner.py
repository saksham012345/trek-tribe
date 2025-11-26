"""Model runner that loads a local HF model and generates with token-aware truncation.

Key behaviors:
- Load tokenizer and model from `MODEL_DIR` (local_files_only=True).
- Provide `generate()` that will truncate inputs to respect model max context.
- Optional PEFT adapter support if `peft` is available and configured.
"""
from typing import Optional
import logging
import os

from . import config

logger = logging.getLogger("ai-service.model_runner")

_pipeline = None
_tokenizer = None
_model = None
_model_loaded = False


class FallbackGenerator:
    def generate(self, prompt: str, max_tokens: int = 64) -> str:
        safe = (prompt or "").strip()
        if not safe:
            return ""
        snippet = safe[: max(40, min(300, len(safe)))]
        return f"[fallback] {snippet}"


def _detect_model_max_length(model) -> int:
    # Handle several config attribute names across HF models
    for attr in ("n_positions", "n_ctx", "max_position_embeddings", "context_length"):
        val = getattr(model.config, attr, None)
        if isinstance(val, int) and val > 0:
            return val
    # conservative default
    return 1024


def load_local_pipeline(model_dir: Optional[str] = None, model_name: Optional[str] = None, adapter_path: Optional[str] = None):
    """Load tokenizer/model pipeline from local files and set globals."""
    global _pipeline, _tokenizer, _model, _model_loaded
    if _pipeline is not None:
        return _pipeline

    try:
        from transformers import AutoTokenizer, AutoModelForSeq2SeqLM, pipeline
        try:
            # PEFT optional
            from peft import PeftModel
            _peft_available = True
        except Exception:
            PeftModel = None
            _peft_available = False

        model_path = model_dir or model_name or config.MODEL_DIR or config.MODEL_NAME

        # Guardrail: disallow obvious GPT-2 defaults when instruction tuning is expected
        if config.MODEL_INSTRUCTION_TUNED and "gpt2" in (model_path or "").lower():
            raise RuntimeError("Configured MODEL_NAME appears to be GPT-2 while MODEL_INSTRUCTION_TUNED=true; please use an instruction-tuned model like google/flan-t5-base")

        logger.info("Loading tokenizer from %s", model_path)
        tokenizer = AutoTokenizer.from_pretrained(model_path, use_fast=True, local_files_only=True)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token

        logger.info("Loading model from %s (local only)", model_path)
        model = AutoModelForSeq2SeqLM.from_pretrained(model_path, low_cpu_mem_usage=True, local_files_only=True)

        if adapter_path and _peft_available:
            try:
                logger.info("Loading PEFT adapter from %s", adapter_path)
                model = PeftModel.from_pretrained(model, adapter_path)
            except Exception as e:
                logger.warning("Failed to load PEFT adapter %s: %s", adapter_path, e)

        # Create CPU text2text pipeline for instruction-tuned seq2seq models
        pipe = pipeline("text2text-generation", model=model, tokenizer=tokenizer, device=-1)

        _pipeline = pipe
        _tokenizer = tokenizer
        _model = model
        _model_loaded = True
        # expose model max length
        _model.max_length = _detect_model_max_length(model)
        logger.info("Local pipeline loaded, model max_length=%s", _model.max_length)
        return _pipeline

    except Exception as e:
        logger.exception("Failed to load local model pipeline: %s", e)
        _pipeline = None
        _tokenizer = None
        _model = None
        _model_loaded = False
        return None


def is_model_loaded() -> bool:
    return _model_loaded


def get_model_max_length() -> int:
    if _model is not None:
        return getattr(_model, "max_length", 1024)
    return 1024


def _truncate_by_tokens(text: str, max_input_tokens: int) -> str:
    if not _tokenizer:
        # fallback to char truncation
        return text[- (max_input_tokens * 3) :]
    toks = _tokenizer.encode(text, add_special_tokens=False)
    if len(toks) <= max_input_tokens:
        return text
    # keep last tokens (most recent context)
    keep = toks[-max_input_tokens:]
    return _tokenizer.decode(keep, skip_special_tokens=True, clean_up_tokenization_spaces=True)


def count_tokens(text: str) -> int:
    """Return token count for given text using loaded tokenizer if available.

    Falls back to a rough character-based estimate if tokenizer not loaded.
    """
    if _tokenizer:
        try:
            toks = _tokenizer.encode(text, add_special_tokens=False)
            return len(toks)
        except Exception:
            pass
    # rough heuristic: 4 chars per token
    return max(0, int(len(text) / 4))


def generate(prompt: str, max_tokens: int = 64, model_dir: Optional[str] = None, model_name: Optional[str] = None, **gen_kwargs) -> str:
    """Generate text using the local pipeline with token-aware truncation.

    gen_kwargs are forwarded to the transformers pipeline (e.g., temperature, top_k).
    """
    if config.MODEL_LOCAL_ENABLED:
        try:
            adapter = config.AI_PEFT_ADAPTER
            p = load_local_pipeline(model_dir or config.MODEL_DIR, model_name or config.MODEL_NAME, adapter_path=adapter)
            if p is not None:
                model_max = get_model_max_length()
                # Reserve space for new tokens and safety margin
                reserve = int(max_tokens) + 16
                allowed = max(1, min(config.AI_MAX_INPUT_TOKENS, model_max - reserve))
                prompt_trunc = _truncate_by_tokens(prompt, allowed)

                params = {
                    "max_new_tokens": int(max_tokens),
                    "do_sample": gen_kwargs.get("do_sample", True),
                    "top_k": gen_kwargs.get("top_k", 50),
                    "top_p": gen_kwargs.get("top_p", 0.95),
                    "temperature": gen_kwargs.get("temperature", 0.8),
                }
                # allow override
                params.update({k: v for k, v in gen_kwargs.items() if k not in params})

                out = p(prompt_trunc, **params)
                if isinstance(out, list) and len(out) > 0 and "generated_text" in out[0]:
                    return out[0]["generated_text"]
                return str(out)
        except Exception as e:
            logger.exception("Local generation failed: %s", e)

    return FallbackGenerator().generate(prompt, max_tokens)


__all__ = ["generate", "is_model_loaded", "load_local_pipeline", "get_model_max_length", "count_tokens"]
