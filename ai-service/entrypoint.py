import os
import sys
import subprocess
import time
from pathlib import Path

# Ensure we're in the correct working directory
os.chdir('/app')

MODEL_DIR = os.environ.get("MODEL_DIR") or f"/app/models/{os.environ.get('MODEL_NAME','google/flan-t5-base').replace('/','_')}"
DATA_DIR = os.environ.get("AI_DATA_DIR") or os.environ.get("DATA_DIR") or "/app/data"

# Ensure directories
Path(MODEL_DIR).mkdir(parents=True, exist_ok=True)
Path(DATA_DIR).mkdir(parents=True, exist_ok=True)

# Download model at first boot if not present
def model_installed(model_dir: str) -> bool:
    # heuristic: presence of tokenizer.json or config.json
    p = Path(model_dir)
    return any(p.glob('tokenizer.json')) or any(p.glob('config.json')) or any(p.glob('*.bin')) or any(p.glob('*.safetensors'))

if not model_installed(MODEL_DIR):
    print(f"Model not present in {MODEL_DIR}. Attempting runtime download...")
    rc = subprocess.call([sys.executable, "download_model.py"], env=os.environ)
    if rc != 0:
        print("Model download failed (non-zero exit). Continuing — service may fallback.")

# Build retrieval index if missing
index_path = os.path.join(DATA_DIR, 'tfidf_index.pkl')
if not os.path.exists(index_path):
    print("Retrieval index not found — attempting to run ingestion to build index...")
    try:
        subprocess.call([sys.executable, "./scripts/ingest_site_docs.py", "."])
    except Exception as e:
        print("Ingestion failed:", e)

# Start uvicorn server directly
PORT = os.environ.get('PORT','8000')
print(f"Starting uvicorn server on port {PORT}")
print(f"Command: uvicorn app.main:app --host 0.0.0.0 --port {PORT} --log-level info --workers 1")

# Use subprocess instead of os.execvp for better logging
try:
    result = subprocess.run([
        sys.executable, "-m", "uvicorn",
        "app.main:app",
        "--host", "0.0.0.0",
        "--port", str(PORT),
        "--log-level", "info",
        "--workers", "1"
    ], check=True)
    sys.exit(result.returncode)
except FileNotFoundError as e:
    print(f"ERROR: Could not find uvicorn: {e}", file=sys.stderr)
    sys.exit(1)
except subprocess.CalledProcessError as e:
    print(f"ERROR: uvicorn exited with code {e.returncode}", file=sys.stderr)
    sys.exit(e.returncode)
except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
