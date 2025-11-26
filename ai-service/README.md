# AI Service (FastAPI) - Overview

This small FastAPI microservice provides a `/generate` endpoint for text generation. It supports two modes:

- Local model mode: install `transformers` and `torch` and the service will try to load `distilgpt2` for CPU generation (demo-grade only).
- Fallback stub: if heavy ML dependencies are not installed the service will run a deterministic fallback generator for development and testing.

Files:
- `app/main.py` - FastAPI app with endpoints `POST /generate`, `GET /health`, `GET /ready`.
- `app/model_runner.py` - tries to load a HF model (distilgpt2) if available, else uses a fallback.
- `app/config.py` - environment-based configuration.
- `app/utils.py` - shared helpers (api key checking, response shapes).
- `Dockerfile` - container image for deployment.
- `requirements.txt` - minimal Python dependencies (FastAPI + Uvicorn). Commented notes for optional ML deps.

Security:
- Set `AI_SERVICE_KEY` environment variable to a strong secret and include it in requests as header `x-api-key`.
- The microservice should be deployed inside a private network or behind an API gateway. For public deployments, enable TLS and rate-limiting.

Quick start (dev, fallback mode):

```powershell
cd ai-service
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

To enable local HF model generation (CPU):

```powershell
pip install transformers torch
# then restart the service; model loads on first request
```

Docker build (recommended for deployment):

```powershell
docker build -t trek-tribe-ai:latest ./ai-service
docker run --env AI_SERVICE_KEY=yourkey -p 8000:8000 trek-tribe-ai:latest
```

RAG / Fine-tuning and model guidance
------------------------------------

- RAG (Retrieval-Augmented Generation): add a service that indexes documents (e.g. embeddings stored in a vector store such as Milvus, Pinecone, or Weaviate). Implement an endpoint `/retrieve` that returns the top-K documents for a query; combine them with the user's prompt (or use them as context) before calling `/generate`.
- Fine-tuning: for production-quality domain adaptation, either:
	- Use a hosted finetuning API (OpenAI/Hugging Face) to avoid managing heavy GPU infra, or
	- Maintain a training pipeline (PyTorch + Hugging Face Trainer) that runs on GPU instances and writes model artifacts. Update `model_runner` to load the fine-tuned model path.

Model recommendations
---------------------
- Dev/demo (no GPU): `distilgpt2` — very small and fast; OK for demos and tests but low-quality output.
- Small local model (better): `gpt2-medium` or `gpt2-large` — better than distil; requires more RAM and CPU.
- Modern compact models (recommended production via hosted API): Mistral / Llama-2-7B quantized. For production UX, prefer a hosted inference API (OpenAI or Hugging Face Inference) unless you can manage GPU/quantized inference runtimes.

Next steps and integration checklist
----------------------------------
- Add the backend proxy route to `services/api` and put the AI service URL + `AI_SERVICE_KEY` in backend env.
- Add the frontend widget and route the client to `services/api` proxy.
- Add a CI smoke test that builds the image and hits `/health` and `/generate` in fallback mode.

