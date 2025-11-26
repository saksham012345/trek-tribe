import os


# AI service key required by backend proxy to call this service
AI_SERVICE_KEY = os.environ.get("AI_SERVICE_KEY") or os.environ.get("AI_KEY") or ""

# Local model configuration
# MODEL_LOCAL_ENABLED: set to 'true' to force local-only inference
# Whether the model is instruction tuned (helps guide model selection)
MODEL_INSTRUCTION_TUNED = os.environ.get("MODEL_INSTRUCTION_TUNED", "true").lower() in ("1", "true", "yes")

# Local model enabled
MODEL_LOCAL_ENABLED = os.environ.get("MODEL_LOCAL_ENABLED", "true").lower() in ("1", "true", "yes")
# Default to an instruction-tuned model by default
MODEL_NAME = os.environ.get("MODEL_NAME") or os.environ.get("AI_MODEL_NAME") or "google/flan-t5-base"
# Local directory where the model will be downloaded (download_model.py writes here)
MODEL_DIR = os.environ.get("MODEL_DIR") or os.environ.get("MODEL_PATH") or f"/app/models/{MODEL_NAME}"

# Directory where retrieval index and docs are stored
DATA_DIR = os.environ.get("AI_DATA_DIR") or os.environ.get("DATA_DIR") or "/app/data"

# Optional PEFT adapter path (local path where adapter is saved)
AI_PEFT_ADAPTER = os.environ.get("AI_PEFT_ADAPTER") or os.environ.get("PEFT_ADAPTER") or None

# Optional Redis URL for rate limiting and distributed locks (e.g. redis://:pass@host:6379/0)
REDIS_URL = os.environ.get("REDIS_URL") or os.environ.get("REDIS_HOST") or None

# Other runtime tuning
MAX_GENERATION_TOKENS = int(os.environ.get("MAX_GENERATION_TOKENS", "256"))
# Enforce presence of API key in production (set REQUIRE_API_KEY=false to disable)
REQUIRE_API_KEY = os.environ.get("REQUIRE_API_KEY", "true").lower() in ("1", "true", "yes")

# Generation timeout (seconds)
AI_GEN_TIMEOUT = int(os.environ.get("AI_GEN_TIMEOUT", "50"))

# Rate limiting (requests per window)
AI_RATE_LIMIT = int(os.environ.get("AI_RATE_LIMIT", "20"))
AI_RATE_WINDOW = int(os.environ.get("AI_RATE_WINDOW", "60"))

# Max input tokens to send to model (conservative default for GPT-2 context ~1024)
AI_MAX_INPUT_TOKENS = int(os.environ.get("AI_MAX_INPUT_TOKENS", "800"))


def validate_environment(raise_on_error: bool = False) -> bool:
	"""Validate critical environment variables and warn/raise on misconfiguration.

	- Ensures API key length if REQUIRE_API_KEY is enabled
	- Warns or rejects use of insecure default model `gpt2`
	"""
	errors = []
	if REQUIRE_API_KEY and (not AI_SERVICE_KEY or len(AI_SERVICE_KEY) < 32):
		errors.append("AI_SERVICE_KEY must be set and at least 32 characters when REQUIRE_API_KEY=true")

	# warn/error on GPT-2 usage
	if "gpt2" in (MODEL_NAME or "").lower():
		# GPT-2 is not instruction-tuned nor ideal for structured JSON outputs
		msg = f"MODEL_NAME='{MODEL_NAME}' looks like GPT-2; this is discouraged. Use an instruction-tuned model like google/flan-t5-base."
		errors.append(msg)

	if errors and raise_on_error:
		raise RuntimeError("; ".join(errors))
	return len(errors) == 0

# Proxy/backend timeout for requests to this service
AI_PROXY_TIMEOUT_MS = int(os.environ.get("AI_PROXY_TIMEOUT_MS", "120000"))
