FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    MODEL_NAME=google/flan-t5-base \
    MODEL_DIR=/app/models/google_flan-t5-base \
    MODEL_LOCAL_ENABLED=true \
    PORT=8000

WORKDIR /app

# System deps for transformers/torch (minimal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential git curl ca-certificates libgomp1 && \
    rm -rf /var/lib/apt/lists/*

# Copy requirements first for layer caching
COPY requirements.txt /app/requirements.txt

# Install Python deps; prefer CPU torch wheels when available
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r /app/requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu

# Copy application sources
COPY . /app

# Make entrypoint scripts executable
RUN chmod +x /app/entrypoint.py /app/docker-entrypoint.sh

EXPOSE 8000

# Use shell script wrapper to ensure proper execution
ENTRYPOINT ["/app/docker-entrypoint.sh"]
