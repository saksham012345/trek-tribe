#!/usr/bin/env python3
"""Download a Hugging Face model and save to a local directory.

Usage:
  MODEL_NAME=gpt2-medium python download_model.py
  or set MODEL_DIR to override where to save
"""
import os
import sys
import logging
#!/usr/bin/env python3
"""Download a Hugging Face model into the ai-service MODEL_DIR.

This script respects `MODEL_NAME` and `MODEL_DIR` env vars. After downloading
the model it will optionally run the ingestion script to build the TF-IDF index
so the Docker image can ship with a ready-to-use retrieval index.
"""
import os
import sys
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("download_model")

# Prefer env vars
MODEL = os.environ.get("MODEL_NAME") or os.environ.get("AI_MODEL_NAME") or os.environ.get("MODEL", "gpt2")
MODEL_DIR = os.environ.get("MODEL_DIR") or os.environ.get("MODEL_PATH") or f"/app/models/{MODEL}"


def main():
    try:
        from transformers import AutoTokenizer, AutoModelForCausalLM
    except Exception as e:
        logger.error("transformers not installed: %s", e)
        sys.exit(2)

    dest = Path(MODEL_DIR)
    dest.mkdir(parents=True, exist_ok=True)

    # Allow HF token for private models
    hf_token = os.environ.get("HUGGINGFACE_TOKEN") or os.environ.get("HF_TOKEN")
    use_auth = {"use_auth_token": hf_token} if hf_token else {}

    logger.info("Downloading tokenizer for %s -> %s", MODEL, dest)
    tokenizer = AutoTokenizer.from_pretrained(MODEL, use_fast=True, **(use_auth or {}))
    tokenizer.save_pretrained(dest)

    logger.info("Downloading model weights for %s -> %s", MODEL, dest)
    # Multiple attempts to reduce transient network failures
    attempts = int(os.environ.get("MODEL_DOWNLOAD_ATTEMPTS", "3"))
    for i in range(attempts):
        try:
            model = AutoModelForCausalLM.from_pretrained(MODEL, **(use_auth or {}))
            model.save_pretrained(dest)
            logger.info("Model downloaded to %s", dest)
            break
        except Exception as e:
            logger.warning("Attempt %s/%s failed: %s", i + 1, attempts, e)
            if i == attempts - 1:
                logger.error("Failed to download model after %s attempts", attempts)
                raise

    # Optionally run ingestion to build TF-IDF index into /app/data
    try:
        ingest_script = Path(__file__).parent / 'scripts' / 'ingest_site_docs.py'
        if ingest_script.exists():
            logger.info("Running ingestion to build retrieval index...")
            import subprocess
            subprocess.check_call([sys.executable, str(ingest_script), '..'])
            logger.info("Ingestion complete")
    except Exception as e:
        logger.warning("Ingestion step failed: %s", e)


if __name__ == "__main__":
    main()
