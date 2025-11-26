import os
import sys
import subprocess
import time
from pathlib import Path

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

# Exec uvicorn with passed PORT or default
PORT = os.environ.get('PORT','8000')
print(f"Starting uvicorn on port {PORT}")
args = ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", PORT, "--log-level", "info", "--workers", "1"]
os.execvp("uvicorn", args)
