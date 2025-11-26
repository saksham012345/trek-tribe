Local GPT-2 + LoRA (PEFT) guide
================================

This document explains how to run a local GPT-2 model for inference and how to fine-tune a LoRA adapter on site documents so answers are site-specific. The repo already includes TF-IDF retrieval (RAG) and an ingestion script.

1) Install dependencies
-----------------------
From the `ai-service` directory run the following command to install Python dependencies:

```
cd C:\Users\hp\Development\trek-tribe\ai-service
python -m pip install -r requirements.txt
```

2) Build TF-IDF index (already provided)
----------------------------------------
Run the ingester which splits site docs into passages and saves the TF-IDF index:

```
python .\scripts\ingest_site_docs.py ..
```

3) Run a local GPT-2 model for inference
-----------------------------------------
Set environment variables and start uvicorn (service will prefer local transformers model):

```
cd ai-service
set PYTHONPATH=.
set AI_SERVICE_KEY=dev-ai-key-123
set AI_MODEL_NAME=gpt2
set AI_PEFT_ADAPTER=
uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level info
```

Then test the generate endpoint (PowerShell):

```
Invoke-RestMethod -Uri http://localhost:8000/generate -Method Post -Body (ConvertTo-Json @{ prompt = 'Explain Trek-Tribe in one sentence.'; max_tokens = 60 }) -ContentType 'application/json' -Headers @{ 'x-api-key' = 'dev-ai-key-123' } | ConvertTo-Json -Depth 5
```

4) Fine-tune a LoRA adapter on site docs
---------------------------------------
This will train a lightweight adapter and save it under `ai-service/models/lora_adapter` (or a path you choose):

```
python .\scripts\train_lora.py --base_model gpt2 --output_dir ../models/lora_adapter --epochs 2 --per_device_train_batch_size 2
```

Notes:
- Training on CPU is possible but slow. Use a machine with a CUDA GPU for practical speeds.
- You can adjust `--per_device_train_batch_size` and `--epochs` to fit resources.

5) Use the trained adapter during inference
------------------------------------------
Start the service with `AI_PEFT_ADAPTER` pointing to the adapter directory created above. The service will attempt to load the adapter and generate using the base model + adapter.

6) Connect frontend chat widget
-------------------------------
- The frontend `AIChatWidget` posts to the backend proxy at `/api/ai/generate`. Ensure the backend (`services/api`) is running and its `AI_SERVICE_URL` points to `http://localhost:8000` (or appropriate host).
- The backend proxy will forward requests to the local AI service (and the AI service will use TF-IDF retrieval results + local model generation).

7) Improvements you can make (recommendations)
---------------------------------------------
- Use embeddings + FAISS instead of TF-IDF for better retrieval quality.
- Use `gpt2-medium` for better generation (if CPU time acceptable) or a small GPU to run larger models.
- Add prompt templates and a token-budgeted context appender so retrieved passages don't exceed model limits.
- Use LoRA/PEFT with higher-quality base models for best results.

If you want, I can:
- Start a quick local test that loads `gpt2` and shows sample outputs (may be slow here), or
- Prepare a script to convert the TF-IDF passages into a prompt template optimized for GPT-2, or
- Add a small endpoint that returns the retrieval results (for debugging) so the frontend can show which passages were used.
