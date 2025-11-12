# Trek Tribe AI Chatbot Training

This directory contains the training script and requirements for Trek Tribe's AI chatbot.

## Prerequisites

- Python 3.8 or higher
- pip package manager
- (Optional) CUDA-capable GPU for faster training

## Setup

1. **Install Python dependencies:**
   ```bash
   cd services/api/scripts
   pip install -r requirements-ai.txt
   ```

2. **Verify training data exists:**
   The training data should be located at:
   ```
   services/api/src/data/ai_training_data.json
   ```

## Training the Model

### Basic Training
```bash
python train_ai_bot.py
```

This will:
- Load the training data from `ai_training_data.json`
- Fine-tune the DialoGPT model on Trek Tribe conversations
- Save the trained model to `services/api/models/trek_ai_bot/`
- Test the model with sample queries

### Training Options

- **CPU Training:** By default, uses CPU (slower but works everywhere)
- **GPU Training:** Automatically detects and uses CUDA if available (much faster)

### Test Existing Model
```bash
python train_ai_bot.py --test
```

## Training Configuration

You can modify these parameters in `train_ai_bot.py`:

```python
MODEL_NAME = "microsoft/DialoGPT-small"  # Base model
EPOCHS = 3                                # Training epochs
BATCH_SIZE = 4                            # Batch size
LEARNING_RATE = 5e-5                      # Learning rate
MAX_LENGTH = 512                          # Max sequence length
```

## Training Output

The trained model will be saved to:
```
services/api/models/trek_ai_bot/
├── config.json
├── pytorch_model.bin
├── tokenizer_config.json
├── vocab.json
├── merges.txt
└── training_metadata.json
```

## Integrate with API

After training, the model is automatically available to the API through:
```
/api/ai/chat
/api/recommendations
```

The AI service will load the model from `services/api/models/trek_ai_bot/`.

## Training Time Estimates

- **CPU (no GPU):** ~20-30 minutes for 40 conversations
- **GPU (CUDA):** ~5-10 minutes for 40 conversations

## Troubleshooting

### Out of Memory
Reduce `BATCH_SIZE` to 2 or 1 in the script.

### CUDA Not Found
Install PyTorch with CUDA support:
```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
```

### Import Errors
Ensure all dependencies are installed:
```bash
pip install -r requirements-ai.txt
```

## Updating Training Data

To improve the chatbot:

1. Edit `services/api/src/data/ai_training_data.json`
2. Add more conversations to the `conversations` array
3. Re-run the training script
4. The API will automatically use the new model

## Model Architecture

- **Base Model:** microsoft/DialoGPT-small
- **Fine-tuning:** Causal language modeling on travel conversations
- **Special Tokens:** `<|user|>` and `<|bot|>` for conversation structure
- **Max Length:** 512 tokens

## Performance

The model is optimized for:
- Friendly, conversational responses
- Travel and trekking domain knowledge
- Trek Tribe platform features
- Budget and preference-based recommendations

## Support

For issues or questions about AI training, contact the development team.
